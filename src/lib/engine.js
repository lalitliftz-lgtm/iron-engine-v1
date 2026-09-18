// ============================================================
// IRON ENGINE — deterministic program-generation logic
// Ported verbatim from the LalitLifts storefront engine.
// Pure functions + data tables + XLSX/text export.
// ============================================================
import * as XLSX from "xlsx";
import { CONFIG } from "../config/siteConfig";

export const C = {
  iron: "#111318", steel: "#1B1F26", steel2: "#242932", line: "#31374280",
  lineSolid: "#313742",
  chalk: "#EDEAE2", knurl: "#9BA1AC", dim: "#6B7280",
  red: "#C8102E", redDim: "#8E1024",
  brass: "#C9A24B",
};

export const PLATES = [
  { w: 25, c: "#C8102E" }, { w: 20, c: "#1D4E9E" }, { w: 15, c: "#E3A80D" },
  { w: 10, c: "#2E7D4F" }, { w: 5, c: "#EDEAE2" }, { w: 2.5, c: "#3A3D45" }, { w: 1.25, c: "#9BA1AC" },
];

export const round25 = (w) => Math.round(w / 2.5) * 2.5;
export const epley = (w, r) => (r <= 1 ? w : w * (1 + r / 30));

export const SCHEMES = {
  hyp: {
    label: "Hypertrophy–Strength (Base Block)",
    weeks: [
      { sets: 4, reps: 8, pct: 67.5, rpe: 7 },
      { sets: 4, reps: 7, pct: 70, rpe: 7.5 },
      { sets: 4, reps: 6, pct: 72.5, rpe: 8 },
      { sets: 3, reps: 5, pct: 60, rpe: 6, deload: true },
    ],
  },
  str: {
    label: "Strength Block",
    weeks: [
      { sets: 4, reps: 6, pct: 72.5, rpe: 7 },
      { sets: 4, reps: 5, pct: 77.5, rpe: 7.5 },
      { sets: 5, reps: 4, pct: 80, rpe: 8 },
      { sets: 3, reps: 3, pct: 65, rpe: 6, deload: true },
    ],
  },
  peak: {
    label: "Peaking Block",
    weeks: [
      { sets: 4, reps: 4, pct: 80, rpe: 7.5 },
      { sets: 3, reps: 3, pct: 85, rpe: 8 },
      { sets: 2, reps: 2, pct: 90, rpe: 8.5 },
      { sets: 2, reps: 2, pct: 72.5, rpe: 6, deload: true, taper: true },
    ],
  },
};

export const LIFT_NAMES = { squat: "Squat", bench: "Bench Press", deadlift: "Deadlift" };
export const PAUSED = { squat: "Paused Squat (2 sec)", bench: "Paused Bench (3 sec)", deadlift: "Paused Deadlift (below knee)" };

export const WEEKDAYS = {
  3: ["Monday", "Wednesday", "Friday"],
  4: ["Monday", "Tuesday", "Thursday", "Friday"],
  5: ["Monday", "Tuesday", "Thursday", "Friday", "Saturday"],
  6: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
};
export const ALL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export const STICKING = {
  squat: {
    hole: {
      l: "Fails at the bottom (hole)",
      variation: { name: "Paused Squat (3 sec, bottom)", off: -17.5 },
      acc: { name: "Leg Press (deep ROM, quad focus)", sr: "3 × 10", rpe: "RPE 8" },
      note: "Weak point: the hole — building bottom-position strength",
    },
    mid: {
      l: "Hips shoot up / mid-range fail",
      variation: { name: "Tempo Squat (3 sec descent)", off: -20 },
      acc: { name: "Good Morning", sr: "3 × 8", rpe: "RPE 7" },
      note: "Weak point: mid-range — posterior chain + positioning",
    },
  },
  bench: {
    chest: {
      l: "Can't get it off the chest",
      variation: { name: "Long-Pause Bench (3 sec)", off: -12.5 },
      acc: { name: "DB Bench Press (deep stretch)", sr: "3 × 10", rpe: "RPE 8" },
      note: "Weak point: off-chest — bottom-end pressing strength",
    },
    mid: {
      l: "Stalls in the mid-range",
      variation: { name: "Spoto Press (1 sec hold above chest)", off: -15 },
      acc: { name: "Overhead Press (strict)", sr: "3 × 8", rpe: "RPE 8" },
      note: "Weak point: mid-range — shoulder/triceps transition",
    },
    lockout: {
      l: "Fails at lockout",
      variation: { name: "Close-Grip Bench Press", off: -12.5 },
      acc: { name: "Heavy Dips or JM Press", sr: "3 × 8", rpe: "RPE 8" },
      note: "Weak point: lockout — triceps work",
    },
  },
  deadlift: {
    floor: {
      l: "Can't break the floor",
      variation: { name: "Deficit Deadlift (2–3 cm)", off: -20 },
      acc: { name: "Leg Press (leg drive focus)", sr: "3 × 10", rpe: "RPE 8" },
      note: "Weak point: the floor — leg drive + start position",
    },
    knee: {
      l: "Stalls at the knee",
      variation: { name: "Paused Deadlift (below knee, 2 sec)", off: -17.5 },
      acc: { name: "Halting Deadlift (to the knee)", sr: "2 × 4", rpe: "RPE 7" },
      note: "Weak point: knee-level — positioning and lat tightness",
    },
    lockout: {
      l: "Can't finish the lockout",
      variation: { name: "Block Pull (below knee)", off: -7.5 },
      acc: { name: "Hip Thrust (heavy)", sr: "3 × 8", rpe: "RPE 8" },
      note: "Weak point: lockout — hips/glutes work",
    },
  },
};

export const T = (title, slots, acc) => ({ title, slots, acc });
export const S = (lift, role) => ({ lift, role });

export const TEMPLATES = {
  bal: {
    3: [
      T("Squat Heavy", [S("squat", "primary"), S("bench", "secondary")], "squatDay"),
      T("Deadlift Heavy", [S("deadlift", "primary"), S("bench", "paused")], "deadDay"),
      T("Bench Heavy", [S("bench", "primary"), S("squat", "paused")], "benchDay"),
    ],
    4: [
      T("Squat Heavy", [S("squat", "primary"), S("bench", "secondary")], "squatDay"),
      T("Bench Heavy", [S("bench", "primary")], "benchDay"),
      T("Deadlift Heavy", [S("deadlift", "primary"), S("squat", "secondary")], "deadDay"),
      T("Bench Volume", [S("bench", "paused")], "volumeDay"),
    ],
    5: [
      T("Squat Heavy", [S("squat", "primary"), S("bench", "secondary")], "squatDay"),
      T("Bench Heavy", [S("bench", "primary")], "benchDay"),
      T("Deadlift Heavy", [S("deadlift", "primary")], "deadDay"),
      T("Squat Volume", [S("squat", "paused")], "squatVol"),
      T("Bench Volume", [S("bench", "paused")], "volumeDay"),
    ],
    6: [
      T("Squat Heavy", [S("squat", "primary"), S("bench", "secondary")], "squatDay"),
      T("Bench Heavy", [S("bench", "primary")], "benchDay"),
      T("Deadlift Heavy", [S("deadlift", "primary")], "deadDay"),
      T("Squat Volume", [S("squat", "paused")], "squatVol"),
      T("Bench Volume", [S("bench", "paused")], "volumeDay"),
      T("Upper Back + Arms", [], "upperDay"),
    ],
  },
  squat: {
    3: [
      T("Squat Heavy", [S("squat", "primary"), S("bench", "secondary")], "squatDay"),
      T("Deadlift Heavy", [S("deadlift", "primary"), S("squat", "paused")], "deadDay"),
      T("Bench Heavy", [S("bench", "primary"), S("squat", "tech")], "benchDay"),
    ],
    4: [
      T("Squat Heavy", [S("squat", "primary"), S("bench", "secondary")], "squatDay"),
      T("Bench Heavy", [S("bench", "primary")], "benchDay"),
      T("Squat Volume", [S("squat", "secondary")], "squatVol"),
      T("Deadlift Heavy", [S("deadlift", "primary"), S("squat", "tech")], "deadDay"),
    ],
    5: [
      T("Squat Heavy", [S("squat", "primary"), S("bench", "secondary")], "squatDay"),
      T("Bench Heavy", [S("bench", "primary")], "benchDay"),
      T("Squat Volume", [S("squat", "secondary")], "squatVol"),
      T("Deadlift Heavy", [S("deadlift", "primary")], "deadDay"),
      T("Squat Variation + Upper", [S("squat", "paused")], "volumeDay"),
    ],
    6: [
      T("Squat Heavy", [S("squat", "primary")], "squatDay"),
      T("Bench Heavy", [S("bench", "primary")], "benchDay"),
      T("Squat Volume", [S("squat", "secondary")], "squatVol"),
      T("Deadlift Heavy", [S("deadlift", "primary")], "deadDay"),
      T("Squat Variation", [S("squat", "paused")], "squatVol"),
      T("Bench Volume + Upper", [S("bench", "paused")], "volumeDay"),
    ],
  },
  bench: {
    3: [
      T("Bench Heavy", [S("bench", "primary"), S("squat", "secondary")], "benchDay"),
      T("Deadlift Heavy", [S("deadlift", "primary"), S("bench", "paused")], "deadDay"),
      T("Bench Volume", [S("bench", "secondary"), S("squat", "paused")], "volumeDay"),
    ],
    4: [
      T("Bench Heavy", [S("bench", "primary")], "benchDay"),
      T("Squat Heavy", [S("squat", "primary")], "squatDay"),
      T("Bench Variation", [S("bench", "paused")], "volumeDay"),
      T("Deadlift Heavy", [S("deadlift", "primary"), S("bench", "tech")], "deadDay"),
    ],
    5: [
      T("Bench Heavy", [S("bench", "primary")], "benchDay"),
      T("Squat Heavy", [S("squat", "primary")], "squatDay"),
      T("Bench Volume", [S("bench", "secondary")], "volumeDay"),
      T("Deadlift Heavy", [S("deadlift", "primary")], "deadDay"),
      T("Bench Variation + Upper", [S("bench", "paused")], "upperDay"),
    ],
    6: [
      T("Bench Heavy", [S("bench", "primary")], "benchDay"),
      T("Squat Heavy", [S("squat", "primary")], "squatDay"),
      T("Bench Volume", [S("bench", "secondary")], "volumeDay"),
      T("Deadlift Heavy", [S("deadlift", "primary")], "deadDay"),
      T("Bench Variation", [S("bench", "paused")], "upperDay"),
      T("Squat Volume", [S("squat", "paused")], "squatVol"),
    ],
  },
  dead: {
    3: [
      T("Deadlift Heavy", [S("deadlift", "primary"), S("bench", "secondary")], "deadDay"),
      T("Squat Heavy", [S("squat", "primary"), S("bench", "paused")], "squatDay"),
      T("Bench Heavy", [S("bench", "primary"), S("deadlift", "paused")], "benchDay"),
    ],
    4: [
      T("Deadlift Heavy", [S("deadlift", "primary")], "deadDay"),
      T("Bench Heavy", [S("bench", "primary")], "benchDay"),
      T("Squat Heavy", [S("squat", "primary"), S("bench", "secondary")], "squatDay"),
      T("Deadlift Variation", [S("deadlift", "paused"), S("bench", "paused")], "volumeDay"),
    ],
    5: [
      T("Deadlift Heavy", [S("deadlift", "primary")], "deadDay"),
      T("Bench Heavy", [S("bench", "primary")], "benchDay"),
      T("Squat Heavy", [S("squat", "primary"), S("bench", "secondary")], "squatDay"),
      T("Deadlift Variation", [S("deadlift", "paused")], "deadDay"),
      T("Bench Volume + Upper", [S("bench", "paused")], "volumeDay"),
    ],
    6: [
      T("Deadlift Heavy", [S("deadlift", "primary")], "deadDay"),
      T("Bench Heavy", [S("bench", "primary")], "benchDay"),
      T("Squat Heavy", [S("squat", "primary")], "squatDay"),
      T("Deadlift Variation", [S("deadlift", "paused")], "deadDay"),
      T("Bench Volume", [S("bench", "paused")], "volumeDay"),
      T("Squat Volume + Upper", [S("squat", "paused")], "squatVol"),
    ],
  },
};

export function dayTemplates(days, exp, focus) {
  if (exp === "beg") {
    const base = [
      T("Full Body A", [S("squat", "beg"), S("bench", "beg")], "pullA"),
      T("Full Body B", [S("squat", "begLight"), S("deadlift", "begDL"), S("bench", "begPause")], "pullB"),
      T("Full Body C", [S("squat", "beg"), S("bench", "beg")], "pullC"),
    ];
    const out = [...base];
    for (let i = 3; i < days; i++) out.push({ ...T("Technique + GPP (Optional)", [], "gpp"), optional: true });
    return out;
  }
  return TEMPLATES[focus]?.[days] || TEMPLATES.bal[4];
}

export const ACC = {
  squatDay: [
    { name: "Leg Press or Bulgarian Split Squat", sr: "3 × 10–12", rpe: "RPE 8" },
    { name: "Leg Curl", sr: "3 × 10–12", rpe: "RPE 8" },
    { name: "Hanging Leg Raise / Ab Wheel", sr: "3 × 10–15", rpe: "—" },
  ],
  benchDay: [
    { name: "Barbell Row", sr: "4 × 8–10", rpe: "RPE 8" },
    { name: "Overhead Press (DB or Barbell)", sr: "3 × 8–10", rpe: "RPE 8" },
    { name: "Triceps: Dips or Pushdown", sr: "3 × 10–12", rpe: "RPE 8–9" },
  ],
  deadDay: [
    { name: "Romanian Deadlift", sr: "3 × 8–10", rpe: "RPE 7–8" },
    { name: "Lat Pulldown or Pull-ups", sr: "3 × 8–12", rpe: "RPE 8" },
    { name: "Back Extension", sr: "3 × 12–15", rpe: "RPE 8" },
  ],
  volumeDay: [
    { name: "Incline DB Press", sr: "3 × 10–12", rpe: "RPE 8" },
    { name: "Chest-Supported Row", sr: "3 × 10–12", rpe: "RPE 8" },
    { name: "Rear Delt Fly + Biceps Curl (superset)", sr: "3 × 12–15", rpe: "RPE 8–9" },
  ],
  squatVol: [
    { name: "Walking Lunge", sr: "3 × 10/leg", rpe: "RPE 8" },
    { name: "Leg Curl", sr: "3 × 10–12", rpe: "RPE 8" },
    { name: "Plank or Ab Wheel", sr: "3 × 30–45 sec", rpe: "—" },
  ],
  upperDay: [
    { name: "Pull-ups or Lat Pulldown", sr: "4 × 8–12", rpe: "RPE 8" },
    { name: "Chest-Supported Row", sr: "3 × 10–12", rpe: "RPE 8" },
    { name: "Face Pull + Rear Delt Fly", sr: "3 × 15", rpe: "RPE 8" },
    { name: "Biceps + Triceps (superset)", sr: "3 × 10–12", rpe: "RPE 8–9" },
  ],
  pullA: [
    { name: "Barbell Row", sr: "3 × 8–10", rpe: "RPE 8" },
    { name: "Plank", sr: "3 × 30–45 sec", rpe: "—" },
  ],
  pullB: [
    { name: "Lat Pulldown or Pull-ups", sr: "3 × 8–12", rpe: "RPE 8" },
    { name: "Biceps Curl", sr: "2 × 10–12", rpe: "RPE 8" },
  ],
  pullC: [
    { name: "Chin-ups or Lat Pulldown", sr: "3 × 8–12", rpe: "RPE 8" },
    { name: "Triceps Pushdown", sr: "2 × 10–12", rpe: "RPE 8" },
  ],
  gpp: [
    { name: "Light technique: SBD practice up to 50%", sr: "3 × 5", rpe: "RPE 5–6" },
    { name: "Sled push / incline walk / cardio", sr: "15–20 min", rpe: "easy" },
    { name: "Core + mobility circuit", sr: "10–15 min", rpe: "—" },
  ],
};

export const SWAPS = {
  back: {
    "Barbell Row": "Chest-Supported Row (spine-safe)",
    "Romanian Deadlift": "Leg Curl (spine-safe swap)",
    "Back Extension": "Bird Dog + Side Plank (spine-safe)",
    "Hanging Leg Raise / Ab Wheel": "Dead Bug / Plank (spine-safe)",
    "Walking Lunge": "Leg Press (light, spine-safe)",
    "Good Morning": "Leg Curl (spine-safe swap)",
  },
  knee: {
    "Leg Press or Bulgarian Split Squat": "Hip Thrust (knee-friendly)",
    "Walking Lunge": "Leg Curl (knee-friendly swap)",
    "Leg Press (deep ROM, quad focus)": "Leg Press (pain-free ROM only)",
  },
  shoulder: {
    "Triceps: Dips or Pushdown": "Triceps Pushdown (avoid dips)",
    "Overhead Press (DB or Barbell)": "Landmine or Neutral-Grip DB Press",
    "Overhead Press (strict)": "Landmine Press (shoulder-safe)",
    "Incline DB Press": "Incline DB Press (neutral grip)",
    "Heavy Dips or JM Press": "JM Press or Pushdown (avoid dips)",
  },
};

export function applySwaps(accList, injuries) {
  return accList.map((a) => {
    let name = a.name;
    for (const key of ["back", "knee", "shoulder"]) {
      if (injuries[key] && SWAPS[key][name]) name = SWAPS[key][name];
    }
    return { ...a, name };
  });
}

export function recoveryProfile(form) {
  const poor = form.sleep === "low" || form.stress === "high";
  const mid = !poor && (form.sleep === "mid" || form.stress === "mid");
  if (poor) return { level: "poor", setDelta: -1, rpeCap: 7.5, note: "Recovery is POOR (sleep/stress) — volume reduced by 1 set, RPE capped at 7.5. Fix sleep first; the volume comes back." };
  if (mid) return { level: "mid", setDelta: 0, rpeCap: null, note: "Recovery is borderline — take the deload week seriously. Don't skip it." };
  return { level: "good", setDelta: 0, rpeCap: null, note: null };
}

export function resolveMaxes(form) {
  if (form.rmMode === "know") {
    return { squat: Number(form.maxes.squat) || 0, bench: Number(form.maxes.bench) || 0, deadlift: Number(form.maxes.deadlift) || 0, estimated: false };
  }
  if (form.rmMode === "calc") {
    const out = { estimated: true };
    for (const l of ["squat", "bench", "deadlift"]) {
      const w = Number(form.calc[l].w) || 0;
      const r = Number(form.calc[l].r) || 0;
      out[l] = w && r ? round25(epley(w, r)) : 0;
    }
    return out;
  }
  return { squat: 0, bench: 0, deadlift: 0, estimated: false };
}

export function buildLift(slot, wk, form, maxes, rec) {
  const { lift, role } = slot;
  const max = maxes[lift] || 0;
  const stick = form.weak !== "none" && form.sticking ? STICKING[form.weak]?.[form.sticking] : null;
  const mk = (name, sets, reps, pct, rpe, note) => ({
    name, sets, reps, rpe,
    pct: pct || null,
    kg: max && pct ? round25((pct / 100) * max) : null,
    note: note || null, lift,
  });

  if (role === "beg") {
    const pct = 70 + wk * 2.5;
    return mk(LIFT_NAMES[lift], 3, 5, pct, "RPE ≤ 8", wk === 0 ? "Add +2.5 kg each week as long as RPE stays under 8" : null);
  }
  if (role === "begLight") {
    const pct = 62.5 + wk * 2.5;
    return mk(LIFT_NAMES[lift] + " (Light)", 2, 5, pct, "RPE 6–7", "Technique focus — prioritize bar speed");
  }
  if (role === "begDL") {
    const pct = 72.5 + wk * 2.5;
    return mk(LIFT_NAMES[lift], 2, 5, pct, "RPE ≤ 8", "Deadlift carries a high fatigue cost — 2 sets is enough");
  }
  if (role === "begPause") {
    const pct = 60 + wk * 2.5;
    return mk(PAUSED[lift], 2, 5, pct, "RPE 7", null);
  }

  const scheme = SCHEMES[form.goal].weeks[wk];
  const notes = [];

  if (role === "tech") {
    const pct = scheme.deload ? 55 : 60;
    return mk(LIFT_NAMES[lift] + " (Technique/Speed)", 3, 3, pct, "RPE 6", "Light technique work — practice competition commands, maximum bar speed");
  }

  if (role === "primary") {
    let sets = scheme.sets;
    let rpe = scheme.rpe;
    if (lift === "deadlift" && !scheme.deload) sets = Math.max(2, sets - 1);
    if (form.weak === lift && !scheme.deload) {
      sets += 1;
      notes.push(stick ? stick.note : "+1 set (weakest lift — extra volume)");
    }
    if (!scheme.deload && rec.setDelta) sets = Math.max(2, sets + rec.setDelta);
    if (!scheme.deload && rec.rpeCap) rpe = Math.min(rpe, rec.rpeCap);
    if (form.injuries.back && (lift === "squat" || lift === "deadlift")) {
      rpe = Math.min(rpe, 7.5);
      notes.push("Lower-back flag — RPE capped at 7.5. Any pain = end the set");
    }
    if (form.injuries.knee && lift === "squat") notes.push("Knee flag — controlled tempo, pain-free depth only");
    if (form.injuries.shoulder && lift === "bench") notes.push("Shoulder flag — slightly narrower grip, tuck the elbows");
    if (scheme.taper) notes.push("Taper — optional heavy single @ RPE 8–9 on the weekend");
    else if (scheme.deload) notes.push("Deload — the weight will feel light. Keep it light.");
    return mk(LIFT_NAMES[lift], sets, scheme.reps, scheme.pct, `RPE ${rpe}`, notes.join(" · ") || null);
  }

  if (role === "secondary") {
    const sets = Math.max(2, scheme.sets - 1);
    const reps = Math.min(scheme.reps + 2, 10);
    const pct = scheme.deload ? scheme.pct - 5 : scheme.pct - 10;
    return mk(LIFT_NAMES[lift], sets, reps, pct, `RPE ${Math.max(6, scheme.rpe - 1)}`, "Secondary slot — volume work, don't grind reps");
  }

  if (stick && form.weak === lift) {
    const pct = scheme.deload ? stick.variation.off + scheme.pct - 5 : scheme.pct + stick.variation.off;
    return mk(stick.variation.name, 3, Math.min(scheme.reps, 5), Math.max(pct, 40), "RPE 7", stick.note);
  }
  const pct = scheme.deload ? scheme.pct - 10 : scheme.pct - 15;
  return mk(PAUSED[lift], 3, Math.min(scheme.reps, 5), pct, "RPE 7", "Variation — position and control work");
}

export function buildProgram(form, maxes) {
  const rec = recoveryProfile(form);
  const tmpl = dayTemplates(form.days, form.exp, form.focus);
  const wdays = WEEKDAYS[form.days] || WEEKDAYS[4];
  const stick = form.weak !== "none" && form.sticking ? STICKING[form.weak]?.[form.sticking] : null;

  const weeks = [0, 1, 2, 3].map((wk) => {
    const deload = form.exp !== "beg" && SCHEMES[form.goal].weeks[wk].deload;
    return {
      label: `Week ${wk + 1}`,
      deload,
      days: tmpl.map((d, di) => {
        const main = d.slots.map((s) => buildLift(s, wk, form, maxes, rec));
        let acc = applySwaps([...(ACC[d.acc] || [])], form.injuries);
        if (form.weak !== "none" && !d.optional && wk < 3) {
          if (d.slots.find((s) => s.lift === form.weak && s.role === "primary")) {
            const extra = stick
              ? { ...stick.acc, name: "Weak-point: " + stick.acc.name }
              : { name: "Extra weak-point volume", sr: "2 × 5", rpe: "RPE 7" };
            acc = [...acc, applySwaps([extra], form.injuries)[0]];
          }
        }
        if (deload) acc = acc.slice(0, 2).map((a) => ({ ...a, sr: a.sr.includes("×") ? a.sr.replace(/^\d+/, "2") : a.sr }));
        return { weekday: wdays[di] || "Extra", title: d.title, optional: d.optional, main, acc };
      }),
    };
  });

  const count = { squat: 0, bench: 0, deadlift: 0 };
  tmpl.forEach((d) => d.slots.forEach((s) => count[s.lift]++));
  const freq = `SQ ${count.squat}× · BP ${count.bench}× · DL ${count.deadlift}× / week`;

  return { weeks, rec, freq, restDays: ALL_DAYS.filter((d) => !wdays.includes(d)) };
}

/* ---------------- XLSX export ---------------- */
export function weekRows(w) {
  const rows = [["Day", "Focus", "Exercise", "Sets", "Reps", "Load (kg)", "%1RM", "RPE", "Notes"]];
  const byDay = {};
  w.days.forEach((d) => (byDay[d.weekday] = d));
  ALL_DAYS.forEach((wd) => {
    const d = byDay[wd];
    if (!d) {
      rows.push([wd, "Rest", "—", "", "", "", "", "", "Recovery / mobility"]);
      return;
    }
    d.main.forEach((m) => {
      rows.push([wd, d.title, m.name, m.sets, m.reps, m.kg || "—", m.pct ? m.pct + "%" : "—", m.rpe, m.note || ""]);
    });
    d.acc.forEach((a) => {
      const parts = a.sr.split("×");
      const s = parts.length === 2 ? parts[0].trim() : "";
      const r = parts.length === 2 ? parts[1].trim() : a.sr;
      rows.push([wd, "Accessories", a.name, s, r, "—", "—", a.rpe === "—" ? "" : a.rpe, ""]);
    });
    rows.push([]);
  });
  return rows;
}

export function downloadXLSX(program, form) {
  const wb = XLSX.utils.book_new();
  const cols = [{ wch: 11 }, { wch: 18 }, { wch: 38 }, { wch: 6 }, { wch: 9 }, { wch: 10 }, { wch: 7 }, { wch: 9 }, { wch: 50 }];
  program.weeks.forEach((w) => {
    const ws = XLSX.utils.aoa_to_sheet(weekRows(w));
    ws["!cols"] = cols;
    XLSX.utils.book_append_sheet(wb, ws, w.label + (w.deload ? " (Deload)" : ""));
  });
  const rules = [
    ["IRON ENGINE by LALITLIFTS — EXECUTION RULES", ""],
    ["Athlete", form.name || "—"],
    ["Block", form.exp === "beg" ? "Beginner Linear" : SCHEMES[form.goal].label],
    ["Frequency", program.freq],
    ["", ""],
    ["Warm-up", "Bar ×8 → 40% ×5 → 55% ×3 → 70% ×2 → 80% ×1 → work sets"],
    ["RPE", "RPE 7 = 3 reps left | RPE 8 = 2 left | RPE 9 = 1 left. RPE is the final judge."],
    ["Auto-regulation", "If RPE runs higher than prescribed → reduce weight by 5%"],
    ["Rest", "Main lifts 3–5 min | Accessories 1.5–2 min"],
    ["", ""],
    ["TEST DAY (Week 5, after the deload)", ""],
    ["Protocol", "70% → 80% → 87.5% → 92.5% → 97–100% → PR attempt only if bar speed looks good. Max 3 heavy singles."],
    ["Reality", "Beginners: a PR is almost certain. Intermediates: 2.5–5 kg is realistic. Big PRs come from block sequencing — Base → Strength → Peak."],
    ["", ""],
    ["TECHNIQUE STANDARDS", ""],
    ["Bench", "Every rep = competition rep. Touch → settle → press. No sinking, no bouncing."],
    ["Squat", "Every rep to depth. Brace first, then descend. Same walkout every set."],
    ["Deadlift", "Pull the slack out — never jerk the bar. Hips and shoulders rise together."],
    ["", ""],
    ["Coaching", "For 1:1 coaching, DM @" + CONFIG.insta],
  ];
  const wsR = XLSX.utils.aoa_to_sheet(rules);
  wsR["!cols"] = [{ wch: 34 }, { wch: 90 }];
  XLSX.utils.book_append_sheet(wb, wsR, "Rules + Test Day");
  const name = (form.name || "athlete").trim().toLowerCase().replace(/\s+/g, "-");
  XLSX.writeFile(wb, `${name}-iron-engine-4week.xlsx`);
}

export function programToText(program, form) {
  let t = `IRON ENGINE by LALITLIFTS — 4 WEEK ${form.exp === "beg" ? "BEGINNER LINEAR" : SCHEMES[form.goal].label.toUpperCase()}\n${form.name ? "Athlete: " + form.name + "\n" : ""}Frequency: ${program.freq}\n\n`;
  program.weeks.forEach((w) => {
    t += `======== ${w.label}${w.deload ? " (DELOAD)" : ""} ========\n`;
    w.days.forEach((d) => {
      t += `\n${d.weekday} — ${d.title}\n`;
      d.main.forEach((m) => {
        t += `  ${m.name}: ${m.sets} x ${m.reps}${m.pct ? ` @ ${m.pct}%` : ""}${m.kg ? ` (${m.kg} kg)` : ""} ${m.rpe}\n`;
        if (m.note) t += `    → ${m.note}\n`;
      });
      d.acc.forEach((a) => (t += `  ${a.name}: ${a.sr} ${a.rpe !== "—" ? a.rpe : ""}\n`));
    });
    t += `\nRest days: ${program.restDays.join(", ")}\n\n`;
  });
  t += `TEST DAY (Week 5): 70% → 80% → 87.5% → 92.5% → 97–100% → PR attempt only if bar speed looks good.\n`;
  return t;
}

/* ---------------- Plate math ---------------- */
export function platesPerSide(total) {
  let side = (total - 20) / 2;
  if (side < 0) return null;
  const out = [];
  for (const p of PLATES) {
    while (side >= p.w - 0.001) { out.push(p); side -= p.w; }
  }
  return out;
}
