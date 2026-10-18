import LegalLayout from '../../components/LegalLayout';
import { legalDates } from '../../config/legalConfig';

export default function RefundPolicy() {
  return (
    <LegalLayout title="Refund & Cancellation Policy" lastUpdated={legalDates.refundPolicy}>
      <p>Due to the digital nature of the Iron Engine and downloadable PDF guides, all sales are final.</p>
      <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">1. No Refunds</h2>
      <p>Once a payment is verified and access to the Iron Engine Pro subscription or a PDF guide is unlocked, we cannot revoke access or issue a refund. Please ensure you review the free sample program before upgrading.</p>
      <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">2. Cancellation</h2>
      <p>Iron Engine Pro is sold as a 1-, 3-, 6- or 12-month pass that does not auto-renew. Therefore, there is no need to cancel. Access expires automatically at the end of the period you paid for. Buying again while active adds the new period after your current one ends.</p>
      <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">3. Failed / Pending Payments</h2>
      <p>If your payment fails but money is deducted from your bank account, it will typically be auto-verified or refunded by the payment gateway within 5-7 business days. Access is only granted upon successful payment verification.</p>
      <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">4. Exceptional Circumstances</h2>
      <p>Refunds will only be considered in cases of proven technical failure where you were charged but did not receive access for an extended period, or accidental duplicate purchases.</p>
    </LegalLayout>
  );
}
