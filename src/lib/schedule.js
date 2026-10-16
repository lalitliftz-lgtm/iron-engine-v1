/**
 * Real-life schedule logic for an active block: missed days, breaks, catching up.
 * Coach rules (Helms / System 2.0 spirit):
 *  - The CALENDAR leads: Today shows the session dated today. Rest day or already done →
 *    the next dated session. Never cram two sessions to catch up.
 *  - Missed sessions (date passed, not logged): no meet → can be done later on a free day,
 *    or skipped; meet block → dropped, the meet doesn't move.
 *  - Every remaining date already passed (long break) and no meet → continue in order.
 *  - Back after a break: first session lighter (8–14 days −5%, 15–28 days −10%);
 *    a month or more off → a fresh block from current strength.
 */
const DAY = 864e5;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

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

export function planSchedule(snap, logs = [], createdAt, now = new Date()) {
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
  const sameDay = (a) => a && a.getTime() === today.getTime();
  const todaySession = sessions.find((s) => sameDay(s.at)) || null;
  const todayDone = !!todaySession && done.has(todaySession.key);
  const todayPending = todaySession && !todayDone ? todaySession : null;           // today's session, optional or not
  const upcoming = todayPending || required.find((s) => !s.at || s.at > today) || null;
  const next = upcoming || (meetLocked ? null : required[0] || null);
  // An optional day between today and the next required session: offered, not pushed.
  const optionalBefore = next && !todayPending ? pending.find((s) => s.day.optional && s.at && s.at >= today && (!next.at || s.at < next.at)) || null : null;
  // Before the block's first dated session (blocks start on a Monday).
  const firstAt = sessions.map((s) => s.at).filter(Boolean).sort((a, b) => a - b)[0] || null;
  const startsOn = firstAt && firstAt > today ? firstAt : null;
  const when = !next?.at ? 'next' : sameDay(next.at) ? 'today' : next.at > today ? 'upcoming' : 'overdue';
  const todayRest = !todaySession && (snap?.weeks || []).some((w) => (w.days || []).some((d) => d.rest && sameDay(labelToDate(d.date, createdAt))));

  const trainedLogs = logs.filter(trained);
  const last = trainedLogs.reduce((a, l) => (!a || new Date(l.date_completed) > new Date(a.date_completed) ? l : a), null);
  const gapDays = last ? Math.floor((today - startOfDay(last.date_completed)) / DAY) : null;
  // Lifts already trained hard today (main sets ticked) — the 48 h note is only about these.
  const todayLifts = new Set(trainedLogs.filter((l) => startOfDay(l.date_completed).getTime() === today.getTime())
    .flatMap((l) => (l.logged_exercises || []).filter((ex) => ex.type === 'Main' && ex.lift && (ex.loggedSets || []).some((s) => s.completed)).map((ex) => ex.lift)));
  const nextLifts = new Set((next?.day.exercises || []).filter((ex) => ex.type === 'Main' && ex.lift).map((ex) => ex.lift));
  // Warn only when the next session hits a lift already trained today. Accessory days, other lifts: no note.
  const repeatLifts = [...nextLifts].filter((l) => todayLifts.has(l));

  return {
    next,
    when,               // 'today' | 'upcoming' (rest day / today done / ahead) | 'overdue' (all dates passed) | 'next'
    todayDone,
    optionalBefore,
    startsOn,
    todayRest,
    meetLocked,
    missed: meetLocked ? [] : overdue,                // can still be done on a free day
    droppedForMeet: meetLocked ? overdue.length : 0, // missed sessions the meet calendar left behind
    gapDays,
    repeatLifts,
    sessionsDone: new Set(trainedLogs.map((l) => `${l.week_number}-${l.day_number}`).filter((k) => sessions.some((x) => x.key === k && !x.day.optional))).size,
    sessionsTotal: sessions.filter((x) => !x.day.optional).length,
    noneLeftBeforeMeet: meetLocked && !next && required.length > 0,
  };
}

/** Load factor for the first session back after a break (null = no change). */
export function reentry(gapDays) {
  if (gapDays === null || gapDays < 8) return null;
  if (gapDays <= 14) return { factor: 0.95, text: `Back after ${gapDays} days — main lifts 5% lighter today. Full loads from the next session.` };
  if (gapDays <= 28) return { factor: 0.9, text: `Back after ${gapDays} days — main lifts 10% lighter today. Full loads from the next session.` };
  return { factor: 0.9, rebuild: true, text: `Back after ${gapDays} days — main lifts 10% lighter today. After a month off, build a fresh block from where you are now.` };
}
