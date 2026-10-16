import { Link } from 'react-router-dom';
import { planStaleReasons } from '../../lib/planStale';

/** Amber nudge when the profile changed after this block was built. */
export default function StalePlanBanner({ profile, program, className = '' }) {
  const reasons = planStaleReasons(profile, program);
  if (!reasons.length) return null;
  return (
    <div className={`bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 no-print ${className}`}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-700">Your profile changed — this block is out of date</p>
        <p className="text-xs text-gray-500 mt-0.5">Since it was built, {reasons.join(', ')}. Build a new block so the plan matches. Sessions you already logged stay in History.</p>
      </div>
      <Link to="/dashboard/generate" className="bg-gray-900 text-white px-4 py-2.5 rounded-lg text-sm font-semibold text-center shrink-0">Build new block</Link>
    </div>
  );
}
