/**
 * Real-life schedule logic for an active block: missed days, breaks, catching up.
 * Coach rules (Helms / System 2.0 spirit):
 *  - No meet: the plan is a SEQUENCE. A missed day isn't lost, it's simply next; dates slide.
 *  - Meet block: the CALENDAR wins. The meet doesn't move, so missed sessions are dropped
 *    and you continue with today's session — never cram two sessions to catch up.
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
  const pending = sessions.filter((s) => !done.has(s.key));
  const overdue = pending.filter((s) => s.at && s.at < today);
  const next = meetLocked ? (pending.find((s) => !s.at || s.at >= today) || null) : (pending[0] || null);

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
    meetLocked,
    behind: meetLocked ? 0 : overdue.length,       // sessions the dates are behind (sequence mode)
    droppedForMeet: meetLocked ? overdue.length : 0, // missed sessions the meet calendar left behind
    gapDays,
    repeatLifts,
    sessionsDone: trainedLogs.length,
    sessionsTotal: sessions.length,
    noneLeftBeforeMeet: meetLocked && !next && pending.length > 0,
  };
}

/** Load factor for the first session back after a break (null = no change). */
export function reentry(gapDays) {
  if (gapDays === null || gapDays < 8) return null;
  if (gapDays <= 14) return { factor: 0.95, text: `Back after ${gapDays} days — main lifts 5% lighter today. Full loads from the next session.` };
  if (gapDays <= 28) return { factor: 0.9, text: `Back after ${gapDays} days — main lifts 10% lighter today. Full loads from the next session.` };
  return { factor: 0.9, rebuild: true, text: `Back after ${gapDays} days — main lifts 10% lighter today. After a month off, build a fresh block from where you are now.` };
}
