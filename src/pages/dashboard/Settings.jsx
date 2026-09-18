import { useAuth } from '../../context/AuthContext';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function Settings() {
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handlePasswordReset = async () => {
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, { redirectTo: `${window.location.origin}/reset-password` });
    setMessage(error ? error.message : 'Password reset link sent to your email.');
    setLoading(false);
  };

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-800 mb-6">Account Settings</h2>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 space-y-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Email Address</h3>
          <p className="text-gray-600">{user?.email}</p>
        </div>
        <div className="border-t pt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Password</h3>
          <button onClick={handlePasswordReset} disabled={loading} className="bg-gray-100 hover:bg-gray-200 text-gray-800 py-2 px-4 rounded">{loading ? 'Sending...' : 'Send Password Reset Link'}</button>
          {message && <p className="text-green-600 text-sm mt-2">{message}</p>}
        </div>
        <div className="border-t pt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Session</h3>
          <button onClick={signOut} className="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded">Sign Out</button>
        </div>
      </div>
    </div>
  );
}
