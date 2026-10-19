import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLang } from '../../lib/useLang';

export default function ExerciseDetail() {
  const { id } = useParams();
  const { L } = useLang();
  const [exercise, setExercise] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetail = async () => {
      setLoading(true);
      const { data, error } = await supabase.from('exercises').select(`*, technique_lab (*)`).eq('id', id).maybeSingle();
      if (data) {
        setExercise(data);
        if (data.movement_pattern) {
          const { data: relData } = await supabase.from('exercises').select('id, name').eq('movement_pattern', data.movement_pattern).neq('id', id).limit(4);
          setRelated(relData || []);
        }
      }
      setLoading(false);
    };
    fetchDetail();
    window.scrollTo(0, 0);
  }, [id]);

  if (loading) return <div className="flex justify-center min-h-[60vh] items-center"><div className="animate-spin h-8 w-8 border-2 border-gray-900 rounded-full border-t-transparent"></div></div>;
  if (!exercise) return <div className="text-center py-20 text-gray-500">{L('Exercise not found.', 'Exercise nahi mili.')}</div>;

  const tech = exercise.technique_lab;

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-8 md:py-12">
      <Link to="/dashboard/technique-lab" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 mb-6 font-medium">
        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        {L('Back to Library', 'Library pe wapas')}
      </Link>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{exercise.category}</span>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight mt-1">{exercise.name}</h1>
          </div>
          <div className="flex gap-2">
            {exercise.movement_pattern && <span className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold capitalize">{exercise.movement_pattern}</span>}
            {exercise.equipment_required && exercise.equipment_required.length > 0 && <span className="px-3 py-1.5 bg-gray-900 text-white rounded-full text-xs font-semibold">{exercise.equipment_required[0]}</span>}
          </div>
        </div>
        {tech?.video_url ? (
          <a href={tech.video_url} target="_blank" rel="noopener noreferrer" className="block relative aspect-video bg-gray-900 rounded-2xl overflow-hidden mb-8 group shadow-md">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 group-hover:scale-110 transition-transform">
                <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" /></svg>
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
              <p className="text-white text-sm font-medium flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" /></svg>
                {L('Watch Video Demonstration', 'Video demo dekho')}
              </p>
            </div>
          </a>
        ) : <div className="aspect-video bg-gray-100 rounded-2xl mb-8 flex items-center justify-center text-gray-400 text-sm">{L('No video available', 'Video available nahi hai')}</div>}

        <div className="space-y-8">
          {tech?.setup_instructions && (
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2"><span className="w-1 h-5 bg-gray-900 rounded-full"></span> {L('Setup Instructions', 'Setup kaise karein')}</h2>
              <p className="text-gray-600 leading-relaxed text-sm">{tech.setup_instructions}</p>
            </div>
          )}
          {tech?.coaching_cues && tech.coaching_cues.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><span className="w-1 h-5 bg-blue-500 rounded-full"></span> {L('Coaching Cues', 'Coaching cues')}</h2>
              <ul className="space-y-3">
                {tech.coaching_cues.map((cue, i) => (
                  <li key={i} className="flex items-start text-sm text-gray-700">
                    <span className="flex-shrink-0 w-5 h-5 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-[10px] font-bold mr-3 mt-0.5">{i+1}</span>
                    {cue}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {tech?.common_mistakes && tech.common_mistakes.length > 0 && (
            <div className="bg-red-50/50 border border-red-100 rounded-xl p-6">
              <h2 className="text-lg font-bold text-red-900 mb-4 flex items-center gap-2"><span className="w-1 h-5 bg-red-500 rounded-full"></span> {L('Common Mistakes to Avoid', 'Yeh galtiyan mat karna')}</h2>
              <ul className="space-y-2">
                {tech.common_mistakes.map((mistake, i) => (
                  <li key={i} className="flex items-start text-sm text-red-800">
                    <svg className="w-4 h-4 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    {mistake}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {related.length > 0 && (
          <div className="mt-12 pt-8 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">{L('Related Exercises', 'Milti-julti exercises')}</h3>
            <div className="flex flex-wrap gap-2">
              {related.map(rel => (
                <Link key={rel.id} to={`/dashboard/technique-lab/${rel.id}`} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full text-sm font-medium transition-colors">{rel.name}</Link>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
