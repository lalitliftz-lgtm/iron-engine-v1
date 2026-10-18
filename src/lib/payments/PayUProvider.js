import crypto from 'crypto';
import { PaymentProvider } from './PaymentProvider.js';

/**
 * PayU (India) provider — classic hosted-checkout (redirect) flow.
 *
 * Flow:
 *  1. Server builds form params + SHA-512 request hash  -> buildCheckout()
 *  2. Browser POSTs the form to PayU's gateway (redirect)
 *  3. PayU redirects back (POST) to surl/furl with a reverse hash -> verifyResponse()
 *  4. (optional) Server-to-server confirmation            -> fetchPaymentStatus()
 *
 * Env vars (server-side only — SALT must NEVER reach the browser):
 *   PAYU_KEY   = merchant key
 *   PAYU_SALT  = merchant salt (32-bit)   <-- secret
 *   PAYU_MODE  = 'test' | 'live'          (default: 'test')
 */
export class PayUProvider extends PaymentProvider {
  constructor() {
    super();
    this.key = process.env.PAYU_KEY;
    this.salt = process.env.PAYU_SALT;
    this.mode = (process.env.PAYU_MODE || 'test').toLowerCase();

    if (!this.key || !this.salt) {
      throw new Error('PayU is not configured. Set PAYU_KEY and PAYU_SALT.');
    }
  }

  get gatewayUrl() {
    return this.mode === 'live'
      ? 'https://secure.payu.in/_payment'
      : 'https://test.payu.in/_payment';
  }

  get verifyApiUrl() {
    return this.mode === 'live'
      ? 'https://info.payu.in/merchant/postservice.php?form=2'
      : 'https://test.payu.in/merchant/postservice.php?form=2';
  }

  generateTxnId() {
    return `IE${Date.now()}${crypto.randomBytes(4).toString('hex')}`;
  }

  _sha512(str) {
    return crypto.createHash('sha512').update(str).digest('hex');
  }

  /**
   * Build the request hash that PayU expects for /_payment.
   * sequence: key|txnid|amount|productinfo|firstname|email|udf1..udf5|||||salt
   */
  _requestHash({ txnid, amount, productinfo, firstname, email, udf1, udf2, udf3, udf4, udf5 }) {
    const seq = [
      this.key, txnid, amount, productinfo, firstname, email,
      udf1 || '', udf2 || '', udf3 || '', udf4 || '', udf5 || '',
      '', '', '', '', '', // udf6..udf10 (unused)
      this.salt,
    ].join('|');
    return this._sha512(seq);
  }

  /**
   * Build everything the browser needs to redirect to PayU.
   * Returns { txnid, gatewayUrl, params }.
   */
  buildCheckout({ amount, productinfo, firstname, email, phone, surl, furl, udf1, udf2, udf3 }) {
    const txnid = this.generateTxnId();
    const amt = Number(amount).toFixed(2);

    const base = {
      key: this.key,
      txnid,
      amount: amt,
      productinfo,
      firstname: firstname || 'Athlete',
      email,
      phone: phone || '9999999999',
      surl,
      furl,
      udf1: udf1 || '',
      udf2: udf2 || '',
      udf3: udf3 || '',
    };

    const hash = this._requestHash({
      txnid,
      amount: amt,
      productinfo,
      firstname: base.firstname,
      email,
      udf1: base.udf1,
      udf2: base.udf2,
      udf3: base.udf3,
    });

    return { txnid, gatewayUrl: this.gatewayUrl, params: { ...base, hash } };
  }

  /**
   * Verify the reverse hash PayU sends to surl/furl.
   * sequence: salt|status|||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key
   * Returns { valid, paymentData }.
   */
  verifyResponse(body) {
    const {
      status, txnid, amount, productinfo, firstname, email,
      udf1 = '', udf2 = '', udf3 = '', udf4 = '', udf5 = '',
      hash: receivedHash, mihpayid, additionalCharges,
    } = body;

    const seq = [
      // With a convenience fee PayU prefixes the reverse hash with additionalCharges.
      ...(additionalCharges ? [additionalCharges] : []),
      this.salt, status,
      '', '', '', '', '', // udf10..udf6 (unused)
      udf5, udf4, udf3, udf2, udf1,
      email, firstname, productinfo, amount, txnid, this.key,
    ].join('|');

    const expected = this._sha512(seq);
    const valid = typeof receivedHash === 'string'
      && receivedHash.length === expected.length
      && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(receivedHash.toLowerCase()));

    return {
      valid,
      paymentData: {
        provider: 'payu',
        orderId: txnid,
        paymentId: mihpayid || txnid,
        amount: Number(amount),
        currency: 'INR',
        // normalise PayU's 'success' to the 'captured' status the rest of the app expects
        status: status === 'success' ? 'captured' : status,
        timestamp: new Date().toISOString(),
        notes: { user_id: udf1, product_id: udf2, product_type: udf3 },
        rawPayload: body,
      },
    };
  }

  /**
   * Server-to-server confirmation via PayU's verify_payment API (used by polling).
   * hash: sha512(key|command|var1|salt)
   */
  async fetchPaymentStatus(txnid) {
    const command = 'verify_payment';
    const hash = this._sha512([this.key, command, txnid, this.salt].join('|'));

    const form = new URLSearchParams({ key: this.key, command, var1: txnid, hash });
    const resp = await fetch(this.verifyApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });

    const data = await resp.json().catch(() => ({}));
    const details = data?.transaction_details?.[txnid];

    if (details && details.status && details.status.toLowerCase() === 'success') {
      return {
        provider: 'payu',
        orderId: txnid,
        paymentId: details.mihpayid,
        amount: Number(details.amt || details.transaction_amount || details.amount || 0),
        currency: 'INR',
        status: 'captured',
        timestamp: new Date().toISOString(),
        notes: { user_id: details.udf1, product_id: details.udf2, product_type: details.udf3 },
        rawPayload: details,
      };
    }

    return { status: 'pending' };
  }
}
