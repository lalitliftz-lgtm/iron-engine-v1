import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import AuthShell from '../components/AuthShell';

export const INVITE_KEY = 'll-invite-code';

/** /invite/CODE — remembers the code, then the person signs up or logs in and claims it on the Pro page. */
export default function Invite() {
  const { code = '' } = useParams();
  useEffect(() => { try { localStorage.setItem(INVITE_KEY, code); } catch { /* storage blocked: they can type the code */ } }, [code]);
  const next = encodeURIComponent('/dashboard/subscription');
  return (
    <AuthShell title="You're invited 🎉" subtitle="One month of Iron Engine Pro, free — invite only.">
      <p className="text-sm text-gray-600">Your code: <b className="font-mono text-gray-900">{code}</b></p>
      <p className="text-sm text-gray-500 mt-2">Create your account (or log in), then tap <b>Claim free month</b> on the Pro page. If the code doesn't fill in by itself, type it there.</p>
      <div className="flex flex-col gap-2 mt-5">
        <Link to={`/signup?next=${next}`} className="text-center bg-gray-900 text-white font-semibold py-3 rounded-lg">Create account</Link>
        <Link to={`/login?next=${next}`} className="text-center border border-gray-200 text-gray-700 font-semibold py-3 rounded-lg">I already have an account</Link>
      </div>
    </AuthShell>
  );
}
