import { createClient } from '@supabase/supabase-js';
import { getPaymentProvider } from '../../src/lib/payments/PaymentFactory.js';
import { processSuccessfulPayment } from '../../src/lib/payments/VerificationService.js';

const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const token = req.headers.authorization?.split(' ')[1];
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Unauthorized' });

    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ error: 'Order ID is required' });

    const { data: activeSub } = await supabaseAdmin.from('subscriptions').select('id, end_date').eq('user_id', user.id).eq('status', 'active').gte('end_date', new Date().toISOString()).order('end_date', { ascending: false }).limit(1).maybeSingle();
    if (activeSub) return res.status(200).json({ status: 'success', message: 'Access already active' });

    const provider = getPaymentProvider();
    const paymentData = await provider.fetchPaymentStatus(orderId);

    if (paymentData.status === 'captured') {
      const result = await processSuccessfulPayment(supabaseAdmin, paymentData);
      if (result.success) return res.status(200).json({ status: 'success', message: 'Payment verified and access granted' });
    }

    return res.status(200).json({ status: 'pending', message: 'Payment not captured yet' });

  } catch (error) {
    console.error('Verify Status Error:', error);
    return res.status(500).json({ status: 'error', error: 'Failed to verify payment status' });
  }
}
