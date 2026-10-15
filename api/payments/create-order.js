import { createClient } from '@supabase/supabase-js';
import { getPaymentProvider } from '../../src/lib/payments/PaymentFactory.js';

const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const token = req.headers.authorization?.split(' ')[1];
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Unauthorized' });

    const { productId } = req.body;
    if (!productId) return res.status(400).json({ error: 'Product ID is required' });

    const { data: product, error: prodError } = await supabaseAdmin.from('products').select('id, name, price_cents, type').eq('id', productId).single();
    if (prodError || !product) return res.status(404).json({ error: 'Product not found' });

    if (product.type === 'subscription') {
      const { data: activeSub } = await supabaseAdmin.from('subscriptions').select('id').eq('user_id', user.id).eq('status', 'active').gte('end_date', new Date().toISOString()).order('end_date', { ascending: false }).limit(1).maybeSingle();
      if (activeSub) return res.status(400).json({ error: 'You already have an active subscription.' });
    } else if (product.type === 'pdf_guide') {
      const { data: existingPurchase } = await supabaseAdmin.from('purchases').select('id').eq('user_id', user.id).eq('product_id', productId).maybeSingle();
      if (existingPurchase) return res.status(400).json({ error: 'You already own this product.' });
    }

    const provider = getPaymentProvider();
    const amount = product.price_cents / 100;

    // Absolute return URL — PayU redirects the browser here after payment.
    const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
    const host = req.headers.host;
    const callbackUrl = `${proto}://${host}/api/payments/payu-callback`;

    // Prefill buyer name from athlete profile if present (optional, cosmetic).
    let firstname = user.email?.split('@')[0] || 'Athlete';
    const { data: profile } = await supabaseAdmin
      .from('athlete_profiles')
      .select('full_name')
      .eq('user_id', user.id)
      .maybeSingle();
    if (profile?.full_name) firstname = profile.full_name.split(' ')[0];

    const checkout = provider.buildCheckout({
      amount,
      productinfo: product.name,
      firstname,
      email: user.email,
      surl: callbackUrl,
      furl: callbackUrl,
      udf1: user.id,          // used server-side to grant access after verifying the hash
      udf2: product.id,
      udf3: product.type,
    });

    return res.status(200).json({
      provider: 'payu',
      txnid: checkout.txnid,
      gatewayUrl: checkout.gatewayUrl,
      params: checkout.params,
    });

  } catch (error) {
    console.error('Create Order Error:', error);
    return res.status(500).json({ error: 'Failed to initiate payment' });
  }
}
