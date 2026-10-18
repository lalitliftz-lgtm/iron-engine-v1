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

    const provider = getPaymentProvider();
    const paymentData = await provider.fetchPaymentStatus(orderId);

    // Only the buyer can poll their own order.
    if (paymentData.notes?.user_id && paymentData.notes.user_id !== user.id) return res.status(403).json({ status: 'error', error: 'Not your order' });

    if (paymentData.status === 'captured') {
      // Idempotent: records the payment once and (re)grants access if an earlier attempt failed half-way.
      const result = await processSuccessfulPayment(supabaseAdmin, paymentData);
      if (result.success) return res.status(200).json({ status: 'success', message: 'Payment verified and access granted' });
    }

    return res.status(200).json({ status: 'pending', message: 'Payment not captured yet' });

  } catch (error) {
    console.error('Verify Status Error:', error);
    return res.status(500).json({ status: 'error', error: 'Failed to verify payment status' });
  }
}
