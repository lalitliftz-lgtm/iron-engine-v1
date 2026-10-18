import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { blockSummary, printBlock } from '../../lib/exportBlock';

const STYLE = { focused: 'Focused', balanced: 'Balanced', full: 'Full' };

/** The moment after "Build my block": what you got, at a glance, and the one next step. */
export default function BlockReady({ snapshot, athlete }) {
  const s = blockSummary(snapshot, athlete);
  const weeks = snapshot.weeks || [];
  // Heaviest prescribed % of each week (main lifts) — the shape of the block.
  const shape = weeks.map((w) => {
    const pcts = w.days.flatMap((d) => (d.exercises || []).filter((e) => e.type === 'Main' && e.pct).map((e) => e.pct));
    return { label: w.label || `Week ${w.week}`, top: pcts.length ? Math.max(...pcts) : null, tag: w.bridge ? 'continues' : w.meetWeek ? 'meet' : w.taper ? 'taper' : w.deload ? 'deload' : '' };
  });
  const tops = shape.map((x) => x.top).filter(Boolean);
  const lo = Math.min(...tops) - 5, hi = Math.max(...tops); // spread the bars over the block's own range
  const first = weeks.flatMap((w) => w.days).find((d) => !d.rest && !d.meetDay);
  const why = (snapshot.meta?.decisions || []).filter((d) => ['Block Selection', 'Training Age'].includes(d.step)).map((d) => d.reason).filter(Boolean).slice(0, 2);
  const style = snapshot.meta?.form?.style;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 md:p-10 shadow-2xl text-white">
      <div className="flex items-center gap-2 text-green-400 text-sm font-semibold">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
        Your block is ready
      </div>
      <h1 className="text-3xl md:text-4xl mt-3 leading-tight" style={{ fontFamily: "'Archivo Black', sans-serif" }}>{s.block}</h1>
      <p className="text-gray-400 mt-1">{s.athlete}{s.range ? ` · ${s.range}` : ''}</p>

      <div className="flex flex-wrap gap-2 mt-5">
        {[`${s.weeks} weeks`, `${s.sessions} sessions`, s.freq, style && `${STYLE[style]} accessories`, s.meet && `Meet ${s.meet}`].filter(Boolean).map((c) => (
          <span key={c} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-gray-700 text-gray-300">{c}</span>
        ))}
      </div>

      {tops.length > 0 && (
        <div className="mt-7">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500 mb-3">How heavy each week gets</p>
          <div className="flex items-end gap-2 h-28">
            {shape.map((w, i) => {
              const h = w.top ? 18 + ((w.top - lo) / Math.max(1, hi - lo)) * 82 : 10;
              return (
                <div key={i} className="flex-1 min-w-0 h-full flex flex-col justify-end items-center gap-1.5">
                  <span className="text-[11px] tabular-nums text-gray-300">{w.top ? `${w.top}%` : ''}</span>
                  <motion.div initial={{ height: 0 }} animate={{ height: `${h}%` }} transition={{ delay: 0.15 + i * 0.08, duration: 0.5 }}
                    className="w-full rounded-t-md" style={{ background: w.tag === 'deload' || w.tag === 'taper' ? '#4b5260' : w.tag === 'meet' ? '#c9a24b' : '#c8102e' }} />
                </div>
              );
            })}
          </div>
          <div className="flex gap-2 mt-1.5">
            {shape.map((w, i) => <span key={i} className="flex-1 min-w-0 text-center text-[10px] text-gray-500 truncate">{w.tag || w.label.replace('Week ', 'W')}</span>)}
          </div>
        </div>
      )}

      {first && (
        <div className="mt-7 border border-gray-800 rounded-xl p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500">First session · {first.weekday} {first.date}</p>
          <p className="font-semibold mt-1">{first.focus}</p>
          <div className="mt-2 space-y-1">
            {(first.exercises || []).filter((e) => e.type === 'Main').map((e, i) => (
              <div key={i} className="flex justify-between text-sm"><span className="text-gray-300">{e.name}</span><span className="font-mono text-gray-200">{e.sets} × {e.reps}{e.weight ? ` · ${e.weight} kg` : ''}</span></div>
            ))}
          </div>
        </div>
      )}

      {why.length > 0 && (
        <div className="mt-6 space-y-1.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500">Why this block</p>
          {why.map((w, i) => <p key={i} className="text-sm text-gray-300">• {w}</p>)}
        </div>
      )}

      <div className="mt-8 grid gap-2 sm:grid-cols-3">
        <Link to="/dashboard/programs" className="sm:col-span-2 bg-red-600 hover:bg-red-700 text-white text-center font-semibold py-3.5 rounded-xl">Open my program</Link>
        <button type="button" onClick={() => printBlock(snapshot, athlete)} className="border border-gray-700 text-gray-200 font-semibold py-3.5 rounded-xl hover:bg-gray-800">Download PDF</button>
      </div>
      <Link to="/dashboard" className="block text-center text-sm text-gray-400 mt-4 hover:text-white">Go to Today</Link>
    </motion.div>
  );
}
