export async function processSuccessfulPayment(supabaseAdmin, paymentData) {
  const { provider: providerName, orderId, paymentId, amount, currency, timestamp, notes, rawPayload } = paymentData;
  const { user_id, product_id, product_type } = notes;

  if (!user_id || !product_id) {
    console.error('Missing user_id or product_id in payment notes');
    return { success: false, error: 'Invalid payment metadata' };
  }

  const { error: txnError } = await supabaseAdmin.from('payment_transactions').insert({
    user_id, product_id, provider: providerName, provider_order_id: orderId, provider_payment_id: paymentId,
    status: paymentData.status, currency: currency, amount_paid: amount, raw_payload: rawPayload, payment_timestamp: timestamp
  });

  if (txnError && txnError.code === '23505') {
    const { data: existingSub } = await supabaseAdmin.from('subscriptions').select('id').eq('razorpay_payment_id', paymentId).maybeSingle();
    return { success: true, alreadyProcessed: true, accessGranted: !!existingSub };
  } else if (txnError) {
    throw txnError;
  }

  if (product_type === 'subscription') {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 365);

    await supabaseAdmin.from('subscriptions').insert({
      user_id, product_id, status: 'active',
      start_date: startDate.toISOString(), end_date: endDate.toISOString(),
      razorpay_payment_id: paymentId
    });

    await supabaseAdmin.from('security_audit_logs').insert({
      user_id, action: 'SUBSCRIPTION_ACTIVATED',
      metadata: { paymentId, amount, provider: providerName, source: 'recovery_api' }
    });

  } else if (product_type === 'pdf_guide') {
    await supabaseAdmin.from('purchases').insert({ user_id, product_id, razorpay_payment_id: paymentId });
  }

  return { success: true, accessGranted: true };
}
