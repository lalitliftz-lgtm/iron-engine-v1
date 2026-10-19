import { useEffect, useState } from 'react';
import { withParams, safeNext } from '../lib/nav';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthShell from '../components/AuthShell';

export default function Signup() {
  const { signUp, user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const product = params.get('product');
  const loginSuffix = `${next ? `?next=${encodeURIComponent(next)}` : ''}${product ? `${next ? '&' : '?'}product=${encodeURIComponent(product)}` : ''}`;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (user) navigate(withParams(next, { product }), { replace: true }); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(null); setMessage(null);
    const { error } = await signUp(email, password, window.location.origin + withParams('/login', { next, product }));
    if (error) setError(error.message);
    else setMessage(`Verification link sent to ${email}. Not in your inbox? Check Spam / Promotions (Inbox mein nahi? Spam check karo). Tap the link, then log in.`);
    setLoading(false);
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle={product ? `You're signing up to unlock: ${product}` : 'Science-based powerlifting. No bro-science.'}>
      {error && <div className="bg-red-100 text-red-700 p-3 mb-4 rounded text-sm">{error}</div>}
      {message && <div className="bg-green-100 text-green-700 p-3 mb-4 rounded text-sm">{message}</div>}
      <form onSubmit={handleSubmit}>
        <label className="block text-xs font-semibold uppercase tracking-wider text-knurl mb-1">Email</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full p-3 mb-4 rounded-lg border border-line bg-iron text-chalk focus:ring-2 focus:ring-red-600 focus:border-transparent" />
        <label className="block text-xs font-semibold uppercase tracking-wider text-knurl mb-1">Password</label>
        <input type="password" required minLength="6" value={password} onChange={(e) => setPassword(e.target.value)}
          className="w-full p-3 mb-6 rounded-lg border border-line bg-iron text-chalk focus:ring-2 focus:ring-red-600 focus:border-transparent" />
        <button type="submit" disabled={loading}
          className="w-full bg-red-600 hover:bg-red-700 text-white p-3 rounded-lg font-bold tracking-wide disabled:opacity-50 transition-colors">
          {loading ? 'Creating account…' : 'CREATE ACCOUNT →'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-dim">
        Already have an account? <Link to={`/login${loginSuffix}`} className="text-brass font-semibold">Log in</Link>
      </p>
    </AuthShell>
  );
}
