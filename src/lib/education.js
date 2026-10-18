/* Beginner education: short, practical, one idea at a time. Shown inside the app where it's needed
   (warm-ups and cues next to the lift, RPE where you rate it, one tip a day on Today) — no reading homework. */

/** Warm-up ramp to the first work set: bar ×8 → 40% ×5 → 55% ×3 → 70% ×2 → 80% ×1 of the WORK weight
 *  (deadlift starts from the floor at 40%). Steps that are at/below the bar or too close to the work set are skipped. */
export function warmupSets(workKg, lift) {
  const W = Number(workKg);
  if (!W || W <= 25) return [];
  const r = (x) => Math.round(x / 2.5) * 2.5;
  const ramp = [[0.4, 5], [0.55, 3], [0.7, 2], [0.8, 1]].map(([p, reps]) => ({ kg: r(W * p), reps }));
  const out = lift === 'deadlift' ? [] : [{ kg: 20, reps: 8, bar: true }];
  for (const s of ramp) {
    const prev = out[out.length - 1]?.kg || 0;
    if (s.kg > 20 && s.kg > prev && s.kg <= W * 0.85) out.push(s);
  }
  return out;
}

/** Three cues per lift — the ones that fix most beginner problems. */
export const CUES = {
  squat: ['Big breath into your belly, brace like someone will punch your stomach — then sit down.', 'Knees travel out over your toes; whole foot stays on the floor.', 'Hips below the knee crease, then drive up — chest and hips rise together.'],
  bench: ['Shoulder blades squeezed together and down, before you unrack.', 'Feet planted, slight arch; the bar touches the same spot on your lower chest every rep.', 'Lower under control, short pause, press up and slightly back over your shoulders.'],
  deadlift: ['Bar over mid-foot, shins close; grip just outside your legs.', 'Pull the slack out of the bar (tight arms, chest up) before it leaves the floor.', 'Push the floor away; bar stays against your legs; stand tall, don\'t lean back.'],
};

/** RPE in plain words. */
export const RPE_SCALE = [
  ['10', 'Nothing left — could not do one more rep.'],
  ['9', 'One more rep was possible.'],
  ['8', 'Two more reps were possible.'],
  ['7', 'Three more reps — fast and clean.'],
  ['6', 'Four or more left — a warm-up feel.'],
];

/** One lesson per day for the first two weeks. */
export const LESSONS = [
  { t: 'Log every set — it is your coach', b: 'Tap ✓ after each set and add how hard it felt. The engine reads these to pick next week\'s weights. A session that isn\'t logged can\'t help you.' },
  { t: 'What RPE means', b: 'RPE = how many reps you had left. RPE 8 = two more were possible. Most of your sets should feel like 7–8: hard, but clean and fast.' },
  { t: 'Warm up the same way every time', b: 'Bar ×8, then a few lighter sets up to your work weight (the app lists them). Warm-ups should never tire you — they rehearse the lift.' },
  { t: 'Brace before every rep', b: 'Big breath into your belly, tighten everything around it, then move. Breathe out at the top, breathe in again, brace again.' },
  { t: 'Depth and range count', b: 'A squat counts when your hips go below your knees. A bench rep touches your chest. Short reps look stronger but build less strength.' },
  { t: 'Rest long enough', b: 'Main lifts: 3–5 minutes between sets. Short rest feels productive but makes the next set worse. Accessories: 1.5–2 minutes.' },
  { t: 'Soreness vs pain', b: 'Dull, all-over muscle soreness is normal and fades in 1–3 days. Sharp pain in a joint is not — stop that lift and tap Pain.' },
  { t: 'Why the weights feel easy at first', b: 'Your plan starts a little light on purpose. You add weight every week; starting easy is what lets you keep adding for months.' },
  { t: 'Sleep is part of training', b: '7–9 hours. Strength is built while you recover, not while you lift. Bad night? Use "Low energy" in the workout instead of skipping.' },
  { t: 'Eat enough protein', b: 'Roughly 1.6–2 g per kg of bodyweight a day, spread over meals — dal, paneer, eggs, chicken, curd, whey. It is what your muscles are rebuilt from.' },
  { t: 'Missed a session? Just continue', b: 'Never do two sessions in one day to catch up. Do the next one. One missed day changes nothing; trying to make it up does.' },
  { t: 'Technique day is not an easy day', b: 'Light weight, perfect reps. Same setup, same speed every rep. This is where your squat, bench and deadlift get better.' },
  { t: 'Film one set a week', b: 'Phone on the floor, side view. Compare it with the cues on each lift. You will see things you can\'t feel.' },
  { t: 'Progress is not linear forever', b: 'Weeks of easy progress, then a tough week — normal. Log honestly; the engine slows the jumps when you need it.' },
];

const LESSON_KEY = 'll-lessons-seen';
export function seenLessons() { try { return JSON.parse(localStorage.getItem(LESSON_KEY) || '[]'); } catch { return []; } }
export function markLessonSeen(i) { try { const s = new Set(seenLessons()); s.add(i); localStorage.setItem(LESSON_KEY, JSON.stringify([...s])); } catch { /* storage blocked */ } }
/** Today's lesson: the first one not yet marked "Got it". */
export function nextLesson() {
  const seen = new Set(seenLessons());
  const i = LESSONS.findIndex((_, k) => !seen.has(k));
  return i === -1 ? null : { i, ...LESSONS[i], n: i + 1, of: LESSONS.length };
}
