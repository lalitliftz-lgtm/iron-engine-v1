import { Link } from 'react-router-dom';
import LegalLayout from '../../components/LegalLayout';
import { legalDates } from '../../config/legalConfig';

export default function Terms() {
  return (
    <LegalLayout title="Terms & Conditions" lastUpdated={legalDates.terms}>
      <p>By accessing or using LalitLifts, you agree to be bound by these Terms & Conditions. If you do not agree, please do not use our Service.</p>
      <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">1. Subscription & Access</h2>
      <p>LalitLifts offers an annual digital subscription ("Iron Engine Pro") valid for 365 days from the date of successful payment verification. Access is granted automatically only after the payment gateway confirms the transaction. The subscription does not auto-renew.</p>
      <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">2. Account Usage</h2>
      <p>One subscription is valid for one athlete profile. Account sharing, allowing multiple users to access a single account, or attempting to bypass payment gates is strictly prohibited and will result in account termination without refund.</p>
      <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">3. Digital Products</h2>
      <p>Upon purchasing a digital PDF guide, you are granted a non-exclusive, non-transferable license to download and use the guide for personal use. You may not distribute, resell, or reproduce the PDFs.</p>
      <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">4. No Medical Advice</h2>
      <p>The Iron Engine provides algorithmic powerlifting programming based on your inputs. This Service is educational and is not medical advice. You train at your own risk. Always consult a physician before starting any new exercise program. For full details, please review our <Link to="/disclaimer" className="text-blue-600 hover:underline font-medium">Medical & Training Disclaimer</Link>.</p>
    </LegalLayout>
  );
}
