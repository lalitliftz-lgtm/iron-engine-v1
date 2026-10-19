import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSubscription } from '../context/SubscriptionContext';
import { marketingAssets } from '../config/marketingConfig';

export default function UpgradeModal({ isOpen, onClose }) {
  const { status, programCount } = useSubscription();
  const isExpired = status === 'pro_expired';
  const isFreeLimitReached = status === 'free' && programCount >= 1;
  
  const navigate = useNavigate();
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  useEffect(() => { if (isOpen) setIsVideoPlaying(false); }, [isOpen]);
  const goToCheckout = () => { onClose?.(); navigate('/dashboard/subscription'); };

  const headerTitle = isExpired ? 'Renew Your Pro Access' : isFreeLimitReached ? 'Your free week is done — unlock the full block' : 'Upgrade to Iron Engine Pro';
  const headerSubtitle = isExpired ? 'Renew your subscription to continue generating programs and logging your workouts.' : isFreeLimitReached ? 'Pro builds your next block from your logs: updated maxes, weak-point work and weekly check-ins that set next week\'s kg.' : 'You\'ve seen the basics. Unlock the full power of automated, science-based programming.';
  const hasVideo = marketingAssets.demoVideoUrl && marketingAssets.demoVideoThumbnail;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4 overflow-y-auto" onClick={onClose}>
          <motion.div initial={{ y: "100%", opacity: 0.5 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0.5 }} transition={{ type: "spring", stiffness: 300, damping: 30 }} className="bg-white rounded-t-3xl md:rounded-2xl shadow-2xl max-w-3xl w-full relative my-0 md:my-8" onClick={(e) => e.stopPropagation()}>
            <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-900 z-10 bg-white/80 rounded-full p-1.5 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            <div className="overflow-y-auto max-h-[95vh] md:max-h-[90vh] rounded-t-3xl md:rounded-2xl">
              
              {hasVideo && (
                <div className="relative h-48 md:h-64 bg-gray-900 overflow-hidden flex items-center justify-center rounded-t-3xl md:rounded-t-2xl">
                  {!isVideoPlaying ? (
                    <button onClick={() => setIsVideoPlaying(true)} className="absolute inset-0 flex items-center justify-center group" style={{ backgroundImage: `url('${marketingAssets.demoVideoThumbnail}')`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
                      <div className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition-colors"></div>
                      <div className="relative z-10 w-16 h-16 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 group-hover:scale-110 transition-transform">
                        <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" /></svg>
                      </div>
                      <div className="absolute bottom-4 left-4 z-10">
                        <span className="px-3 py-1 text-xs font-semibold bg-white/10 backdrop-blur-md text-white rounded-full border border-white/20 uppercase tracking-wider">Watch 30-sec Demo</span>
                      </div>
                    </button>
                  ) : (
                    <video autoPlay loop muted controls playsInline className="absolute inset-0 w-full h-full object-cover">
                      <source src={marketingAssets.demoVideoUrl} type="video/mp4" />
                    </video>
                  )}
                </div>
              )}

              <div className={`px-6 md:px-10 text-center ${hasVideo ? 'pt-8' : 'pt-12'}`}>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2 tracking-tight">{headerTitle}</h2>
                <p className="text-gray-500 mb-8 text-sm md:text-base max-w-md mx-auto">{headerSubtitle}</p>
              </div>

              <div className="px-6 md:px-10 mb-10">
                <div className="grid grid-cols-3 gap-2 text-center text-sm mb-2">
                  <div className="text-left text-gray-500 font-medium pl-2">Features</div>
                  <div className="text-gray-500 font-medium">Free</div>
                  <div className="text-gray-900 font-bold">Pro</div>
                </div>
                
                <div className="space-y-3">
                  <ComparisonRow feature="Program Generation" free="Week 1 only" pro="Unlimited blocks" />
                  <ComparisonRow feature="Weak-point variations + accessories" free={<CrossIcon />} pro={<CheckIcon />} />
                  <ComparisonRow feature="Block focus (squat / bench / deadlift)" free={<CrossIcon />} pro={<CheckIcon />} />
                  <ComparisonRow feature="Meet-aware peaking + taper" free={<CrossIcon />} pro={<CheckIcon />} />
                  <ComparisonRow feature="Injury-safe load caps + swaps" free={<CheckIcon />} pro={<CheckIcon />} />
                  <ComparisonRow feature="Workout logger + history" free="Week 1" pro={<CheckIcon />} />
                  <ComparisonRow feature="Weekly check-in sets next week's kg" free={<CrossIcon />} pro={<CheckIcon />} />
                </div>
              </div>

              <div className="px-6 md:px-10 py-10 text-center">
                <div className="inline-flex items-center gap-2 mb-4">
                  <span className="px-2.5 py-1 text-[10px] font-bold bg-amber-100 text-amber-800 rounded-full uppercase tracking-wider">One-time payment · no auto-debit</span>
                </div>
                
                <div className="flex items-baseline justify-center gap-2 mb-1">
                  <span className="text-gray-500 font-medium">from</span>
                  <span className="text-4xl md:text-5xl font-bold text-gray-900">₹833</span>
                  <span className="text-gray-500 font-medium">/ month</span>
                </div>
                <p className="text-xs text-gray-400 mb-8">1 month ₹1,499 · 3 months ₹3,499 · 6 months ₹5,999 · 1 year ₹9,999. No auto-debit. All Iron Engine updates included.</p>

                <button onClick={goToCheckout} className="w-full md:w-auto bg-gray-900 hover:bg-gray-800 text-white px-12 py-4 rounded-xl text-sm font-semibold transition-colors shadow-lg hover:shadow-xl">
                  {isExpired ? 'Renew Pro — see plans' : 'Upgrade to Pro — see plans'}
                </button>
                <p className="text-xs text-gray-400 mt-4">Secure payment. Instant access after successful payment verification.</p>
              </div>

            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const ComparisonRow = ({ feature, free, pro }) => (
  <div className="grid grid-cols-3 gap-2 items-center text-center text-sm py-2 border-b border-gray-100 last:border-0">
    <div className="text-left text-gray-600 pl-2">{feature}</div>
    <div className="text-gray-400 flex justify-center items-center">{free}</div>
    <div className="text-gray-900 font-medium flex justify-center items-center">{pro}</div>
  </div>
);

const CheckIcon = () => (
  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
);

const CrossIcon = () => (
  <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
);
