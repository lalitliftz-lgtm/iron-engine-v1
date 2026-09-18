import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';

export default function Programs() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [program, setProgram] = useState(null);
  const [activeWeek, setActiveWeek] = useState(1);
  const [activeDay, setActiveDay] = useState(1);

  useEffect(() => {
    const fetchProgram = async () => {
      const { data } = await supabase
        .from('generated_programs')
        .select(`id, created_at, is_active, program_snapshot, engine_versions ( version_string ), athlete_profiles ( primary_goal )`)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) setProgram(data);
      setLoading(false);
    };
    fetchProgram();
  }, [user]);

  const handlePrint = () => { window.print(); };

  if (loading) return <div className="flex justify-center items-center min-h-[60vh]"><div className="animate-spin h-8 w-8 border-2 border-gray-900 rounded-full border-t-transparent"></div></div>;

  if (!program) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white border border-gray-200 rounded-2xl shadow-sm p-12">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">No Active Program</h1>
          <p className="text-gray-500 mb-8 max-w-md mx-auto">You haven't generated a training block yet. Complete your assessment and let the Iron Engine calibrate your workflow.</p>
          <Link to="/dashboard/assessment" className="inline-flex items-center justify-center bg-gray-900 hover:bg-gray-800 text-white px-8 py-3.5 rounded-lg text-sm font-medium transition-colors">Start Assessment</Link>
        </motion.div>
      </div>
    );
  }

  const { blockType, weeks } = program.program_snapshot;
  const currentWeekData = weeks.find(w => w.week === activeWeek) || weeks[0];
  const currentDayData = currentWeekData.days.find(d => d.day === activeDay) || currentWeekData.days[0];

  return (
    <>
      <style>{`@media print { body * { visibility: hidden; } #print-area, #print-area * { visibility: visible; } #print-area { position: absolute; left: 0; top: 0; width: 100%; } .no-print { display: none !important; } }`}</style>
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 md:py-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 no-print">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 tracking-tight">{blockType}</h1>
              <span className="px-2.5 py-1 text-xs font-semibold bg-green-50 text-green-700 rounded-full">{program.is_active ? 'Active' : 'Completed'}</span>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500"><span>Generated {new Date(program.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span></div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              Export PDF
            </button>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mb-8">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Program Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            <div><p className="text-xs text-gray-400 mb-1">Block</p><p className="text-sm font-semibold text-gray-900">{blockType}</p></div>
            <div><p className="text-xs text-gray-400 mb-1">Total Weeks</p><p className="text-sm font-semibold text-gray-900">{weeks.length} Weeks</p></div>
            <div><p className="text-xs text-gray-400 mb-1">Days / Week</p><p className="text-sm font-semibold text-gray-900">{currentWeekData.days.length} Days</p></div>
            <div><p className="text-xs text-gray-400 mb-1">Primary Goal</p><p className="text-sm font-semibold text-gray-900">{program.athlete_profiles?.primary_goal || 'Strength'}</p></div>
            <div><p className="text-xs text-gray-400 mb-1">Engine Version</p><p className="text-sm font-semibold text-gray-900">{program.engine_versions?.version_string || 'v1.0'}</p></div>
          </div>
        </div>

        <div id="print-area">
          <div className="hidden print:block mb-8">
            <h1 className="text-2xl font-bold">{blockType} - LalitLifts Iron Engine</h1>
            <p className="text-gray-600">Week {activeWeek} | Generated {new Date(program.created_at).toLocaleDateString()}</p>
          </div>

          <div className="flex space-x-2 mb-6 overflow-x-auto pb-2 no-print">
            {weeks.map((w) => (
              <button key={w.week} onClick={() => { setActiveWeek(w.week); setActiveDay(1); }} className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeWeek === w.week ? 'bg-gray-900 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>Week {w.week}</button>
            ))}
          </div>

          <div className="flex space-x-2 mb-8 overflow-x-auto pb-2 no-print">
            {currentWeekData.days.map((d) => (
              <button key={d.day} onClick={() => setActiveDay(d.day)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeDay === d.day ? 'bg-gray-100 text-gray-900 ring-1 ring-gray-200' : 'text-gray-500 hover:bg-gray-50'}`}>Day {d.day} <span className="text-gray-400 ml-1 text-xs">{d.focus}</span></button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={`${activeWeek}-${activeDay}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-4">
              {currentDayData.exercises.map((ex, idx) => {
                const isMain = ex.type === 'Main';
                return (
                  <div key={idx} className={`bg-white rounded-xl border ${isMain ? 'border-gray-300 shadow-md' : 'border-gray-200 shadow-sm'} p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:shadow-md`}>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`text-xs font-semibold uppercase tracking-wider ${isMain ? 'text-gray-900' : 'text-gray-400'}`}>{ex.type}</span>
                        {isMain && <span className="w-1 h-1 bg-gray-300 rounded-full"></span>}
                        <span className="text-xs text-gray-500 capitalize">{ex.focus || ''}</span>
                      </div>
                      <h3 className={`text-lg ${isMain ? 'font-bold text-gray-900' : 'font-semibold text-gray-800'}`}>{ex.name}</h3>
                      <div className="grid grid-cols-3 gap-2 mt-3 md:hidden">
                        <StatBox label="Sets" value={`${ex.sets} x ${ex.reps}`} />
                        <StatBox label="Weight" value={`${ex.weight}${typeof ex.weight === 'string' && ex.weight.includes('RPE') ? '' : 'kg'}`} />
                        <StatBox label="RPE" value={ex.rpe || '—'} />
                      </div>
                    </div>
                    <div className="hidden md:flex items-center gap-8 no-print">
                      <div className="text-center"><p className="text-xs text-gray-400 uppercase tracking-wider">Sets</p><p className="text-sm font-medium text-gray-900 mt-1">{ex.sets} x {ex.reps}</p></div>
                      <div className="text-center"><p className="text-xs text-gray-400 uppercase tracking-wider">Weight</p><p className="text-sm font-medium text-gray-900 mt-1">{ex.weight}{typeof ex.weight === 'string' && ex.weight.includes('RPE') ? '' : 'kg'}</p></div>
                      <div className="text-center"><p className="text-xs text-gray-400 uppercase tracking-wider">Target RPE</p><p className="text-sm font-medium text-gray-900 mt-1">@ {ex.rpe || '—'}</p></div>
                    </div>
                    <div className="flex md:justify-end no-print">
                      <Link to={`/dashboard/technique-lab?search=${encodeURIComponent(ex.name)}`} className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-md transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        Technique Lab
                      </Link>
                    </div>
                  </div>
                );
              })}
              
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mt-6">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  <h3 className="text-sm font-semibold text-gray-700">Coach Notes</h3>
                </div>
                <div className="text-sm text-gray-600 space-y-2">
                  <p>{currentDayData.notes || "Warm up thoroughly with dynamic stretches and 2-3 ramp-up sets before hitting your working weight on main lifts."}</p>
                  <p>Rest 2-3 minutes between heavy main lifts, and 1-1.5 minutes for accessories. Focus on bar speed and perfect technique. If an exercise causes sharp pain, stop immediately and swap to a pain-free variation.</p>
                </div>
              </div>

              <div className="hidden print:block mt-8 text-sm text-gray-600 border-t pt-4"><p>Log your workouts at lalitlifts.vercel.app</p></div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}

const StatBox = ({ label, value }) => (
  <div className="bg-gray-50 rounded-lg p-2 text-center">
    <p className="text-[10px] text-gray-400 uppercase tracking-wider">{label}</p>
    <p className="text-xs font-medium text-gray-900 mt-0.5">{value}</p>
  </div>
);
