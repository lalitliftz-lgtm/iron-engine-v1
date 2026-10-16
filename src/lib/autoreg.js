/* Iron Engine — Autoregulation layer (Lalit Lifts Powerlifting System 2.0, Ch 8 + Ch 10)
 * Pure functions, no imports from the DOM. Used by the API and the dashboard.
 *
 *   trafficLight(checkin)            → green / yellow / red (Ch 10 weekly fatigue checklist)
 *   liftDecisions(weekPlan, logs)    → per main lift: what last week's RPE/misses say about next week (Ch 8 matrix)
 *   nextWeekAdjustment(...)          → the overlay stored on the program and applied to the next week
 *   applyAdjustments(snapshot)       → snapshot with the overlays applied (kg recomputed, notes added)
 *   evaluateBlock(snapshot, logs)    → block-end verdict + e1RM trend (Ch 8/9: advance / repeat lighter / repeat less volume)
 *   attemptPlan(maxes, logs, exp)    → opener / 2nd / 3rd per lift in kg (Ch 16; illustrative %, adjusted by recent singles)
 */
import { round25, epley, rpeFor, LIFT_NAMES } from "./engine.js";

const LIFTS = ["squat", "bench", "deadlift"];
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const rpeOf = (rpeStr) => { const m = String(rpeStr ?? "").match(/\d+(\.\d+)?/g); return m ? Number(m[m.length - 1]) : null; }; // "RPE 5–6" → 6
/** Competition-lift work the matrix steers (not technique/speed, activation, singles or variations). */
const NOT_STEERED = /Technique|Activation|single|commands|Paused|Variation|Box|Pin|Deficit|Tempo|Spoto|Close|Larsen|Block|Front|Belt|Slingshot|Floor|Feet/i;

/* ---------------- 7a. Weekly check-in → traffic light (Ch 10) ---------------- */
/** @param c { sleepHours, soreness(0-10), mood: 'pos'|'neu'|'neg', motivation: 'high'|'mid'|'low', pain: boolean, painWhere?: string, rhrUp?: boolean } */
export function trafficLight(c) {
  const sleep = num(c.sleepHours) ?? 7;
  const sore = num(c.soreness) ?? 4;
  const red = [];
  const yellow = [];
  if (sleep < 6) red.push("sleep under 6 h"); else if (sleep < 7) yellow.push("sleep 6–7 h");
  if (sore >= 8) red.push(`soreness ${sore}/10`); else if (sore >= 6) yellow.push(`soreness ${sore}/10`);
  if (c.mood === "neg") red.push("mood negative"); else if (c.mood === "neu") yellow.push("mood flat");
  if (c.motivation === "low") red.push("motivation low"); else if (c.motivation === "mid") yellow.push("motivation moderate");
  if (c.pain) (c.painPersistent ? red : yellow).push(`${c.painPersistent ? "persistent " : "minor "}${c.painWhere || "joint"} pain`);
  if (c.rhrUp) red.push("resting heart rate up 5+ bpm");
  // Ch 10: one red-light sign is a warning; two or more = deload now. Yellow signs stack into caution.
  const light = red.length >= 2 ? "red" : red.length === 1 || yellow.length >= 2 ? "yellow" : "green";
  const reason = {
    green: "Green light — recovery is on track. Train the plan as written.",
    yellow: `Yellow light (${[...red, ...yellow].join(", ")}) — train, but RPE 6–7, one set less on the main lifts, nothing new this week.`,
    red: `Red light (${red.join(", ")}) — deload NOW, don't wait for the planned week. Volume −50%, loads 60–70%, accessories light. Sleep is the first fix.`,
  }[light];
  return { light, reason, signs: [...red, ...yellow] };
}

/* ---------------- 7b. Load decision matrix per lift (Ch 8) ---------------- */
/** Collect, per lift, what was logged for a week: planned RPE, max logged RPE, missed reps, pain. */
export function weekLiftSummary(weekPlan, logs) {
  const out = {};
  for (const l of LIFTS) out[l] = { planned: 0, sessions: 0, maxRpe: null, maxOver: null, minOver: null, targetRpe: null, missed: 0, pain: false, cleanSets: 0, topKg: 0 };
  // planned RPE per exercise comes from the snapshot week (the log may be older than the current overlay)
  const planRpe = {};
  for (const d of weekPlan?.days || []) for (const e of d.exercises || []) if (e.type === "Main") planRpe[`${d.day}|${e.name}`] = rpeOf(e.rpe);
  for (const log of logs) {
    for (const ex of log.logged_exercises || []) {
      if (ex.type !== "Main" || !ex.lift || ex.skipped || NOT_STEERED.test(ex.name)) continue;
      const s = out[ex.lift];
      s.sessions++;
      const target = rpeOf(ex.rpe) ?? planRpe[`${log.day_number}|${ex.name}`] ?? 8;
      if (s.targetRpe === null || target > s.targetRpe) s.targetRpe = target; // the heaviest slot defines the lift's week
      const targetReps = parseInt(String(ex.reps), 10) || null;
      for (const set of ex.loggedSets || []) {
        if (!set.completed) continue;
        s.planned++;
        const r = num(set.rpe);
        if (r !== null) {
          s.maxRpe = s.maxRpe === null ? r : Math.max(s.maxRpe, r);
          const over = r - target;
          s.maxOver = s.maxOver === null ? over : Math.max(s.maxOver, over);
          s.minOver = s.minOver === null ? over : Math.min(s.minOver, over);
        }
        const reps = num(set.reps);
        if (targetReps && reps !== null && reps < targetReps) s.missed++; else s.cleanSets++;
        if (set.pain) s.pain = true;
        const kg = num(set.weight) || 0;
        if (kg > s.topKg) s.topKg = kg;
      }
    }
  }
  return out;
}

/** Ch 8 decision matrix. Returns per lift { action, deltaPct, deltaKg, setDelta, rpeCap, reason }. */
export function liftDecisions(weekPlan, logs, light = "green", missHistory = {}) {
  const sum = weekLiftSummary(weekPlan, logs);
  const out = {};
  for (const l of LIFTS) {
    const s = sum[l];
    const benchInc = l === "bench" ? 1.25 : 2.5;
    const d = { action: "same", deltaPct: 0, deltaKg: 0, setDelta: 0, rpeCap: null, reason: "" };
    const target = s.targetRpe ?? 8;
    if (!s.sessions) { d.action = "same"; d.reason = `${LIFT_NAMES[l]}: not logged last week — plan unchanged. Log it so the engine can steer.`; }
    else if (s.missed >= 1 && (missHistory[l] || 0) >= 1) { d.action = "reset"; d.deltaPct = -10; d.reason = `${LIFT_NAMES[l]}: reps missed two weeks in a row → −10% and a lighter week (Ch 8: second miss = reset, not push).`; }
    else if (s.missed >= 1) { d.action = "repeat"; d.reason = `${LIFT_NAMES[l]}: reps missed → repeat the same load next week; earn it before adding.`; }
    else if (s.pain) { d.action = "pain"; d.deltaPct = -5; d.rpeCap = 7; d.reason = `${LIFT_NAMES[l]}: pain logged → −5%, RPE 7 cap. Pain twice in a row = tell the engine (injury flag) before the next block.`; }
    else if (s.maxRpe === null) { d.action = "same"; d.reason = `${LIFT_NAMES[l]}: sets done but no RPE logged — plan unchanged. Log RPE and the engine adjusts the kg for you.`; }
    else if (s.maxRpe >= 9.5 || s.maxOver >= 1.5) { d.action = "down"; d.deltaPct = -5; d.reason = `${LIFT_NAMES[l]}: RPE ran ${s.maxRpe} vs ${target} planned (grind) → −5% next week. Fatigue is accumulating.`; }
    else if (s.maxOver >= 1) { d.action = "same"; d.reason = `${LIFT_NAMES[l]}: RPE ${s.maxRpe}, one above plan → same load next week.`; }
    else if (s.maxOver <= -1.5) { d.action = "up2"; d.deltaKg = benchInc * 2; d.reason = `${LIFT_NAMES[l]}: RPE ${s.maxRpe} vs ${target} planned — easy → +${benchInc * 2} kg next week. You're adapting faster than the plan.`; }
    else { d.action = "up"; d.deltaKg = benchInc; d.reason = `${LIFT_NAMES[l]}: on target (RPE ${s.maxRpe}, all reps clean) → +${benchInc} kg next week.`; }
    // Traffic light overrides upward moves
    if (light === "yellow" && (d.action === "up" || d.action === "up2")) { d.action = "same"; d.deltaKg = 0; d.rpeCap = 7; d.setDelta = -1; d.reason += " Yellow light → held: same load, RPE 6–7, one set less."; }
    if (light === "yellow" && d.action === "same" && !d.rpeCap) { d.rpeCap = 7; d.setDelta = -1; }
    out[l] = { ...d, missed: s.missed, maxRpe: s.maxRpe, topKg: s.topKg };
  }
  return out;
}

/* ---------------- Overlay stored on the program ---------------- */
/** Build the overlay for `nextWeek` from the check-in + lift decisions. */
export function nextWeekAdjustment(nextWeek, light, decisions, checkinReason) {
  const adj = { week: nextWeek, light, deload: light === "red", lifts: {}, notes: [checkinReason] };
  for (const l of LIFTS) {
    const d = decisions[l];
    if (!d) continue;
    adj.lifts[l] = { deltaPct: d.deltaPct || 0, deltaKg: d.deltaKg || 0, setDelta: d.setDelta || 0, rpeCap: d.rpeCap || null, reason: d.reason };
  }
  if (light === "red") adj.notes.push("This week is a reactive deload: half the sets, 60–70% loads, accessories 2 light sets. The planned week moves to after it.");
  return adj;
}

/** Apply stored adjustments to a snapshot (never mutates the stored one). */
export function applyAdjustments(snapshot, adjustments) {
  if (!snapshot || !adjustments?.loads) return snapshot;
  const maxes = snapshot.meta?.maxes || {};
  const weeks = snapshot.weeks.map((w) => {
    const adj = adjustments.loads[String(w.week)];
    if (!adj || w.meetWeek) return w;
    const days = w.days.map((d) => ({
      ...d,
      exercises: d.exercises.map((e) => {
        if (e.type !== "Main" || !e.lift) {
          if (adj.deload && e.type === "Accessory") return { ...e, sets: Math.min(e.sets, 2), rpe: "6", note: "Deload — light" };
          return e;
        }
        const a = adj.lifts?.[e.lift] || {};
        let pct = e.pct, kg = num(e.weight), sets = e.sets, rpe = e.rpe, note = e.note;
        const tags = [];
        if (!adj.deload && NOT_STEERED.test(e.name)) return e; // technique/variation slots keep their own light loads
        if (adj.deload) {
          if (pct) { pct = Math.min(pct, 65); kg = maxes[e.lift] ? round25((pct / 100) * maxes[e.lift]) : kg; }
          else if (kg) kg = round25(kg * 0.85);
          sets = Math.max(1, Math.ceil(sets / 2)); rpe = "6"; tags.push("Reactive deload: half the sets, light load");
        } else {
          if (a.deltaPct && pct) { pct = Math.round((pct + a.deltaPct) * 2) / 2; kg = maxes[e.lift] ? round25((pct / 100) * maxes[e.lift]) : kg; tags.push(`${a.deltaPct > 0 ? "+" : ""}${a.deltaPct}%`); }
          else if (a.deltaPct && kg) { kg = round25(kg * (1 + a.deltaPct / 100)); tags.push(`${a.deltaPct}%`); }
          if (a.deltaKg && kg) { kg = round25(kg + a.deltaKg); if (maxes[e.lift]) pct = Math.round((kg / maxes[e.lift]) * 200) / 2; tags.push(`${a.deltaKg > 0 ? "+" : ""}${a.deltaKg} kg`); }
          if (a.setDelta) { sets = Math.max(1, sets + a.setDelta); tags.push(`${a.setDelta} set`); }
          if (a.rpeCap) { const cur = rpeOf(rpe); if (cur === null || cur > a.rpeCap) { rpe = String(a.rpeCap); tags.push(`RPE cap ${a.rpeCap}`); } }
        }
        if (!tags.length) return e;
        return { ...e, pct, weight: kg ?? e.weight, sets, rpe, note: [note, `Adjusted (${tags.join(", ")}) — ${a.reason || adj.notes[0] || "weekly check-in"}`].filter(Boolean).join(" · "), adjusted: true };
      }),
    }));
    return { ...w, days, adjusted: true, adjustNotes: adj.notes, light: adj.light, deload: w.deload || adj.deload };
  });
  return { ...snapshot, weeks };
}

/* ---------------- 7d. Block-end evaluation ---------------- */
/** e1RM from logged main sets (≤5 reps, RPE ≤ 8.5 → Epley with reps-in-reserve). */
export function e1rmFromLogs(logs) {
  const best = { squat: null, bench: null, deadlift: null };
  for (const log of logs) for (const ex of log.logged_exercises || []) {
    if (ex.type !== "Main" || !ex.lift || ex.skipped || NOT_STEERED.test(ex.name)) continue;
    for (const s of ex.loggedSets || []) {
      const kg = num(s.weight), reps = num(s.reps), rpe = num(s.rpe);
      if (!s.completed || !kg || !reps || reps > 5 || s.pain) continue;
      if (rpe !== null && rpe > 8.5) continue;
      const rir = rpe === null ? 2 : Math.max(0, 10 - rpe);
      const est = round25(epley(kg, reps + rir));
      if (!best[ex.lift] || est > best[ex.lift].e1rm) best[ex.lift] = { e1rm: est, from: `${kg} kg × ${reps}${rpe !== null ? ` @ RPE ${rpe}` : ""}`, date: log.date_completed };
    }
  }
  return best;
}

export function evaluateBlock(snapshot, logs, checkins = {}) {
  const planned = snapshot.weeks.reduce((n, w) => n + w.days.filter((d) => !d.meetDay).length, 0);
  const done = new Set(logs.map((l) => `${l.week_number}-${l.day_number}`)).size;
  const completion = planned ? Math.round((done / planned) * 100) : 0;
  let inRange = 0, total = 0, grinds = 0, painSets = 0;
  for (const log of logs) for (const ex of log.logged_exercises || []) {
    if (ex.type !== "Main" || !ex.lift) continue;
    const target = rpeOf(ex.rpe);
    for (const s of ex.loggedSets || []) {
      if (!s.completed) continue;
      const r = num(s.rpe); if (s.pain) painSets++;
      if (r === null || target === null) continue;
      total++; if (r <= target + 0.5) inRange++; if (r >= 9.5) grinds++;
    }
  }
  const rpeOk = total ? Math.round((inRange / total) * 100) : null;
  const reds = Object.values(checkins).filter((c) => c.light === "red").length;
  const yellows = Object.values(checkins).filter((c) => c.light === "yellow").length;
  const e1rm = e1rmFromLogs(logs);
  const oldMax = snapshot.meta?.maxes || {};
  const progressed = LIFTS.filter((l) => e1rm[l] && oldMax[l] && e1rm[l].e1rm >= oldMax[l] + 2.5);

  let verdict, reason, volumeDelta = 0, loadDelta = 0;
  if (completion < 60) { verdict = "repeat"; reason = `Only ${completion}% of sessions logged — the block never got a fair run. Same block again, same loads; finish it this time (or log the sessions you did).`; }
  else if (reds >= 2 || grinds > total * 0.3 || painSets >= 3) { verdict = "repeat-lighter"; loadDelta = -7.5; volumeDelta = -1; reason = `Struggled: ${reds ? `${reds} red-light weeks` : ""}${grinds ? ` ${grinds} grind sets` : ""}${painSets ? ` ${painSets} painful sets` : ""}. Repeat the block 5–10% lighter with one set less — do not escalate intensity on a tired body.`; }
  else if (completion >= 90 && (rpeOk === null || rpeOk >= 70) && yellows <= 1) { verdict = "advance"; reason = `${completion}% of sessions done${rpeOk !== null ? `, RPE in range ${rpeOk}% of the time` : ""}${progressed.length ? `, ${progressed.map((l) => LIFT_NAMES[l]).join("/")} e1RM up` : ""}. Move to the next phase.`; }
  else { verdict = "repeat-less-volume"; volumeDelta = -1; reason = `Mostly done (${completion}%) but fatigue showed (${yellows} yellow weeks${rpeOk !== null ? `, RPE in range only ${rpeOk}%` : ""}). Repeat a similar block with ~20% less volume.`; }
  return { verdict, reason, completion, rpeOk, grinds, painSets, reds, yellows, e1rm, progressed, volumeDelta, loadDelta };
}

/* ---------------- 8. Attempt calculator (Ch 16 — illustrative %, adjusted by training) ---------------- */
export function attemptPlan(maxes, logs = [], exp = "int", compLifts = LIFTS) {
  const e1 = e1rmFromLogs(logs);
  const out = {};
  for (const l of LIFTS.filter((x) => (compLifts || LIFTS).includes(x))) {
    const max = maxes?.[l] || 0;
    if (!max) continue;
    // Best clean single/double in training (RPE ≤ 8) anchors the opener; the 1RM anchors the ceiling.
    let bestSingle = 0;
    for (const log of logs) for (const ex of log.logged_exercises || []) {
      if (ex.lift !== l || ex.type !== "Main") continue;
      for (const s of ex.loggedSets || []) { const kg = num(s.weight), reps = num(s.reps), rpe = num(s.rpe); if (s.completed && kg && reps && reps <= 2 && (rpe === null || rpe <= 8) && !s.pain && kg > bestSingle) bestSingle = kg; }
    }
    const ref = Math.max(max, e1[l]?.e1rm || 0);
    const conservative = exp === "beg" || maxes.estimated;
    let opener = round25(ref * 0.9);
    if (bestSingle) opener = Math.min(opener, round25(bestSingle));
    const second = round25(ref * (conservative ? 0.95 : 0.97));
    const third = round25(ref * (conservative ? 1.0 : 1.025));
    out[l] = {
      opener, second, third,
      notes: [
        bestSingle ? `Opener = your best clean single in training (${bestSingle} kg) — a weight you make on any day.` : "Opener ≈ 90% (about your current 3-rep max) — a weight you make on any day, tired or fresh.",
        `2nd ≈ ${conservative ? 95 : 97}% — your real lift. Only if the opener moved fast.`,
        `3rd ≈ ${conservative ? "100" : "102.5"}% — a small PR, ONLY if the 2nd was clean (RPE ≤ 9). A missed 3rd scores nothing.`,
      ],
      ref,
    };
  }
  out.rule = exp === "beg"
    ? "First meet: the goal is 9 for 9 (or 3 for 3 per lift) and the experience. Open light, take small jumps, decide the 3rd after the 2nd."
    : "Build the biggest TOTAL, not three lift PRs. 9 for 9 beats a bombed-out hero. Decide the 3rd after the 2nd, never before.";
  return out;
}
