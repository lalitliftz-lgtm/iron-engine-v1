import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { e1rmFromLogs } from '../../lib/autoreg';

const LIFT_NAMES = { squat: 'Squat', bench: 'Bench', deadlift: 'Deadlift' };
const n = (v) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));
const fmtDate = (d, opts = { weekday: 'short', day: 'numeric', month: 'short' }) => new Date(d).toLocaleDateString(undefined, opts);

/** Heaviest completed set of each competition lift's main work in one session. */
function topSets(log) {
  const top = {};
  for (const ex of log.logged_exercises || []) {
    if (ex.type !== 'Main' || !ex.lift || ex.skipped) continue;
    for (const s of ex.loggedSets || []) {
      const kg = n(s.weight);
      if (!s.completed || !kg) continue;
      if (!top[ex.lift] || kg > top[ex.lift].kg) top[ex.lift] = { kg, reps: s.reps, rpe: s.rpe };
    }
  }
  return top;
}

function setCounts(log) {
  let done = 0, total = 0, pain = false;
  for (const ex of log.logged_exercises || []) for (const s of ex.loggedSets || []) { total++; if (s.completed) done++; if (s.pain) pain = true; }
  return { done, total, pain };
}

export default function WorkoutHistory() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      const { data } = await supabase
        .from('workout_logs')
        .select(`id, program_id, date_completed, duration_seconds, week_number, day_number, logged_exercises, generated_programs ( program_snapshot )`)
        .eq('user_id', user.id)
        .order('date_completed', { ascending: false });
      setLogs(data || []);
      setLoading(false);
    };
    fetchHistory();
  }, [user]);

  // Newest block first; sessions inside a block newest first.
  const blocks = useMemo(() => {
    const map = new Map();
    for (const log of logs) {
      const key = log.program_id || 'none';
      if (!map.has(key)) map.set(key, { key, snapshot: log.generated_programs?.program_snapshot || null, logs: [] });
      map.get(key).logs.push(log);
    }
    return [...map.values()];
  }, [logs]);

  // Soft delete (is_deleted) — the row is kept for safety but leaves History, Today and block stats.
  const removeLog = async (log) => {
    if (!window.confirm(`Remove the session from ${fmtDate(log.date_completed)}? Use this for a wrong or test log — it no longer counts anywhere.`)) return;
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/remove-workout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ logId: log.id }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { window.alert(`Could not remove it: ${body.error || 'please try again'}`); return; }
    setLogs((prev) => prev.filter((l) => l.id !== log.id));
  };

  const trend = useMemo(() => {
    const best = e1rmFromLogs(logs);
    const oldest = blocks[blocks.length - 1]?.snapshot?.meta?.maxes || {};
    return Object.keys(LIFT_NAMES).filter((l) => best[l]).map((l) => ({ lift: l, start: n(oldest[l]), now: best[l].e1rm, from: best[l].from }));
  }, [logs, blocks]);

  if (loading) return <div className="flex justify-center min-h-[60vh] items-center"><div className="animate-spin h-8 w-8 border-2 border-gray-900 rounded-full border-t-transparent"></div></div>;

  if (logs.length === 0) return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-8 md:py-12">
      <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 tracking-tight mb-6">History</h1>
      <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">No sessions logged yet</h2>
        <p className="text-gray-500 text-sm mb-5">Every session you log shows up here, with your top sets and how your strength is moving.</p>
        <Link to="/dashboard" className="inline-block bg-gray-900 text-white px-6 py-3 rounded-lg text-sm font-semibold">Go to today's session</Link>
      </div>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 md:py-12">
      <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 tracking-tight">History</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">{logs.length} session{logs.length === 1 ? '' : 's'} logged · {blocks.length} block{blocks.length === 1 ? '' : 's'}</p>

      {trend.length > 0 && (
        <section className="bg-white border border-gray-200 rounded-2xl p-4 md:p-5 mb-6">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Strength trend</h2>
          <div className="grid grid-cols-3 gap-3">
            {trend.map((t) => {
              const delta = t.start ? t.now - t.start : null;
              return (
                <div key={t.lift}>
                  <p className="text-xs text-gray-500">{LIFT_NAMES[t.lift]}</p>
                  <p className="text-xl font-bold text-gray-900 tabular-nums">{t.now}<span className="text-xs font-normal text-gray-500"> kg</span></p>
                  {delta !== null && (
                    <p className={`text-xs tabular-nums ${delta >= 2.5 ? 'text-green-600' : 'text-gray-400'}`}>
                      {delta >= 2.5 ? `▲ +${delta}` : delta <= -2.5 ? `${delta}` : '±0'} vs start {t.start}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">Estimated 1RM from your logged sets of 5 reps or fewer at RPE 8.5 or below — not a test. Best sets: {trend.map((t) => `${LIFT_NAMES[t.lift]} ${t.from}`).join(' · ')}.</p>
        </section>
      )}

      <div className="space-y-4">
        {blocks.map((b, bi) => <Block key={b.key} block={b} open={bi === 0} onRemove={removeLog} />)}
      </div>
    </div>
  );
}

function Block({ block, open, onRemove }) {
  const snap = block.snapshot;
  const trainable = snap?.weeks ? snap.weeks.flatMap((w) => w.days.filter((d) => !d.rest && !d.meetDay).map((d) => `${w.week}-${d.day}`)) : [];
  // A session counts only when at least one set was ticked — an empty "Finish" is not a trained day.
  const done = new Set(block.logs.filter((l) => setCounts(l).done > 0).map((l) => `${l.week_number}-${l.day_number}`).filter((k) => trainable.includes(k))).size;
  const pct = trainable.length ? Math.min(100, Math.round((done / trainable.length) * 100)) : null;
  const first = block.logs[block.logs.length - 1], last = block.logs[0];

  return (
    <details open={open} className="group bg-white border border-gray-200 rounded-2xl">
      <summary className="list-none cursor-pointer p-4 md:p-5">
        <div className="flex justify-between items-start gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900 truncate">{snap?.blockType || 'Program'}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{fmtDate(first.date_completed, { day: 'numeric', month: 'short' })} – {fmtDate(last.date_completed, { day: 'numeric', month: 'short' })} · {block.logs.length} session{block.logs.length === 1 ? '' : 's'}</p>
          </div>
          <span className="text-gray-400 text-sm transition-transform group-open:rotate-180" aria-hidden>▾</span>
        </div>
        {pct !== null && (
          <div className="mt-3">
            <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--ll-good)' }} /></div>
            <p className="text-[11px] text-gray-400 mt-1">{done} of {trainable.length} sessions done · {pct}%</p>
          </div>
        )}
      </summary>
      <div className="border-t border-gray-200 divide-y divide-gray-200">
        {block.logs.map((log) => <Session key={log.id} log={log} snap={snap} onRemove={onRemove} />)}
      </div>
    </details>
  );
}

function Session({ log, snap, onRemove }) {
  const day = snap?.weeks?.[log.week_number - 1]?.days?.find((d) => d.day === log.day_number);
  const top = topSets(log);
  const { done, total, pain } = setCounts(log);
  const exercises = (log.logged_exercises || []).filter((ex) => !ex.skipped && ex.loggedSets?.some((s) => s.completed));
  const mins = Math.round((log.duration_seconds || 0) / 60);

  return (
    <details className="">
      <summary className="list-none cursor-pointer px-4 md:px-5 py-3.5">
        <div className="flex justify-between items-baseline gap-3">
          <p className="text-sm font-medium text-gray-900 min-w-0 truncate">
            {fmtDate(log.date_completed)} <span className="text-gray-500 font-normal">· W{log.week_number} D{log.day_number}{day?.focus ? ` · ${day.focus}` : ''}</span>
          </p>
          <p className="text-xs text-gray-400 shrink-0 tabular-nums">{mins ? `${mins} min · ` : ''}{done}/{total} sets</p>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs">
          {Object.entries(top).map(([l, s]) => (
            <span key={l} className="text-gray-600"><span className="text-gray-400">{LIFT_NAMES[l]}</span> <b className="text-gray-900 font-semibold tabular-nums">{s.kg}×{s.reps}</b>{s.rpe ? <span className="text-gray-400"> @{s.rpe}</span> : ''}</span>
          ))}
          {pain && <span className="text-amber-700">⚠ pain noted</span>}
          {done === 0 && <span className="text-amber-700">No sets ticked — tap ✓ on each set while you train so it counts</span>}
          {done > 0 && !Object.keys(top).length && <span className="text-gray-400">Accessories / support work</span>}
        </div>
      </summary>
      <div className="px-4 md:px-5 pb-4 space-y-2">
        {exercises.map((ex, i) => (
          <div key={i} className="flex justify-between items-start gap-3 text-sm">
            <span className="text-gray-700 min-w-0">{ex.name}</span>
            <div className="flex flex-wrap justify-end gap-1.5">
              {ex.loggedSets.filter((s) => s.completed).map((s, si) => (
                <span key={si} className={`text-xs px-1.5 py-0.5 rounded font-mono ${s.pain ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-700'}`}>{s.weight ? `${s.weight}×` : ''}{s.reps}</span>
              ))}
            </div>
          </div>
        ))}
        <div className="pt-2 text-right">
          <button type="button" onClick={() => onRemove(log)} className="text-xs text-gray-400 hover:text-red-600">Remove this session</button>
        </div>
      </div>
    </details>
  );
}
