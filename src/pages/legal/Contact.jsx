import LegalLayout from '../../components/LegalLayout';
import { CONFIG } from '../../config/siteConfig';

export default function Contact() {
  return (
    <LegalLayout title="Contact Us" lastUpdated="2026-10-19">
      <p>We are here to help. If you have any questions regarding your subscription, the Iron Engine, or need technical support, please reach out to us.</p>
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mt-6 space-y-4 not-prose">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-1">WhatsApp</h3>
          <a href={`https://wa.me/${CONFIG.whatsapp}`} target="_blank" rel="noreferrer" className="text-gray-600 underline">+{CONFIG.whatsapp.replace(/^91/, '91 ')}</a>
          <p className="text-xs text-gray-400 mt-1">Fastest for payment or access questions.</p>
        </div>
        <div className="pt-4 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-1">Email Support</h3>
          <a href={`mailto:${CONFIG.supportEmail}`} className="text-gray-600 underline">{CONFIG.supportEmail}</a>
          <p className="text-xs text-gray-400 mt-1">We respond within 24-48 hours.</p>
        </div>
        <div className="pt-4 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-1">Instagram</h3>
          <p className="text-gray-600">@lalit_lifts_</p>
          <p className="text-xs text-gray-400 mt-1">For quick updates and powerlifting tips.</p>
        </div>
      </div>
      <p className="mt-8 text-sm text-gray-500">Before reaching out regarding a payment issue, please ensure you have your Transaction ID ready, which can be found on your Purchase Success page or in your dashboard.</p>
    </LegalLayout>
  );
}
