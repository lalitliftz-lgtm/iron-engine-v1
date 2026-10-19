import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion } from 'framer-motion';
import { CONFIG } from '../config/siteConfig';
import { useLang } from '../lib/useLang';

export default function PaymentProcessing() {
  const navigate = useNavigate();
  const location = useLocation();
  const { L } = useLang();
  const [status, setStatus] = useState('verifying');
  const [orderId, setOrderId] = useState(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const id = params.get('order_id');
    if (id) { setOrderId(id); startPolling(id); } else { setStatus('error'); }
    return () => clearInterval(intervalRef.current);
  }, [location.search]);

  const startPolling = (id) => {
    setStatus('verifying');
    checkStatus(id);
    const started = Date.now();
    intervalRef.current = setInterval(() => {
      // Stop after ~3 minutes: the payment may still settle, but don't spin forever.
      if (Date.now() - started > 3 * 60 * 1000) { clearInterval(intervalRef.current); setStatus('timeout'); return; }
      checkStatus(id);
    }, 5000);
  };

  const checkStatus = async (id) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { clearInterval(intervalRef.current); setStatus('error'); return; }
      const response = await fetch('/api/payments/verify-status', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: id })
      });
      const data = await response.json();
      if (data.status === 'failed') { clearInterval(intervalRef.current); setStatus('error'); return; }
      if (data.status === 'success') {
        clearInterval(intervalRef.current);
        setStatus('success');
        setTimeout(() => window.location.assign('/purchase-success'), 2000); // full load: Pro status refreshes everywhere
      }
    } catch (err) { console.error('Polling error:', err); }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md w-full bg-white border border-gray-200 rounded-2xl shadow-sm p-10 text-center">
        {status === 'verifying' && (
          <>
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">{L('Verifying Payment...', 'Payment verify ho raha hai...')}</h1>
            <p className="text-gray-500 text-sm mb-8">{L('We are securely confirming your transaction with the bank. This usually takes a few seconds.', 'Bank se tumhara transaction securely confirm kar rahe hain. Bas kuch second lagte hain.')}</p>
            <button onClick={() => checkStatus(orderId)} className="text-sm text-gray-600 hover:text-gray-900 font-medium border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors">{L('Check Status Manually', 'Status khud check karo')}</button>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">{L('Payment Successful!', 'Payment ho gaya!')}</h1>
            <p className="text-gray-500 text-sm mb-8">{L('Payment confirmed — your purchase is unlocked. Opening your receipt…', 'Payment confirm — purchase unlock ho gaya. Receipt khul rahi hai…')}</p>
          </>
        )}
        {status === 'timeout' && (
          <>
            <h1 className="text-xl font-bold text-gray-900 mb-2">{L('Still confirming your payment', 'Payment abhi confirm ho raha hai')}</h1>
            <p className="text-gray-500 text-sm mb-2">{L("The bank hasn't confirmed it yet. If money was deducted, tap Check again in a few minutes — access is granted the moment it's confirmed.", 'Bank ne abhi confirm nahi kiya. Paise kat gaye hain to kuch minute baad Check again dabao — confirm hote hi access mil jayega.')}</p>
            <p className="text-xs text-gray-400 mb-6">{L('Order ID: ', 'Order ID: ')}<span className="font-mono select-all">{orderId}</span>{L(` · Need help? Message @${CONFIG.insta} with this ID.`, ` · Help chahiye? Ye ID @${CONFIG.insta} ko message karo.`)}</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => startPolling(orderId)} className="bg-gray-900 text-white px-6 py-2.5 rounded-lg text-sm font-medium">{L('Check again', 'Fir se check karo')}</button>
              <button onClick={() => navigate('/dashboard')} className="border border-gray-200 text-gray-700 px-6 py-2.5 rounded-lg text-sm font-medium">Dashboard</button>
            </div>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">{L('Verification Issue', 'Verification mein problem')}</h1>
            <p className="text-gray-500 text-sm mb-8">{L("We couldn't confirm this payment. If money was deducted, sign in and open this page again, or message us with your order ID.", 'Ye payment confirm nahi ho paya. Paise kat gaye hain to sign in karke ye page fir kholo, ya order ID ke saath humein message karo.')}</p>
            <button onClick={() => navigate('/dashboard')} className="bg-gray-900 text-white px-6 py-2.5 rounded-lg text-sm font-medium">{L('Back to Dashboard', 'Dashboard pe wapas')}</button>
          </>
        )}
      </motion.div>
    </div>
  );
}
