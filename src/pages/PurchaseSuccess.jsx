import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { motion } from 'framer-motion';

export default function PurchaseSuccess() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [purchaseData, setPurchaseData] = useState(null);

  useEffect(() => {
    const fetchLatestPurchase = async () => {
      const { data: txn, error: txnError } = await supabase
        .from('payment_transactions')
        .select(`provider_payment_id, payment_timestamp, product_id, products ( id, name, type )`)
        .eq('user_id', user.id)
        .eq('status', 'captured')
        .order('payment_timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (txnError || !txn) { setLoading(false); return; }

      let expiryDate = null;
      if (txn.products?.type === 'subscription') {
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('end_date')
          .eq('user_id', user.id)
          .eq('product_id', txn.product_id)
          .eq('status', 'active')
          .order('end_date', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (sub) expiryDate = sub.end_date;
      }

      setPurchaseData({
        productName: txn.products?.name,
        productType: txn.products?.type,
        transactionId: txn.provider_payment_id,
        expiryDate: expiryDate
      });
      setLoading(false);
    };

    if (user) fetchLatestPurchase();
  }, [user]);

  if (loading) return <div className="min-h-screen bg-gray-50 flex justify-center items-center"><div className="animate-spin h-8 w-8 border-2 border-gray-900 rounded-full border-t-transparent"></div></div>;

  if (!purchaseData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">No Recent Purchases Found</h1>
          <button onClick={() => navigate('/dashboard')} className="mt-4 text-gray-600 hover:text-gray-900 underline">Go to Dashboard</button>
        </div>
      </div>
    );
  }

  const isSubscription = purchaseData.productType === 'subscription';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-lg w-full bg-white border border-gray-200 rounded-2xl shadow-sm p-8 md:p-12 text-center">
        <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }} className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-8">
          <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
        </motion.div>
        <h1 className="text-3xl font-bold text-gray-900 mb-3 tracking-tight">Payment Successful!</h1>
        <p className="text-gray-500 mb-8 max-w-sm mx-auto">Thank you for your purchase. Your transaction has been verified and access is now unlocked.</p>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-8 text-left">
          <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200">
            <span className="text-sm text-gray-500">Product</span>
            <span className="text-sm font-semibold text-gray-900">{purchaseData.productName}</span>
          </div>
          {isSubscription && purchaseData.expiryDate && (
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200">
              <span className="text-sm text-gray-500">Access Valid Until</span>
              <span className="text-sm font-semibold text-gray-900">{new Date(purchaseData.expiryDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Transaction ID</span>
            <span className="text-xs font-mono text-gray-700 bg-gray-200 px-2 py-1 rounded">{purchaseData.transactionId}</span>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <button onClick={() => navigate(isSubscription ? '/dashboard/programs' : '/dashboard/products')} className="w-full bg-gray-900 hover:bg-gray-800 text-white py-3.5 rounded-lg text-sm font-semibold transition-colors">{isSubscription ? 'Start Using Iron Engine →' : 'Download Your Guide →'}</button>
          <button onClick={() => navigate('/dashboard')} className="w-full text-gray-600 hover:text-gray-900 py-2.5 rounded-lg text-sm font-medium transition-colors">Go to Dashboard</button>
        </div>
      </motion.div>
    </div>
  );
}
