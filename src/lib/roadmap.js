import { meetPhase } from './engine';
import { labelToDate, startOfDay } from './schedule';

const DAY = 864e5;
const NAME = { base: 'Base', strength: 'Strength', peak: 'Peak → Taper', taper: 'Taper', meetweek: 'Meet week', beginner: 'Beginner Linear', post: 'Post-meet recovery' };
const FOCUS = {
  base: 'Muscle + work capacity · 6–8 reps',
  strength: 'Heavy 2–5s at 80–90%',
  peak: 'Competition lifts · singles/doubles · taper',
  taper: 'Volume down, weight stays heavy',
  meetweek: 'Light singles, rest, compete',
  beginner: 'Add weight every week',
};

/**
 * The season at a glance: the current block in full, the blocks after it as an outline, ending at the meet.
 * Future blocks use the SAME phase rules the engine uses when it builds them (meetPhase), so the roadmap is
 * what will actually happen — but each one is still built from real results when its turn comes.
 */
export function seasonRoadmap(snap, createdAt, meetDate, exp = 'int') {
  if (!snap?.weeks?.length) return null;
  const dates = snap.weeks.flatMap((w) => w.days.map((d) => labelToDate(d.date, createdAt))).filter(Boolean).sort((a, b) => a - b);
  const start = dates[0] || startOfDay(createdAt || Date.now());
  const end = dates[dates.length - 1] || new Date(start.getTime() + snap.weeks.length * 7 * DAY - DAY);
  const blocks = [{ name: snap.blockType || 'Current block', weeks: snap.weeks.length, start, end, current: true }];

  const meet = meetDate ? startOfDay(meetDate) : null;
  if (!meet || meet <= end) return { blocks, meet: meet && meet >= start ? meet : null };

  // Next blocks start on the Monday after this one ends.
  let cursor = new Date(end.getTime() + DAY);
  while (cursor.getDay() !== 1) cursor = new Date(cursor.getTime() + DAY);
  for (let i = 0; i < 12; i++) {
    const days = Math.round((meet - cursor) / DAY);
    if (days <= 0) break;
    const m = meetPhase(days, exp, 0);
    const lenWeeks = m.blockWeeks || (m.phase === 'beginner' && !m.finalDays ? 4 : null);
    if (lenWeeks && m.phase !== 'peak') {
      const bEnd = new Date(cursor.getTime() + lenWeeks * 7 * DAY - DAY);
      blocks.push({ name: m.phase === 'beginner' ? 'Beginner Linear' : NAME[m.phase], weeks: lenWeeks, start: cursor, end: bEnd, focus: FOCUS[m.phase] });
      cursor = new Date(bEnd.getTime() + DAY);
    } else {
      blocks.push({ name: NAME[m.phase] || 'Peak → Taper', weeks: Math.ceil(days / 7), start: cursor, end: new Date(meet.getTime() - DAY), focus: FOCUS[m.phase] || FOCUS.peak, final: true });
      break;
    }
  }
  return { blocks, meet };
}

