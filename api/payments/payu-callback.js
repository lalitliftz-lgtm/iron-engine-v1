import { createClient } from '@supabase/supabase-js';
import { getPaymentProvider } from '../../src/lib/payments/PaymentFactory.js';
import { processSuccessfulPayment } from '../../src/lib/payments/VerificationService.js';

const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

/**
 * PayU redirects the browser here (POST) after payment — both for success (surl)
 * and failure (furl). We verify the reverse hash, grant access on success, then
 * 302-redirect the user back into the app.
 *
 * The user is identified from udf1 (their id), which is protected by the hash —
 * so no login token is required on this callback.
 */
export default async function handler(req, res) {
  const base = `${(req.headers['x-forwarded-proto'] || 'https').split(',')[0]}://${req.headers.host}`;

  if (req.method !== 'POST') {
    res.writeHead(302, { Location: `${base}/dashboard/subscription` });
    return res.end();
  }

  try {
    const provider = getPaymentProvider();
    const { valid, paymentData } = provider.verifyResponse(req.body);

    if (!valid) {
      res.writeHead(302, { Location: `${base}/dashboard/subscription?payment=invalid` });
      return res.end();
    }

    if (paymentData.status !== 'captured') {
      res.writeHead(302, { Location: `${base}/dashboard/subscription?payment=failed` });
      return res.end();
    }

    await processSuccessfulPayment(supabaseAdmin, paymentData);

    // Hand off to the polling page, which double-confirms via the verify API.
    res.writeHead(302, { Location: `${base}/payment/processing?order_id=${paymentData.orderId}` });
    return res.end();

  } catch (error) {
    console.error('PayU Callback Error:', error);
    res.writeHead(302, { Location: `${base}/dashboard/subscription?payment=error` });
    return res.end();
  }
}
