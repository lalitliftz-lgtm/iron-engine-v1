import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { CONFIG } from '../../config/siteConfig';
import { INVITE_KEY } from '../Invite';
import { useLang } from '../../lib/useLang';

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
  const { L } = useLang();
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
      if (!res.ok) { setInviteMsg({ ok: false, text: body.error || L('Could not redeem the code.', 'Code redeem nahi ho paaya.') }); return; }
      try { localStorage.removeItem(INVITE_KEY); } catch { /* ignore */ }
      setInviteMsg({ ok: true, text: L(`Done — Pro is free until ${new Date(body.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}. Reloading…`, `Ho gaya — Pro ${new Date(body.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} tak free hai. Reload ho raha hai…`) });
      setTimeout(() => window.location.reload(), 1500); // refresh the Pro status everywhere
    } catch {
      setInviteMsg({ ok: false, text: L('No connection — check your internet and try again.', 'Connection nahi hai — internet check karo aur phir try karo.') });
    } finally {
      setInviteBusy(false);
    }
  };

  // Show a friendly message if PayU redirected back after a failed/cancelled payment.
  useEffect(() => {
    const p = params.get('payment');
    if (!p) return;
    const messages = {
      failed: L('Payment was not completed. No charge was made — please try again.', 'Payment complete nahi hua. Koi paisa nahi kata — please phir try karo.'),
      invalid: L("We couldn't verify that payment. If money was deducted it will be auto-confirmed shortly.", 'Hum yeh payment verify nahi kar paaye. Agar paisa kat gaya hai to thodi der mein apne aap confirm ho jayega.'),
      error: L('Something went wrong while confirming the payment. Please try again.', 'Payment confirm karte waqt kuch gadbad ho gayi. Please phir try karo.'),
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
      if (pErr || !product) throw new Error(L('Product not found. Check the catalogue.', 'Product nahi mila. Catalogue check karo.'));

      // 2. auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error(L('Please log in again.', 'Please dobara log in karo.'));

      // 3. create the PayU transaction (server builds the signed params)
      const res = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ productId: product.id, extend: extendOpen }),
      });
      const order = await res.json();
      if (!res.ok) throw new Error(order.error || L('Could not start payment.', 'Payment shuru nahi ho paaya.'));
      if (!order.gatewayUrl || !order.params) throw new Error(L('Payment could not be initialised. Please try again.', 'Payment start nahi ho paaya. Please phir try karo.'));

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

  if (loading) return <div className="animate-pulse text-knurl">{L('Loading subscription…', 'Subscription load ho raha hai…')}</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 md:py-10">
      <h2 className="text-3xl text-chalk mb-8" style={{ fontFamily: "'Archivo Black', sans-serif" }}>{L('My Subscription', 'Mera Subscription')}</h2>

      {/* A PDF guide coming from the storefront gets its own buy card; Pro is bought from the plan picker below. */}
      {intendedProduct && intendedIsGuide && (
        <div className="mb-6 rounded-xl border border-red-600 bg-steel p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-chalk font-semibold">{L(`Finish unlocking ${intendedProduct}`, `${intendedProduct} unlock karna poora karo`)}</p>
            <p className="text-knurl text-sm">{intendedIsGuide ? L('One step left — after payment the PDF is waiting in My guides.', 'Bas ek step baaki — payment ke baad PDF My guides mein mil jayega.') : L('One step left — complete checkout to activate full access.', 'Bas ek step baaki — full access ke liye checkout poora karo.')}</p>
          </div>
          <button onClick={() => startCheckout(intendedProduct)} disabled={busy}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 px-6 rounded-lg disabled:opacity-50 whitespace-nowrap">
            {busy ? L('Opening…', 'Khul raha hai…') : L('Complete purchase →', 'Purchase poora karo →')}
          </button>
        </div>
      )}

      {error && <div className="mb-6 bg-red-100 text-red-700 p-3 rounded text-sm">{error}</div>}

      <div className="bg-gradient-to-br from-steel2 to-steel text-white rounded-xl border border-line shadow-lg p-8 mb-10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-32 -mt-32" />
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-knurl text-xs uppercase tracking-wider mb-1">{L('Current Plan', 'Abhi ka Plan')}</p>
              <h3 className="text-2xl font-bold text-chalk">{activeSub ? activeSub.products?.name || 'Iron Engine Pro' : L('Free Tier', 'Free Tier')}</h3>
            </div>
            <span className={`px-3 py-1 text-xs font-semibold rounded-full ${activeSub ? 'bg-green-500 text-white' : 'bg-steel2 text-knurl'}`}>
              {activeSub ? L('Active', 'Active hai') : L('Free plan', 'Free plan')}
            </span>
          </div>
          {activeSub ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div><p className="text-knurl text-xs mb-1">{L('Current period started', 'Abhi ka period shuru hua')}</p><p className="font-medium text-chalk">{new Date(activeSub.start_date).toLocaleDateString()}</p></div>
              <div><p className="text-knurl text-xs mb-1">{L('Pro until', 'Pro kab tak')}</p><p className="font-medium text-chalk">{new Date(activeSub.end_date).toLocaleDateString()}</p></div>
              <div><p className="text-knurl text-xs mb-1">{L('Days Remaining', 'Kitne din baaki')}</p><p className="font-medium text-2xl" style={{ color: '#C9A24B' }}>{daysRemaining(activeSub.end_date)}</p></div>
            </div>
          ) : (
            <p className="text-knurl mb-8">{L("You're on the free plan — Week 1 of your block. Pro unlocks the full block and builds every next block from your logs.", 'Aap free plan par ho — block ka sirf Week 1. Pro poora block unlock karta hai aur aapke logs se har agla block banata hai.')}</p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
            <p className="text-chalk font-semibold">{renewLocked ? L('Your Pro is active', 'Aapka Pro active hai') : extendOpen ? L('Extend your Pro', 'Apna Pro extend karo') : activeSub ? L('Renew your Pro', 'Apna Pro renew karo') : L('Choose your plan', 'Apna plan chuno')}</p>
            {renewLocked && (
              <button type="button" onClick={() => setExtendOpen(true)} className="text-sm font-semibold px-4 py-2 rounded-lg" style={{ background: '#C9A24B', color: '#14161B' }}>{L('Extend Pro', 'Pro extend karo')}</button>
            )}
            {extendOpen && <button type="button" onClick={() => setExtendOpen(false)} className="text-sm font-semibold text-knurl hover:text-chalk">{L('Cancel', 'Cancel karo')}</button>}
          </div>
          <p className="text-knurl text-sm mb-4">{renewLocked
            ? L('Nothing to pay now. Want more time? Tap Extend Pro — the extra time starts when your current Pro ends.', 'Abhi kuch pay nahi karna. Aur time chahiye? Extend Pro dabao — extra time aapka current Pro khatam hone ke baad shuru hoga.')
            : L(`One-time payment · no auto-debit${activeSub ? ` · starts after your current Pro ends (${new Date(activeSub.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}), so no days are lost` : ''}`,
              `Ek baar ka payment · koi auto-debit nahi${activeSub ? ` · aapka current Pro khatam hone ke baad (${new Date(activeSub.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}) shuru hoga, to ek bhi din waste nahi hoga` : ''}`)}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {CONFIG.proPlans.map((p) => {
              const perMonth = Math.round(p.price / p.months);
              const save = Math.round((1 - p.price / (CONFIG.proPlans[0].price * p.months)) * 100);
              return (
                <button key={p.productName} type="button" onClick={() => startCheckout(p.productName)} disabled={busy || renewLocked}
                  className={`relative text-left rounded-xl border p-4 transition disabled:opacity-50 disabled:cursor-not-allowed ${p.popular || p.best ? 'border-[#C9A24B] bg-steel2' : 'border-line hover:border-knurl'}`}>
                  {(p.popular || p.best) && <span className="absolute -top-2.5 left-3 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: '#C9A24B', color: '#14161B' }}>{p.popular ? L('Most popular', 'Sabse popular') : L('Best value', 'Sabse best value')}</span>}
                  <span className="block text-knurl text-xs uppercase tracking-wider">{p.label}</span>
                  <span className="block text-2xl font-bold text-chalk mt-1">₹{p.price.toLocaleString('en-IN')}</span>
                  <span className="block text-xs text-knurl mt-0.5">₹{perMonth.toLocaleString('en-IN')} {L(' / month', ' / mahina')}{save > 0 ? L(` · save ${save}%`, ` · ${save}% bachao`) : ''}</span>
                </button>
              );
            })}
          </div>
          {busy && <p className="text-knurl text-sm mt-3">{L('Opening secure payment…', 'Secure payment khul raha hai…')}</p>}
        </div>
      </div>

      <div className={`rounded-xl border p-5 mb-10 ${invite ? 'border-[#C9A24B] bg-steel2' : 'border-line bg-steel'}`}>
        <h3 className="text-chalk font-semibold">{L('Have an invite code?', 'Invite code hai?')}</h3>
        <p className="text-knurl text-sm mt-0.5">{L('Invite only — one free month of Iron Engine Pro.', 'Sirf invite se — Iron Engine Pro ka ek mahina free.')}</p>
        <div className="flex gap-2 mt-3">
          <input value={invite} onChange={(e) => setInvite(e.target.value.toUpperCase())} placeholder="INVITE CODE" aria-label={L('Invite code', 'Invite code')}
            className="flex-1 min-w-0 h-11 px-3 rounded-lg bg-iron border border-line text-chalk font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-[#C9A24B]" />
          <button type="button" onClick={redeemInvite} disabled={!invite.trim() || inviteBusy}
            className="h-11 px-4 rounded-lg font-semibold disabled:opacity-50" style={{ background: '#C9A24B', color: '#14161B' }}>
            {inviteBusy ? L('Checking…', 'Check ho raha hai…') : L('Claim free month', 'Free mahina claim karo')}
          </button>
        </div>
        {inviteMsg && <p className={`text-sm mt-2 ${inviteMsg.ok ? 'text-green-500' : 'text-red-500'}`}>{inviteMsg.text}</p>}
      </div>

      <div className="bg-steel rounded-xl border border-line overflow-hidden">
        <div className="p-6 border-b border-line"><h3 className="text-lg font-semibold text-chalk">{L('Billing History', 'Billing History')}</h3></div>
        {history.length === 0 ? (
          <div className="p-8 text-center text-dim">{L('No billing history yet.', 'Abhi tak koi billing history nahi.')}</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-iron border-b border-line">
              <tr>
                {[['Date', 'Date'], ['Plan', 'Plan'], ['Amount', 'Amount'], ['Status', 'Status']].map(([h, hi]) => (
                  <th key={h} className="p-4 font-medium text-knurl text-sm">{L(h, hi)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((sub) => (
                <tr key={sub.id} className="border-b border-line last:border-0 hover:bg-steel2">
                  <td className="p-4 text-knurl text-sm">{new Date(sub.start_date).toLocaleDateString()}</td>
                  <td className="p-4 text-knurl text-sm">{sub.products?.name || L('Subscription', 'Subscription')}</td>
                  <td className="p-4 text-knurl text-sm">{String(sub.razorpay_payment_id || '').startsWith('invite:') ? L('Free (invite)', 'Free (invite se)') : sub.amountPaid != null ? `₹${Number(sub.amountPaid).toLocaleString('en-IN')}` : '—'}</td>
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
