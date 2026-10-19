import { useAuth } from '../../context/AuthContext';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useLang } from '../../lib/useLang';

export default function Settings() {
  const { user, signOut } = useAuth();
  const { L } = useLang();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handlePasswordReset = async () => {
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, { redirectTo: `${window.location.origin}/reset-password` });
    setMessage(error ? error.message : L('Password reset link sent to your email.', 'Password reset link aapke email par bhej diya.'));
    setLoading(false);
  };

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-800 mb-6">{L('Account Settings', 'Account Settings')}</h2>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 space-y-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">{L('Email Address', 'Email Address')}</h3>
          <p className="text-gray-600">{user?.email}</p>
        </div>
        <div className="border-t pt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-2">{L('Password', 'Password')}</h3>
          <button onClick={handlePasswordReset} disabled={loading} className="bg-gray-100 hover:bg-gray-200 text-gray-800 py-2 px-4 rounded">{loading ? L('Sending...', 'Bhej rahe hain...') : L('Send Password Reset Link', 'Password Reset Link bhejo')}</button>
          {message && <p className="text-green-600 text-sm mt-2">{message}</p>}
        </div>
        <div className="border-t pt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-2">{L('Session', 'Session')}</h3>
          <button onClick={signOut} className="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded">{L('Sign Out', 'Sign Out karo')}</button>
        </div>
      </div>
    </div>
  );
}
