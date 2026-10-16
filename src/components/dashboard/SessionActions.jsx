import { useState } from 'react';
import { supabase } from '../../lib/supabase';

const REASONS = [['sick', 'Sick / not well'], ['busy', 'No time'], ['gym_closed', 'Gym closed / holiday'], ['travel', 'Travelling'], ['injury', 'Injury / pain'], ['other', 'Other']];

async function post(body) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch('/api/save-workout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || 'Could not save');
}

/**
 * The two things real people need besides "Start": they trained from the PDF / forgot
 * the app ("Mark done"), or they can't train ("Skip"). Both keep the plan moving
 * and keep History honest. Neither guilt-trips — one missed day changes nothing.
 */
export default function SessionActions({ programId, week, day, onDone }) {
  const [open, setOpen] = useState(null); // 'skip' | 'done'
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const base = { programId, weekNumber: week.week, dayNumber: day.day, durationSeconds: 0, clientId: `${programId}-${week.week}-${day.day}-${open}` };
  const asPlanned = () => day.exercises.map((ex) => ({
    ...ex,
    skipped: false,
    loggedSets: Array.from({ length: Number(ex.sets) || 1 }, () => ({ weight: ex.weight || '', reps: /^\d+$/.test(String(ex.reps)) ? Number(ex.reps) : '', rpe: '', pain: false, completed: true, planned: true })),
  }));
  const skipped = () => day.exercises.map((ex) => ({ ...ex, skipped: true, loggedSets: [] }));

  const run = async (body) => {
    setBusy(true); setErr('');
    try { await post({ ...base, ...body }); setOpen(null); onDone?.(); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="mt-3">
      <div className="flex justify-center gap-5 text-xs">
        <button type="button" onClick={() => setOpen(open === 'done' ? null : 'done')} className="text-gray-500 hover:text-gray-900 font-medium">Did it without the app?</button>
        <button type="button" onClick={() => setOpen(open === 'skip' ? null : 'skip')} className="text-gray-500 hover:text-gray-900 font-medium">Can't train?</button>
      </div>
      {open === 'done' && (
        <div className="mt-3 bg-gray-50 border border-gray-200 rounded-xl p-4">
          <p className="text-sm text-gray-700">Mark <b>{day.focus}</b> as done as planned. It counts for your block; it isn't used to estimate your max (no RPE).</p>
          <button type="button" disabled={busy} onClick={() => run({ loggedExercises: asPlanned(), quick: true })} className="mt-3 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50">{busy ? 'Saving…' : 'Mark done'}</button>
        </div>
      )}
      {open === 'skip' && (
        <div className="mt-3 bg-gray-50 border border-gray-200 rounded-xl p-4">
          <p className="text-sm text-gray-700 mb-3">No problem — one missed session changes nothing. Don't double up tomorrow; just do the next one. Why are you skipping?</p>
          <div className="grid grid-cols-2 gap-2">
            {REASONS.map(([v, l]) => (
              <button key={v} type="button" disabled={busy} onClick={() => run({ loggedExercises: skipped(), skipReason: v })} className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 hover:bg-gray-100 text-left disabled:opacity-50">{l}</button>
            ))}
          </div>
          <p className="text-[11px] text-gray-400 mt-2">Injury or pain that lasts? Update it in your profile so the plan works around it.</p>
        </div>
      )}
      {err && <p className="text-xs text-red-600 mt-2">{err}</p>}
    </div>
  );
}
