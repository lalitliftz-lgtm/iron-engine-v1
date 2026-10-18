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

  await grantAccess(supabaseAdmin, { user_id, product_id, product_type, paymentId, amount, providerName, alreadyProcessed });
  return { success: true, alreadyProcessed, accessGranted: true };
}

async function grantAccess(supabaseAdmin, { user_id, product_id, product_type, paymentId, amount, providerName, alreadyProcessed }) {
  if (product_type === 'subscription') {
    const { data: existing, error: readErr } = await supabaseAdmin.from('subscriptions').select('id').eq('razorpay_payment_id', paymentId).maybeSingle();
    if (readErr) throw readErr;
    if (existing) return;
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 365);
    const { error } = await supabaseAdmin.from('subscriptions').insert({
      user_id, product_id, status: 'active',
      start_date: startDate.toISOString(), end_date: endDate.toISOString(),
      razorpay_payment_id: paymentId,
    });
    if (error && error.code !== '23505') throw error;
    // Audit is best-effort — it must never block the grant.
    const { error: auditErr } = await supabaseAdmin.from('security_audit_logs').insert({
      user_id, action: 'SUBSCRIPTION_ACTIVATED',
      metadata: { paymentId, amount, provider: providerName, source: alreadyProcessed ? 'grant_repair' : 'payment' },
    });
    if (auditErr) console.error('Audit log failed:', auditErr.message);
  } else if (product_type === 'pdf_guide') {
    const { data: owned, error: readErr } = await supabaseAdmin.from('purchases').select('id').eq('user_id', user_id).eq('product_id', product_id).limit(1).maybeSingle();
    if (readErr) throw readErr;
    if (owned) return;
    const { error } = await supabaseAdmin.from('purchases').insert({ user_id, product_id, razorpay_payment_id: paymentId });
    if (error && error.code !== '23505') throw error;
  } else {
    throw new Error(`Unknown product type "${product_type}" for payment ${paymentId}`);
  }
}
