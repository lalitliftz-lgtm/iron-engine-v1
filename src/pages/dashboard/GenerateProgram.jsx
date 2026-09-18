import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useSubscription } from '../../context/SubscriptionContext';
import UpgradeModal from '../../components/UpgradeModal';
import { motion, AnimatePresence } from 'framer-motion';

const STAGES = [
  { id: 0, name: "Loading Athlete Profile", description: "Fetching 1RMs, weak points, and constraints" },
  { id: 1, name: "Diagnosing Weak Points", description: "Analyzing mechanical failure points" },
  { id: 2, name: "Selecting Training Block", description: "Mapping timeline to adaptation phase" },
  { id: 3, name: "Assigning Main Lifts", description: "Calculating wave loading progression" },
  { id: 4, name: "Selecting Accessories", description: "Applying weak-point mapping matrix" },
  { id: 5, name: "Applying Progression Rules", description: "Setting RPE caps and volume budgets" },
  { id: 6, name: "Building Final Program", description: "Compiling 4-week training snapshot" }
];

export default function GenerateProgram() {
  const navigate = useNavigate();
  const { status } = useSubscription();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [appStatus, setAppStatus] = useState('idle');
  const [error, setError] = useState('');
  const [currentStage, setCurrentStage] = useState(0);
  const [engineData, setEngineData] = useState(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (appStatus === 'generating') {
      intervalRef.current = setInterval(() => {
        setCurrentStage((prev) => {
          if (prev === STAGES.length - 1 && !engineData) return prev;
          if (prev === STAGES.length - 1 && engineData) {
            clearInterval(intervalRef.current);
            setTimeout(() => navigate('/dashboard/programs'), 1000);
            return prev;
          }
          return prev + 1;
        });
      }, 550);
      return () => clearInterval(intervalRef.current);
    }
  }, [appStatus, engineData, navigate]);

  const handleGenerate = async () => {
    setAppStatus('generating');
    setError('');
    setCurrentStage(0);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/generate-program', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
      });

      if (response.status === 403) {
        const data = await response.json();
        if (data.error === 'UPGRADE_REQUIRED') {
          setShowUpgradeModal(true);
          setAppStatus('idle');
          clearInterval(intervalRef.current);
          return;
        }
      }

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Engine failed to generate program');
      }

      const data = await response.json();
      setEngineData(data.engineData);

    } catch (err) {
      setError(err.message);
      setAppStatus('error');
      clearInterval(intervalRef.current);
    }
  };

  const getStageDetail = (stageId) => {
    if (!engineData) return null;
    if (stageId === 2) {
      const blockDecision = engineData.log.find(l => l.step === 'Block Selection');
      return blockDecision ? `Assigned: ${blockDecision.decision}` : null;
    }
    if (stageId === 4) {
      const accessoryDecisions = engineData.log.filter(l => l.step === 'Accessory Mapping');
      if (accessoryDecisions.length === 0) return "Mapped: Balanced Routine";
      return `Mapped: ${accessoryDecisions[0].decision}`;
    }
    return null;
  };

  return (
    <>
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="w-full max-w-xl">
          {appStatus === 'idle' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
              <div className="w-20 h-20 bg-gray-900 border border-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-2xl">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">Iron Engine V1</h1>
              <p className="text-gray-500 mb-10 max-w-md mx-auto">The engine will securely analyze your assessment, apply scientific progression, and map your weak points to specific accessories.</p>
              <button onClick={handleGenerate} className="bg-white hover:bg-gray-100 text-gray-900 px-10 py-4 rounded-xl text-sm font-semibold transition-all w-full md:w-auto shadow-lg hover:shadow-xl hover:-translate-y-0.5">Initialize Engine</button>
            </motion.div>
          )}

          {appStatus === 'generating' && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 md:p-10 shadow-2xl">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">Engine Running</h2>
                <span className="text-xs text-gray-600 font-mono">{Math.round(((currentStage + 1) / STAGES.length) * 100)}%</span>
              </div>
              <div className="h-1 w-full bg-gray-800 rounded-full overflow-hidden mb-10">
                <motion.div className="h-full bg-white rounded-full" initial={{ width: 0 }} animate={{ width: `${((currentStage + 1) / STAGES.length) * 100}%` }} transition={{ duration: 0.4, ease: "easeInOut" }} />
              </div>
              <div className="space-y-6">
                {STAGES.map((stage) => {
                  const isComplete = currentStage > stage.id;
                  const isActive = currentStage === stage.id;
                  const detail = isComplete ? getStageDetail(stage.id) : null;
                  return (
                    <div key={stage.id} className="flex items-start space-x-4">
                      <div className="flex-shrink-0 mt-0.5">
                        {isComplete ? <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center"><svg className="w-3 h-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg></div> : isActive ? <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin"></div> : <div className="w-5 h-5 rounded-full border-2 border-gray-700"></div>}
                      </div>
                      <div className="flex-1">
                        <h3 className={`text-sm font-medium transition-colors ${isActive ? 'text-white' : isComplete ? 'text-gray-400' : 'text-gray-600'}`}>{stage.name}</h3>
                        <AnimatePresence>
                          {isActive && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-gray-500 mt-1 font-mono">{stage.description}...</motion.p>}
                          {isComplete && detail && <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-green-400 mt-1 font-mono">{detail}</motion.p>}
                        </AnimatePresence>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {appStatus === 'error' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-gray-900 border border-red-900 rounded-2xl p-10 text-center shadow-2xl">
              <div className="w-12 h-12 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Engine Error</h2>
              <p className="text-gray-500 mb-6 text-sm">{error}</p>
              <button onClick={() => setAppStatus('idle')} className="text-gray-400 hover:text-white font-medium text-sm border border-gray-700 px-6 py-2 rounded-lg">Reset Engine</button>
            </motion.div>
          )}
        </div>
      </div>
      <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
    </>
  );
}
