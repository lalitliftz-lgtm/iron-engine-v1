// ============================================================
// IRON ENGINE v2 — deterministic program-generation logic
// Built on the Lalit Lifts Powerlifting System: standards before
// weight, one primary lift per session, % gives direction and RPE
// fine-tunes execution, fatigue is a signal, deload is training.
// Pure functions + data tables + XLSX/text export.
// ============================================================
import * as XLSX from "xlsx";
import { CONFIG } from "../config/siteConfig.js";

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
export const round125 = (w) => Math.round(w / 1.25) * 1.25;
export const epley = (w, r) => (r <= 1 ? w : w * (1 + r / 30));

/* ---------------- %1RM ↔ reps ↔ RPE realism ----------------
   Average trained lifter: 100%→1, 95%→2, 90%→3–4, 85%→5–6, 80%→7–8,
   75%→9–10, 70%→11–12. Used so a prescription never says "RPE 8" at a
   load that is really RPE 5 (or vice versa). Individuals vary a lot —
   the RPE target is the final judge, % is the plan. */
const REPS_AT_PCT = [[100, 1], [95, 2], [90, 3.5], [85, 5.5], [80, 7.5], [75, 9.5], [70, 11.5], [65, 13.5], [60, 15.5], [55, 18], [50, 21]];
export function maxRepsAt(pct) {
  if (pct >= 100) return 1;
  if (pct <= 50) return 21;
  for (let i = 0; i < REPS_AT_PCT.length - 1; i++) {
    const [p1, r1] = REPS_AT_PCT[i], [p2, r2] = REPS_AT_PCT[i + 1];
    if (pct <= p1 && pct >= p2) return r1 + ((p1 - pct) / (p1 - p2)) * (r2 - r1);
  }
  return 21;
}
export function rpeFor(pct, reps) {
  const rpe = 10 - (maxRepsAt(pct) - reps);
  return Math.max(4, Math.min(10, Math.round(rpe * 2) / 2));
}
export const RPE_WORDS = { 6: "4 reps bache", 6.5: "3–4 reps bache", 7: "3 reps bache", 7.5: "2–3 reps bache", 8: "2 reps bache", 8.5: "1–2 reps bache", 9: "1 rep bacha", 9.5: "bas ek aur nahi", 10: "max effort" };
export const rpeLabel = (rpe) => `RPE ${rpe}${RPE_WORDS[rpe] ? ` (${RPE_WORDS[rpe]})` : ""}`;

/* ---------------- Block schemes (Lalit ranges) ----------------
   Base/Accumulation: 70–80%, 6–8 reps, RPE 7–8, accessories 3–4 × 10–15
   Strength/Intensification: 80–90%, 2–5 reps, RPE 8–9, accessories 2–3 × 5–8
   Peaking/Realization: 90%+, 1–3 reps, competition lifts only
   Deload: ~50–60% volume, 60–70% intensity, RPE 6
   Each week: sets/reps/pct for squat+bench, `dl` override for deadlift
   (highest fatigue cost → fewer sets), `acc` = accessories per day,
   `extras` = practice singles added to the primary slot. */
export const SCHEMES = {
  hyp: {
    label: "Base Block (Accumulation)",
    range: "70–80% · 6–8 reps · RPE 7–8 · work capacity + muscle",
    weeks: [
      { sets: 4, reps: 8, pct: 72.5, rpe: 7, dl: { sets: 3, reps: 5, pct: 77.5 }, acc: 4 },
      { sets: 4, reps: 7, pct: 75, rpe: 7.5, dl: { sets: 3, reps: 5, pct: 80 }, acc: 4 },
      { sets: 4, reps: 6, pct: 77.5, rpe: 8, dl: { sets: 3, reps: 4, pct: 82.5 }, acc: 4 },
      { sets: 3, reps: 5, pct: 60, rpe: 6, dl: { sets: 2, reps: 3, pct: 60 }, acc: 2, deload: true },
    ],
  },
  str: {
    label: "Strength Block (Intensification)",
    range: "80–90% · 2–5 reps · RPE 8–9 · maximum strength",
    weeks: [
      { sets: 4, reps: 4, pct: 82.5, rpe: 8, dl: { sets: 3, reps: 3, pct: 85 }, acc: 3 },
      { sets: 4, reps: 3, pct: 85, rpe: 8, dl: { sets: 3, reps: 2, pct: 87.5 }, acc: 3 },
      { sets: 3, reps: 2, pct: 87.5, rpe: 8.5, dl: { sets: 2, reps: 1, pct: 90 }, acc: 2, note: "Last set: bar speed good → +2.5 kg allowed. Grind = stop." },
      { sets: 3, reps: 3, pct: 65, rpe: 6, dl: { sets: 2, reps: 2, pct: 65 }, acc: 2, deload: true },
    ],
  },
  peak: {
    label: "Peaking Block (Realization)",
    range: "85–95% · 1–3 reps · competition lifts only · meet rehearsal",
    weeks: [
      { sets: 3, reps: 2, pct: 85, rpe: 8, dl: { sets: 2, reps: 2, pct: 85 }, acc: 2, extras: [{ reps: 1, pct: 90, note: "Practice single — competition commands, full setup" }] },
      { sets: 2, reps: 2, pct: 87.5, rpe: 8.5, dl: { sets: 2, reps: 1, pct: 87.5 }, acc: 1, extras: [{ reps: 1, pct: 92.5, note: "2nd-attempt feel — only if bar speed looks good" }] },
      { sets: 2, reps: 1, pct: 90, rpe: 8.5, dl: { sets: 1, reps: 1, pct: 90 }, acc: 1, extras: [{ reps: 1, pct: 95, note: "3rd-attempt feel — ONLY if the 90% single moved fast; otherwise stop at 90 (your opener on any day)" }] },
      { sets: 2, reps: 2, pct: 72.5, rpe: 6, dl: { sets: 1, reps: 2, pct: 70 }, acc: 0, deload: true, taper: true },
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

/* ---------------- Weak-point system (System 2.0 Ch.12 / A–Z Ch.7) ----------------
   Each sticking point lists several variations and accessories (first = default);
   the athlete may pick another. `variation` / `acc` keep the default for older UI. */
const WP = (l, variations, accessories, note, limiters) => ({
  l, variations, accessories, note, limiters,
  get variation() { return this.variations[0]; },
  get acc() { return this.accessories[0]; },
});
export const STICKING = {
  squat: {
    hole: WP("Fails in the hole (bottom)",
      [{ name: "Paused Squat (3 sec, bottom)", off: -17.5 }, { name: "Pin Squat (from deep)", off: -20 }, { name: "Tempo Squat (3 sec descent)", off: -20 }],
      [{ name: "Hip Thrust (heavy)", sr: "3 × 8", rpe: "RPE 8" }, { name: "Leg Press (deep ROM)", sr: "3 × 10", rpe: "RPE 8" }, { name: "Hip mobility + deep goblet squat hold", sr: "3 × 30 sec", rpe: "—" }],
      "Weak point: the hole — bottom-position strength and confidence", ["hip/glute strength", "hip mobility", "bracing lost at bottom"]),
    mid: WP("Stalls mid-range (most common)",
      [{ name: "Box Squat (mid-range height)", off: -15 }, { name: "Pin Squat (mid-range)", off: -15 }, { name: "Front Squat", off: -30 }],
      [{ name: "Leg Press (quad focus)", sr: "3 × 10", rpe: "RPE 8" }, { name: "Leg Extension", sr: "3 × 12", rpe: "RPE 8" }, { name: "Hack Squat", sr: "3 × 10", rpe: "RPE 8" }],
      "Weak point: mid-range — quad strength and positioning", ["quad strength", "hip drive", "knees caving / too upright"]),
    lockout: WP("Can't finish the lockout (hips)",
      [{ name: "Pin Squat (above parallel)", off: -5 }, { name: "Belt Squat", off: -25 }],
      [{ name: "Hip Thrust (heavy)", sr: "3 × 8", rpe: "RPE 8" }, { name: "Back Extension", sr: "3 × 12", rpe: "RPE 8" }],
      "Weak point: lockout — hip extension (glutes, lower back)", ["hip extension strength"]),
    collapse: WP("Chest drops / hips shoot up out of the hole",
      [{ name: "Paused Squat (3 sec, bottom)", off: -17.5 }, { name: "Pin Squat (from deep)", off: -20 }, { name: "Tempo Squat (3 sec descent)", off: -20 }],
      [{ name: "Chest-Supported Row (upper back)", sr: "3 × 10", rpe: "RPE 8" }, { name: "Front Squat (light, torso control)", sr: "3 × 6", rpe: "RPE 7" }, { name: "Leg Press (quad focus)", sr: "3 × 10", rpe: "RPE 8" }],
      "Position issue more than strength: bracing + quad/upper-back coordination", ["bracing lost at bottom", "quad vs hip coordination"]),
  },
  bench: {
    chest: WP("Can't get it off the chest",
      [{ name: "Paused Bench (competition pause, 2–3 sec)", off: -12.5 }, { name: "Spoto Press (1 sec hold above chest)", off: -15 }, { name: "Long-Pause Bench (3 sec)", off: -15 }],
      [{ name: "DB Bench Press (deep stretch)", sr: "3 × 10", rpe: "RPE 8" }, { name: "Chest Fly / Machine Press", sr: "3 × 12", rpe: "RPE 8" }, { name: "Triceps Pushdown (light)", sr: "3 × 12", rpe: "RPE 7" }],
      "Weak point: off-chest — starting strength, pause control (board press is NOT the fix here)", ["pec strength", "pause control", "setup / leg drive"]),
    mid: WP("Stalls in the mid-range",
      [{ name: "Pin Press (mid-range)", off: -12.5 }, { name: "Close-Grip Bench Press", off: -12.5 }, { name: "Spoto Press (1 sec hold above chest)", off: -15 }],
      [{ name: "Dips (weighted if possible)", sr: "3 × 8", rpe: "RPE 8" }, { name: "Skull Crushers", sr: "3 × 10", rpe: "RPE 8" }, { name: "Overhead Press (strict)", sr: "3 × 8", rpe: "RPE 8" }],
      "Weak point: mid-range — triceps transition and elbow position", ["triceps strength", "elbow angle", "pec if elbows tucked"]),
    lockout: WP("Fails at lockout",
      [{ name: "Pin Press (lockout range)", off: -7.5 }, { name: "Close-Grip Bench Press", off: -12.5 }, { name: "Board Press (2-board)", off: -7.5 }],
      [{ name: "Dips (weighted if possible)", sr: "3 × 8", rpe: "RPE 8" }, { name: "Skull Crushers", sr: "3 × 10", rpe: "RPE 8" }, { name: "Triceps Pushdown", sr: "3 × 12", rpe: "RPE 8–9" }],
      "Weak point: lockout — triceps strength", ["triceps strength", "fatigue late in session"]),
    unstable: WP("Bar path / touch point changes every rep",
      [{ name: "Tempo Bench (3 sec descent)", off: -17.5 }, { name: "Long-Pause Bench (3 sec)", off: -15 }],
      [{ name: "Chest-Supported Row (upper back)", sr: "3 × 10", rpe: "RPE 8" }, { name: "Face Pull + Rear Delt Fly", sr: "3 × 15", rpe: "RPE 8" }],
      "Setup repeatability: upper-back tightness and scapular control", ["upper back engagement", "setup consistency"]),
  },
  deadlift: {
    floor: WP("Can't break the floor",
      [{ name: "Deficit Deadlift (2–3 cm)", off: -20 }, { name: "Paused Deadlift (just off the floor)", off: -17.5 }],
      [{ name: "Leg Press (leg drive focus)", sr: "3 × 10", rpe: "RPE 8" }, { name: "Front Squat (quads)", sr: "3 × 6", rpe: "RPE 7" }, { name: "Pendulum / Hack Squat", sr: "3 × 10", rpe: "RPE 8" }],
      "Weak point: the floor — leg drive, wedge and start position", ["quad strength from dead stop", "starting position", "slack not pulled"]),
    knee: WP("Stalls around the knee",
      [{ name: "Paused Deadlift (below knee, 2 sec)", off: -17.5 }, { name: "Pin Pull (mid-shin / knee)", off: -7.5 }, { name: "Tempo Deadlift (controlled ascent)", off: -20 }],
      [{ name: "Good Morning", sr: "3 × 8", rpe: "RPE 7" }, { name: "Romanian Deadlift", sr: "3 × 8", rpe: "RPE 7–8" }, { name: "Leg Press (quads + glutes)", sr: "3 × 10", rpe: "RPE 8" }],
      "Weak point: knee-level — hip drive, positioning and lat tightness", ["hip drive (glutes/hams)", "bar drifting away", "lats loose"]),
    lockout: WP("Can't finish the lockout",
      [{ name: "Block Pull (knee height)", off: -7.5 }, { name: "Tempo Deadlift (controlled ascent)", off: -20 }],
      [{ name: "Hip Thrust (heavy)", sr: "3 × 8", rpe: "RPE 8" }, { name: "Back Extension", sr: "3 × 12", rpe: "RPE 8" }, { name: "Snatch-Grip Deadlift (light, upper back)", sr: "3 × 5", rpe: "RPE 7" }],
      "Weak point: lockout — glutes and upper back", ["hip extension strength", "upper back (shoulders back)"]),
  },
};

/* ---------------- Day templates ---------------- */
export const T = (title, slots, acc) => ({ title, slots, acc });
export const S = (lift, role) => ({ lift, role });

export const TEMPLATES = {
  bal: {
    3: [
      T("Squat Heavy", [S("squat", "primary"), S("bench", "secondary")], "squatDay"),
      T("Bench Heavy + Deadlift", [S("bench", "primary"), S("deadlift", "primary")], "deadDay"),
      T("Deadlift Variation + Bench Volume", [S("deadlift", "paused"), S("bench", "secondary"), S("squat", "tech")], "volumeDay"),
    ],
    // Lalit sample week: squat-driven · bench intensity · deadlift controlled · bench volume + squat technique
    4: [
      T("Squat Heavy", [S("squat", "primary"), S("bench", "secondary")], "squatDay"),
      T("Bench Heavy", [S("bench", "primary")], "benchDay"),
      T("Deadlift Heavy", [S("deadlift", "primary"), S("bench", "tech")], "deadDay"),
      T("Bench Volume + Squat Technique", [S("bench", "paused"), S("squat", "tech")], "volumeDay"),
    ],
    5: [
      T("Squat Heavy", [S("squat", "primary"), S("bench", "secondary")], "squatDay"),
      T("Bench Heavy", [S("bench", "primary")], "benchDay"),
      T("Deadlift Heavy", [S("deadlift", "primary")], "deadDay"),
      T("Squat Volume", [S("squat", "paused")], "squatVol"),
      T("Bench Volume", [S("bench", "paused")], "volumeDay"),
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
  },
};

const SUPPORT_DAYS = [
  { ...T("Support Day — Technique + Accessories", [S("bench", "tech"), S("squat", "tech")], "supportDay"), optional: true, support: true },
  { ...T("Support Day — Deadlift Technique + Mobility", [S("deadlift", "tech")], "supportDay"), optional: true, support: true },
];

/** Training days ≠ stress days. 5–6 days = 4–5 core stress days + support days
 *  (light technique, accessories, mobility) — the Indian 6-day-gym context. */
export function dayTemplates(days, exp, focus) {
  if (exp === "beg") {
    const base = [
      T("Full Body A", [S("squat", "beg"), S("bench", "beg")], "pullA"),
      T("Full Body B", [S("squat", "begLight"), S("deadlift", "begDL"), S("bench", "begPause")], "pullB"),
      T("Full Body C", [S("squat", "beg"), S("bench", "beg")], "pullC"),
    ];
    const out = [...base];
    for (let i = 3; i < days; i++) out.push({ ...T("Technique + GPP (Optional)", [], "gpp"), optional: true, support: true });
    return out;
  }
  const t = TEMPLATES[focus] || TEMPLATES.bal;
  if (days <= 4) return t[days] || t[4];
  const coreDays = exp === "adv" ? 5 : 4;
  const core = t[coreDays];
  const support = SUPPORT_DAYS.slice(0, days - coreDays);
  return [...core, ...support];
}

/** Weekday assignment: support days sit between core days so hard days get rest around them. */
export function weekdaysFor(tmpl, days) {
  const coreCount = tmpl.filter((d) => !d.support).length;
  const supportCount = tmpl.length - coreCount;
  if (supportCount === 0) return WEEKDAYS[days] || WEEKDAYS[4];
  const core = WEEKDAYS[Math.min(5, coreCount)] || WEEKDAYS[4];
  const supportSlots = ["Wednesday", "Saturday", "Sunday"].filter((d) => !core.includes(d));
  const out = [];
  let ci = 0, si = 0;
  for (const d of tmpl) out.push(d.support ? supportSlots[si++] || "Extra" : core[ci++]);
  return out;
}

/* ---------------- Accessories (by day role) ---------------- */
export const ACC = {
  squatDay: [
    { name: "Leg Press or Bulgarian Split Squat", sr: "3 × 10–12", rpe: "RPE 8" },
    { name: "Leg Curl", sr: "3 × 10–12", rpe: "RPE 8" },
    { name: "Hanging Leg Raise / Ab Wheel", sr: "3 × 10–15", rpe: "—" },
    { name: "Chest-Supported Row", sr: "3 × 10–12", rpe: "RPE 8" },
  ],
  benchDay: [
    { name: "Barbell Row", sr: "4 × 8–10", rpe: "RPE 8" },
    { name: "Overhead Press (DB or Barbell)", sr: "3 × 8–10", rpe: "RPE 8" },
    { name: "Triceps: Dips or Pushdown", sr: "3 × 10–12", rpe: "RPE 8–9" },
    { name: "Face Pull + Rear Delt Fly", sr: "3 × 15", rpe: "RPE 8" },
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
    { name: "Triceps Pushdown", sr: "3 × 12", rpe: "RPE 8" },
  ],
  squatVol: [
    { name: "Walking Lunge", sr: "3 × 10/leg", rpe: "RPE 8" },
    { name: "Leg Curl", sr: "3 × 10–12", rpe: "RPE 8" },
    { name: "Plank or Ab Wheel", sr: "3 × 30–45 sec", rpe: "—" },
    { name: "Leg Extension", sr: "3 × 12", rpe: "RPE 8" },
  ],
  upperDay: [
    { name: "Pull-ups or Lat Pulldown", sr: "4 × 8–12", rpe: "RPE 8" },
    { name: "Chest-Supported Row", sr: "3 × 10–12", rpe: "RPE 8" },
    { name: "Face Pull + Rear Delt Fly", sr: "3 × 15", rpe: "RPE 8" },
    { name: "Biceps + Triceps (superset)", sr: "3 × 10–12", rpe: "RPE 8–9" },
  ],
  supportDay: [
    { name: "Chest-Supported Row (light)", sr: "3 × 12", rpe: "RPE 7" },
    { name: "Face Pull + Band Pull-Apart", sr: "3 × 15", rpe: "RPE 7" },
    { name: "Core: Dead Bug / Plank", sr: "3 × 30–45 sec", rpe: "—" },
    { name: "Mobility circuit (hips, ankles, T-spine)", sr: "10–15 min", rpe: "easy" },
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

/* ---------------- Injury swaps ---------------- */
export const SWAPS = {
  back: {
    "Barbell Row": "Chest-Supported Row (spine-safe)",
    "Romanian Deadlift": "Leg Curl (spine-safe swap)",
    "Back Extension": "Bird Dog + Side Plank (spine-safe)",
    "Hanging Leg Raise / Ab Wheel": "Dead Bug / Plank (spine-safe)",
    "Walking Lunge": "Leg Press (light, spine-safe)",
    "Good Morning": "Leg Curl (spine-safe swap)",
    "Snatch-Grip Deadlift (light, upper back)": "Chest-Supported Row (spine-safe)",
  },
  knee: {
    "Leg Press or Bulgarian Split Squat": "Hip Thrust (knee-friendly)",
    "Walking Lunge": "Leg Curl (knee-friendly swap)",
    "Leg Press (deep ROM)": "Leg Press (pain-free ROM only)",
    "Leg Press (quad focus)": "Leg Press (pain-free ROM only)",
    "Leg Extension": "Leg Extension (pain-free ROM, light)",
  },
  shoulder: {
    "Triceps: Dips or Pushdown": "Triceps Pushdown (avoid dips)",
    "Overhead Press (DB or Barbell)": "Landmine or Neutral-Grip DB Press",
    "Overhead Press (strict)": "Landmine Press (shoulder-safe)",
    "Incline DB Press": "Incline DB Press (neutral grip)",
    "Dips (weighted if possible)": "JM Press or Pushdown (avoid dips)",
  },
};

export function applySwaps(accList, injuries) {
  return accList.map((a) => {
    let name = a.name;
    for (const key of ["back", "knee", "shoulder"]) {
      if (injuries?.[key] && SWAPS[key][name]) name = SWAPS[key][name];
    }
    return { ...a, name };
  });
}

/* ---------------- Equipment substitutions ----------------
   commercial = everything · basic = barbell, rack, bench, plates, DBs, pull-up bar
   minimal = barbell, rack, bench, plates only */
const EQUIP_SUBS = {
  basic: [
    ["Leg Press or Bulgarian Split Squat", "Bulgarian Split Squat (DB)"],
    ["Leg Press (deep ROM)", "Goblet Squat (deep, pause)"],
    ["Leg Press (quad focus)", "Front Squat (light) or Goblet Squat"],
    ["Leg Press (leg drive focus)", "Front Squat (light)"],
    ["Leg Press (quads + glutes)", "Front Squat (light)"],
    ["Leg Press", "Bulgarian Split Squat (DB)"],
    ["Hack Squat", "Front Squat (light)"],
    ["Pendulum / Hack Squat", "Front Squat (light)"],
    ["Leg Extension (pain-free ROM, light)", "Step-ups (light)"],
    ["Leg Extension", "Step-ups (DB)"],
    ["Leg Curl (spine-safe swap)", "Nordic Curl (eccentric) or DB RDL"],
    ["Leg Curl (knee-friendly swap)", "Glute Bridge"],
    ["Leg Curl", "Nordic Curl (eccentric) or Romanian Deadlift"],
    ["Lat Pulldown or Pull-ups", "Pull-ups (band-assisted if needed)"],
    ["Pull-ups or Lat Pulldown", "Pull-ups (band-assisted if needed)"],
    ["Chin-ups or Lat Pulldown", "Chin-ups (band-assisted if needed)"],
    ["Chest-Supported Row (upper back)", "Single-Arm DB Row (chest braced)"],
    ["Chest-Supported Row (light)", "Single-Arm DB Row (light)"],
    ["Chest-Supported Row (spine-safe)", "Single-Arm DB Row (chest braced)"],
    ["Chest-Supported Row", "Single-Arm DB Row"],
    ["Triceps: Dips or Pushdown", "Close-Grip Push-ups or Skull Crushers"],
    ["Triceps Pushdown (avoid dips)", "Skull Crushers (DB)"],
    ["Triceps Pushdown (light)", "DB Overhead Extension (light)"],
    ["Triceps Pushdown", "DB Overhead Extension"],
    ["Chest Fly / Machine Press", "DB Fly"],
    ["Face Pull + Rear Delt Fly", "Rear Delt DB Fly + Band Pull-Apart"],
    ["Face Pull + Band Pull-Apart", "Rear Delt DB Fly + Band Pull-Apart"],
    ["Rear Delt Fly + Biceps Curl (superset)", "Rear Delt DB Fly + DB Curl (superset)"],
    ["Belt Squat", "Pin Squat (above parallel)"],
    ["Back Extension", "Romanian Deadlift (light) or Reverse Hyper on bench"],
    ["Bird Dog + Side Plank (spine-safe)", "Bird Dog + Side Plank (spine-safe)"],
    ["Sled push / incline walk / cardio", "Incline walk / cardio"],
  ],
  minimal: [
    ["Leg Press or Bulgarian Split Squat", "Bulgarian Split Squat (bodyweight / plate)"],
    ["Leg Press (deep ROM)", "Paused Goblet Squat with a plate"],
    ["Leg Press (quad focus)", "Front Squat (light)"],
    ["Leg Press (leg drive focus)", "Front Squat (light)"],
    ["Leg Press (quads + glutes)", "Front Squat (light)"],
    ["Leg Press", "Bulgarian Split Squat (bodyweight / plate)"],
    ["Hack Squat", "Front Squat (light)"],
    ["Pendulum / Hack Squat", "Front Squat (light)"],
    ["Leg Extension (pain-free ROM, light)", "Step-ups (light)"],
    ["Leg Extension", "Step-ups (bodyweight / plate)"],
    ["Leg Curl (spine-safe swap)", "Nordic Curl (eccentric)"],
    ["Leg Curl (knee-friendly swap)", "Glute Bridge"],
    ["Leg Curl", "Nordic Curl (eccentric) or Romanian Deadlift"],
    ["Lat Pulldown or Pull-ups", "Barbell Row"],
    ["Pull-ups or Lat Pulldown", "Barbell Row"],
    ["Chin-ups or Lat Pulldown", "Barbell Row (underhand)"],
    ["Chest-Supported Row (upper back)", "Pendlay Row (strict)"],
    ["Chest-Supported Row (light)", "Barbell Row (light)"],
    ["Chest-Supported Row (spine-safe)", "Bird Dog + Band Pull-Apart"],
    ["Chest-Supported Row", "Barbell Row"],
    ["Single-Arm DB Row", "Barbell Row"],
    ["Triceps: Dips or Pushdown", "Close-Grip Push-ups or Skull Crushers (bar)"],
    ["Triceps Pushdown (avoid dips)", "Skull Crushers (bar)"],
    ["Triceps Pushdown (light)", "Close-Grip Push-ups"],
    ["Triceps Pushdown", "Skull Crushers (bar)"],
    ["Skull Crushers", "Skull Crushers (bar)"],
    ["Dips (weighted if possible)", "Close-Grip Bench Press (light) or Push-ups"],
    ["DB Bench Press (deep stretch)", "Close-Grip Bench / Push-ups (deep)"],
    ["Incline DB Press", "Close-Grip Bench Press (light)"],
    ["Overhead Press (DB or Barbell)", "Overhead Press (Barbell)"],
    ["Landmine or Neutral-Grip DB Press", "Landmine Press (bar in corner)"],
    ["Chest Fly / Machine Press", "Push-ups (deep)"],
    ["Face Pull + Rear Delt Fly", "Band Pull-Apart or Plate Rear Delt Raise"],
    ["Face Pull + Band Pull-Apart", "Band Pull-Apart or Plate Rear Delt Raise"],
    ["Rear Delt Fly + Biceps Curl (superset)", "Plate Rear Delt Raise + Barbell Curl"],
    ["Biceps + Triceps (superset)", "Barbell Curl + Skull Crushers (superset)"],
    ["Biceps Curl", "Barbell Curl"],
    ["Belt Squat", "Pin Squat (above parallel)"],
    ["Back Extension", "Romanian Deadlift (light)"],
    ["Hip Thrust (heavy)", "Barbell Hip Thrust / Glute Bridge"],
    ["Hip Thrust (knee-friendly)", "Barbell Glute Bridge"],
    ["Walking Lunge", "Reverse Lunge (bar or bodyweight)"],
    ["Sled push / incline walk / cardio", "Walk / jump rope"],
    ["Hip mobility + deep goblet squat hold", "Hip mobility + deep bodyweight squat hold"],
  ],
};
export function applyEquipment(accList, equipment) {
  const subs = EQUIP_SUBS[equipment];
  if (!subs) return accList;
  return accList.map((a) => {
    const hit = subs.find(([k]) => a.name === k) || subs.find(([k]) => a.name.startsWith(k));
    return hit ? { ...a, name: hit[1] } : a;
  });
}

/* ---------------- Recovery / readiness ---------------- */
export function recoveryProfile(form) {
  const poor = form.sleep === "low" || form.stress === "high";
  const mid = !poor && (form.sleep === "mid" || form.stress === "mid");
  let r;
  if (poor) r = { level: "poor", setDelta: -1, rpeCap: 7.5, note: "Recovery is POOR (sleep/stress) — volume reduced by 1 set, RPE capped at 7.5. Fix sleep first; the volume comes back." };
  else if (mid) r = { level: "mid", setDelta: 0, rpeCap: null, note: "Recovery is borderline — take the deload week seriously. Don't skip it." };
  else r = { level: "good", setDelta: 0, rpeCap: null, note: null };
  // Block-end evaluation can ask for less volume this block (repeat with −20% volume).
  if (form.volumeDelta) { r.setDelta = Math.max(-2, Math.min(0, r.setDelta + form.volumeDelta)); r.note = [r.note, "Last block showed fatigue — one set less on the main lifts this block."].filter(Boolean).join(" "); }
  return r;
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

/* ---------------- Meet-aware phasing ----------------
   The engine never ignores a meet date. It decides the phase from
   weeks-out using the System 2.0 timeline:
   >10 wk out → Base · 5–10 wk → Strength · ≤5 wk → Peaking → Taper → Meet week.
   Edge cases are handled explicitly (meet in 10 days, meet passed, …). */
export function daysToMeet(profile) {
  if (!profile?.competition_date) return null;
  return Math.ceil((new Date(profile.competition_date) - new Date()) / 86400000);
}

export function meetPhase(days, exp) {
  if (days === null || days === undefined) return { phase: "none" };
  if (days <= 0 && days > -14) return { phase: "post", reason: "Meet just happened — one deload week (volume −50%, light technique), then a Base block. No heavy work this week." };
  if (days <= -14) return { phase: "none", reason: "Meet date is in the past — planning a normal block. Update the date when the next meet is booked." };
  // Full template weeks that fit before the final ~7–14 calendar days (taper sessions → activation → light single → rest → meet).
  const fullWeeks = Math.max(0, Math.floor((days - 1) / 7) - 1);
  const finalDays = days - fullWeeks * 7;
  if (days <= 5) return { phase: "meetweek", fullWeeks: 0, finalDays, reason: `Meet in ${days} day${days === 1 ? "" : "s"} — this is MEET WEEK. No new block, no changes, no PR attempts in the gym. One light session at most, then rest. Rest is training now.` };
  if (days <= 14) return { phase: "taper", fullWeeks: 0, finalDays, reason: `Meet in ${days} days — TAPER into the meet. Volume −40–50%, 70–75%, nothing above 75%, nothing new. Last 2 days: complete rest.` };
  if (exp === "beg") {
    if (days <= 35) return { phase: "beginner", fullWeeks, finalDays, reason: `Meet in ${days} days — beginner stays on linear progression for ${fullWeeks} week${fullWeeks === 1 ? "" : "s"}, then the plan tapers into the meet. Practice commands and pauses every session.` };
    return { phase: "beginner", fullWeeks: 4, finalDays: 0, reason: `Meet in ${days} days — beginner stays on linear progression; the taper comes in the last block before the meet.` };
  }
  if (days <= 35) return { phase: "peak", fullWeeks, finalDays, reason: `Meet in ${days} days — PEAKING: ${fullWeeks} peaking week${fullWeeks === 1 ? "" : "s"}, then taper into the meet. Competition lifts only, accessories minimal.` };
  if (days <= 70) return { phase: "strength", fullWeeks: 4, finalDays: 0, reason: `Meet in ${days} days — STRENGTH block now (heavy 2–5s); peaking starts ~5 weeks out.` };
  return { phase: "base", fullWeeks: 4, finalDays: 0, reason: `Meet in ${days} days — enough time for a BASE block first (muscle + work capacity), strength and peaking later.` };
}

/* ---------------- Lift builders ---------------- */
const BEG_START = { squat: 70, bench: 70, deadlift: 72.5 };
const BEG_INC = { squat: 2.5, bench: 1.25, deadlift: 2.5 };

function stickingFor(form) {
  if (form.weak === "none" || !form.sticking) return null;
  const st = STICKING[form.weak]?.[form.sticking];
  if (!st) return null;
  const idx = (v, arr) => { const n = Number(v); return Number.isInteger(n) && n >= 0 && n < arr.length ? n : 0; };
  const variation = st.variations[idx(form.variationIdx, st.variations)];
  const acc = st.accessories[idx(form.accIdx, st.accessories)];
  return { ...st, variation, acc, l: st.l, note: st.note };
}

export function buildLift(slot, wk, form, maxes, rec, scheme) {
  const { lift, role } = slot;
  const max = maxes[lift] || 0;
  const stick = stickingFor(form);
  const weakType = form.weakType || "strength";
  const w = scheme || {};
  const mk = (name, sets, reps, pct, rpe, note, kgOverride) => ({
    name, sets, reps, rpe,
    pct: pct || null,
    kg: kgOverride ?? (max && pct ? round25((pct / 100) * max) : null),
    note: note || null, lift,
  });

  // ---- Beginner linear: fixed kg jumps while RPE ≤ 8 (System 2.0 / A–Z)
  if (role === "beg" || role === "begLight" || role === "begDL" || role === "begPause") {
    const light = role === "begLight", pause = role === "begPause", dl = role === "begDL";
    // 1.25 kg bench jumps need 0.625 kg micro-plates — only assume them in a commercial gym.
    const micro = lift === "bench" && form.equipment === "commercial";
    const rnd = micro ? round125 : round25;
    const liftInc = micro ? BEG_INC.bench : lift === "bench" ? 2.5 : BEG_INC[lift];
    const startPct = light ? BEG_START[lift] - 7.5 : pause ? BEG_START[lift] - 10 : BEG_START[lift];
    const inc = (light || pause ? 0.5 : 1) * liftInc;
    const base = max ? rnd((startPct / 100) * max) : null;
    let kg = base ? rnd(base + wk * inc) : null;
    let sets = dl ? 2 : light || pause ? 2 : 3;
    let reps = 5;
    const notes = [];
    if (w.taper || w.meetweek) {
      // Beginner taper: same lifts, lighter, fewer sets — practice the commands.
      kg = base ? rnd(base * 0.9) : null;
      sets = 2; reps = w.meetweek ? 2 : 3;
      notes.push(w.meetweek ? "Meet week — light and crisp. Pause every squat/bench rep like on the platform." : "Taper — lighter than last week on purpose. Clean reps, full commands, walk out feeling fresh.");
    }
    const pct = max && kg ? Math.round((kg / max) * 200) / 2 : null;
    const name = pause ? PAUSED[lift] : LIFT_NAMES[lift] + (light ? " (Light)" : "");
    const rpe = w.taper || w.meetweek ? "RPE 6" : light ? "RPE 6–7" : pause ? "RPE 7" : "RPE ≤ 8";
    if (wk === 0 && !light && !pause && !w.taper) notes.push(`+${liftInc} kg each week while every rep stays clean and RPE ≤ 8. Miss reps → repeat the weight. Miss twice → −10%, then half the jump.${lift === "bench" && !micro ? " Have 0.5 kg micro-plates? Use +1.25 kg jumps instead." : ""}`);
    if (light) notes.push("Technique focus — same setup every rep, bar speed first");
    if (dl) notes.push("Deadlift carries a high fatigue cost — 2 clean sets is enough");
    if (!max) notes.push("No 1RM needed: pick a weight you can do for 5 clean reps with 3 reps left, then add 2.5 kg weekly");
    return mk(name, sets, reps, pct, rpe, notes.join(" · ") || null, kg);
  }

  const notes = [];
  const base = lift === "deadlift" && w.dl ? w.dl : w;

  if (role === "tech") {
    const pct = w.deload ? 55 : w.taper ? 60 : 62.5;
    return mk(LIFT_NAMES[lift] + " (Technique/Speed)", 3, 3, pct, "RPE 5–6", "Light technique work — competition commands, same setup every rep, maximum bar speed");
  }
  if (role === "activation") {
    return mk(LIFT_NAMES[lift] + " (Activation)", 2, 2, 60, "RPE 5", "Meet week — grease the groove, nothing heavy. Feel the commands.");
  }
  if (role === "primer") {
    return mk(LIFT_NAMES[lift] + " (Light single · commands)", 1, 1, 70, "RPE 5–6", "NOT your opener — your opener (~90%) happens on the platform. This is one crisp 70% single to groove the commands. Walk away feeling strong, not tired.");
  }

  if (role === "primary") {
    let sets = base.sets;
    let reps = base.reps;
    let rpe = w.rpe;
    let pct = base.pct;
    let capped = false;   // the load was actually lowered → no "+2.5 kg" notes, RPE re-derived
    let noExtras = false; // heavy singles removed (pain flag / technique / estimated max)
    const cap = (limit, why, soft) => { noExtras = true; if (pct > limit) { pct = limit; capped = true; notes.push(why); } else if (soft) notes.push(soft); };
    if (form.weak === lift && !w.deload && weakType === "strength") {
      sets += 1;
      notes.push(stick ? stick.note : "+1 set (weakest lift — extra volume)");
    }
    if (!w.deload && rec.setDelta) sets = Math.max(2, sets + rec.setDelta);
    if (!w.deload && weakType === "fatigue") { sets = Math.max(2, sets - 1); rpe = Math.min(rpe, 7); notes.push("Warm-ups felt heavy → volume −1 set, RPE capped at 7 this block. Recover first, then push."); }
    if (!w.deload && rec.rpeCap) rpe = Math.min(rpe, rec.rpeCap);
    // Pain flags gate the LOAD, not just the label (System 2.0: pain = the set ends, load comes down first).
    if (form.injuries?.back && (lift === "squat" || lift === "deadlift")) {
      rpe = Math.min(rpe, 7.5);
      cap(80, "Lower-back flag — load capped at 80%, no heavy singles until 2 pain-free weeks. Any pain = end the set", "Lower-back flag — RPE capped at 7.5, no heavy singles. Any pain = end the set");
    }
    if (form.injuries?.knee && lift === "squat") cap(85, "Knee flag — load capped at 85%, controlled tempo, pain-free depth only", "Knee flag — controlled tempo, pain-free depth only");
    if (form.injuries?.shoulder && lift === "bench") cap(85, "Shoulder flag — load capped at 85%, slightly narrower grip, tuck the elbows", "Shoulder flag — slightly narrower grip, tuck the elbows");
    // Technique issue on this lift: heavy weights only rehearse the broken pattern — hold the primary at ≤80%.
    if (form.weak === lift && weakType === "technique") cap(80, "TECHNIQUE issue — primary held at 80% until the position holds under load. Film one set per session", "TECHNIQUE issue — perfect position every rep, film one set per session");
    // Untested / estimated max: nothing above 87.5% in the plan — earn the heavy singles first.
    if (maxes.estimated && !w.deload) cap(87.5, "Your max is an estimate — nothing above 87.5% until a clean heavy single confirms it");
    if (capped) {
      // A capped single/double at 80% is too easy to be useful — add reps until it is real work (RPE ≥ 6).
      while (rpeFor(pct, reps) < 6 && reps < 5) reps++;
      rpe = Math.min(rpe, rpeFor(pct, reps));
    }
    if (w.note && !w.deload && !noExtras) notes.push(w.note);
    if (w.taper) notes.push("Taper — nothing above 75%. Freshness is the goal.");
    else if (w.deload) notes.push("Deload — the weight will feel light. Keep it light.");
    const realism = pct ? rpeFor(pct, reps) : null;
    if (realism && !w.deload && !w.extras && !capped && Math.abs(realism - rpe) >= 1.5) notes.push(`If this feels ≤ RPE ${realism}, the % is light for you today — add 2.5 kg. RPE is the final judge.`);
    const out = mk(LIFT_NAMES[lift], sets, reps, pct, `RPE ${rpe}`, notes.join(" · ") || null);
    if (w.extras && !w.deload && !noExtras) {
      out.extras = w.extras.map((e) => ({ name: `${LIFT_NAMES[lift]} — single`, sets: 1, reps: e.reps, pct: e.pct, kg: max ? round25((e.pct / 100) * max) : null, rpe: `RPE ${rpeFor(e.pct, 1)}`, note: e.note, lift }));
    }
    return out;
  }

  if (role === "secondary") {
    const sets = Math.max(2, base.sets - 1);
    const reps = Math.min(base.reps + 2, 8);
    const pct = Math.max(67.5, w.deload ? base.pct - 5 : base.pct - 10);
    return mk(LIFT_NAMES[lift], sets, reps, pct, `RPE ${Math.max(6, Math.min(w.rpe - 1, rpeFor(pct, reps)))}`, "Secondary slot — volume work, don't grind reps");
  }

  // paused / variation slot — dropped in deload and taper (nothing new, nothing extra)
  if (w.deload || w.taper) return null;
  if (stick && form.weak === lift && weakType !== "fatigue") {
    const extraOff = weakType === "technique" ? -5 : 0;
    const pct = Math.max(40, (w.deload ? base.pct - 5 : base.pct) + stick.variation.off + extraOff);
    const note = weakType === "technique" ? `${stick.note} · TECHNIQUE issue: lighter load, perfect position, film every set` : stick.note;
    return mk(stick.variation.name, 3, Math.min(base.reps, 5), pct, "RPE 7", note);
  }
  const pct = w.deload ? base.pct - 10 : base.pct - 15;
  return mk(PAUSED[lift], 3, Math.min(base.reps, 5), pct, "RPE 7", "Variation — position and control work");
}

/* ---------------- Week plan assembly ---------------- */
function weekPlan(form, meet) {
  // Returns the list of week schemes with phase labels. Length varies with the meet.
  const goal = SCHEMES[form.goal] ? form.goal : "str";
  const P = SCHEMES.peak.weeks;
  const begWeeks = (n) => SCHEMES.hyp.weeks.slice(0, n).map((w) => ({ ...w, deload: false, acc: 2 }));
  switch (meet?.phase) {
    case "meetweek": return { weeks: [], final: true, blockLabel: "Meet Week" };
    case "taper": return { weeks: [], final: true, blockLabel: "Taper → Meet" };
    case "peak": {
      const n = Math.min(3, Math.max(1, meet.fullWeeks)); // peaking weeks before the taper
      const peakWeeks = n === 1 ? [P[2]] : n === 2 ? [P[1], P[2]] : [P[0], P[1], P[2]];
      return { weeks: peakWeeks, final: true, blockLabel: SCHEMES.peak.label };
    }
    case "beginner":
      return meet.finalDays ? { weeks: begWeeks(Math.max(1, meet.fullWeeks)), final: true, blockLabel: "Beginner Linear → Meet", goal: "beg" } : { weeks: begWeeks(4), blockLabel: "Beginner Linear Block", goal: "beg" };
    case "strength": return { weeks: SCHEMES.str.weeks, blockLabel: SCHEMES.str.label, goal: "str" };
    case "base": return { weeks: SCHEMES.hyp.weeks, blockLabel: SCHEMES.hyp.label, goal: "hyp" };
    case "post": return { weeks: [{ ...SCHEMES.hyp.weeks[3], label: "Post-meet Deload" }, ...SCHEMES.hyp.weeks.slice(0, 3)], blockLabel: "Post-meet Recovery → Base" };
    default:
      if (form.exp === "beg") return { weeks: SCHEMES.hyp.weeks.map((w) => ({ ...w, deload: false, acc: 2 })), blockLabel: "Beginner Linear Block", goal: "beg" };
      return { weeks: SCHEMES[goal].weeks, blockLabel: SCHEMES[goal].label, goal };
  }
}

/** The last days before a meet are laid out from the meet DATE, not from a template:
 *  taper sessions on the lifter's normal training days while ≥ 6 days out, activation 5 days out,
 *  one light single 3 days out, complete rest the last 2 days, then the meet. Beginners taper on their own template. */
function finalStretch(startOffset, form, maxes, rec, tmpl, wdays) {
  const D = form.meetDays;
  const taperScheme = { ...SCHEMES.peak.weeks[3], label: "Taper" };
  const meetScheme = { meetweek: true, deload: true, sets: 2, reps: 2, pct: 60, rpe: 5, acc: 0 };
  const taperDays = [], meetDays = [];
  for (let off = Math.max(0, startOffset); off <= D; off++) {
    const date = new Date(Date.now() + off * 86400000);
    const weekday = ALL_DAYS[(date.getDay() + 6) % 7];
    const dateLabel = date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    const before = D - off;
    const day = (title, main, extra = {}) => ({ weekday, date: dateLabel, title, optional: false, main, acc: [], ...extra });
    if (before === 0) meetDays.push(day("MEET DAY", [], { meetDay: true, note: "Warm-up to opener: bar → 40% ×4 → 60% ×3 → 80% ×2 → 90% ×1 → 5–10 min → Attempt 1. Nothing new today." }));
    else if (before === 5) meetDays.push(day("Activation", ["squat", "bench", "deadlift"].map((l) => buildLift(S(l, "activation"), 0, form, maxes, rec, meetScheme))));
    else if (before === 3) meetDays.push(day("Light Singles + Commands", ["squat", "bench"].map((l) => buildLift(S(l, "primer"), 0, form, maxes, rec, meetScheme))));
    else if (before >= 6) {
      const di = wdays.indexOf(weekday);
      const t = di >= 0 ? tmpl[di] : null;
      if (!t || t.support) continue;
      const main = t.slots.map((sl) => buildLift(sl, 0, form, maxes, rec, taperScheme)).filter(Boolean);
      if (main.length) taperDays.push(day(t.title, main));
    }
  }
  const restOf = (days) => ALL_DAYS.filter((d) => !days.some((x) => x.weekday === d));
  const out = [];
  if (taperDays.length) out.push({ label: "Taper", deload: false, taper: true, phase: "Taper", days: taperDays, restDays: restOf(taperDays), notes: ["Taper: same lifts, 70–75%, half the sets, no accessories. You should leave every session feeling you could have done much more — that is the point."] });
  const meetWeekday = meetDays.at(-1)?.weekday;
  out.push({ label: "Meet Week", deload: true, meetWeek: true, phase: "Meet Week", days: meetDays, restDays: restOf(meetDays), notes: [`Meet day: ${meetWeekday}. ` + MEET_WEEK_NOTES[0], ...MEET_WEEK_NOTES.slice(1)] });
  return out;
}
const MEET_WEEK_NOTES = [
  "Activation 5 days out, one light single 3 days out, then COMPLETE REST the last 2 days. Rest is training now.",
  "Nothing new on meet day: same belt, same shoes, same setup, same warm-up you trained with.",
  "Attempts: 1st = the lift you make on any day (~90%). 2nd = your real lift (~95–100%). 3rd = small PR only if 1 and 2 were clean.",
  "Warm-up to opener: 4×1 @40% → 3×1 @60% → 2×1 @80% → 1×1 @90% → 5–10 min rest → Attempt 1.",
  "Between lifts: walk 2–3 min, eat (carbs + protein), hydrate, 10–15 min calm, 5-min activation before the next lift.",
];

export function buildProgram(form, maxes) {
  const rec = recoveryProfile(form);
  const meet = meetPhase(form.meetDays ?? null, form.exp);
  const plan = weekPlan(form, meet);
  const isBeg = form.exp === "beg";
  let tmpl = isBeg ? dayTemplates(form.days, "beg", form.focus) : dayTemplates(form.days, form.exp, form.focus);
  // Weak-point variation must actually appear: if the weak lift has no variation slot in this template,
  // turn its technique slot into one, or add one to the last core day.
  const stickEarly = stickingFor(form);
  if (!isBeg && stickEarly && form.weak !== "none" && (form.weakType || "strength") !== "fatigue") {
    tmpl = tmpl.map((d) => ({ ...d, slots: d.slots.map((s) => ({ ...s })) }));
    const hasVar = tmpl.some((d) => d.slots.some((s) => s.lift === form.weak && s.role === "paused"));
    if (!hasVar) {
      const techDay = tmpl.find((d) => d.slots.some((s) => s.lift === form.weak && s.role === "tech"));
      if (techDay) techDay.slots.find((s) => s.lift === form.weak && s.role === "tech").role = "paused";
      else { const last = [...tmpl].reverse().find((d) => !d.support); if (last) last.slots.push(S(form.weak, "paused")); }
    }
  }
  const wdays = weekdaysFor(tmpl, form.days);
  const stick = stickingFor(form);
  const weakType = form.weakType || "strength";
  const level = form.exp === "beg" ? "beg" : form.exp === "adv" ? "adv" : "int";
  const budget = { beg: [10, 12], int: [13, 15], adv: [16, 20] }[level];

  const notes = [];
  if (meet.reason) notes.push(meet.reason);
  if (weakType === "technique") notes.push("Form breaks even at light loads → this is a TECHNIQUE issue. Variations at lighter loads, no extra accessory volume, film one set per session.");
  if (weakType === "fatigue") notes.push("Warm-ups feel heavy → FATIGUE, not weakness. No new variations this block; volume −1 set, RPE capped at 7. If it persists 2 weeks, deload now.");

  const weeks = plan.weeks.map((w, wi) => {
    const label = w.label || `Week ${wi + 1}`;
    const deload = !!w.deload;
    const accCount = w.acc ?? 3;
    return {
      label, deload, taper: !!w.taper, phase: w.taper ? "Taper" : deload ? "Deload" : plan.blockLabel,
      days: tmpl.map((d, di) => {
        const main = d.slots.map((s) => buildLift(s, wi, form, maxes, rec, w)).filter(Boolean);
        let acc = applyEquipment(applySwaps([...(ACC[d.acc] || [])], form.injuries), form.equipment);
        // accessories scale with the block: base 3–4, strength 2–3, peaking 0–2, taper 0
        const cap = isBeg ? acc.length : d.support ? acc.length : d.acc === "deadDay" ? Math.max(0, accCount - 1) : accCount;
        acc = acc.slice(0, cap);
        if (form.weak !== "none" && stick && weakType === "strength" && !d.optional && !deload && !w.taper) {
          if (d.slots.find((s) => s.lift === form.weak && s.role === "primary")) {
            const extra = { ...stick.acc, name: "Weak-point: " + stick.acc.name };
            acc = [...acc, applyEquipment(applySwaps([extra], form.injuries), form.equipment)[0]];
          }
        }
        if (deload || w.taper) acc = acc.slice(0, w.taper ? 0 : 2).map((a) => ({ ...a, sr: a.sr.includes("×") ? a.sr.replace(/^\d+/, "2") : a.sr, rpe: a.rpe === "—" ? a.rpe : "RPE 6" }));
        return { weekday: wdays[di] || "Extra", title: d.title, optional: d.optional, support: d.support, main, acc };
      }).filter((d) => d.main.length || d.acc.length).sort((a, b) => ALL_DAYS.indexOf(a.weekday) - ALL_DAYS.indexOf(b.weekday)),
    };
  });
  // Keep weekly hard sets inside the level's budget by dropping surplus accessories (never main lifts).
  if (plan.final && form.meetDays !== null && form.meetDays !== undefined) weeks.push(...finalStretch(plan.weeks.length * 7, form, maxes, rec, tmpl, wdays));
  // Trim ONCE on the heaviest-volume week and hold the same accessory menu all block — a coach never rotates accessories by accident.
  const trimmed = new Set();
  const refWeek = weeks.find((w) => !w.deload && !w.taper && !w.meetWeek) || weeks.find((w) => !w.meetWeek);
  if (refWeek) trimToBudget(refWeek, budget[1]).forEach((n) => trimmed.add(n));
  if (trimmed.size) for (const w of weeks) if (w !== refWeek && !w.meetWeek) for (const d of w.days) d.acc = d.acc.filter((a) => !trimmed.has(a.name));
  if (trimmed.size) notes.push(`Volume kept inside ${budget[0]}–${budget[1]} hard sets/week per movement for your level — dropped: ${[...trimmed].join(", ")}. Add back only if you are recovering easily.`);

  const count = { squat: 0, bench: 0, deadlift: 0 };
  tmpl.forEach((d) => d.slots.forEach((s) => count[s.lift]++));
  const freq = `SQ ${count.squat}× · BP ${count.bench}× · DL ${count.deadlift}× / week`;
  const volume = weeklyVolume(weeks.find((w) => !w.deload) || weeks[0]);

  // A test day only makes sense when there is no meet: the meet IS the test.
  const testDay = meet.phase === "none" && !isBeg;
  return { weeks, rec, freq, restDays: ALL_DAYS.filter((d) => !wdays.includes(d)), phase: meet.phase, blockLabel: plan.blockLabel, notes, volume, budget, testDay, meetDays: form.meetDays ?? null };
}

/** Which volume bucket an accessory belongs to (Lower / Upper push / Upper pull). */
export function accBucket(name) {
  if (/mobility|plank|dead bug|core|cardio|walk|sled|jump rope|stretch|leg raise|ab wheel|crunch|pallof|carry/i.test(name)) return null;
  if (/back ext|good morning|rdl|romanian|hip thrust|glute bridge/i.test(name)) return "hinge"; // posterior chain: counts as lower AND pull
  if (/row|pull-?up|chin|lat |pulldown|face pull|rear delt|snatch|band pull/i.test(name)) return "pull";
  if (/squat|leg|lunge|hip|glute|nordic|step|deadlift|block|deficit|belt|hack|pendulum|extension|bridge/i.test(name)) return "lower";
  if (/bench|press|dip|triceps|push|skull|fly|jm|overhead/i.test(name)) return "push";
  return null;
}
const isHardSet = (m) => !/Technique|Activation|Opener/.test(m.name);

/** Count hard sets per bucket for one week. Deadlift counts in both lower and pull; light technique work is not counted. */
export function weeklyVolume(week) {
  const v = { lower: 0, push: 0, pull: 0 };
  for (const d of week.days || []) {
    for (const m of d.main) {
      if (!isHardSet(m)) continue;
      if (m.lift === "deadlift") { v.lower += m.sets; v.pull += m.sets; }
      else if (m.lift === "squat") v.lower += m.sets;
      else v.push += m.sets;
    }
    for (const a of d.acc) {
      const sets = parseInt(String(a.sr), 10) || 0;
      const b = accBucket(a.name);
      if (b === "hinge") { v.lower += sets; v.pull += sets; }
      else if (b) v[b] += sets;
    }
  }
  return v;
}

/** Trim accessories (never weak-point work, never main lifts) until each bucket fits the level's weekly budget.
 *  A–Z rule: 3–4 clean sets beat 6 sloppy ones; accessories support the lift, they don't compete with it. */
function trimToBudget(week, budgetMax) {
  const removed = [];
  for (let guard = 0; guard < 30; guard++) {
    const v = weeklyVolume(week);
    const over = Object.keys(v).find((k) => v[k] > budgetMax);
    if (!over) break;
    // remove from the day that has the most accessories in that bucket, last one first
    let best = null;
    for (const d of week.days) {
      const idx = [...d.acc.keys()].reverse().find((i) => { const b = accBucket(d.acc[i].name); return (b === over || (b === "hinge" && over !== "push")) && !d.acc[i].name.startsWith("Weak-point"); });
      if (idx !== undefined && (!best || d.acc.length > best.d.acc.length)) best = { d, idx };
    }
    if (!best) break;
    removed.push(best.d.acc[best.idx].name);
    best.d.acc.splice(best.idx, 1);
  }
  return removed;
}

/* ---------------- Dashboard bridge: assessment → engine form ---------------- */
const WEAK_POINT_MAP = {
  squat: { "Hole/Mid-range": "hole", "Hole": "hole", "Mid-range": "mid", "Lockout": "lockout", "Core/Collapse": "collapse" },
  bench: { "Chest/Off-chest": "chest", "Mid-range": "mid", "Lockout": "lockout", "Unstable": "unstable" },
  deadlift: { "Off-floor": "floor", "Mid-range": "knee", "Lockout": "lockout" },
};
const EXP_MAP = { Beginner: "beg", Intermediate: "int", Advanced: "adv" };
const TYPICAL_RATIO = { squat: 1, bench: 0.7, deadlift: 1.2 };

export function injuriesFromText(text) {
  const t = String(text || "").toLowerCase();
  return {
    back: /back|spine|lumbar|disc|sciatic/.test(t),
    knee: /knee|patell|menisc/.test(t),
    shoulder: /shoulder|rotator|impinge|ac joint|labrum/.test(t),
  };
}

/**
 * Build the engine `form` from a saved athlete_profiles row, then apply user
 * overrides from the dashboard. Returns { form, maxes, decisions, meet }.
 */
export function profileToForm(profile, overrides = {}) {
  const a = profile?.assessment_data || {};
  const decisions = [];
  const maxes = {
    squat: Number(profile?.squat_1rm) || 0,
    bench: Number(profile?.bench_1rm) || 0,
    deadlift: Number(profile?.deadlift_1rm) || 0,
    estimated: a.maxes_estimated === true || a.maxes_estimated === "true",
  };

  const exp = EXP_MAP[profile?.experience_level] || "int";
  const days = Math.min(6, Math.max(3, Number(profile?.training_days_per_week) || 4));
  const meetDays = daysToMeet(profile);
  const meet = meetPhase(meetDays, exp);

  // Block goal: the meet timeline decides; otherwise the stated goal.
  let goal = "str";
  if (meet.phase === "base") goal = "hyp";
  else if (meet.phase === "strength") goal = "str";
  else if (meet.phase === "peak") goal = "peak";
  else if (profile?.primary_goal === "Hypertrophy") goal = "hyp";
  if (meet.reason) decisions.push({ step: "Block Selection", decision: { base: "Base Block", strength: "Strength Block", peak: "Peaking Block", taper: "Taper → Meet", meetweek: "Meet Week", post: "Post-meet deload", beginner: "Beginner Linear" }[meet.phase] || SCHEMES[goal]?.label, reason: meet.reason });
  else if (exp === "beg") decisions.push({ step: "Block Selection", decision: "Beginner Linear Block", reason: "First year: 3 full-body days, same lifts every week, +2.5 kg while RPE ≤ 8. Skill before load." });
  else if (goal === "hyp") decisions.push({ step: "Block Selection", decision: "Base Block", reason: "Goal is muscle + capacity — 6–8 reps at 70–80%, accessories 10–15" });
  else decisions.push({ step: "Block Selection", decision: "Strength Block", reason: "No meet date — heavy 2–5s at 80–90%, the range where strength is built" });

  // Weak point pre-checks: technique vs strength vs fatigue (System 2.0 Ch.12 / A–Z Ch.7)
  const weakType = a.weak_type === "technique" || a.weak_type === "fatigue" ? a.weak_type : "strength";

  // Weakest lift: among flagged lifts, the one furthest below a balanced ratio.
  const flagged = ["squat", "bench", "deadlift"].filter((l) => {
    const label = a[`${l}_weak_point`];
    return label && label !== "None" && WEAK_POINT_MAP[l][label];
  });
  let weak = "none", sticking = null;
  if (flagged.length && maxes.squat) {
    const lag = (l) => (maxes[l] / maxes.squat) / TYPICAL_RATIO[l];
    weak = flagged.sort((x, y) => lag(x) - lag(y))[0];
    sticking = WEAK_POINT_MAP[weak][a[`${weak}_weak_point`]];
    const st = STICKING[weak][sticking];
    if (flagged.length > 1) decisions.push({ step: "Weak-Point Priority", decision: LIFT_NAMES[weak], reason: `${flagged.map((l) => LIFT_NAMES[l]).join(" and ")} both flagged — one weak point per block. ${LIFT_NAMES[weak]} lags most for your ratios; the other gets its turn next block.` });
    if (weakType === "fatigue") decisions.push({ step: "Weak-Point Diagnosis", decision: `${LIFT_NAMES[weak]} — ${st.l}`, reason: "But warm-ups feel heavy → treated as FATIGUE first: no new variation, volume down, RPE capped" });
    else if (weakType === "technique") decisions.push({ step: "Weak-Point Diagnosis", decision: `${LIFT_NAMES[weak]} — ${st.l}`, reason: `TECHNIQUE issue → ${st.variation.name} at a lighter load; no extra accessory volume` });
    else decisions.push({ step: "Weak-Point Diagnosis", decision: `${LIFT_NAMES[weak]} — ${st.l}`, reason: `${st.variation.name} + ${st.acc.name} for 4–6 weeks, then retest` });
  } else {
    decisions.push({ step: "Weak-Point Diagnosis", decision: "Balanced", reason: "No sticking point flagged — equal volume across lifts" });
  }

  const injuries = injuriesFromText(a.current_injuries);
  const flaggedInj = Object.keys(injuries).filter((k) => injuries[k]);
  if (flaggedInj.length) decisions.push({ step: "Injury Screen", decision: flaggedInj.join(", "), reason: "Load capped on the affected lift, heavy singles removed, joint-safe accessory swaps. Pain = the set ends." });
  if (maxes.estimated) decisions.push({ step: "Max Check", decision: "Estimated maxes", reason: "Your numbers come from a rep set, not a tested single — the plan stays ≤ 87.5% until a clean heavy single confirms them." });

  const equipment = ["commercial", "basic", "minimal"].includes(a.equipment_level) ? a.equipment_level : "commercial";
  if (equipment !== "commercial") decisions.push({ step: "Equipment", decision: equipment === "basic" ? "Barbell + DB gym" : "Barbell only", reason: "Machine/cable accessories swapped for barbell, dumbbell or bodyweight versions" });

  const form = {
    name: profile?.full_name || "",
    exp, days, goal,
    focus: "bal",
    rmMode: "know",
    maxes: { squat: maxes.squat, bench: maxes.bench, deadlift: maxes.deadlift },
    calc: { squat: { w: "", r: "" }, bench: { w: "", r: "" }, deadlift: { w: "", r: "" } },
    weak, sticking, weakType, variationIdx: 0, accIdx: 0,
    injuries, equipment,
    sleep: "high", stress: "low",
    meetDays,
    ...overrides,
  };
  if (overrides.injuries) form.injuries = { ...injuries, ...overrides.injuries };
  if (form.weak === "none") form.sticking = null;
  else if (!form.sticking || !STICKING[form.weak]?.[form.sticking]) form.sticking = Object.keys(STICKING[form.weak])[0];
  if (!SCHEMES[form.goal]) form.goal = "str";
  if (!TEMPLATES[form.focus]) form.focus = "bal";
  if (!WEEKDAYS[form.days]) form.days = 4;
  if (form.goal === "peak" && meet.phase !== "peak") {
    // Peaking without a meet makes no sense — it becomes a strength block that ends in a test day.
    form.goal = "str";
    decisions.push({ step: "Block Selection", decision: "Strength Block (test day in week 5)", reason: "Peaking is only used with a meet date. Add your meet date to unlock a real peak." });
  }

  return { form, maxes, decisions, meet };
}

/**
 * Convert engine output into the `program_snapshot` shape the dashboard reads.
 */
export function toSnapshot(program, form, maxes, decisions = []) {
  const splitSR = (sr) => {
    const parts = String(sr).split("×");
    if (parts.length === 2) return { sets: parseInt(parts[0], 10) || 1, reps: parts[1].trim() };
    return { sets: 1, reps: String(sr) };
  };
  const rpeNum = (rpe) => String(rpe || "").replace(/^RPE\s*/i, "") || "—";

  const weeks = program.weeks.map((w, wi) => ({
    week: wi + 1,
    label: w.label,
    phase: w.phase,
    deload: !!w.deload,
    taper: !!w.taper,
    meetWeek: !!w.meetWeek,
    weekNotes: w.notes || null,
    restDays: w.restDays || program.restDays,
    days: w.days.map((d, di) => ({
      day: di + 1,
      weekday: d.weekday,
      date: d.date || null,
      focus: d.title,
      optional: !!d.optional,
      support: !!d.support,
      meetDay: !!d.meetDay,
      notes: [d.note, ...d.main.map((m) => m.note)].filter(Boolean).join(" · ") || null,
      exercises: [
        ...d.main.flatMap((m) => [
          { name: m.name, type: "Main", lift: m.lift, sets: m.sets, reps: m.reps, weight: m.kg ?? "", pct: m.pct, rpe: rpeNum(m.rpe), note: m.note },
          ...(m.extras || []).map((e) => ({ name: e.name, type: "Main", lift: e.lift, sets: 1, reps: e.reps, weight: e.kg ?? "", pct: e.pct, rpe: rpeNum(e.rpe), note: e.note })),
        ]),
        ...d.acc.map((a) => ({ name: a.name, type: "Accessory", ...splitSR(a.sr), weight: "", pct: null, rpe: rpeNum(a.rpe), note: null })),
      ],
    })),
  }));

  return {
    version: 3,
    blockType: program.blockLabel || (form.exp === "beg" ? "Beginner Linear Block" : SCHEMES[form.goal].label),
    weeks,
    meta: {
      form, maxes, decisions,
      freq: program.freq, restDays: program.restDays, rec: program.rec,
      phase: program.phase, notes: program.notes, volume: program.volume, budget: program.budget,
      testDay: !!program.testDay, meetDays: program.meetDays ?? null,
    },
  };
}

/* ---------------- XLSX export ---------------- */
function flatMain(d) {
  return d.main.flatMap((m) => [m, ...(m.extras || [])]);
}
export function weekRows(w) {
  const rows = [["Day", "Focus", "Exercise", "Sets", "Reps", "Load (kg)", "%1RM", "RPE", "Notes"]];
  const byDay = {};
  w.days.forEach((d) => (byDay[d.weekday] = d));
  ALL_DAYS.forEach((wd) => {
    const d = byDay[wd];
    if (!d) return; // rest day — not a row
    if (d.note) rows.push([wd, d.title, "—", "", "", "", "", "", d.note]);
    flatMain(d).forEach((m) => {
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
  if (w.notes) w.notes.forEach((n) => rows.push(["", "Note", n]));
  return rows;
}

export function downloadXLSX(program, form) {
  const wb = XLSX.utils.book_new();
  const cols = [{ wch: 11 }, { wch: 18 }, { wch: 38 }, { wch: 6 }, { wch: 9 }, { wch: 10 }, { wch: 7 }, { wch: 9 }, { wch: 50 }];
  program.weeks.forEach((w) => {
    const ws = XLSX.utils.aoa_to_sheet(weekRows(w));
    ws["!cols"] = cols;
    XLSX.utils.book_append_sheet(wb, ws, (w.label + (w.deload && !w.meetWeek ? " (Deload)" : "")).slice(0, 31));
  });
  const rules = [
    ["IRON ENGINE by LALITLIFTS — EXECUTION RULES", ""],
    ["Athlete", form.name || "—"],
    ["Block", program.blockLabel || (form.exp === "beg" ? "Beginner Linear" : SCHEMES[form.goal].label)],
    ["Frequency", program.freq],
    ["", ""],
    ...(program.notes || []).map((n) => ["Engine note", n]),
    ["", ""],
    ["Warm-up", "Bar ×8 → 40% ×5 → 55% ×3 → 70% ×2 → 80% ×1 → work sets (RPE 4–6, never tiring)"],
    ["RPE", "RPE 7 = 3 reps left | RPE 8 = 2 left | RPE 9 = 1 left. % is the plan, RPE is the final judge."],
    ["Auto-regulation", "RPE higher than prescribed → reduce 5%. RPE 6–7 when 8 was asked → +2.5 kg next week. Missed reps → repeat the load; missed twice → −10%."],
    ["Rest", "Main lifts 3–5 min | Accessories 1.5–2 min"],
    ["Standard", "Every rep competition-legal: depth, pause, lockout. A rep you couldn't repeat on the platform doesn't count as volume."],
    ["", ""],
    ...(program.testDay ? [
      ["TEST DAY (Week 5, after the deload)", ""],
      ["Protocol", "70% → 80% → 87.5% → 92.5% → 97–100% → PR attempt only if bar speed looks good. Max 3 heavy singles."],
      ["Reality", "Beginners: a PR is almost certain. Intermediates: 2.5–5 kg is realistic. Big PRs come from block sequencing — Base → Strength → Peak."],
      ["", ""],
    ] : []),
    ["TECHNIQUE STANDARDS", ""],
    ["Bench", "Every rep = competition rep. Touch → settle → press. No sinking, no bouncing."],
    ["Squat", "Every rep to depth. Brace first, then descend. Same walkout every set."],
    ["Deadlift", "Pull the slack out — never jerk the bar. Hips and shoulders rise together."],
    ["", ""],
    ["Coaching", "For 1:1 coaching, DM @" + CONFIG.insta],
  ];
  const wsR = XLSX.utils.aoa_to_sheet(rules);
  wsR["!cols"] = [{ wch: 34 }, { wch: 90 }];
  XLSX.utils.book_append_sheet(wb, wsR, program.testDay ? "Rules + Test Day" : "Rules");
  const name = (form.name || "athlete").trim().toLowerCase().replace(/\s+/g, "-");
  XLSX.writeFile(wb, `${name}-iron-engine-block.xlsx`);
}

export function programToText(program, form) {
  const block = program.blockLabel || (form.exp === "beg" ? "BEGINNER LINEAR" : SCHEMES[form.goal].label.toUpperCase());
  let t = `IRON ENGINE by LALITLIFTS — ${block.toUpperCase()}\n${form.name ? "Athlete: " + form.name + "\n" : ""}Frequency: ${program.freq}\n`;
  (program.notes || []).forEach((n) => (t += `! ${n}\n`));
  t += "\n";
  program.weeks.forEach((w) => {
    t += `======== ${w.label}${w.deload && !w.meetWeek ? " (DELOAD)" : ""}${w.taper ? " (TAPER)" : ""} ========\n`;
    w.days.forEach((d) => {
      t += `\n${d.weekday}${d.date ? " " + d.date : ""} — ${d.title}\n`;
      if (d.note) t += `    → ${d.note}\n`;
      flatMain(d).forEach((m) => {
        t += `  ${m.name}: ${m.sets} x ${m.reps}${m.pct ? ` @ ${m.pct}%` : ""}${m.kg ? ` (${m.kg} kg)` : ""} ${m.rpe}\n`;
        if (m.note) t += `    → ${m.note}\n`;
      });
      d.acc.forEach((a) => (t += `  ${a.name}: ${a.sr} ${a.rpe !== "—" ? a.rpe : ""}\n`));
    });
    (w.notes || []).forEach((n) => (t += `  * ${n}\n`));
    t += `\nRest days: ${(w.restDays || program.restDays).join(", ")}\n\n`;
  });
  if (program.testDay) t += `TEST DAY (Week 5): 70% → 80% → 87.5% → 92.5% → 97–100% → PR attempt only if bar speed looks good.\n`;
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
