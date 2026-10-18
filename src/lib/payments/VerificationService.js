/**
 * Record a captured payment and grant what was bought. Safe to call any number of times for the same
 * payment (callback + polling + retries): the transaction row is unique on the payment id, and the grant
 * step checks for an existing grant before inserting — so a grant that failed once is repaired on the
 * next call instead of being skipped as "already processed".
 */
export async function processSuccessfulPayment(supabaseAdmin, paymentData) {
  const { provider: providerName, orderId, paymentId, amount, currency, timestamp, notes, rawPayload } = paymentData;
  const { user_id, product_id, product_type } = notes || {};

  if (!user_id || !product_id) {
    console.error('Missing user_id or product_id in payment notes');
    return { success: false, error: 'Invalid payment metadata' };
  }

  const { error: txnError } = await supabaseAdmin.from('payment_transactions').insert({
    user_id, product_id, provider: providerName, provider_order_id: orderId, provider_payment_id: paymentId,
    status: paymentData.status, currency: currency, amount_paid: amount, raw_payload: rawPayload, payment_timestamp: timestamp
  });
  const alreadyProcessed = txnError?.code === '23505';
  if (txnError && !alreadyProcessed) throw txnError;

  // The amount PayU captured must cover today's price of this product (a checkout saved before a price
  // rise, or for a product since switched off, must not unlock it). Mismatch → no grant, flagged for the owner.
  const { data: product, error: prodErr } = await supabaseAdmin.from('products').select('price_cents, is_active').eq('id', product_id).maybeSingle();
  if (prodErr) throw prodErr;
  const paidCents = Math.round(Number(amount) * 100);
  // (PayU always reports the amount; 0 / missing means the status API left it out — don't punish the buyer for that.)
  if (!product || (paidCents > 0 && paidCents < Number(product.price_cents))) {
    await audit(supabaseAdmin, user_id, 'PAYMENT_AMOUNT_MISMATCH', { paymentId, amount, expected: product ? product.price_cents / 100 : null, product_id });
    return { success: false, error: 'This payment does not match the current price. Message us with your order ID — we will sort it out or refund it.' };
  }

  await grantAccess(supabaseAdmin, { user_id, product_id, product_type, paymentId, amount, providerName, alreadyProcessed });
  return { success: true, alreadyProcessed, accessGranted: true };
}

// Best-effort audit row — it must never block or break a payment.
async function audit(supabaseAdmin, user_id, action, metadata) {
  const { error } = await supabaseAdmin.from('security_audit_logs').insert({ user_id, action, metadata });
  if (error) console.error('Audit log failed:', error.message);
}

// Iron Engine Pro plans (1, 3, 6, 12 months) are one-time passes: each payment adds products.duration_days.
// No auto-renew (PayU one-time checkout). Fallback when the column is missing/empty: 30 days.
const DEFAULT_SUBSCRIPTION_DAYS = 30;

async function grantAccess(supabaseAdmin, { user_id, product_id, product_type, paymentId, amount, providerName, alreadyProcessed }) {
  if (product_type === 'subscription') {
    const { data: existing, error: readErr } = await supabaseAdmin.from('subscriptions').select('id').eq('razorpay_payment_id', paymentId).maybeSingle();
    if (readErr) throw readErr;
    if (existing) return;
    // Renewing early stacks on the current period instead of losing the days left.
    const { data: current, error: curErr } = await supabaseAdmin.from('subscriptions').select('end_date').eq('user_id', user_id).eq('status', 'active').gte('end_date', new Date().toISOString()).order('end_date', { ascending: false }).limit(1).maybeSingle();
    if (curErr) throw curErr;
    const { data: plan, error: planErr } = await supabaseAdmin.from('products').select('duration_days').eq('id', product_id).maybeSingle();
    if (planErr && planErr.code !== '42703') throw planErr; // 42703 = column not added yet → default
    const days = Number(plan?.duration_days) > 0 ? Number(plan.duration_days) : DEFAULT_SUBSCRIPTION_DAYS;
    const startDate = current ? new Date(current.end_date) : new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + days);
    // subscriptions.razorpay_payment_id is unique (migration v5): parallel callbacks for one payment can't
    // grant twice — the loser gets 23505 and stops here.
    const { error } = await supabaseAdmin.from('subscriptions').insert({
      user_id, product_id, status: 'active',
      start_date: startDate.toISOString(), end_date: endDate.toISOString(),
      razorpay_payment_id: paymentId,
    });
    if (error?.code === '23505') return;
    if (error) throw error;
    await audit(supabaseAdmin, user_id, 'SUBSCRIPTION_ACTIVATED', { paymentId, amount, provider: providerName, source: alreadyProcessed ? 'grant_repair' : 'payment' });
  } else if (product_type === 'pdf_guide') {
    const { data: owned, error: readErr } = await supabaseAdmin.from('purchases').select('id, razorpay_payment_id').eq('user_id', user_id).eq('product_id', product_id).limit(1).maybeSingle();
    if (readErr) throw readErr;
    if (owned) {
      // Paid twice for the same guide (two tabs / double tap): nothing more to grant — flag it so it gets refunded.
      if (owned.razorpay_payment_id && owned.razorpay_payment_id !== paymentId && !alreadyProcessed) {
        await audit(supabaseAdmin, user_id, 'DUPLICATE_PURCHASE_REFUND', { paymentId, firstPaymentId: owned.razorpay_payment_id, product_id, amount });
      }
      return;
    }
    const { error } = await supabaseAdmin.from('purchases').insert({ user_id, product_id, razorpay_payment_id: paymentId });
    if (error && error.code !== '23505') throw error;
  } else {
    throw new Error(`Unknown product type "${product_type}" for payment ${paymentId}`);
  }
}
