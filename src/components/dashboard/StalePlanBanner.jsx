import { Link } from 'react-router-dom';
import { planStaleReasons } from '../../lib/planStale';
import { useLang } from '../../lib/useLang';

/** Amber nudge when the profile changed after this block was built. */
export default function StalePlanBanner({ profile, program, className = '' }) {
  const { L } = useLang();
  const reasons = planStaleReasons(profile, program);
  if (!reasons.length) return null;
  return (
    <div className={`bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 no-print ${className}`}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-700">{L('Your profile changed — this block is out of date', 'Aapki profile badal gayi — yeh block purana ho gaya')}</p>
        <p className="text-xs text-gray-500 mt-0.5">{L(`Since it was built, ${reasons.join(', ')}. Build a new block so the plan matches. Sessions you already logged stay in History.`, `Block banne ke baad: ${reasons.join(', ')}. Naya block banao taaki plan match kare. Jo sessions log ho chuke hain woh History mein rahenge.`)}</p>
      </div>
      <Link to="/dashboard/generate" className="bg-gray-900 text-white px-4 py-2.5 rounded-lg text-sm font-semibold text-center shrink-0">{L('Build new block', 'Naya block banao')}</Link>
    </div>
  );
}
