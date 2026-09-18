import { PayUProvider } from './PayUProvider.js';

let providerInstance = null;

export function getPaymentProvider() {
  if (providerInstance) return providerInstance;
  const provider = (process.env.PAYMENT_PROVIDER || 'payu').toLowerCase();
  switch (provider) {
    case 'payu':
      providerInstance = new PayUProvider();
      break;
    default:
      throw new Error(`Unsupported payment provider: ${provider}`);
  }
  return providerInstance;
}
