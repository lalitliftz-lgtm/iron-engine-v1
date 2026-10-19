import { Link } from 'react-router-dom';
import { seasonRoadmap } from '../../lib/roadmap';
import { appNow } from '../../lib/schedule';
import { useLang } from '../../lib/useLang';

const fmt = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/** The big picture above the detailed block: where this block sits in the season, ending at the meet. */
export default function SeasonRoadmap({ program }) {
  const { L } = useLang();
  const snap = program?.program_snapshot;
  const profile = program?.athlete_profiles || {};
  const approx = profile.assessment_data?.meet_date_status === 'approx';
  const road = seasonRoadmap(snap, program?.created_at, profile.competition_date, snap?.meta?.form?.exp, approx);
  if (!road) return null;
  const { blocks, meet } = road;
  const weeksToMeet = meet ? Math.max(0, Math.ceil((meet - appNow()) / (7 * 864e5))) : null;

  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-4 md:p-5 mb-5 no-print">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">{L('Season roadmap', 'Season ka roadmap')}</h2>
        {meet && <span className="text-xs text-gray-500">{L(`${weeksToMeet} week${weeksToMeet === 1 ? '' : 's'} to the meet${approx ? ' (date not confirmed)' : ''}`, `Meet mein ${weeksToMeet} hafte baaki${approx ? ' (date pakki nahi)' : ''}`)}</span>}
      </div>
      <ol className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
        {blocks.map((b, i) => (
          <li key={i} className={`rounded-xl border p-3 ${b.current ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
            <p className={`text-[11px] font-semibold uppercase tracking-wider ${b.current ? 'text-red-600' : 'text-gray-400'}`}>{b.current ? L('Now', 'Abhi') : L(`Then · ${b.weeks} wk`, `Phir · ${b.weeks} wk`)}</p>
            <p className="text-sm font-semibold text-gray-900 mt-0.5">{b.name}</p>
            <p className="text-xs text-gray-500 tabular-nums">{fmt(b.start)} – {fmt(b.end)}</p>
            {b.focus && <p className="text-xs text-gray-500 mt-1">{b.focus}</p>}
          </li>
        ))}
        {meet ? (
          <li className="rounded-xl border border-gray-900 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-900">Meet</p>
            <p className="text-sm font-semibold text-gray-900 mt-0.5">{fmt(meet)}</p>
            <p className="text-xs text-gray-500">{approx ? L('Earliest likely date', 'Sabse jaldi possible date') : 'Platform day'}</p>
          </li>
        ) : (
          <li className="rounded-xl border border-dashed border-gray-300 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{L('Next', 'Agla')}</p>
            <p className="text-sm text-gray-700 mt-0.5">{L("Built from this block's results — Base or Strength.", 'Is block ke results se banega — Base ya Strength.')}</p>
            <Link to="/dashboard/assessment" className="text-xs font-semibold text-blue-600">{L('Add a meet date for a full season plan', 'Poore season plan ke liye meet date daalo')}</Link>
          </li>
        )}
      </ol>
      {blocks.length > 1 && <p className="text-[11px] text-gray-400 mt-3">{L('Later blocks are an outline. Each one is built from your real results when its turn comes.', 'Aage ke blocks abhi sirf outline hain. Har block apni baari aane pe aapke real results se banega.')}</p>}
    </section>
  );
}
