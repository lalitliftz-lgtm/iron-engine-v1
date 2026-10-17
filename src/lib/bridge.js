import { labelToDate } from './schedule.js';

const DAY = 864e5;

/**
 * Mid-week rebuild (e.g. the meet date was announced on a Wednesday): a new block starts on the next
 * Monday, which used to leave Wed–Sun as "rest / one light technique session". A coach never wastes those
 * days, so the rest of THIS week keeps the previous block's sessions (same loads) as a first
 * "This week (continues)" week; the new block takes over on Monday.
 * Not used when the new block starts today (taper/meet week ≤14 days out) or when there is no previous block.
 *
 * @param newSnap   snapshot of the block just built
 * @param prevSnap  the previous active block's snapshot (with adjustments already applied)
 * @param prevLogs  logs of the previous block (sessions already done are not repeated)
 * @param prevCreatedAt  previous block's created_at (to read its "16 Oct" labels)
 * @param todayMs   the athlete's today as UTC-midnight ms (engine calToday)
 */
export function bridgeWeek(newSnap, prevSnap, prevLogs, prevCreatedAt, todayMs) {
  if (!newSnap?.weeks?.length || !prevSnap?.weeks?.length) return newSnap;
  const todayIso = new Date(todayMs).toISOString().slice(0, 10);
  const toMs = (label, created) => { const d = labelToDate(label, created); return d ? Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) : null; };

  const firstNew = newSnap.weeks.flatMap((w) => w.days).map((d) => toMs(d.date, todayIso)).filter((x) => x !== null).sort((a, b) => a - b)[0];
  if (!firstNew || firstNew <= todayMs) return newSnap; // new block starts today: nothing to bridge

  const done = new Set((prevLogs || []).map((l) => `${l.week_number}-${l.day_number}`));
  const carried = [];
  for (const w of prevSnap.weeks) for (const d of w.days || []) {
    const at = toMs(d.date, prevCreatedAt);
    if (at === null || at < todayMs || at >= firstNew || d.meetDay || done.has(`${w.week}-${d.day}`)) continue;
    carried.push({ at, d, phase: w.phase });
  }
  if (!carried.some(({ d }) => !d.rest)) return newSnap; // only rest days left this week: keep the lead-in note

  carried.sort((a, b) => a.at - b.at);
  const startLabel = new Date(firstNew).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const bridge = {
    week: 1,
    label: 'This week (continues)',
    phase: carried[0].phase || 'Bridge',
    deload: false, taper: false, meetWeek: false,
    bridge: true,
    weekNotes: [`The rest of this week continues your previous block — same sessions, same loads. The new block starts ${startLabel}.`],
    days: carried.map(({ d }, i) => ({ ...d, day: i + 1 })),
  };
  const weeks = [bridge, ...newSnap.weeks.map((w, i) => ({ ...w, week: i + 2 }))];
  const notes = (newSnap.meta?.notes || []).filter((n) => !/^Week 1 starts Monday/.test(n));
  notes.unshift(`This week finishes your previous block's sessions; the new block starts ${startLabel}. No lost days.`);
  return { ...newSnap, weeks, meta: { ...newSnap.meta, notes } };
}
