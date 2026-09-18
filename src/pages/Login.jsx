import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthShell from '../components/AuthShell';

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/dashboard';
  const product = params.get('product');
  const suffix = `${next ? `?next=${encodeURIComponent(next)}` : ''}${product ? `${next ? '&' : '?'}product=${encodeURIComponent(product)}` : ''}`;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await signIn(email, password);
    if (error) { setError(error.message); setLoading(false); return; }
    const dest = product ? `${next}?product=${encodeURIComponent(product)}` : next;
    navigate(dest, { replace: true });
  };

  return (
    <AuthShell title="Log in" subtitle="Welcome back. Load the bar.">
      {error && <div className="bg-red-100 text-red-700 p-3 mb-4 rounded text-sm">{error}</div>}
      <form onSubmit={handleSubmit}>
        <label className="block text-xs font-semibold uppercase tracking-wider text-knurl mb-1">Email</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full p-3 mb-4 rounded-lg border border-line bg-iron text-chalk focus:ring-2 focus:ring-red-600 focus:border-transparent" />
        <label className="block text-xs font-semibold uppercase tracking-wider text-knurl mb-1">Password</label>
        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
          className="w-full p-3 mb-6 rounded-lg border border-line bg-iron text-chalk focus:ring-2 focus:ring-red-600 focus:border-transparent" />
        <button type="submit" disabled={loading}
          className="w-full bg-red-600 hover:bg-red-700 text-white p-3 rounded-lg font-bold tracking-wide disabled:opacity-50 transition-colors">
          {loading ? 'Logging in…' : 'LOG IN →'}
        </button>
      </form>
      <div className="mt-6 flex flex-col items-center text-sm gap-2">
        <Link to="/forgot-password" className="text-dim hover:text-chalk">Forgot password?</Link>
        <p className="text-dim">New here? <Link to={`/signup${suffix}`} className="text-brass font-semibold">Create an account</Link></p>
      </div>
    </AuthShell>
  );
}
