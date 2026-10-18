import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { CONFIG } from '../../config/siteConfig';
import { INVITE_KEY } from '../Invite';

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
  const [extendOpen, setExtendOpen] = useState(false);
  const [error, setError] = useState(null);
  const [invite, setInvite] = useState(() => { try { return params.get('invite') || localStorage.getItem(INVITE_KEY) || ''; } catch { return params.get('invite') || ''; } });
  const [inviteMsg, setInviteMsg] = useState(null); // { ok, text }
  const [inviteBusy, setInviteBusy] = useState(false);

  // Invite-only free month for testers: the server checks the code and grants 30 days of Pro.
  const redeemInvite = async () => {
    setInviteBusy(true); setInviteMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/redeem-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ code: invite }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setInviteMsg({ ok: false, text: body.error || 'Could not redeem the code.' }); return; }
      try { localStorage.removeItem(INVITE_KEY); } catch { /* ignore */ }
      setInviteMsg({ ok: true, text: `Done — Pro is free until ${new Date(body.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}. Reloading…` });
      setTimeout(() => window.location.reload(), 1500); // refresh the Pro status everywhere
    } catch {
      setInviteMsg({ ok: false, text: 'No connection — check your internet and try again.' });
    } finally {
      setInviteBusy(false);
    }
  };

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
        // Early renewals stack: the plan runs from the period covering today to the latest end date.
        const now = new Date();
        const live = data.filter((s) => s.status === 'active' && new Date(s.end_date) > now);
        const current = live.find((s) => new Date(s.start_date) <= now) || live[live.length - 1];
        setActiveSub(current ? { ...current, end_date: live.reduce((m, s) => (s.end_date > m ? s.end_date : m), current.end_date) } : null);
        // Amount actually paid for each period (prices change; the plan's current price is not what they paid).
        const ids = data.map((s) => s.razorpay_payment_id).filter(Boolean);
        const { data: txns } = ids.length ? await supabase.from('payment_transactions').select('provider_payment_id, amount_paid').in('provider_payment_id', ids) : { data: [] };
        const paid = Object.fromEntries((txns || []).map((t) => [t.provider_payment_id, t.amount_paid]));
        setHistory(data.map((s) => ({ ...s, amountPaid: paid[s.razorpay_payment_id] ?? null })));
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
        body: JSON.stringify({ productId: product.id, extend: extendOpen }),
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

  // Active Pro: the plans stay closed; "Extend Pro" opens them on purpose (no accidental second payment).
  const renewLocked = !!activeSub && daysRemaining(activeSub.end_date) > 7 && !extendOpen;

  if (loading) return <div className="animate-pulse text-knurl">Loading subscription…</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 md:py-10">
      <h2 className="text-3xl text-chalk mb-8" style={{ fontFamily: "'Archivo Black', sans-serif" }}>My Subscription</h2>

      {/* A PDF guide coming from the storefront gets its own buy card; Pro is bought from the plan picker below. */}
      {intendedProduct && intendedIsGuide && (
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
              {activeSub ? 'Active' : 'Free plan'}
            </span>
          </div>
          {activeSub ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div><p className="text-knurl text-xs mb-1">Current period started</p><p className="font-medium text-chalk">{new Date(activeSub.start_date).toLocaleDateString()}</p></div>
              <div><p className="text-knurl text-xs mb-1">Pro until</p><p className="font-medium text-chalk">{new Date(activeSub.end_date).toLocaleDateString()}</p></div>
              <div><p className="text-knurl text-xs mb-1">Days Remaining</p><p className="font-medium text-2xl" style={{ color: '#C9A24B' }}>{daysRemaining(activeSub.end_date)}</p></div>
            </div>
          ) : (
            <p className="text-knurl mb-8">You're on the free plan — your first block is yours to keep. Pro builds every next block from your logs.</p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
            <p className="text-chalk font-semibold">{renewLocked ? 'Your Pro is active' : extendOpen ? 'Extend your Pro' : activeSub ? 'Renew your Pro' : 'Choose your plan'}</p>
            {renewLocked && (
              <button type="button" onClick={() => setExtendOpen(true)} className="text-sm font-semibold px-4 py-2 rounded-lg" style={{ background: '#C9A24B', color: '#14161B' }}>Extend Pro</button>
            )}
            {extendOpen && <button type="button" onClick={() => setExtendOpen(false)} className="text-sm font-semibold text-knurl hover:text-chalk">Cancel</button>}
          </div>
          <p className="text-knurl text-sm mb-4">{renewLocked
            ? 'Nothing to pay now. Want more time? Tap Extend Pro — the extra time starts when your current Pro ends.'
            : `One-time payment · no auto-debit${activeSub ? ` · starts after your current Pro ends (${new Date(activeSub.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}), so no days are lost` : ''}`}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {CONFIG.proPlans.map((p) => {
              const perMonth = Math.round(p.price / p.months);
              const save = Math.round((1 - p.price / (CONFIG.proPlans[0].price * p.months)) * 100);
              return (
                <button key={p.productName} type="button" onClick={() => startCheckout(p.productName)} disabled={busy || renewLocked}
                  className={`relative text-left rounded-xl border p-4 transition disabled:opacity-50 disabled:cursor-not-allowed ${p.best ? 'border-[#C9A24B] bg-steel2' : 'border-line hover:border-knurl'}`}>
                  {p.best && <span className="absolute -top-2.5 left-3 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: '#C9A24B', color: '#14161B' }}>Best value</span>}
                  <span className="block text-knurl text-xs uppercase tracking-wider">{p.label}</span>
                  <span className="block text-2xl font-bold text-chalk mt-1">₹{p.price.toLocaleString('en-IN')}</span>
                  <span className="block text-xs text-knurl mt-0.5">₹{perMonth.toLocaleString('en-IN')} / month{save > 0 ? ` · save ${save}%` : ''}</span>
                </button>
              );
            })}
          </div>
          {busy && <p className="text-knurl text-sm mt-3">Opening secure payment…</p>}
        </div>
      </div>

      <div className={`rounded-xl border p-5 mb-10 ${invite ? 'border-[#C9A24B] bg-steel2' : 'border-line bg-steel'}`}>
        <h3 className="text-chalk font-semibold">Have an invite code?</h3>
        <p className="text-knurl text-sm mt-0.5">Invite only — one free month of Iron Engine Pro.</p>
        <div className="flex gap-2 mt-3">
          <input value={invite} onChange={(e) => setInvite(e.target.value.toUpperCase())} placeholder="INVITE CODE" aria-label="Invite code"
            className="flex-1 min-w-0 h-11 px-3 rounded-lg bg-iron border border-line text-chalk font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-[#C9A24B]" />
          <button type="button" onClick={redeemInvite} disabled={!invite.trim() || inviteBusy}
            className="h-11 px-4 rounded-lg font-semibold disabled:opacity-50" style={{ background: '#C9A24B', color: '#14161B' }}>
            {inviteBusy ? 'Checking…' : 'Claim free month'}
          </button>
        </div>
        {inviteMsg && <p className={`text-sm mt-2 ${inviteMsg.ok ? 'text-green-500' : 'text-red-500'}`}>{inviteMsg.text}</p>}
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
                  <td className="p-4 text-knurl text-sm">{String(sub.razorpay_payment_id || '').startsWith('invite:') ? 'Free (invite)' : sub.amountPaid != null ? `₹${Number(sub.amountPaid).toLocaleString('en-IN')}` : '—'}</td>
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
