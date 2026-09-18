import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import AuthShell from '../components/AuthShell';

export default function ForgotPassword() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(null); setMessage(null);
    const { error } = await resetPassword(email);
    if (error) setError(error.message);
    else setMessage('Password reset link sent. Check your email.');
    setLoading(false);
  };

  return (
    <AuthShell title="Reset password" subtitle="We'll email you a reset link.">
      {error && <div className="bg-red-100 text-red-700 p-3 mb-4 rounded text-sm">{error}</div>}
      {message && <div className="bg-green-100 text-green-700 p-3 mb-4 rounded text-sm">{message}</div>}
      <form onSubmit={handleSubmit}>
        <label className="block text-xs font-semibold uppercase tracking-wider text-knurl mb-1">Email</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full p-3 mb-6 rounded-lg border border-line bg-iron text-chalk focus:ring-2 focus:ring-red-600 focus:border-transparent" />
        <button type="submit" disabled={loading}
          className="w-full bg-red-600 hover:bg-red-700 text-white p-3 rounded-lg font-bold tracking-wide disabled:opacity-50 transition-colors">
          {loading ? 'Sending…' : 'SEND RESET LINK'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm"><Link to="/login" className="text-dim hover:text-chalk">← Back to login</Link></p>
    </AuthShell>
  );
}
