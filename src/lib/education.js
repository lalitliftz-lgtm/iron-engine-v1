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
  { t: 'Missed a session? Pick up where you left off', b: 'Do the missed session on your next training day — the rest of the plan moves along and the block ends a few days later. Never two sessions in one day. Meet coming up? Then the date can\'t move: skip a light session, make up a hard one on a free day.' },
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

/* ---------------- Hinglish ----------------
   Same advice in simple Hinglish (Roman script) for lifters more comfortable with Hindi.
   One switch for the whole app's coaching text; remembered on this phone. */
export const LESSONS_HI = [
  { t: 'Har set log karo — yahi aapka coach hai', b: 'Har set ke baad ✓ dabao aur likho kitna tough laga. Engine isi se agle hafte ka weight decide karta hai. Jo session log nahi hua, woh aapki madad nahi kar sakta.' },
  { t: 'RPE ka matlab', b: 'RPE = set ke baad kitne reps aur ho sakte the. RPE 8 = 2 reps aur ho jaate. Zyada tar sets 7–8 par hone chahiye: mushkil, lekin saaf aur fast.' },
  { t: 'Warm-up hamesha ek jaisa', b: 'Khali bar ×8, phir thode halke sets work weight tak (app list dikhata hai). Warm-up se thakna nahi hai — yeh lift ki practice hai.' },
  { t: 'Har rep se pehle brace', b: 'Pet mein badi saans bharo, uske chaaron taraf sab tight karo, phir lift karo. Upar aakar saans chhodo, phir saans bharo, phir brace.' },
  { t: 'Depth aur poori range zaroori', b: 'Squat tab count hota hai jab hips ghutno se neeche jaayein. Bench rep mein bar chest ko touch kare. Aadhe reps strong dikhte hain par strength kam banate hain.' },
  { t: 'Rest poora lo', b: 'Main lifts: sets ke beech 3–5 minute. Kam rest productive lagta hai par agla set kharab karta hai. Accessories: 1.5–2 minute.' },
  { t: 'Soreness vs dard', b: 'Muscles mein halka, poora dard (soreness) normal hai, 1–3 din mein chala jaata hai. Joint mein tez/chubhne wala dard normal nahi — woh lift rok do aur Pain dabao.' },
  { t: 'Shuru mein weight halka kyun lagta hai', b: 'Plan jaan-boojh kar thoda halka shuru hota hai. Har hafte weight badhta hai; aasaan shuruaat hi mahino tak badhte rehne deti hai.' },
  { t: 'Neend bhi training hai', b: '7–9 ghante. Strength recovery mein banti hai, lift karte waqt nahi. Raat kharab gayi? Workout skip mat karo — "Low energy" use karo.' },
  { t: 'Protein poora khao', b: 'Roz lagbhag 1.6–2 g per kg bodyweight, alag-alag meals mein — dal, paneer, ande, chicken, dahi, whey. Muscles isi se dobara bante hain.' },
  { t: 'Session miss hua? Jahan chhoda wahin se shuru karo', b: 'Chhoota hua session agle training din karo — baaki plan aage khisak jaata hai, block kuch din baad khatam hota hai. Ek din mein do session kabhi nahi. Meet aane wala hai? Tab date nahi hilti: halka session chhod do, heavy wala hafte ke khaali din mein kar lo.' },
  { t: 'Technique day aasaan din nahi hai', b: 'Halka weight, perfect reps. Har rep same setup, same speed. Yahin aapka squat, bench aur deadlift behtar hota hai.' },
  { t: 'Hafte mein ek set video karo', b: 'Phone zameen par, side se. Har lift ke cues se compare karo. Jo feel nahi hota, woh video mein dikh jaata hai.' },
  { t: 'Progress hamesha seedhi line nahi hoti', b: 'Kuch hafte aasaan progress, phir ek tough hafta — normal hai. Imaandari se log karo; zaroorat ho toh engine jumps chhote kar deta hai.' },
];

export const CUES_HI = {
  squat: ['Pet mein badi saans, aise brace karo jaise koi pet par punch maarega — phir neeche baitho.', 'Ghutne toes ki direction mein bahar; poora pair zameen par.', 'Hips ghutno se neeche, phir upar push — chest aur hips saath uthein.'],
  bench: ['Unrack se pehle shoulder blades peeche aur neeche squeeze karo.', 'Pair zameen par jame hue, halka arch; bar har rep lower chest par same jagah touch kare.', 'Control mein neeche, chhota pause, phir upar aur thoda peeche shoulders ki taraf press.'],
  deadlift: ['Bar mid-foot ke upar, shins paas; grip legs ke theek bahar.', 'Bar zameen se uthne se pehle slack nikalo (haath tight, chest upar).', 'Zameen ko neeche dhakelo; bar legs se chipki rahe; seedhe khade ho, peeche mat jhuko.'],
};

export const RPE_SCALE_HI = [
  ['10', 'Kuch nahi bacha — ek rep bhi aur nahi hota.'],
  ['9', 'Ek rep aur ho jaata.'],
  ['8', 'Do reps aur ho jaate.'],
  ['7', 'Teen reps aur — fast aur saaf.'],
  ['6', 'Chaar ya zyada bache — warm-up jaisa.'],
];

export const EDU_TEXT = {
  en: {
    tip: 'Coach tip', gotIt: 'Got it', warmup: 'Warm-up sets', workSets: 'work sets', bar: 'bar',
    warmupHint: 'Easy and fast — rest 1–2 min between. Warm-ups rehearse the lift; they should never tire you.',
    cues: 'Form cues',
    rpeLine: 'RPE 7 = 3 reps left · 8 = 2 left · 9 = 1 left. Log it after each set — the plan adjusts the next sets.',
    rpeWhat: 'What is RPE?', rpeTitle: 'RPE — how hard was that set?',
    rpeIntro: 'Count the reps you still had in the tank, honestly. Bar speed is a good guide: still fast = 7, slowing down = 8–9.',
    rpeFoot: 'Most work sets should land at 7–8. Halves are fine: 8.5 = maybe two, surely one more.',
    switchTo: 'Hinglish mein padho',
  },
  hi: {
    tip: 'Coach tip', gotIt: 'Samajh gaya', warmup: 'Warm-up sets', workSets: 'work sets', bar: 'bar',
    warmupHint: 'Aasaan aur fast — beech mein 1–2 min rest. Warm-up lift ki practice hai; isse thakna nahi hai.',
    cues: 'Form cues (sahi technique)',
    rpeLine: 'RPE 7 = 3 reps bache · 8 = 2 bache · 9 = 1 bacha. Har set ke baad likho — plan agle sets adjust karta hai.',
    rpeWhat: 'RPE kya hai?', rpeTitle: 'RPE — set kitna tough tha?',
    rpeIntro: 'Imaandari se gino kitne reps aur ho sakte the. Bar ki speed se pata chalta hai: abhi bhi fast = 7, slow ho rahi = 8–9.',
    rpeFoot: 'Zyada tar work sets 7–8 par hone chahiye. Aadha bhi chalega: 8.5 = shayad do, ek pakka.',
    switchTo: 'Read in English',
  },
};

const LANG_KEY = 'll-lang';
export function getLang() { try { return localStorage.getItem(LANG_KEY) === 'hi' ? 'hi' : 'en'; } catch { return 'en'; } }
export function setLang(lang) {
  try { localStorage.setItem(LANG_KEY, lang === 'hi' ? 'hi' : 'en'); } catch { /* storage blocked */ }
  window.dispatchEvent(new Event(LANG_KEY));
}
export const LANG_EVENT = LANG_KEY;
