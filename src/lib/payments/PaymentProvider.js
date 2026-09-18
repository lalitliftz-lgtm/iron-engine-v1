export class PaymentProvider {
  async createOrder(amount, currency, notes) { throw new Error('Method not implemented'); }
  verifyWebhookSignature(payload, signature) { throw new Error('Method not implemented'); }
  parseWebhookPayload(payload) { throw new Error('Method not implemented'); }
  async fetchPaymentStatus(orderId) { throw new Error('Method not implemented'); }
}
