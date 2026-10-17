/**
 * Season simulator — walks real athletes through whole seasons, day by day, and checks the rules
 * the app promises. Run: `npm run test:season` (runs it in three time zones).
 *
 * For every scenario (start weekday × meet distance × training age × days/week × events × exact/approx):
 *   build block → each calendar day: what can be started? log it (or miss it) → block over? build the next
 *   one (with the mid-week bridge) → … → meet day → post-meet block.
 * Plus mid-week meet announcements (rebuild on a Wednesday with the bridge week).
 * Any broken rule is printed with the scenario so it can be reproduced.
 */
const store = {};
globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };

const { profileToForm, buildProgram, toSnapshot, calToday } = await import('../src/lib/engine.js');
const { planSchedule, lockReason, labelToDate, setTestToday } = await import('../src/lib/schedule.js');
const { bridgeWeek } = await import('../src/lib/bridge.js');
const { seasonRoadmap } = await import('../src/lib/roadmap.js');
const { applyAdjustments } = await import('../src/lib/autoreg.js');

const DAY = 864e5;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ymdUTC = (ms) => new Date(ms).toISOString().slice(0, 10);
const utc = (s) => Date.parse(`${s}T00:00:00Z`);
const localNoon = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 10, 0, 0); };
const sameLocalDay = (a, s) => { const b = localNoon(s); return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); };

let rng = 12345;
const rand = () => { rng = (rng * 1103515245 + 12345) % 2147483648; return rng / 2147483648; };

const failures = [];
let checks = 0;
const fail = (ctx, msg) => { if (failures.length < 400) failures.push(`${ctx} :: ${msg}`); };
const ok = (cond, ctx, msg) => { checks++; if (!cond) fail(ctx, msg); };

function build(profile, today, prev) {
  const { form, maxes, decisions } = profileToForm(profile, { today });
  const program = buildProgram(form, maxes);
  let snap = toSnapshot(program, form, maxes, decisions);
  if (prev) snap = bridgeWeek(snap, applyAdjustments(prev.snap, prev.snap.adjustments), prev.logs, prev.createdAt, calToday(today));
  return { snap, createdAt: `${today}T06:00:00Z`, logs: [], builtOn: today, label: snap.blockType };
}

/** Calendar of a block: [{w, d, ymd}] using the app's own label reader. */
function calendar(block) {
  return block.snap.weeks.flatMap((w) => w.days.map((d) => {
    const at = labelToDate(d.date, block.createdAt);
    return { w, d, ymd: at ? `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}` : null, at };
  }));
}

function checkSnapshot(block, ctx, { meet, exact, hasMaxes, days, today }) {
  const cal = calendar(block);
  ok(cal.every((c) => c.ymd), ctx, 'a day has no readable date');
  // weekday matches date, dates strictly increasing, no duplicates
  for (let i = 0; i < cal.length; i++) {
    const c = cal[i];
    if (!c.at) continue;
    ok(c.d.weekday === WEEKDAYS[c.at.getDay()], ctx, `${c.d.date} labelled ${c.d.weekday} but is a ${WEEKDAYS[c.at.getDay()]}`);
    if (i) ok(utc(c.ymd) > utc(cal[i - 1].ymd), ctx, `dates not increasing: ${cal[i - 1].d.date} → ${c.d.date}`);
  }
  const first = cal[0]?.ymd;
  ok(first && utc(first) >= utc(today), ctx, `block starts ${first} before the day it was built (${today})`);
  ok(first && (utc(first) - utc(today)) / DAY <= 6, ctx, `block starts ${first}, more than 6 days after ${today}`);
  // meet day
  const meetDays = cal.filter((c) => c.d.meetDay);
  if (meet && exact && cal.length && utc(meet) <= utc(cal[cal.length - 1].ymd)) {
    ok(meetDays.length === 1, ctx, `${meetDays.length} meet days in a block that reaches the meet`);
    ok(meetDays[0]?.ymd === meet, ctx, `meet day on ${meetDays[0]?.ymd}, meet is ${meet}`);
    ok(utc(cal[cal.length - 1].ymd) === utc(meet), ctx, `block continues after the meet (${cal[cal.length - 1].ymd})`);
    const dayBefore = cal.find((c) => c.ymd === ymdUTC(utc(meet) - DAY));
    ok(!dayBefore || dayBefore.d.rest || !dayBefore.d.exercises?.length, ctx, 'training scheduled the day before the meet');
  }
  if (!meet) ok(meetDays.length === 0, ctx, 'meet day in a block without a meet');
  // loads
  for (const c of cal) for (const ex of c.d.exercises || []) {
    if (ex.type !== 'Main' || ex.pct === null || ex.pct === undefined) continue;
    ok(ex.pct <= 92.5, ctx, `${c.d.date} ${ex.name} at ${ex.pct}%`);
    if (hasMaxes && ex.lift) ok(Number(ex.weight) > 0 && Number.isFinite(Number(ex.weight)), ctx, `${c.d.date} ${ex.name} has no load (${ex.weight})`);
  }
  // Required sessions per calendar week (Mon–Sun) never exceed the athlete's days (bridge days aside).
  const perWeek = {};
  for (const c of cal) {
    if (!c.at || c.w.bridge || c.d.rest || c.d.meetDay || c.d.optional) continue;
    const mon = new Date(c.at); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
    const k = mon.toDateString(); perWeek[k] = (perWeek[k] || 0) + 1;
  }
  for (const [k, n] of Object.entries(perWeek)) ok(n <= days, ctx, `week of ${k}: ${n} required sessions, athlete trains ${days} days`);
}

function walk(profile, scen, ctx) {
  const { start, meet, exact, hasMaxes, days, missRate, changeMeet } = scen;
  let prof = { ...profile };
  let block = build(prof, start);
  checkSnapshot(block, ctx + ' [block 1]', { meet: prof.competition_date, exact, hasMaxes, days, today: start });
  const blocks = [block];
  const end = meet ? ymdUTC(utc(meet) + 2 * DAY) : ymdUTC(utc(start) + 120 * DAY);
  let predicted = null;
  for (let t = utc(start); t <= utc(end); t += DAY) {
    const today = ymdUTC(t);
    setTestToday(today);
    const now = localNoon(today);
    const dctx = `${ctx} @${today} [${block.label}]`;

    // Coach announces the meet mid-week → rebuild with the bridge week.
    if (changeMeet && today === changeMeet.on) {
      prof = { ...prof, competition_status: true, competition_date: changeMeet.meet, assessment_data: { ...prof.assessment_data, meet_date_status: 'exact' } };
      const before = calendar(block).filter((c) => !c.d.rest && !c.d.meetDay && c.ymd && utc(c.ymd) >= t && !block.logs.some((l) => l.week_number === c.w.week && l.day_number === c.d.day));
      const next = build(prof, today, block);
      checkSnapshot(next, dctx + ' [rebuilt mid-week]', { meet: changeMeet.meet, exact: true, hasMaxes, days: Infinity, today });
      const ncal = calendar(next);
      const newFirst = ncal.find((c) => !c.w.bridge)?.ymd;
      for (const c of before) if (newFirst && utc(c.ymd) < utc(newFirst) && !c.d.optional) ok(ncal.some((n) => n.w.bridge && n.ymd === c.ymd && n.d.focus === c.d.focus), dctx, `mid-week rebuild lost ${c.d.date} ${c.d.focus}`);
      block = next; blocks.push(block);
      scen.meet = changeMeet.meet;
    }

    const sched = planSchedule(block.snap, block.logs, block.createdAt, now);
    const cal = calendar(block);
    const todays = cal.filter((c) => c.ymd === today && !c.d.rest && !c.d.meetDay);
    const pendingToday = todays.filter((c) => !block.logs.some((l) => l.week_number === c.w.week && l.day_number === c.d.day));
    ok(sched.allowed.size <= 1, dctx, `${sched.allowed.size} sessions startable on one day`);
    if (pendingToday.length) ok(sched.allowed.has(`${pendingToday[0].w.week}-${pendingToday[0].d.day}`), dctx, `today's session ${pendingToday[0].d.focus} is not startable`);
    if (pendingToday.length) ok(sched.when === 'today', dctx, `Today card is "${sched.when}" while a session is dated today`);
    for (const c of cal) {
      if (c.d.rest || c.d.meetDay) continue;
      const key = `${c.w.week}-${c.d.day}`;
      if (c.ymd !== today) ok(!sched.allowed.has(key) && lockReason(sched, c.w, c.d, block.createdAt), dctx, `${c.d.date} ${c.d.focus} startable on ${today}`);
    }
    if (!pendingToday.length && !sched.blockOver && sched.next) ok(sched.when !== 'today', dctx, 'Today card offers a session on a day without one');
    // Today is never blank without a reason: a next session, block over, everything logged, or "none left before the meet".
    const allLogged = cal.filter((c) => !c.d.rest && !c.d.meetDay && !c.d.optional).every((c) => block.logs.some((l) => l.week_number === c.w.week && l.day_number === c.d.day));
    ok(sched.next || sched.blockOver || allLogged || sched.noneLeftBeforeMeet || sched.nothingLeft || cal.some((c) => c.d.meetDay && utc(c.ymd) >= t), dctx, 'Today has nothing to show and no reason');
    if (sched.noneLeftBeforeMeet) ok(cal.some((c) => c.d.meetDay) && !sched.blockOver, dctx, '"no sessions left before the meet" on a block without the meet');

    // The athlete trains (or misses) today's session.
    if (pendingToday.length) {
      const c = pendingToday[0];
      if (rand() >= missRate) block.logs.push({ week_number: c.w.week, day_number: c.d.day, date_completed: new Date(now).toISOString(), logged_exercises: (c.d.exercises || []).map((ex) => ({ ...ex, loggedSets: [{ weight: ex.weight, reps: ex.reps, rpe: '', completed: true }] })) });
    }

    // Meet day itself
    const meetToday = cal.find((c) => c.ymd === today && c.d.meetDay);
    if (meetToday) ok(sched.allowed.size === 0, dctx, 'a session is startable on meet day');

    // Block over → the roadmap's prediction must match what actually gets built next.
    if (sched.blockOver) {
      const tomorrowIsMeetDone = scen.meet && utc(today) > utc(scen.meet);
      const next = build(prof, today, block);
      if (predicted && !tomorrowIsMeetDone && scen.meet) {
        const actual = next.label;
        const okName = (predicted === 'Base' && /Base/.test(actual)) || (predicted === 'Strength' && /Strength/.test(actual)) || (predicted === 'Peak & Hold' && /Peak & Hold/.test(actual)) || (/Peak|Taper|Meet/i.test(predicted) && predicted !== 'Peak & Hold' && /Peak|Taper|Meet/i.test(actual) && !/Hold/.test(actual)) || (predicted === 'Beginner Linear' && /Beginner/.test(actual));
        ok(okName, dctx, `roadmap said next is "${predicted}", engine built "${actual}"`);
      }
      checkSnapshot(next, dctx + ' [next block]', { meet: tomorrowIsMeetDone ? null : prof.competition_date, exact, hasMaxes, days: Infinity, today });
      block = next; blocks.push(block);
      if (blocks.length > 20) { fail(ctx, 'more than 20 blocks — season never reaches the meet'); break; }
    }
    // Remember what the roadmap predicts for the block after this one.
    predicted = seasonRoadmap(block.snap, block.createdAt, prof.competition_date, block.snap.meta?.form?.exp, prof.assessment_data?.meet_date_status === 'approx')?.blocks?.[1]?.name || null;
  }

  // An exact meet must have been on the calendar of some block, on the right day.
  if (scen.meet && exact) ok(blocks.some((b) => calendar(b).some((c) => c.d.meetDay && c.ymd === scen.meet)), ctx, `meet ${scen.meet} never appeared as a meet day`);
  setTestToday(null);
  return blocks.length;
}

// ---------------- scenario grid ----------------
const EXP = [['Beginner', 'session'], ['Intermediate', 'week'], ['Advanced', 'month']];
const EVENTS = ['full', 'bench', 'deadlift', 'pushpull'];
const MEETS = [null, 6, 10, 14, 20, 30, 36, 41, 45, 55, 63, 70, 77, 90, 120, 160];
let scenarios = 0, blocksBuilt = 0;
const t0 = Date.now();
for (let s = 0; s < 7; s++) {                        // every start weekday
  const start = ymdUTC(utc('2026-10-12') + s * DAY);
  for (const md of MEETS) for (const [lvl, rate] of EXP) for (const days of [3, 4, 5, 6]) {
    const approx = md && md > 30 && rand() < 0.3;
    const events = EVENTS[Math.floor(rand() * EVENTS.length)];
    const noMaxes = lvl === 'Beginner' && rand() < 0.3;
    const meet = md ? ymdUTC(utc(start) + md * DAY) : null;
    const profile = {
      full_name: 'Sim', experience_level: lvl, training_days_per_week: days, bodyweight_kg: 80,
      squat_1rm: noMaxes ? null : 160, bench_1rm: noMaxes ? null : 110, deadlift_1rm: noMaxes ? null : 195,
      competition_status: !!meet, competition_date: meet,
      assessment_data: { progress_rate: rate, meet_events: events, meet_date_status: approx ? 'approx' : 'exact' },
    };
    const scen = { start, meet, exact: !approx, hasMaxes: !noMaxes, days, missRate: rand() < 0.5 ? 0 : 0.15 };
    const ctx = `[TZ=${process.env.TZ || 'local'} start=${start} meet=${meet || 'none'}${approx ? '(approx)' : ''} ${lvl} ${days}d ${events}${noMaxes ? ' no-maxes' : ''} miss=${scen.missRate}]`;
    try { blocksBuilt += walk(profile, scen, ctx); } catch (e) { fail(ctx, `CRASH ${e.stack?.split('\n').slice(0, 3).join(' | ')}`); }
    scenarios++;
  }
}
// Mid-week meet announcements: no meet → on a Wednesday the date is set 12–60 days out.
for (let s = 0; s < 7; s++) for (const ahead of [12, 16, 25, 35, 45, 60]) for (const [lvl, rate] of EXP) {
  const start = ymdUTC(utc('2026-10-12') + s * DAY);
  let wed = utc(start) + 7 * DAY; while (new Date(wed).getUTCDay() !== 3) wed += DAY;
  const on = ymdUTC(wed), meet = ymdUTC(wed + ahead * DAY);
  const profile = { full_name: 'Sim', experience_level: lvl, training_days_per_week: 4, bodyweight_kg: 80, squat_1rm: 160, bench_1rm: 110, deadlift_1rm: 195, competition_status: false, competition_date: null, assessment_data: { progress_rate: rate, meet_events: 'full' } };
  const scen = { start, meet: null, exact: true, hasMaxes: true, days: 4, missRate: 0, changeMeet: { on, meet } };
  const ctx = `[TZ=${process.env.TZ || 'local'} start=${start} meet announced ${on} for ${meet} ${lvl}]`;
  try { blocksBuilt += walk(profile, scen, ctx); } catch (e) { fail(ctx, `CRASH ${e.stack?.split('\n').slice(0, 3).join(' | ')}`); }
  scenarios++;
}

console.log(`TZ=${process.env.TZ || 'local'}: ${scenarios} seasons, ${blocksBuilt} blocks, ${checks} checks in ${((Date.now() - t0) / 1000).toFixed(1)}s — ${failures.length ? `${failures.length} FAILED` : 'all passed'}`);
if (failures.length) {
  const byMsg = {};
  for (const f of failures) { const m = f.split(' :: ')[1].replace(/\d{1,2} [A-Z][a-z]{2}|\d{4}-\d{2}-\d{2}/g, '…'); (byMsg[m] = byMsg[m] || []).push(f); }
  for (const [m, list] of Object.entries(byMsg)) console.log(`\n✗ ${m}  (${list.length}×)\n   e.g. ${list[0]}`);
  process.exitCode = 1;
}
