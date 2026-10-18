import LegalLayout from '../../components/LegalLayout';
import { legalDates } from '../../config/legalConfig';

export default function PrivacyPolicy() {
  return (
    <LegalLayout title="Privacy Policy" lastUpdated={legalDates.privacyPolicy}>
      <p>Your privacy is critical to us. This Privacy Policy explains how LalitLifts ("we", "us", or "our") collects, uses, and protects your information when you use our website and services (the "Service").</p>
      <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">1. Information We Collect</h2>
      <p>We collect information necessary to provide you with personalized powerlifting programs and process payments. This includes:</p>
      <ul className="list-disc pl-6 space-y-2">
        <li><strong>Account Data:</strong> Email address and encrypted password.</li>
        <li><strong>Athlete Profile Data:</strong> Age, sex, height, bodyweight, 1RMs, weak points, injuries, and available equipment. This is required to generate your customized Iron Engine program.</li>
        <li><strong>Workout Data:</strong> Weights lifted, reps completed, and session notes you voluntarily log.</li>
        <li><strong>Payment Data:</strong> We use PayU to process payments. We do not store your credit card number or sensitive financial data on our servers; we only store transaction IDs and payment status.</li>
      </ul>
      <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">2. How We Use Your Data</h2>
      <p>Your data is used exclusively to operate the Iron Engine, display your training history, secure your account, and process your Iron Engine Pro access. We do not sell your personal data to third parties.</p>
      <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">3. Data Security</h2>
      <p>All data is stored securely using Supabase (PostgreSQL) with Row-Level Security. Access to your personal workout data is strictly restricted to your authenticated account and authorized administrators for support purposes.</p>
      <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">4. Your Rights</h2>
      <p>You have the right to access, modify, or request deletion of your athlete profile and workout data at any time from within the dashboard settings or by contacting us.</p>
    </LegalLayout>
  );
}
