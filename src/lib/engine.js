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
   Deload (both sources agree): load stays at the LOWEST load of the wave, reps drop to the
   lowest reps of the wave, sets drop to ~⅔ → volume about half, RPE ~2 lower. Not a % crash.
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
      { sets: 2, reps: 6, pct: 72.5, rpe: 6, dl: { sets: 2, reps: 4, pct: 77.5 }, acc: 2, deload: true },
    ],
  },
  str: {
    label: "Strength Block (Intensification)",
    range: "80–90% · 2–5 reps · RPE 8–9 · maximum strength",
    weeks: [
      { sets: 4, reps: 4, pct: 82.5, rpe: 8, dl: { sets: 3, reps: 3, pct: 85 }, acc: 3 },
      { sets: 4, reps: 3, pct: 85, rpe: 8, dl: { sets: 3, reps: 2, pct: 87.5 }, acc: 3 },
      { sets: 3, reps: 2, pct: 87.5, rpe: 8.5, dl: { sets: 2, reps: 1, pct: 90 }, acc: 2, note: "Last set: bar speed good → +2.5 kg allowed. Grind = stop." },
      { sets: 2, reps: 2, pct: 82.5, rpe: 6, dl: { sets: 2, reps: 1, pct: 85 }, acc: 2, deload: true },
    ],
  },
  peak: {
    label: "Peaking Block (Realization)",
    range: "85–90% · 3 → 2 → 1 reps · competition lifts first · meet rehearsal",
    weeks: [
      { sets: 3, reps: 3, pct: 85, rpe: 8, dl: { sets: 2, reps: 3, pct: 85 }, acc: 2, peak: true, note: "Competition commands on every rep — squat 'rack', bench 'start/press/rack', deadlift 'down'." },
      { sets: 3, reps: 2, pct: 87.5, rpe: 8, dl: { sets: 2, reps: 2, pct: 87.5 }, acc: 1, peak: true, note: "Competition commands on every rep." },
      { sets: 3, reps: 1, pct: 90, rpe: 8, dl: { sets: 2, reps: 1, pct: 90 }, acc: 1, peak: true, note: "90% singles ≈ your opener zone. Should feel like RPE 7–8. A grind here = open lighter. No max attempts in the gym." },
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
  { ...T("Support Day — Technique + Accessories", [{ ...S("bench", "tech"), support: true }, { ...S("squat", "tech"), support: true }], "supportDay"), optional: true, support: true },
  { ...T("Support Day — Deadlift Technique + Mobility", [{ ...S("deadlift", "tech"), support: true }], "supportDay"), optional: true, support: true },
];

/** Training days ≠ stress days. 5–6 days = 4–5 core stress days + support days
 *  (light technique, accessories, mobility) — the Indian 6-day-gym context. */
export function dayTemplates(days, exp, focus) {
  if (exp === "beg") {
    // Novice week (Helms novice PL structure + System 2.0 skill-first): one volume day, one technique +
    // deadlift day, one strength day. Each day progresses against the same day last week.
    const base = [
      T("Volume Day — Squat + Bench", [S("squat", "begVol"), S("bench", "begVol")], "pullA"),
      T("Technique Day — Bench + Deadlift", [S("bench", "begTech"), S("deadlift", "begDL")], "pullB"),
      T("Strength Day — Squat + Bench", [S("squat", "begStr"), S("bench", "begStr")], "pullC"),
    ];
    const out = [...base];
    // 4+ days: the 4th day carries the accessories so the main-lift days stay short (Helms 4-day novice option).
    if (days >= 4) out.push(T("Accessory Day — Back, Shoulders, Single-Leg", [], "begAcc"));
    for (let i = 4; i < days; i++) out.push({ ...T("Optional — Light Technique + Fitness (GPP)", [], "gpp"), optional: true, support: true });
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
  // Novice days: one pull, one leg/hip and one core movement next to the two main lifts (+ arms/delts by style).
  // The 4th day is a real accessory session: legs, hinge, press, two pulls, core.
  begAcc: [
    { name: "Bulgarian Split Squat or Step-up", sr: "3 × 8/leg", rpe: "RPE 8" },
    { name: "Romanian Deadlift (light)", sr: "3 × 10", rpe: "RPE 7" },
    { name: "Overhead Press (DB or Barbell)", sr: "3 × 10", rpe: "RPE 8" },
    { name: "Lat Pulldown or Pull-ups", sr: "3 × 10", rpe: "RPE 8" },
    { name: "Chest-Supported Row", sr: "3 × 10", rpe: "RPE 8" },
    { name: "Side Plank", sr: "3 × 20–30 sec/side", rpe: "—" },
  ],
  pullA: [
    { name: "Chest-Supported Row", sr: "3 × 10", rpe: "RPE 8" },
    { name: "Leg Curl", sr: "3 × 10–12", rpe: "RPE 8" },
    { name: "Plank", sr: "3 × 30–45 sec", rpe: "—" },
  ],
  pullB: [
    { name: "Lat Pulldown or Pull-ups", sr: "3 × 8–12", rpe: "RPE 8" },
    { name: "Leg Press or Goblet Squat", sr: "3 × 10", rpe: "RPE 8" },
    { name: "Push-ups", sr: "2 × 10–15", rpe: "RPE 8" },
    { name: "Dead Bug", sr: "3 × 8/side", rpe: "—" },
  ],
  pullC: [
    { name: "Back Extension", sr: "3 × 12", rpe: "RPE 7–8" },
    { name: "Face Pull + Band Pull-Apart", sr: "3 × 15", rpe: "RPE 8" },
    { name: "Hanging Knee Raise", sr: "3 × 10", rpe: "—" },
  ],
  gpp: [
    // GPP = general physical preparedness: plain fitness (heart, lungs, core, mobility) that helps you recover.
    { name: "Light technique: pick 1–2 lifts that felt worst this week — empty bar up to 50%", sr: "3 × 5", rpe: "RPE 5–6" },
    { name: "Sled push / incline walk / cardio", sr: "15–20 min", rpe: "easy" },
    { name: "Core + mobility circuit", sr: "10–15 min", rpe: "—" },
  ],
};

/* ---------------- Extras: low-fatigue isolation work (arms, delts, calves, core) ----------------
   Helms: isolation for small muscles adds little systemic fatigue and does not compete with the main lifts,
   so it is NOT counted in the movement-pattern budget. How much of it a lifter gets is their choice
   (training style) and their session length — main lifts and their volume never change. */
export const EXTRAS = {
  squatDay: [{ name: "Standing Calf Raise", sr: "3 × 12–15", rpe: "RPE 8" }, { name: "Lateral Raise", sr: "3 × 12–15", rpe: "RPE 8–9" }],
  benchDay: [{ name: "Lateral Raise", sr: "3 × 12–15", rpe: "RPE 8–9" }, { name: "Hammer Curl", sr: "3 × 10–12", rpe: "RPE 8" }],
  deadDay: [{ name: "Biceps Curl", sr: "3 × 10–12", rpe: "RPE 8" }, { name: "Cable Crunch / Weighted Plank", sr: "3 × 10–15", rpe: "RPE 8" }],
  volumeDay: [{ name: "Lateral Raise", sr: "3 × 12–15", rpe: "RPE 8–9" }, { name: "Overhead Triceps Extension", sr: "3 × 10–12", rpe: "RPE 8" }],
  squatVol: [{ name: "Standing Calf Raise", sr: "3 × 12–15", rpe: "RPE 8" }, { name: "Hanging Knee Raise", sr: "3 × 10–15", rpe: "RPE 8" }],
  upperDay: [{ name: "Lateral Raise", sr: "3 × 12–15", rpe: "RPE 8–9" }, { name: "Hammer Curl", sr: "3 × 10–12", rpe: "RPE 8" }],
  begAcc: [{ name: "Lateral Raise", sr: "3 × 12–15", rpe: "RPE 8" }, { name: "Biceps Curl", sr: "3 × 10–12", rpe: "RPE 8" }],
  pullA: [{ name: "Lateral Raise", sr: "3 × 12–15", rpe: "RPE 8" }, { name: "Biceps Curl", sr: "2 × 10–12", rpe: "RPE 8" }],
  pullB: [{ name: "Triceps Pushdown", sr: "3 × 10–12", rpe: "RPE 8" }, { name: "Hammer Curl", sr: "2 × 10–12", rpe: "RPE 8" }],
  pullC: [{ name: "Biceps Curl", sr: "3 × 10–12", rpe: "RPE 8" }, { name: "Triceps Pushdown", sr: "2 × 10–12", rpe: "RPE 8" }],
};
/** Extras per training day by style: focused 0 · balanced 1 · full 2. */
const EXTRAS_PER_DAY = { focused: 0, balanced: 1, full: 2 };

/* ---------------- Injury swaps ---------------- */
export const SWAPS = {
  back: {
    "Barbell Row": "Chest-Supported Row (spine-safe)",
    "Romanian Deadlift": "Leg Curl (spine-safe swap)",
    "Back Extension": "Bird Dog + Side Plank (spine-safe)",
    "Hanging Leg Raise / Ab Wheel": "Dead Bug / Plank (spine-safe)",
    "Walking Lunge": "Leg Press (light, spine-safe)",
    "Good Morning": "Leg Curl (spine-safe swap)",
    "Romanian Deadlift (light)": "Leg Curl (spine-safe swap)",
    "Snatch-Grip Deadlift (light, upper back)": "Chest-Supported Row (spine-safe)",
  },
  knee: {
    "Leg Press or Bulgarian Split Squat": "Hip Thrust (knee-friendly)",
    "Bulgarian Split Squat or Step-up": "Hip Thrust (knee-friendly)",
    "Leg Press or Goblet Squat": "Leg Press (pain-free ROM only)",
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
    "Lateral Raise": "Lateral Raise (light, pain-free range)",
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
    ["Cable Crunch / Weighted Plank", "Weighted Plank / DB Crunch"],
    ["Leg Press or Bulgarian Split Squat", "Bulgarian Split Squat (DB)"],
    ["Leg Press or Goblet Squat", "Goblet Squat (DB)"],
    ["Leg Press (pain-free ROM only)", "Glute Bridge / Hip Thrust (knee-friendly)"],
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
    ["Lateral Raise (light, pain-free range)", "Plate Lateral Raise (light, pain-free range)"],
    ["Lateral Raise", "Plate Lateral Raise"],
    ["Hammer Curl", "Barbell Curl"],
    ["Overhead Triceps Extension", "Skull Crushers (bar)"],
    ["Cable Crunch / Weighted Plank", "Weighted Plank (plate)"],
    ["Leg Press or Bulgarian Split Squat", "Bulgarian Split Squat (bodyweight / plate)"],
    ["Leg Press or Goblet Squat", "Goblet Squat (plate) or Front Squat (light)"],
    ["Leg Press (pain-free ROM only)", "Glute Bridge / Hip Thrust (knee-friendly)"],
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
/* Calendar days are the ATHLETE's dates, not the server's. The program is built on a server running in UTC:
   at 4 am in India it is still "yesterday" there, which dated sessions a day early. Every date is therefore
   computed from the athlete's local "today" (YYYY-MM-DD sent by their device) as a UTC-midnight timestamp. */
const DAY_MS = 86400000;
export function calToday(ymd) {
  if (typeof ymd === "string" && /^\d{4}-\d{2}-\d{2}$/.test(ymd)) { const [y, m, d] = ymd.split("-").map(Number); return Date.UTC(y, m - 1, d); }
  const n = new Date();
  return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate());
}
/** The device's local date as YYYY-MM-DD (send this to the server). */
export function localYmd(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const calLabel = (ms) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export function daysToMeet(profile, today) {
  if (!profile?.competition_date) return null;
  const meet = calToday(String(profile.competition_date).slice(0, 10));
  return Math.round((meet - calToday(today)) / DAY_MS);
}

/** Days from today until the next Monday (0 when today is Monday) — training weeks run Monday → Sunday. */
export function leadDays(t = calToday()) {
  const dow = typeof t === "number" ? new Date(t).getUTCDay() : t.getDay();
  return (8 - dow) % 7;
}

export function meetPhase(days, exp, lead = leadDays()) {
  if (days === null || days === undefined) return { phase: "none" };
  if (days <= 0 && days > -14) return { phase: "post", reason: "Meet just happened — one deload week (volume −50%, light technique), then a Base block. No heavy work this week." };
  if (days <= -14) return { phase: "none", reason: "Meet date is in the past — planning a normal block. Update the date when the next meet is booked." };
  // Full Monday-to-Sunday weeks that fit before the final ~7–14 calendar days (taper sessions → opener practice → singles → primer → meet).
  // Days before the first Monday are a lead-in (rest / light technique) so every planned week lines up with the real calendar.
  const fullWeeks = Math.max(0, Math.floor((days - lead - 1) / 7) - 1);
  const finalDays = days - lead - fullWeeks * 7;
  if (days <= 5) return { phase: "meetweek", fullWeeks: 0, finalDays, reason: `Meet in ${days} day${days === 1 ? "" : "s"} — MEET WEEK. Only light singles (80% → 77.5%, RPE ≤ 6) to stay sharp, nothing else, day before off. No changes, no PRs in the gym.` };
  if (days <= 14) return { phase: "taper", fullWeeks: 0, finalDays, reason: `Meet in ${days} days — TAPER. Volume down 50–70%, intensity stays (singles/doubles at 77.5–85%), competition lifts trained together, accessories half. Opener practice ~7 days out, then meet week.` };
  if (exp === "beg") {
    if (days <= 35) return { phase: "beginner", fullWeeks, finalDays, lead, reason: `Meet in ${days} days — beginner stays on linear progression for ${fullWeeks} week${fullWeeks === 1 ? "" : "s"}, then the plan tapers into the meet. Practice commands and pauses every session.` };
    return { phase: "beginner", fullWeeks: 4, finalDays: 0, reason: `Meet in ${days} days — beginner stays on linear progression; the taper comes in the last block before the meet.` };
  }
  if (days <= 35) return { phase: "peak", fullWeeks, finalDays, lead, reason: `Meet in ${days} days — PEAKING: ${fullWeeks} peaking week${fullWeeks === 1 ? "" : "s"}, then taper into the meet. Competition lifts only, accessories minimal.` };
  // Season fitted BACKWARD from the meet (Helms: accumulation → intensification → peak/taper):
  // peaking starts ~5 weeks out, the strength block fills the weeks before that, base blocks before that.
  const ds = days - lead; // days from this block's first Monday
  if (ds <= 41) { // too close for a strength block that ends before peaking: peak now
    const fw = Math.max(0, Math.floor((days - lead - 1) / 7) - 1);
    return { phase: "peak", fullWeeks: fw, finalDays: days - lead - fw * 7, lead, reason: `Meet in ${days} days — PEAKING: ${Math.min(3, fw)} peaking weeks, then taper into the meet. Competition lifts only, accessories minimal.` };
  }
  if (ds <= 76) { // strength window; 64–76 days → 4 weeks now, the last week or so comes right before peaking
    const n = Math.min(4, Math.max(1, Math.floor((ds - 35) / 7)));
    return { phase: "strength", fullWeeks: n, blockWeeks: n, finalDays: 0, reason: `Meet in ${days} days — STRENGTH block now (${n} week${n === 1 ? "" : "s"} of heavy 2–5s), sized so peaking starts ~5 weeks out.` };
  }
  // Base sized so the remaining base time is whole 4-week blocks and Strength starts ~9 weeks out:
  // 2–3 weeks → short base ending in a deload; 1 spare week → an intro week first (Helms: ~75% volume, RPE −1).
  const room = Math.floor((ds - 63) / 7);
  const r = room % 4;
  const n = r === 0 ? 4 : r === 1 ? 5 : r;
  return { phase: "base", fullWeeks: n, blockWeeks: n, finalDays: 0, reason: `Meet in ${days} days — BASE block first (${n} weeks: muscle + work capacity), then Strength, then peaking ~5 weeks out.` };
}

/* ---------------- Lift builders ---------------- */
/* Novice: start a little under the textbook % ("leave something in the tank") and add load every week on each day.
   Helms novice jumps: squat/deadlift +5 kg, bench +2.5 kg per week; after a second stall the jump halves. */
const BEG_DAY = {
  begVol: { sets: 3, reps: 8, pct: 65, rpe: "RPE 6–8", label: "" },
  begTech: { sets: 3, reps: 3, pct: 75, rpe: "RPE ≤ 6", label: " (Technique)" },
  begDL: { sets: 3, reps: 3, pct: 77.5, rpe: "RPE ≤ 8", label: "" },
  begStr: { sets: 3, reps: 4, pct: 77.5, rpe: "RPE ≤ 8", label: "" },
};
const BEG_INC = { squat: 5, bench: 2.5, deadlift: 5 };

function stickingFor(form) {
  if (form.weak === "none" || !form.sticking) return null;
  let st = STICKING[form.weak]?.[form.sticking];
  if (!st) return null;
  if (form.weak === "deadlift" && form.sticking === "floor" && form.dlStance === "sumo") {
    // Deficits change a sumo pull too much; pause just off the floor instead.
    st = WP(st.l, [{ name: "Paused Sumo Deadlift (just off the floor)", off: -17.5 }, { name: "Sumo Deadlift vs Bands / Speed Pulls (light)", off: -25 }], st.accessories, "Weak point: the floor (sumo) — wedge, leg drive and hips set before the bar moves", st.limiters);
  }
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

  // ---- Beginner: weekly load jumps per day while every rep stays clean (Helms novice + System 2.0)
  if (BEG_DAY[role]) {
    const cfg = BEG_DAY[role];
    const inc = BEG_INC[lift];
    const base = max ? round25((cfg.pct / 100) * max) : null;
    let kg = base ? round25(base + wk * inc) : null;
    let sets = cfg.sets, reps = cfg.reps;
    const notes = [];
    if (w.taper || w.meetweek) {
      kg = base ? round25(base * 0.95) : null;
      sets = 2; reps = Math.min(reps, 3);
      notes.push("Taper — lighter on purpose. Clean reps, full competition commands, walk out feeling fresh.");
    }
    const pct = max && kg ? Math.round((kg / max) * 200) / 2 : null;
    if (role === "begTech") notes.push("Technique day: always 4–6 reps left in the tank. Same setup, same pause, every rep.");
    if (role === "begDL") notes.push("One heavy-ish pull a week is enough at this stage — clean reps, no grinding.");
    if (wk === 0 && !w.taper && role !== "begTech") notes.push(`+${inc} kg next week on this day if every rep was clean. Missed reps → same weight next week. Missed two weeks in a row → −10% for one week, then back to that weight. Stall again → jumps of +${inc / 2} kg.`);
    if (!max) notes.push(`No max needed: pick a weight you can do for ${reps} clean reps with ${role === "begTech" ? "4–6" : "2–3"} reps left, then add ${inc} kg a week.`);
    return mk(LIFT_NAMES[lift] + cfg.label, sets, reps, pct, w.taper || w.meetweek ? "RPE 6" : cfg.rpe, notes.join(" · ") || null, kg);
  }

  const notes = [];
  const base = lift === "deadlift" && w.dl ? w.dl : w;

  if (role === "tech") {
    // Heavy technique work: heavy enough to be real practice, light enough to recover from (always 4–6 reps in the tank).
    const hurt = (lift === "squat" && (form.injuries?.knee || form.injuries?.back)) || (lift === "deadlift" && form.injuries?.back) || (lift === "bench" && form.injuries?.shoulder);
    const support = slot.support;
    let pct = w.deload ? 75 : 80;
    if (hurt) pct = Math.min(pct, 72.5);
    const sets = w.deload ? 2 : 3, reps = support || lift === "deadlift" ? 1 : 2;
    return mk(LIFT_NAMES[lift] + (support ? " (Technique singles)" : " (Technique)"), sets, reps, pct, "RPE 4–5", "Technique work, not a workout: competition commands, identical setup every rep, maximum intent on the way up. Always 4–6 reps left in the tank.");
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
    // Event type: a lift that is not on the platform is MAINTAINED during peaking, not peaked.
    if (w.peak && form.compLifts && !form.compLifts.includes(lift)) {
      pct = Math.min(pct, 80); sets = Math.max(2, sets - 1); rpe = Math.min(rpe, 7);
      return mk(LIFT_NAMES[lift] + " (maintenance)", sets, Math.max(reps, 3), pct, `RPE ${rpe}`, `Not competed — kept at a maintenance dose so all recovery goes to your ${form.compLifts.map((l) => LIFT_NAMES[l]).join(" + ")}.`);
    }
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
    if (w.taper) notes.push("Taper — volume down, intensity stays. Crisp, never hard.");
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
    let pct = Math.max(67.5, base.pct - 10);
    const upright = lift === "squat" && form.squatBar === "low";
    if (upright) pct -= 5; // high-bar runs ~5–10% below a low-bar max
    return mk(upright ? "High-Bar Squat (upright — quads, hips get a break)" : LIFT_NAMES[lift], sets, reps, pct, `RPE ${Math.max(6, Math.min(w.rpe - 1, rpeFor(pct, reps)))}`, "Secondary slot — volume work, don't grind reps");
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
  // Meet date not confirmed yet: no taper can be dated. Peak toward the earliest likely date, then hold a
  // "ready" pattern (heavy-ish, low volume) until the real date is known — then the engine builds the taper.
  const READY = { sets: 3, reps: 2, pct: 85, rpe: 7, dl: { sets: 2, reps: 2, pct: 85 }, acc: 2, label: "Ready Week (date not confirmed)", note: "Holding pattern until the meet date is confirmed: heavy enough to stay sharp, light enough to stay fresh. Update the date the moment it's announced." };
  if (form.meetApprox && ["peak", "taper", "meetweek"].includes(meet?.phase)) {
    const peakWeeks = meet.phase === "peak" && meet.fullWeeks >= 1 ? (meet.fullWeeks >= 3 ? [P[0], P[1], P[2]] : meet.fullWeeks === 2 ? [P[1], P[2]] : [P[2]]) : [];
    return { weeks: [...peakWeeks, READY, READY], blockLabel: "Peak & Hold (meet date not confirmed)" };
  }
  const begWeeks = (n) => SCHEMES.hyp.weeks.slice(0, n).map((w) => ({ ...w, deload: false, acc: 2 }));
  switch (meet?.phase) {
    case "meetweek": return { weeks: [], final: true, blockLabel: "Meet Week" };
    case "taper": return { weeks: [], final: true, blockLabel: "Taper → Meet" };
    case "peak": {
      if (meet.fullWeeks < 1) return { weeks: [], final: true, blockLabel: "Taper → Meet" }; // no room for a full peaking week once the calendar is lined up
      const n = Math.min(3, meet.fullWeeks); // peaking weeks before the taper
      const peakWeeks = n === 1 ? [P[2]] : n === 2 ? [P[1], P[2]] : [P[0], P[1], P[2]];
      return { weeks: peakWeeks, final: true, blockLabel: SCHEMES.peak.label };
    }
    case "beginner":
      if (meet.finalDays && meet.fullWeeks < 1) return { weeks: [], final: true, blockLabel: "Taper → Meet" };
      return meet.finalDays ? { weeks: begWeeks(meet.fullWeeks), final: true, blockLabel: "Beginner Linear → Meet", goal: "beg" } : { weeks: begWeeks(4), blockLabel: "Beginner Linear Block", goal: "beg" };
    case "strength": {
      // Shorter than 4 weeks only when the meet calendar needs it (it runs straight into peaking, no deload).
      const n = meet.blockWeeks || 4;
      return { weeks: n >= 4 ? SCHEMES.str.weeks : SCHEMES.str.weeks.slice(0, n), blockLabel: SCHEMES.str.label, goal: "str" };
    }
    case "base": {
      const n = meet.blockWeeks || 4; // 2–3 → loading weeks then the deload; 5 → intro week + full block
      const H = SCHEMES.hyp.weeks;
      const intro = { ...H[0], sets: H[0].sets - 1, rpe: H[0].rpe - 1, acc: 3, label: "Intro Week", note: "Intro week: about 75% of the volume at RPE ~1 lower — eases you into the block." };
      return { weeks: n === 5 ? [intro, ...H] : n >= 4 ? H : [...H.slice(0, n - 1), H[3]], blockLabel: SCHEMES.hyp.label, goal: "hyp" };
    }
    case "post": return { weeks: [{ ...SCHEMES.hyp.weeks[3], label: "Post-meet Deload" }, ...SCHEMES.hyp.weeks.slice(0, 3)], blockLabel: "Post-meet Recovery → Base" };
    default:
      if (form.exp === "beg") return { weeks: SCHEMES.hyp.weeks.map((w) => ({ ...w, deload: false, acc: 2 })), blockLabel: "Beginner Linear Block", goal: "beg" };
      return { weeks: SCHEMES[goal].weeks, blockLabel: SCHEMES[goal].label, goal };
  }
}

/** The last ~14 days before a meet are laid out from the meet DATE, not from a template.
 *  Taper principle: cut VOLUME 50–70%, keep INTENSITY (no more than ~10% lower), all three lifts together,
 *  low reps at 77.5–85% so RPE stays low; accessories half the sets. ~7 days out: opener practice
 *  (singles ≈ 90%, RPE 7.5–8.5). Meet week: singles at 82.5% → 80% → a 77.5% primer 2 days out, day before off. */
function finalStretch(startOffset, form, maxes, rec, tmpl, wdays) {
  const D = form.meetDays;
  const beg = form.exp === "beg";
  const comp = form.compLifts || ["squat", "bench", "deadlift"];
  const on = (l) => comp.includes(l);
  const platform = comp.map((l) => LIFT_NAMES[l]).join(" + ");
  const kgOf = (lift, pct) => (maxes[lift] ? round25((pct / 100) * maxes[lift]) : null);
  const single = (lift, sets, pct, rpe, note) => ({ name: LIFT_NAMES[lift], sets, reps: 1, pct, kg: kgOf(lift, pct), rpe, note: note || null, lift });
  const taperDays = [], meetDays = [];
  let taperIdx = 0, openerDone = false;
  for (let off = Math.max(0, startOffset); off <= D; off++) {
    const ms = calToday(form.today) + off * DAY_MS;
    const weekday = ALL_DAYS[(new Date(ms).getUTCDay() + 6) % 7];
    const dateLabel = calLabel(ms);
    const before = D - off;
    const day = (title, main, extra = {}) => ({ weekday, date: dateLabel, title, optional: false, main, acc: [], ...extra });
    const count = taperDays.length + meetDays.length;
    const plan = () => {
    if (before === 0) {
      meetDays.push(day(`MEET DAY — ${platform}`, [], { meetDay: true, note: `On the platform: ${platform}. Warm-up to opener: bar → 40% ×4 → 60% ×3 → 80% ×2 → 90% ×1 → 5–10 min → Attempt 1. Nothing new today.` }));
    } else if (before === 1) {
      return; // day before: off
    } else if (before === 2) {
      const primer = ["squat", "bench"].filter(on);
      const list = primer.length ? primer : comp; // deadlift-only lifter: one light pull is the primer
      meetDays.push(day("Primer — one light single", list.map((l) => single(l, 1, beg ? 72.5 : l === "deadlift" ? 70 : 77.5, "RPE ≤ 5", "Primer 48 h out: one crisp single, bar speed only. Leave feeling strong, not tired.")), {}));
    } else if (before === 3 || before === 4) {
      if (!meetDays.some((d) => d.title.startsWith("Singles @ 80"))) meetDays.push(day("Singles @ 80% — commands", comp.map((l) => single(l, l === "deadlift" ? 1 : 2, beg ? 75 : 80, "RPE 4–6", l === "deadlift" ? "One crisp pull, done" : "Competition commands on every rep"))));
    } else if (before === 5) {
      meetDays.push(day(`Singles @ 82.5% — ${platform}`, comp.map((l) => single(l, l === "deadlift" ? 2 : 3, beg ? 77.5 : 82.5, "RPE 5–7", l === "deadlift" && comp.length > 1 ? "Deadlift fewer sets — highest fatigue cost" : null))));
    } else if (before >= 6 && before <= 8 && !openerDone && (wdays.includes(weekday) || before === 6)) {
      // Opener practice ~7 days out: work up to the planned openers (≈90%), RPE 7.5–8.5, one single each, then nothing.
      openerDone = true;
      taperDays.push(day("Opener practice — work up to your openers", comp.map((l) => single(l, 1, beg ? 85 : 90, "RPE 7.5–8.5", "This is your opener rehearsal: same warm-up ladder as meet day (40 → 60 → 80 → 90%). One single, judge the speed, stop.")), {}));
    } else if (before >= 6 && !openerDone && wdays.includes(weekday)) {
      // Taper sessions (opener practice is the last session of the taper — nothing heavy after it): all three lifts, 1–3 reps at 77.5–85%, volume 50–70% down, accessories half.
      const di = wdays.indexOf(weekday);
      const t = tmpl[di];
      if (!t || t.support) return;
      const variant = taperIdx++ % 2; // alternate doubles @ 80 and triples @ 77.5 so no two sessions are identical
      const reps = variant === 0 ? 2 : 3, pct = (variant === 0 ? 80 : 77.5) - (beg ? 5 : 0);
      const main = [];
      for (const l of ["squat", "bench", "deadlift"]) {
        if (on(l)) main.push({ ...single(l, l === "deadlift" ? 2 : 3, pct, "RPE 6–7"), reps });
        else if (before >= 8) main.push({ ...single(l, 2, 75, "RPE ≤ 6", "Not competed — light maintenance only, then it disappears until after the meet."), name: `${LIFT_NAMES[l]} (maintenance)`, reps: 3 });
      }
      if (!main.length) return;
      main[0].note = main[0].note || "Taper: intensity stays, volume halves. Low reps keep the RPE low — this should feel crisp, never hard.";
      // Bench-only lifters don't need leg/hinge accessories in the taper.
      const accPool = applyEquipment(applySwaps([...(ACC[t.acc] || [])], form.injuries), form.equipment).filter((a) => on("squat") || on("deadlift") || !["quads", "posterior"].includes(accBucket(a.name)));
      const acc = accPool.slice(0, 2).map((a) => ({ ...a, sr: a.sr.includes("×") ? a.sr.replace(/^\d+/, "2") : a.sr, rpe: a.rpe === "—" ? a.rpe : "RPE 7" }));
      taperDays.push(day(`Taper — ${comp.length === 3 ? "all three lifts" : platform} (${variant === 0 ? "doubles" : "triples"})`, main, { acc }));
    }
      };
    plan();
    if (taperDays.length + meetDays.length === count) {
      // No session today — say exactly what the day is for, so no day on the calendar is a blank.
      const group = before <= 5 || !taperDays.length && before <= 6 ? meetDays : taperDays;
      const trainsUsually = wdays.includes(weekday);
      let title = "Rest day", note;
      if (before === 1) { title = "OFF — day before the meet"; note = "No training at all. Eat normally (don't try new food), hydrate, pack your bag (belt, shoes, sleeves, singlet, ID, chalk, snacks), check weigh-in time, sleep early."; }
      else if (trainsUsually) { title = "Optional recovery (no lifting)"; note = "You'd normally train today — in a taper the missing session IS the plan: less work is what lets you peak. If you want to move: 20–30 min walk, 10 min mobility, bar-only technique. No loading."; }
      else note = before <= 5 ? "Rest. Walk 20–30 min, light mobility, sleep 8+ h, keep food and water normal. Visualise your openers." : "Rest. Walk, mobility, sleep 8 h. Recovery is training in the taper.";
      group.push(day(title, [], { rest: true, note }));
    }
  }
  const restOf = (days) => ALL_DAYS.filter((d) => !days.some((x) => x.weekday === d && !x.rest));
  const out = [];
  if (taperDays.length) out.push({ label: "Taper", deload: false, taper: true, phase: "Taper", days: taperDays, restDays: restOf(taperDays), notes: [`Taper: main-lift volume down 50–70%, loads stay at 77.5–85% (never more than ~10% below the block), ${comp.length === 3 ? "all three lifts together" : `${platform} ${comp.length === 1 ? "gets" : "get"} the work; the other lifts fade out`}, accessories at half the sets. Ends with opener practice ~7 days out.`] });
  const meetWeekday = meetDays.at(-1)?.weekday;
  out.push({ label: "Meet Week", deload: true, meetWeek: true, phase: "Meet Week", days: meetDays, restDays: restOf(meetDays), notes: [`Meet day: ${meetWeekday}. ` + MEET_WEEK_NOTES[0], ...MEET_WEEK_NOTES.slice(1)] });
  return out;
}
const MEET_WEEK_NOTES = [
  "Singles at 82.5% five days out, singles at 80% three to four days out, one 77.5% primer 48 h out, the day before OFF. Intensity stays, volume is tiny — that is what lets strength show up on the platform.",
  "Nothing new on meet day: same belt, same shoes, same setup, same warm-up you trained with.",
  "Attempts: 1st = your current 3RM (~90%, a lift you make on any day). 2nd = your current 2RM (~95–97%). 3rd = the next small PR (+2.5 kg) only if it is there; otherwise a conservative jump. Build the biggest TOTAL, not three lift PRs.",
  "Warm-up to opener: 4×1 @40% → 3×1 @60% → 2×1 @80% → 1×1 @90% → 5–10 min rest → Attempt 1.",
  "Between lifts: walk 2–3 min, eat (carbs + protein), hydrate, 10–15 min calm, 5-min activation before the next lift.",
];

export function buildProgram(form, maxes) {
  // Novices don't specialise: every lift is still learning its pattern, so a "weak point" is really technique.
  // Even volume on all three lifts + cues; weak-point work starts once progress slows (intermediate).
  if (form.exp === "beg" && ((form.weak && form.weak !== "none") || (form.weakType && form.weakType !== "strength"))) form = { ...form, weak: "none", sticking: null, weakType: "strength" };
  const rec = recoveryProfile(form);
  const T = calToday(form.today);
  const meet = meetPhase(form.meetDays ?? null, form.exp, leadDays(T));
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
  // Deadlift twice a week (one heavy day + one technique-singles day), as in the intermediate/advanced
  // structure — but only once when recovery is poor, fatigue is the issue, or the back is flagged.
  let dlNote = null;
  const dlSlots = tmpl.reduce((n, d) => n + d.slots.filter((x) => x.lift === "deadlift").length, 0);
  if (!isBeg && dlSlots < 2) {
    const tired = rec.level === "poor" || (form.weakType || "strength") === "fatigue" || form.injuries?.back || form.cutting === "weightclass";
    if (tired) dlNote = "Deadlift stays at 1× this week-plan: recovery is low (sleep/stress, fatigue, back flag or a hard cut). The second, technique pull comes back when recovery does.";
    else {
      tmpl = tmpl.map((d) => ({ ...d, slots: d.slots.map((x) => ({ ...x })) }));
      const core = tmpl.map((d, i) => ({ d, i })).filter(({ d }) => !d.support);
      const dlIdx = core.find(({ d }) => d.slots.some((x) => x.lift === "deadlift" && x.role === "primary"))?.i ?? -1;
      // Farthest core day (around the week) from the heavy pull, without a heavy squat on it.
      const pick = core.filter(({ i, d }) => i !== dlIdx && !d.slots.some((x) => x.lift === "squat" && x.role === "primary"))
        .sort((a, b) => Math.min(Math.abs(b.i - dlIdx), tmpl.length - Math.abs(b.i - dlIdx)) - Math.min(Math.abs(a.i - dlIdx), tmpl.length - Math.abs(a.i - dlIdx)))[0];
      if (pick) { pick.d.slots.push(S("deadlift", "tech")); dlNote = `Deadlift 2× a week: one heavy day + technique singles (~80%, RPE 4–5) on the ${pick.d.title} day. Low fatigue, more practice. Back tired or recovery poor → skip the singles that week.`; }
    }
  }
  const wdays = weekdaysFor(tmpl, form.days);
  const stick = stickingFor(form);
  const weakType = form.weakType || "strength";
  const level = form.exp === "beg" ? "beg" : form.exp === "adv" ? "adv" : "int";
  // Volume by training age (novice 10–12, intermediate 13–15, advanced 16–20 sets/wk per movement).
  // An aggressive cut for a weight class steps volume down one level.
  const step = form.cutting === "weightclass" ? { beg: "beg", int: "beg", adv: "int" }[level] : level;
  const budget = { beg: [10, 12], int: [13, 15], adv: [16, 20] }[step];
  // Training style (the athlete's choice): focused trims to the bottom of the range, balanced to the top,
  // full allows the next level's range (Helms: periods above the range are normal — still capped by recovery).
  const style = ["focused", "balanced", "full"].includes(form.style) ? form.style : "balanced";
  const NEXT_MAX = { beg: 15, int: 20, adv: 20 };
  const budgetMax = style === "focused" ? budget[0] : style === "full" && rec.level !== "poor" && form.cutting !== "weightclass" ? NEXT_MAX[step] : budget[1];
  // Session length decides how many accessories fit (main lifts never get cut).
  const sessionAccCap = form.sessionMin && form.sessionMin <= 45 ? 1 : form.sessionMin && form.sessionMin <= 60 ? 2 : 99;

  const notes = [];
  const holding = plan.blockLabel.startsWith("Peak & Hold");
  if (holding) notes.push(`Meet in about ${form.meetDays} days, date not confirmed. ${plan.weeks.length > 2 ? "Peaking toward the earliest likely date, then " : ""}a READY pattern (85% doubles, RPE 7) you can repeat until the date is announced. Confirm the date → the engine builds the exact taper: opener practice 7 days out, singles, primer, meet. Announced less than a week out → meet-week plan only.`);
  else if (meet.reason) notes.push(meet.reason);
  if (weakType === "technique") notes.push("Form breaks even at light loads → this is a TECHNIQUE issue. Variations at lighter loads, no extra accessory volume, film one set per session.");
  if (weakType === "fatigue") notes.push("Warm-ups feel heavy → FATIGUE, not weakness. No new variations this block; volume −1 set, RPE capped at 7. If it persists 2 weeks, deload now.");
  if (dlNote) notes.push(dlNote);
  if (step !== level) notes.push("Cutting for a weight class → weekly volume stepped down one level so recovery keeps up with the diet. Deload every block, no exceptions.");
  if (sessionAccCap < 99) notes.push(`${form.sessionMin}-minute sessions → main lifts first and complete, then max ${sessionAccCap} accessor${sessionAccCap === 1 ? "y" : "ies"}. Pair upper-body push + pull accessories back-to-back (~2 min between) to save time — never with squats or deadlifts.`);
  if (form.compLifts && form.compLifts.length < 3 && meet.phase !== "none" && meet.phase !== "post") notes.push(`Competing in ${form.compLifts.map((l) => LIFT_NAMES[l]).join(" + ")} only → ${form.compLifts.length === 1 ? "that lift gets" : "those lifts get"} the peak, taper and attempts; the others are maintained, then fade out before the meet.`);

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
        const styleBonus = style === "full" ? 1 : style === "focused" ? -1 : 0;
        const cap = isBeg ? acc.length : d.support ? acc.length : Math.max(1, (d.acc === "deadDay" ? accCount - 1 : accCount) + styleBonus);
        acc = acc.slice(0, cap);
        // Extras (isolation) on loading weeks only — never in deload, peaking or taper weeks.
        // Strength blocks (fewer, heavier accessories): "full" gets one extra less than in a base block.
        const nExtra = Math.max(0, (EXTRAS_PER_DAY[style] ?? 1) - (!isBeg && accCount <= 3 && style === "full" ? 1 : 0));
        if (nExtra && !d.support && !d.optional && !deload && !w.taper && !w.peak && accCount > 0) {
          const have = new Set(acc.map((a) => a.name));
          const extra = (EXTRAS[d.acc] || []).filter((e) => !have.has(e.name)).slice(0, nExtra);
          acc = [...acc, ...applyEquipment(applySwaps(extra, form.injuries), form.equipment)];
        }
        if (form.weak !== "none" && stick && weakType === "strength" && !d.optional && !deload && !w.taper) {
          if (d.slots.find((s) => s.lift === form.weak && s.role === "primary")) {
            const extra = { ...stick.acc, name: "Weak-point: " + stick.acc.name };
            acc = [...acc, applyEquipment(applySwaps([extra], form.injuries), form.equipment)[0]];
          }
        }
        // Equipment swaps can turn two exercises into the same one (minimal gym: both rows → Barbell Row).
        acc = acc.filter((x, i) => acc.findIndex((y) => y.name === x.name) === i);
        if (deload || w.taper) acc = acc.slice(0, w.taper ? 0 : 2).map((a) => ({ ...a, sr: a.sr.includes("×") ? a.sr.replace(/^\d+/, "2") : a.sr, rpe: a.rpe === "—" ? a.rpe : "RPE 6" }));
        if (acc.length > sessionAccCap) {
          const wp = acc.filter((a) => a.name.startsWith("Weak-point"));
          acc = [...acc.filter((a) => !a.name.startsWith("Weak-point")).slice(0, Math.max(0, sessionAccCap - wp.length)), ...wp].slice(0, Math.max(sessionAccCap, wp.length));
        }
        const gppNote = d.acc === "gpp" ? "Optional day. GPP = general fitness — heart, lungs, core, mobility. It helps you recover and train harder on the main days. Not all three lifts: just the 1–2 that felt worst, very light. Skip it if you are tired." : undefined;
        return { weekday: wdays[di] || "Extra", title: d.title, optional: d.optional, support: d.support, main, acc, ...(gppNote ? { note: gppNote } : {}) };
      }).filter((d) => d.main.length || d.acc.length).sort((a, b) => ALL_DAYS.indexOf(a.weekday) - ALL_DAYS.indexOf(b.weekday)),
    };
  });
  // Keep weekly hard sets inside the level's budget by dropping surplus accessories (never main lifts).
  // Every day of every week is on the calendar — non-training days say what they are for.
  for (const w of weeks) {
    for (const wd of ALL_DAYS) if (!w.days.some((d) => d.weekday === wd)) w.days.push({ weekday: wd, title: "Rest day", optional: false, rest: true, main: [], acc: [], note: w.deload ? "Rest. Deload week — let the fatigue go: walk, mobility, sleep 8 h." : "Rest. 20–30 min walk or light cardio, 10 min mobility, sleep 7–9 h, hit your protein. Rest days are when you actually get stronger." });
    w.days.sort((a, b) => ALL_DAYS.indexOf(a.weekday) - ALL_DAYS.indexOf(b.weekday));
  }
  // Put a real date on every training day: week 1 starts on the next Monday (or today if it is Monday).
  const lead = plan.final && plan.weeks.length ? (meet.lead ?? leadDays(T)) : leadDays(T);
  const fmt = (off) => calLabel(T + off * DAY_MS);
  weeks.forEach((w, wi) => w.days.forEach((d) => { const i = ALL_DAYS.indexOf(d.weekday); if (i >= 0) d.date = fmt(lead + wi * 7 + i); }));
  if (weeks.length) weeks[0].startsOn = fmt(lead);
  if (lead > 0 && weeks.length) notes.push(`Week 1 starts Monday ${fmt(lead)}. Until then: rest, or one light technique session (singles @ 70–75%) — no hard training.`);
  if (plan.final && form.meetDays !== null && form.meetDays !== undefined) {
    const fs = finalStretch(plan.weeks.length ? lead + plan.weeks.length * 7 : 0, form, maxes, rec, tmpl, wdays);
    weeks.push(...fs);
    // The final stretch is laid out by the calendar, so a meet week can hold opener practice, two singles days
    // and the primer — more sessions than the athlete has days. Keep each Mon–Sun week within their days:
    // drop the lightest work first (80% singles, then the earliest taper session); primer and opener stay.
    const msOf = {};
    for (let off = 0; off <= (form.meetDays || 0) + 7; off++) msOf[fmt(off)] = T + off * DAY_MS;
    const byWeek = {};
    for (const w of weeks) for (const d of w.days) {
      if (d.rest || d.meetDay || d.optional || msOf[d.date] === undefined) continue;
      const ms = msOf[d.date];
      const mon = ms - ((new Date(ms).getUTCDay() + 6) % 7) * DAY_MS;
      (byWeek[mon] = byWeek[mon] || []).push(d);
    }
    const dropRank = (d) => (/^Singles @ 80/.test(d.title) ? 0 : /^Taper/.test(d.title) ? 1 : 9);
    for (const list of Object.values(byWeek)) {
      let extra = list.length - form.days;
      const order = list.map((d, i) => ({ d, i })).sort((a, b) => dropRank(a.d) - dropRank(b.d) || a.i - b.i);
      for (const { d } of order) {
        if (extra <= 0 || dropRank(d) === 9) break;
        Object.assign(d, { title: "Rest day", rest: true, optional: false, main: [], acc: [], note: `Rest — keeps this week to your ${form.days} training days. Walk, mobility, sleep.` });
        extra--;
      }
    }
    const perWeek = Math.max(...fs.map((w) => w.days.filter((d) => !d.rest && !d.meetDay).length));
    if (form.days > perWeek) notes.push(`You train ${form.days} days a week. ${fs.length > 1 ? "Taper and meet week use" : "The final stretch uses"} only ${perWeek} sessions a week — on purpose: cutting volume while keeping the weight heavy is what makes you peak. Every other day is on the calendar as rest or optional recovery (walk, mobility, bar-only technique — no loading).`);
  }
  // "Exercises you can't or won't do" → swap those accessories everywhere in the block.
  const restricted = restrictedFromText(form.restrictedText);
  const swappedOut = new Set();
  if (restricted.length) for (const w of weeks) for (const d of w.days) {
    const r = applyRestrictions(d.acc, restricted, form.equipment, form.injuries);
    d.acc = r.acc; r.changed.forEach((c) => swappedOut.add(c));
  }
  if (swappedOut.size) notes.push(`Exercises you said you can't or won't do were swapped: ${[...swappedOut].join(", ")}.`);
  // Trim ONCE on the heaviest-volume week and hold the same accessory menu all block — a coach never rotates accessories by accident.
  const trimmed = new Set();
  const refWeek = weeks.find((w) => !w.deload && !w.taper && !w.meetWeek) || weeks.find((w) => !w.meetWeek);
  if (refWeek) trimToBudget(refWeek, budgetMax).forEach((n) => trimmed.add(n));
  if (trimmed.size) for (const w of weeks) if (w !== refWeek && !w.meetWeek) for (const d of w.days) d.acc = d.acc.filter((a) => !trimmed.has(a.name));
  if (trimmed.size) notes.push(`Volume kept at ≤${budgetMax} hard sets/week per muscle group (${style} style, your level ${budget[0]}–${budget[1]}) — dropped: ${[...trimmed].join(", ")}. Arm, shoulder, calf and core work doesn't count toward this; it scales with your style and session length.`);

  const count = { squat: 0, bench: 0, deadlift: 0 };
  tmpl.forEach((d) => d.slots.forEach((s) => count[s.lift]++));
  const freq = `SQ ${count.squat}× · BP ${count.bench}× · DL ${count.deadlift}× / week`;
  const volume = weeklyVolume(weeks.find((w) => !w.deload) || weeks[0]);

  // A test day only makes sense when there is no meet: the meet IS the test.
  const testDay = meet.phase === "none" && !isBeg;
  return { weeks, rec, freq, restDays: ALL_DAYS.filter((d) => !wdays.includes(d)), phase: meet.phase, blockLabel: plan.blockLabel, notes, volume, budget, testDay, meetDays: form.meetDays ?? null, compLifts: form.compLifts || ["squat", "bench", "deadlift"] };
}

/** Which muscle group an accessory counts toward: quads, posterior chain (hamstrings, glutes, lower back),
 *  upper push or upper pull. Helms counts hard sets per muscle group — lumping all leg work into one
 *  "lower" bucket made leg curls compete with squats and starved the accessory list. */
export function accBucket(name) {
  if (/mobility|plank|dead bug|core|cardio|walk|sled|jump rope|stretch|leg raise|knee raise|ab wheel|crunch|pallof|carry|bird dog/i.test(name)) return null;
  // Small-muscle isolation (arms, delts, calves, upper-back pump work): low systemic fatigue, own bucket.
  if (/biceps|triceps|pushdown|skull|lateral raise|rear delt|face pull|band pull|calf|shrug|overhead triceps|hammer curl|barbell curl|db curl/i.test(name)) return "iso";
  if (/leg curl|nordic|back ext|good morning|rdl|romanian|hip thrust|glute|reverse hyper|deadlift|block pull|deficit|rack pull|pull-through/i.test(name)) return "posterior";
  if (/row|pull-?up|chin|lat |pulldown/i.test(name)) return "pull";
  if (/squat|leg press|lunge|step|hack|pendulum|belt|leg ext|split/i.test(name)) return "quads";
  if (/bench|press|dip|push|fly|jm|overhead/i.test(name)) return "push";
  return null;
}
const isHardSet = (m) => !/Technique|Activation|Opener/.test(m.name);

/** Count hard sets per muscle group for one week. Squat → quads, deadlift → posterior chain, bench → push;
 *  light technique work is not counted. */
export function weeklyVolume(week) {
  const v = { quads: 0, posterior: 0, push: 0, pull: 0 };
  for (const d of week.days || []) {
    for (const m of d.main) {
      if (!isHardSet(m)) continue;
      if (m.lift === "deadlift") v.posterior += m.sets;
      else if (m.lift === "squat") v.quads += m.sets;
      else v.push += m.sets;
    }
    for (const a of d.acc) {
      const b = accBucket(a.name);
      if (b && b in v) v[b] += parseInt(String(a.sr), 10) || 0;
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
      const idx = [...d.acc.keys()].reverse().find((i) => { const b = accBucket(d.acc[i].name); return b === over && !d.acc[i].name.startsWith("Weak-point"); });
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

/* ---------------- "Exercises you can't or won't do" ----------------
   Plain-text answer → exercise families. Accessories in a restricted family are swapped for another exercise
   that trains the same muscle group (or dropped if every option is restricted). Main lifts never change here —
   pain on a main lift goes in the injury box, which caps its load. */
const RESTRICT_TERMS = [
  [/\bdips?\b/, /\bdips?\b/i],
  [/pull[- ]?ups?|chin[- ]?ups?/, /pull-?ups?|chin-?ups?/i],
  [/leg press/, /leg press/i],
  [/lunges?/, /lunge/i],
  [/split squat|bulgarian/, /split squat|bulgarian/i],
  [/step[- ]?ups?/, /step-?ups?/i],
  [/overhead|\bohp\b|military|shoulder press/, /overhead press|landmine|neutral-grip db press/i],
  [/\brows?\b|rowing/, /\brow\b/i],
  [/pull ?downs?|lat pull/, /pulldown/i],
  [/\brdl\b|romanian|stiff[- ]?leg/, /romanian|\brdl\b/i],
  [/good ?mornings?/, /good morning/i],
  [/back ext|hyper/, /back extension|reverse hyper/i],
  [/hip thrust|glute bridge/, /hip thrust|glute bridge/i],
  [/leg curl|hamstring curl/, /leg curl/i],
  [/leg ext/, /leg extension/i],
  [/push[- ]?ups?/, /push-?ups?/i],
  [/incline/, /incline/i],
  [/front squat/, /front squat/i],
  [/goblet/, /goblet/i],
  [/hack squat|pendulum/, /hack squat|pendulum/i],
  [/nordic/, /nordic/i],
  [/hanging|leg raise|knee raise/, /hanging|leg raise|knee raise/i],
  [/ab ?wheel|rollout/, /ab wheel/i],
  [/skull/, /skull/i],
  [/lateral raise|side raise/, /lateral raise/i],
  [/face ?pull/, /face pull/i],
  [/calf/, /calf/i],
];
export function restrictedFromText(text) {
  const t = String(text || "").toLowerCase();
  return t.trim() ? RESTRICT_TERMS.filter(([inText]) => inText.test(t)).map(([, inName]) => inName) : [];
}
const RESTRICT_ALT = {
  quads: ["Leg Press or Goblet Squat", "Leg Extension", "Step-ups (DB)", "Bulgarian Split Squat (DB)"],
  posterior: ["Leg Curl", "Back Extension", "Glute Bridge", "Romanian Deadlift (light)"],
  push: ["Incline DB Press", "Push-ups", "Landmine Press (bar in corner)", "DB Bench Press"],
  pull: ["Chest-Supported Row", "Lat Pulldown", "Single-Arm DB Row", "Seated Cable Row"],
  core: ["Dead Bug", "Plank", "Side Plank"],
};
function applyRestrictions(acc, restricted, equipment, injuries) {
  if (!restricted?.length) return { acc, changed: [] };
  const hit = (name) => restricted.some((re) => re.test(name));
  const changed = [];
  const out = [];
  for (const a of acc) {
    if (!hit(a.name)) { out.push(a); continue; }
    // "Lat Pulldown or Pull-ups" with pull-ups restricted → just "Lat Pulldown".
    const [, pre, group, list] = a.name.match(/^((?:Weak-point: )?)(?:([^:]+): )?(.+)$/);
    const options = list.split(/ or /);
    const ok = options.length > 1 ? options.find((o) => !hit(o)) : null;
    if (ok) {
      const label = pre + (group ? group + " " : "") + ok;
      out.push({ ...a, name: label });
      changed.push(`${a.name.replace(/^Weak-point: /, "")} → ${label.replace(/^Weak-point: /, "")}`);
      continue;
    }
    const bucket = accBucket(a.name) || (/plank|bug|raise|wheel|core|crunch/i.test(a.name) ? "core" : null);
    const pool = (RESTRICT_ALT[bucket] || []).map((n) => applyEquipment(applySwaps([{ ...a, name: n }], injuries), equipment)[0]);
    const alt = pool.find((x) => !hit(x.name) && !acc.some((y) => y.name === x.name) && !out.some((y) => y.name === x.name));
    const prefix = a.name.startsWith("Weak-point: ") ? "Weak-point: " : "";
    if (alt) out.push({ ...alt, name: prefix + alt.name });
    changed.push(`${a.name.replace(/^Weak-point: /, "")} → ${alt ? alt.name : "removed"}`);
  }
  return { acc: out, changed };
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
    estimated: a.maxes_estimated === true || a.maxes_estimated === "true" || a.max_tested === "old" || a.max_tested === "never",
  };

  // Training age is defined by how fast you progress, not by years (Helms L3). If the athlete told us, that wins.
  const PROGRESS_EXP = { session: "beg", week: "int", month: "adv" };
  const expFromYears = EXP_MAP[profile?.experience_level] || "int";
  const exp = PROGRESS_EXP[a.progress_rate] || expFromYears;
  const days = Math.min(6, Math.max(3, Number(profile?.training_days_per_week) || 4));
  const today = typeof overrides.today === "string" ? overrides.today : localYmd();
  const meetDays = daysToMeet(profile, today);
  const EVENTS = { full: ["squat", "bench", "deadlift"], bench: ["bench"], deadlift: ["deadlift"], pushpull: ["bench", "deadlift"] };
  const events = EVENTS[a.meet_events] ? a.meet_events : "full";
  const meet = meetPhase(meetDays, exp, leadDays(calToday(today)));

  // Block goal: the meet timeline decides; otherwise the stated goal.
  let goal = "str";
  if (meet.phase === "base") goal = "hyp";
  else if (meet.phase === "strength") goal = "str";
  else if (meet.phase === "peak") goal = "peak";
  else if (profile?.primary_goal === "Hypertrophy") goal = "hyp";
  if (PROGRESS_EXP[a.progress_rate] && PROGRESS_EXP[a.progress_rate] !== expFromYears) {
    const lbl = { beg: "Beginner", int: "Intermediate", adv: "Advanced" };
    decisions.push({ step: "Training Age", decision: lbl[exp], reason: `Your lifts go up ${{ session: "almost every session", week: "week to week / every block", month: "only every month or two" }[a.progress_rate]} — that is ${lbl[exp].toLowerCase()} progression, whatever the years say (${profile?.experience_level || "not set"}). The program matches how fast you actually adapt.` });
  }
  if (meet.reason && a.meet_date_status === "approx" && ["peak", "taper", "meetweek"].includes(meet.phase)) decisions.push({ step: "Block Selection", decision: "Peak & Hold", reason: "Meet date not confirmed — peak toward the earliest likely date, then hold a ready pattern until the date is announced." });
  else if (meet.reason) decisions.push({ step: "Block Selection", decision: { base: "Base Block", strength: "Strength Block", peak: "Peaking Block", taper: "Taper → Meet", meetweek: "Meet Week", post: "Post-meet deload", beginner: "Beginner Linear" }[meet.phase] || SCHEMES[goal]?.label, reason: meet.reason });
  else if (exp === "beg") decisions.push({ step: "Block Selection", decision: "Beginner Linear Block", reason: "Novice: a volume day, a technique + deadlift day and a strength day. Each day adds load every week (squat/deadlift +5 kg, bench +2.5 kg) while every rep stays clean. Skill before load." });
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
  if (exp === "beg") {
    decisions.push({ step: "Weak-Point Diagnosis", decision: "Not yet — beginner", reason: "As a beginner every lift is still learning its pattern, so the 'weak point' is technique, not a muscle. All three lifts get even work and the form cues fix most problems. Weak-point work starts when your progress slows." });
  } else if (flagged.length && maxes.squat) {
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
    today, // the athlete's calendar day this block was built on — re-exports reproduce the same dates
    name: profile?.full_name || "",
    exp, days, goal,
    focus: "bal",
    rmMode: "know",
    maxes: { squat: maxes.squat, bench: maxes.bench, deadlift: maxes.deadlift },
    calc: { squat: { w: "", r: "" }, bench: { w: "", r: "" }, deadlift: { w: "", r: "" } },
    weak, sticking, weakType, variationIdx: 0, accIdx: 0,
    injuries, equipment,
    restrictedText: String(a.restricted_exercises || "").slice(0, 500),
    sleep: ["high", "mid", "low"].includes(a.sleep_level) ? a.sleep_level : "high",
    stress: ["low", "mid", "high"].includes(a.stress_level) ? a.stress_level : "low",
    meetDays,
    meetApprox: a.meet_date_status === "approx",
    compLifts: EVENTS[events],
    sessionMin: [45, 60, 90, 120].includes(Number(a.session_minutes)) ? Number(a.session_minutes) : null,
    style: ["focused", "balanced", "full"].includes(a.training_style) ? a.training_style : "balanced",
    cutting: ["no", "mild", "weightclass"].includes(a.cutting) ? a.cutting : "no",
    squatBar: ["high", "low"].includes(a.squat_bar) ? a.squat_bar : null,
    dlStance: ["conventional", "sumo"].includes(a.deadlift_stance) ? a.deadlift_stance : null,
    ...overrides,
  };
  // A single-lift or push-pull meet shifts the week toward the competed lift(s) — meet-awareness is not a paid extra.
  if (meet.phase !== "none" && meet.phase !== "post" && events === "bench") form.focus = "bench";
  if (meet.phase !== "none" && meet.phase !== "post" && events === "deadlift") form.focus = "dead";
  if (events !== "full" && meet.phase !== "none" && meet.phase !== "post") decisions.push({ step: "Meet Events", decision: EVENTS[events].map((l) => LIFT_NAMES[l]).join(" + "), reason: "Only the lifts on the platform are peaked and tapered; the rest stay at a maintenance dose and fade out in the last 1–2 weeks." });
  if (form.meetApprox && meetDays !== null && meetDays > 0) decisions.push({ step: "Meet Date", decision: "Not confirmed yet", reason: "Planned toward the EARLIEST likely date — being ready early is safe, being late is not. No taper is dated until you confirm; then the taper (10–14 days) is built from the real date." });
  const restrictedHits = restrictedFromText(a.restricted_exercises);
  if (String(a.restricted_exercises || "").trim()) decisions.push({ step: "Exercises You Avoid", decision: restrictedHits.length ? `${restrictedHits.length} exercise type${restrictedHits.length === 1 ? "" : "s"} avoided` : "Read — no match in our exercise list", reason: restrictedHits.length ? "Any of these in your accessories is replaced with another exercise for the same muscle (listed in the plan notes). Main lifts stay — if one of them hurts, write it in the pain box and its load is capped." : "We couldn't match what you wrote to an accessory. Main lifts stay — if one of them hurts, write it in the pain box and its load is capped." });
  if (a.other_sport) decisions.push({ step: "Other Training", decision: String(a.other_sport).slice(0, 40), reason: "Lift first. Hard cardio/sport after lifting (6+ h apart is better) or on non-lifting days; avoid it the day before heavy squats/deadlifts." });
  if (form.cutting === "weightclass") decisions.push({ step: "Weight Cut", decision: "Volume one level lower", reason: "A real deficit lowers recovery — less volume, deload every block, autoregulate harder." });
  if (form.squatBar === "low") decisions.push({ step: "Squat Style", decision: "Low-bar", reason: "Competition and technique squats stay low-bar. Any volume squat is done high-bar/upright, and the quad accessory (leg press / split squat) stays in — low-bar alone under-trains the quads." });
  if (form.dlStance === "sumo" && form.weak === "deadlift" && form.sticking === "floor") decisions.push({ step: "Deadlift Style", decision: "Sumo", reason: "No deficit pulls for a sumo floor weakness — paused pulls just off the floor instead." });
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
      rest: !!d.rest,
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
    if (!d) return;
    if (d.rest) { rows.push([wd, d.title, "—", "", "", "", "", "", d.note || ""]); rows.push([]); return; }
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
