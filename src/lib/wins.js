// Post-session wins: what went well today, measured against the athlete's own past logs.
// Every session gets at least one honest win — showing up is the habit that builds the total.
import { epley } from './engine.js';
import { appNow } from './schedule.js';

const LIFTS = ['squat', 'bench', 'deadlift'];
const NAMES = { squat: 'Squat', bench: 'Bench', deadlift: 'Deadlift' };
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) && n > 0 ? n : null; };

/** Best numbers per competition lift from a list of logged exercises. e1RM only from sets of ≤ 5 reps. */
function bests(exercises) {
  const out = {};
  for (const ex of exercises || []) {
    if (ex.type !== 'Main' || !LIFTS.includes(ex.lift) || ex.skipped) continue;
    for (const s of ex.loggedSets || []) {
      if (!s.completed) continue;
      const w = num(s.weight), r = num(s.reps);
      if (!w) continue;
      const b = out[ex.lift] || (out[ex.lift] = { top: 0, e1rm: 0, volume: 0 });
      b.top = Math.max(b.top, w);
      if (r && r <= 5) b.e1rm = Math.max(b.e1rm, epley(w, r));
      if (r) b.volume += w * r;
    }
  }
  return out;
}

/** Wins for today's session. `past` = earlier workout logs (logged_exercises, date_completed). */
export function findWins(exercises, past = []) {
  const now = bests(exercises);
  const before = {};
  for (const l of past) {
    const b = bests(l.logged_exercises);
    for (const k of Object.keys(b)) {
      const p = before[k] || (before[k] = { top: 0, e1rm: 0 });
      p.top = Math.max(p.top, b[k].top);
      p.e1rm = Math.max(p.e1rm, b[k].e1rm);
    }
  }
  const wins = [];
  for (const lift of LIFTS) {
    const t = now[lift], p = before[lift];
    if (!t) continue;
    if (p && t.top > p.top) {
      wins.push({ big: true, pr: true, en: `New heaviest ${NAMES[lift]}: ${t.top} kg (was ${p.top} kg)`, hi: `Naya heaviest ${NAMES[lift]}: ${t.top} kg (pehle ${p.top} kg)` });
    } else if (p && p.e1rm && t.e1rm > p.e1rm + 0.5) {
      wins.push({ big: true, pr: true, en: `${NAMES[lift]} is getting stronger: estimated max ${Math.round(t.e1rm)} kg (was ${Math.round(p.e1rm)} kg)`, hi: `${NAMES[lift]} strong ho raha hai: estimated max ${Math.round(t.e1rm)} kg (pehle ${Math.round(p.e1rm)} kg)` });
    }
  }
  const trainedPast = past.filter((l) => (l.logged_exercises || []).some((ex) => (ex.loggedSets || []).some((s) => s.completed)));
  const count = trainedPast.length + 1;
  if ([1, 5, 10, 25, 50, 100, 150, 200, 300, 500].includes(count)) {
    wins.push({ big: count > 1, en: count === 1 ? 'First session logged — the hardest one is done.' : `Session #${count} in the book. Consistency builds the total.`, hi: count === 1 ? 'Pehla session log ho gaya — sabse mushkil wala ho gaya.' : `Session #${count} ho gaya. Consistency se hi total badhta hai.` });
  }
  // Sessions this calendar week (Mon–Sun), today included.
  const today = appNow();
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
  const thisWeek = trainedPast.filter((l) => new Date(l.date_completed) >= monday).length + 1;
  if (thisWeek >= 2) wins.push({ en: `${thisWeek} sessions this week. Showing up is the win.`, hi: `Is hafte ${thisWeek} sessions. Aate rehna hi asli jeet hai.` });
  if (!wins.length) wins.push({ en: 'You showed up and did the work. That is how strength is built — one session at a time.', hi: 'Aaye aur kaam kiya. Strength aise hi banti hai — ek session ek baar mein.' });
  return wins.slice(0, 4);
}
