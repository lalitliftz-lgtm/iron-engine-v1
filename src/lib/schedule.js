/**
 * Real-life schedule logic for an active block: missed days, breaks, catching up.
 * Coach rules (Helms, Muscle & Strength Pyramid — adherence):
 *  - On schedule: Today shows the session dated today. Never two sessions in one day.
 *  - Missed session, NO meet: pick up where you left off. The missed session is done on the next
 *    training day, every later session moves along, and the block ends a few days later.
 *    On a rest day the athlete may catch up (optional).
 *  - Missed session, MEET block (date can't move): a low-stress session (technique, ~80% singles,
 *    accessories, primer) is simply skipped; a hard one can be made up on a free day in the same
 *    week, 5% lighter (back-to-back hard days are fine now and then if the load drops).
 *  - Rough day: do this week's easiest remaining session today instead; the hard one follows.
 *  - Back after a break: first session lighter (8–14 days −5%, 15–28 days −10%);
 *    a month or more off → a fresh block from current strength.
 */
const DAY = 864e5;

/* ---- "Today" for the whole app. Normally the real date; in test mode (Account → Testing, opened once
   with ?testmode=1) the coach can pretend it's another day to walk through a block. ---- */
const TEST_KEY = 'll-test-today';
export function testToday() {
  try { const v = localStorage.getItem(TEST_KEY); return /^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : null; } catch { return null; }
}
export function setTestToday(ymd) {
  try { if (ymd) localStorage.setItem(TEST_KEY, ymd); else localStorage.removeItem(TEST_KEY); } catch { /* storage blocked */ }
}
/** Now, as the app should see it: the test date (at the current clock time) or the real now. */
export function appNow() {
  const t = testToday();
  if (!t) return new Date();
  const [y, m, d] = t.split('-').map(Number);
  const n = new Date();
  return new Date(y, m - 1, d, n.getHours(), n.getMinutes(), n.getSeconds());
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
/** "2026-12-21" → that calendar day at local midnight. (new Date("2026-12-21") is UTC midnight —
 *  the previous evening anywhere west of London.) */
export function parseYmd(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

/** "16 Oct" (no year) → Date, using the block's creation date to pick the year. */
export function labelToDate(label, createdAt) {
  const m = /^(\d{1,2})\s+([A-Za-z]{3})/.exec(String(label || ''));
  if (!m) return null;
  const mon = MONTHS.indexOf(m[2].slice(0, 1).toUpperCase() + m[2].slice(1, 3).toLowerCase());
  if (mon < 0) return null;
  const base = new Date(createdAt || Date.now());
  let d = new Date(base.getFullYear(), mon, Number(m[1]));
  if (d < new Date(base.getTime() - 30 * DAY)) d = new Date(base.getFullYear() + 1, mon, Number(m[1]));
  return d;
}

/** A log counts as training only if at least one set was ticked (skips and empty saves don't). */
export const trained = (log) => (log.logged_exercises || []).some((ex) => (ex.loggedSets || []).some((s) => s.completed));

// Sessions that cost little and can be dropped when a meet date pins the calendar.
const isLowStress = (s) => !!s.day.optional || /Technique|Singles @ 80|Primer|Support|Accessory|GPP/i.test(s.day.focus || '');
// How hard a session is: average % of its main lifts (accessory-only days count as light).
// Technique singles are heavy-ish % but very low effort (RPE 4–5), so they count 15 points lighter.
const loadScore = (s) => {
  const m = (s.day.exercises || []).filter((e) => e.type === 'Main' && Number(e.pct) > 0);
  return m.length ? m.reduce((a, e) => a + Number(e.pct) - (/Technique|singles/i.test(e.name || '') ? 15 : 0), 0) / m.length : 50;
};
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); // DST-safe

export function planSchedule(snap, logs = [], createdAt, now = appNow()) {
  const today = startOfDay(now);
  const done = new Set(logs.map((l) => `${l.week_number}-${l.day_number}`));
  const meetLocked = snap?.meta?.meetDays !== null && snap?.meta?.meetDays !== undefined;
  const sessions = (snap?.weeks || []).flatMap((w) => (w.days || [])
    .filter((d) => !d.rest && !d.meetDay)
    .map((d) => ({ week: w, day: d, key: `${w.week}-${d.day}`, at: labelToDate(d.date, createdAt) })));
  // Optional days (Technique + GPP, support days) never become "the" next session, never count as missed.
  const pending = sessions.filter((s) => !done.has(s.key));
  const required = pending.filter((s) => !s.day.optional);
  const overdue = required.filter((s) => s.at && s.at < today);
  const sameDayAs = (a, b) => !!a && !!b && a.getTime() === b.getTime();
  const sameDay = (a) => sameDayAs(a, today);
  const todaySession = sessions.find((s) => sameDay(s.at)) || null;
  const todayDone = !!todaySession && done.has(todaySession.key);
  const todayPending = todaySession && !todayDone ? todaySession : null;           // today's session, optional or not
  const upcoming = todayPending || required.find((s) => !s.at || s.at > today) || null;
  const next = upcoming || (meetLocked ? null : required[0] || null);
  // An optional day between today and the next required session: offered, not pushed.
  const optionalBefore = next && !todayPending ? pending.find((s) => s.day.optional && s.at && s.at >= today && (!next.at || s.at < next.at)) || null : null;
  // Before the block's first dated session (blocks start on a Monday).
  const firstAt = sessions.map((s) => s.at).filter(Boolean).sort((a, b) => a - b)[0] || null;
  // The block's last calendar day (rest days included). Past it, the block is over whatever was logged.
  const allDays = (snap?.weeks || []).flatMap((w) => w.days || []);
  const lastAt = allDays.map((d) => labelToDate(d.date, createdAt)).filter(Boolean).sort((a, b) => b - a)[0] || null;
  const blockOver = !!lastAt && today > lastAt;
  const hasMeetDay = allDays.some((d) => d.meetDay);
  const startsOn = firstAt && firstAt > today ? firstAt : null;
  const when = !next?.at ? 'next' : sameDay(next.at) ? 'today' : next.at > today ? 'upcoming' : 'overdue';
  const todayRest = !todaySession && (snap?.weeks || []).some((w) => (w.days || []).some((d) => d.rest && sameDay(labelToDate(d.date, createdAt))));

  const trainedLogs = logs.filter(trained);
  const last = trainedLogs.reduce((a, l) => (!a || new Date(l.date_completed) > new Date(a.date_completed) ? l : a), null);
  const gapDays = last ? Math.round((today - startOfDay(last.date_completed)) / DAY) : null; // round: DST days are 23/25 h
  // Lifts already trained hard today (main sets ticked) — the 48 h note is only about these.
  const todayLifts = new Set(trainedLogs.filter((l) => startOfDay(l.date_completed).getTime() === today.getTime())
    .flatMap((l) => (l.logged_exercises || []).filter((ex) => ex.type === 'Main' && ex.lift && (ex.loggedSets || []).some((s) => s.completed)).map((ex) => ex.lift)));
  const nextLifts = new Set((next?.day.exercises || []).filter((ex) => ex.type === 'Main' && ex.lift).map((ex) => ex.lift));
  // Warn only when the next session hits a lift already trained today. Accessory days, other lifts: no note.
  const repeatLifts = [...nextLifts].filter((l) => todayLifts.has(l));

  // What can be STARTED (Program page + logger). Everything else is viewable but locked until its date;
  // done sessions are locked too (no duplicate logs).
  // Simple rule: only the session dated TODAY can be started. No session today = nothing to start.
  const loggedToday = logs.some((l) => l.date_completed && startOfDay(l.date_completed).getTime() === today.getTime());
  const weekStart = addDays(today, -((today.getDay() + 6) % 7));
  const weekEnd = addDays(weekStart, 7);

  // ---- No meet + behind: pick up where you left off (Helms). The plan slides, nothing is lost. ----
  const behind = !meetLocked && (!firstAt || today >= firstAt) ? overdue.length : 0;
  if (behind > 0) {
    const trainDows = new Set(required.filter((x) => x.at).map((x) => x.at.getDay()));
    if (!trainDows.size) for (let i = 0; i < 7; i++) trainDows.add(i);
    const nextTrain = (d) => { let x = addDays(d, 1); while (!trainDows.has(x.getDay())) x = addDays(x, 1); return x; };
    const head = required[0];
    const trainDay = trainDows.has(today.getDay());
    const primary = !loggedToday && trainDay ? head : null;
    const catchUp = !loggedToday && !trainDay ? head : null; // rest day: allowed, not pushed
    const projected = new Map();
    let d = primary ? today : nextTrain(today);
    for (const x of required) { projected.set(x.key, d); d = nextTrain(d); }
    const newEnd = projected.get(required[required.length - 1].key);
    // Rough day: an easier session from the same training week may go first.
    const easier = primary && !head.week.taper && !head.week.meetWeek
      ? required.slice(1).filter((x) => x.week.week === head.week.week && loadScore(x) <= loadScore(head) - 5).sort((a, b) => loadScore(a) - loadScore(b))[0] || null
      : null;
    const nextLiftsB = new Set((head.day.exercises || []).filter((ex) => ex.type === 'Main' && ex.lift).map((ex) => ex.lift));
    return {
      next: head,
      allowed: new Set([primary, catchUp, easier].filter(Boolean).map((x) => x.key)),
      doneKeys: done,
      when: primary ? 'today' : 'upcoming',
      todayDone: loggedToday,
      optionalBefore: null,
      startsOn: null,
      todayRest: !primary,
      meetLocked,
      rolling: true,
      behind,
      projected,
      newEnd,
      catchUp,
      easier,
      makeUp: null,
      missed: [],
      droppedForMeet: 0,
      gapDays,
      repeatLifts: [...nextLiftsB].filter((l) => todayLifts.has(l)),
      sessionsDone: new Set(trainedLogs.map((l) => `${l.week_number}-${l.day_number}`).filter((k) => sessions.some((x) => x.key === k && !x.day.optional))).size,
      sessionsTotal: sessions.filter((x) => !x.day.optional).length,
      blockOver: false,
      blockEnd: newEnd,
      nothingLeft: false,
      noneLeftBeforeMeet: false,
    };
  }

  // ---- Meet block: a missed HARD session can be made up on a free day of the same week, 5% lighter. ----
  const isMeetDayOn = (day) => allDays.some((x) => x.meetDay && sameDayAs(labelToDate(x.date, createdAt), day));
  const makeUp = meetLocked && !loggedToday && !todayPending && !isMeetDayOn(today) && !isMeetDayOn(addDays(today, 1))
    ? overdue.find((x) => x.at >= weekStart && !isLowStress(x)) || null
    : null;
  // Rough day: this week's easiest remaining session may go first (not in the taper / meet week).
  const base = todayPending && !todayPending.day.optional && !loggedToday && !todayPending.week.taper && !todayPending.week.meetWeek ? todayPending : null;
  const easier = base
    ? required.filter((x) => x !== base && x.at && x.at > today && x.at < weekEnd && loadScore(x) <= loadScore(base) - 5).sort((a, b) => loadScore(a) - loadScore(b))[0] || null
    : null;

  // On schedule: only the session dated TODAY (plus the easier swap / a meet-week make-up).
  const allowed = new Set([todayPending, easier, makeUp].filter(Boolean).map((x) => x.key));
  // A block finished late (catching up ran past its calendar) ends on the day of its last session.
  const lastLogAt = trainedLogs.reduce((m, l) => { const t = startOfDay(l.date_completed); return !m || t > m ? t : m; }, null);
  const endAt = !meetLocked && lastLogAt && lastAt && lastLogAt > lastAt ? lastLogAt : lastAt;

  return {
    next,
    allowed,
    doneKeys: done,
    when,               // 'today' | 'upcoming' (rest day / today done / ahead) | 'overdue' (all dates passed) | 'next'
    todayDone,
    optionalBefore,
    startsOn,
    todayRest,
    meetLocked,
    rolling: false,
    behind: 0,
    projected: null,
    newEnd: null,
    catchUp: null,
    easier,
    makeUp,
    missed: meetLocked ? [] : overdue,
    droppedForMeet: meetLocked ? overdue.filter((x) => x !== makeUp).length : 0, // missed sessions the meet calendar left behind
    gapDays,
    repeatLifts,
    sessionsDone: new Set(trainedLogs.map((l) => `${l.week_number}-${l.day_number}`).filter((k) => sessions.some((x) => x.key === k && !x.day.optional))).size,
    sessionsTotal: sessions.filter((x) => !x.day.optional).length,
    blockOver: !!endAt && today > endAt,
    blockEnd: endAt,
    // Nothing left to train in this block (the rest were missed or done) but its last days haven't passed yet.
    nothingLeft: !next && !required.some((s) => !s.at || s.at >= today),
    // Only a block that ends AT the meet can run out of sessions "before the meet".
    noneLeftBeforeMeet: hasMeetDay && meetLocked && !next && required.length > 0 && !blockOver,
  };
}

/** Load factor for the first session back after a break (null = no change). */
/** Why a session can't be started right now (null = it can). */
export function lockReason(sched, week, day, createdAt) {
  if (!sched || sched.allowed.has(`${week.week}-${day.day}`)) return null;
  if (sched.doneKeys?.has(`${week.week}-${day.day}`)) return { kind: 'done', text: 'Already logged — see it in History.' };
  const moved = sched.projected?.get(`${week.week}-${day.day}`);
  if (moved) return { kind: 'future', text: `Moved to ${moved.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} — you're catching up, sessions go in order.` };
  const at = labelToDate(day.date, createdAt);
  if (at && at > startOfDay(appNow())) return { kind: 'future', text: `Opens on ${at.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}.` };
  return { kind: 'past', text: 'This date has passed — the plan has moved on.' };
}

export function reentry(gapDays) {
  if (gapDays === null || gapDays < 8) return null;
  if (gapDays <= 14) return { factor: 0.95, text: `Back after ${gapDays} days — main lifts 5% lighter today. Full loads from the next session.` };
  if (gapDays <= 28) return { factor: 0.9, text: `Back after ${gapDays} days — main lifts 10% lighter today. Full loads from the next session.` };
  return { factor: 0.9, rebuild: true, text: `Back after ${gapDays} days — main lifts 10% lighter today. After a month off, build a fresh block from where you are now.` };
}
