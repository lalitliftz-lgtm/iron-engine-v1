/**
 * Did the athlete's profile change in a way the current block no longer matches?
 * Returns plain-language reasons (empty = plan still fits). Only checks things that
 * change the block itself: meet on/off or moved, events, training days.
 */
const EVENT_LIFTS = { full: 'squat,bench,deadlift', bench: 'bench', deadlift: 'deadlift', pushpull: 'bench,deadlift' };

export function planStaleReasons(profile, program) {
  const meta = program?.program_snapshot?.meta;
  if (!profile || !meta?.form) return [];
  // Only a profile edit AFTER the block was built counts (Generate-screen choices are deliberate).
  if (!profile.updated_at || new Date(profile.updated_at) <= new Date(program.created_at)) return [];
  const a = profile.assessment_data || {};
  const reasons = [];

  const builtWithMeet = meta.meetDays !== null && meta.meetDays !== undefined;
  const hasMeet = !!profile.competition_date;
  if (builtWithMeet && !hasMeet) reasons.push('the meet was removed');
  else if (!builtWithMeet && hasMeet) reasons.push('a meet was added');
  else if (builtWithMeet && hasMeet) {
    const plannedMeet = new Date(program.created_at).getTime() + meta.meetDays * 864e5;
    if (Math.abs(new Date(profile.competition_date).getTime() - plannedMeet) > 3 * 864e5) reasons.push('the meet date moved');
  }

  const days = Math.min(6, Math.max(3, Number(profile.training_days_per_week) || 4));
  if (meta.form.days && days !== meta.form.days) reasons.push(`training days changed (${meta.form.days} → ${days})`);

  const events = EVENT_LIFTS[a.meet_events] || EVENT_LIFTS.full;
  if (meta.form.compLifts && meta.form.compLifts.join(',') !== events) reasons.push('the competition lifts changed');

  // Maxes edited by 5% or more → percentages in this block are off.
  // (Skipped when the block deliberately started below the profile maxes after a hard block.)
  const loweredOnPurpose = (meta.decisions || []).some((d) => d.step === 'Start Load');
  const changed = loweredOnPurpose ? [] : ['squat', 'bench', 'deadlift'].filter((l) => {
    const now = Number(profile[`${l}_1rm`]), then = Number(meta.maxes?.[l]);
    return now && then && Math.abs(now - then) / then >= 0.05;
  });
  if (changed.length) reasons.push(`your ${changed.join('/')} max changed`);

  return reasons;
}
