import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { CONFIG } from '../../config/siteConfig';

// Old storefront links may still carry a product's previous name.
const RENAMED = { 'All About Powerlifting System': 'All About Powerlifting System 1.0' };

// Redirect the browser to PayU by auto-submitting a hidden form.
function redirectToPayU(gatewayUrl, params) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = gatewayUrl;
  Object.entries(params).forEach(([name, value]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value ?? '';
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
}

export default function Subscription() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const intendedProduct = RENAMED[params.get('product')] || params.get('product'); // product NAME passed from landing
  const intendedIsGuide = CONFIG.products.find((p) => p.productName === intendedProduct)?.type === 'pdf_guide';

  const [activeSub, setActiveSub] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Show a friendly message if PayU redirected back after a failed/cancelled payment.
  useEffect(() => {
    const p = params.get('payment');
    if (!p) return;
    const messages = {
      failed: 'Payment was not completed. No charge was made — please try again.',
      invalid: "We couldn't verify that payment. If money was deducted it will be auto-confirmed shortly.",
      error: 'Something went wrong while confirming the payment. Please try again.',
    };
    if (messages[p]) setError(messages[p]);
  }, [params]);

  useEffect(() => {
    const fetchSubscriptions = async () => {
      const { data } = await supabase
        .from('subscriptions')
        .select('id, status, start_date, end_date, razorpay_payment_id, products(name)')
        .eq('user_id', user.id)
        .order('start_date', { ascending: false });
      if (data) {
        const active = data.find((s) => s.status === 'active' && new Date(s.end_date) > new Date());
        setActiveSub(active);
        setHistory(data);
      }
      setLoading(false);
    };
    fetchSubscriptions();
  }, [user]);

  const daysRemaining = (endDate) => {
    if (!endDate) return 0;
    return Math.max(0, Math.ceil((new Date(endDate) - new Date()) / (1000 * 60 * 60 * 24)));
  };

  const startCheckout = async (productName = 'Iron Engine Pro') => {
    setError(null); setBusy(true);
    try {
      // 1. resolve product id by name
      const { data: product, error: pErr } = await supabase
        .from('products')
        .select('id, name, type')
        .eq('name', productName)
        .eq('is_active', true)
        .maybeSingle();
      if (pErr || !product) throw new Error('Product not found. Check the catalogue.');

      // 2. auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Please log in again.');

      // 3. create the PayU transaction (server builds the signed params)
      const res = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ productId: product.id }),
      });
      const order = await res.json();
      if (!res.ok) throw new Error(order.error || 'Could not start payment.');
      if (!order.gatewayUrl || !order.params) throw new Error('Payment could not be initialised. Please try again.');

      // 4. redirect to PayU's secure payment page
      redirectToPayU(order.gatewayUrl, order.params);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="animate-pulse text-knurl">Loading subscription…</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-3xl text-chalk mb-8" style={{ fontFamily: "'Archivo Black', sans-serif" }}>My Subscription</h2>

      {/* A PDF guide can be bought with or without Pro; only the subscription itself is hidden when Pro is active. */}
      {intendedProduct && (intendedIsGuide || !activeSub) && (
        <div className="mb-6 rounded-xl border border-red-600 bg-steel p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-chalk font-semibold">Finish unlocking {intendedProduct}</p>
            <p className="text-knurl text-sm">{intendedIsGuide ? 'One step left — after payment the PDF is waiting in My guides.' : 'One step left — complete checkout to activate full access.'}</p>
          </div>
          <button onClick={() => startCheckout(intendedProduct)} disabled={busy}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 px-6 rounded-lg disabled:opacity-50 whitespace-nowrap">
            {busy ? 'Opening…' : 'Complete purchase →'}
          </button>
        </div>
      )}

      {error && <div className="mb-6 bg-red-100 text-red-700 p-3 rounded text-sm">{error}</div>}

      <div className="bg-gradient-to-br from-steel2 to-steel text-white rounded-xl border border-line shadow-lg p-8 mb-10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-32 -mt-32" />
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-knurl text-xs uppercase tracking-wider mb-1">Current Plan</p>
              <h3 className="text-2xl font-bold text-chalk">{activeSub ? activeSub.products?.name || 'Iron Engine Pro' : 'Free Tier'}</h3>
            </div>
            <span className={`px-3 py-1 text-xs font-semibold rounded-full ${activeSub ? 'bg-green-500 text-white' : 'bg-steel2 text-knurl'}`}>
              {activeSub ? 'Active' : 'Inactive'}
            </span>
          </div>
          {activeSub ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div><p className="text-knurl text-xs mb-1">Purchase Date</p><p className="font-medium text-chalk">{new Date(activeSub.start_date).toLocaleDateString()}</p></div>
              <div><p className="text-knurl text-xs mb-1">Expiry Date</p><p className="font-medium text-chalk">{new Date(activeSub.end_date).toLocaleDateString()}</p></div>
              <div><p className="text-knurl text-xs mb-1">Days Remaining</p><p className="font-medium text-2xl" style={{ color: '#C9A24B' }}>{daysRemaining(activeSub.end_date)}</p></div>
            </div>
          ) : (
            <p className="text-knurl mb-8">You don't have an active subscription. Upgrade to unlock the full Iron Engine.</p>
          )}
          <button onClick={() => startCheckout('Iron Engine Pro')} disabled={busy}
            className="font-bold py-2.5 px-6 rounded-lg transition duration-200 disabled:opacity-50"
            style={{ background: '#C9A24B', color: '#14161B' }}>
            {busy ? 'Opening…' : activeSub ? 'Renew Subscription' : 'Upgrade to Pro'}
          </button>
        </div>
      </div>

      <div className="bg-steel rounded-xl border border-line overflow-hidden">
        <div className="p-6 border-b border-line"><h3 className="text-lg font-semibold text-chalk">Billing History</h3></div>
        {history.length === 0 ? (
          <div className="p-8 text-center text-dim">No billing history yet.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-iron border-b border-line">
              <tr>
                {['Date', 'Plan', 'Amount', 'Status'].map((h) => (
                  <th key={h} className="p-4 font-medium text-knurl text-sm">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((sub) => (
                <tr key={sub.id} className="border-b border-line last:border-0 hover:bg-steel2">
                  <td className="p-4 text-knurl text-sm">{new Date(sub.start_date).toLocaleDateString()}</td>
                  <td className="p-4 text-knurl text-sm">{sub.products?.name || 'Subscription'}</td>
                  <td className="p-4 text-knurl text-sm">₹1,999</td>
                  <td className="p-4"><span className={`px-2 py-1 text-xs rounded-full ${sub.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-steel2 text-knurl'}`}>{sub.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
