import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLang } from '../../lib/useLang';

export default function TechniqueLab() {
  const { L } = useLang();
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') || '';
  
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [filterPattern, setFilterPattern] = useState('all');

  useEffect(() => {
    const fetchExercises = async () => {
      const { data, error } = await supabase.from('exercises').select('id, name, movement_pattern, category, technique_lab (video_url)').eq('is_deleted', false).order('name', { ascending: true });
      if (data) setExercises(data);
      setLoading(false);
    };
    fetchExercises();
  }, []);

  const patterns = ['all', ...new Set(exercises.map(ex => ex.movement_pattern).filter(Boolean))];
  const filteredExercises = exercises.filter(ex => {
    const matchesSearch = ex.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterPattern === 'all' || ex.movement_pattern === filterPattern;
    return matchesSearch && matchesFilter;
  });

  if (loading) return <div className="flex justify-center min-h-[60vh] items-center"><div className="animate-spin h-8 w-8 border-2 border-gray-900 rounded-full border-t-transparent"></div></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-gray-900 tracking-tight">Technique Lab</h1>
        <p className="text-gray-500 mt-1">{L('Master the movement. Browse our premium exercise library.', 'Movement perfect karo. Hamari premium exercise library dekho.')}</p>
      </div>
      <div className="flex flex-col md:flex-row gap-3 mb-8 sticky top-0 bg-gray-50 py-4 z-10 -mx-4 px-4 md:mx-0 md:px-0">
        <input type="text" placeholder={L('Search exercises...', 'Exercise search karo...')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="flex-1 px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
        <select value={filterPattern} onChange={(e) => setFilterPattern(e.target.value)} className="px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 capitalize">
          {patterns.map(p => <option key={p} value={p} className="capitalize">{p === 'all' ? L('All Patterns', 'Saare patterns') : p}</option>)}
        </select>
      </div>
      {filteredExercises.length === 0 ? (
        <div className="text-center py-20 text-gray-500">{L('No exercises found.', 'Koi exercise nahi mili.')}</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {filteredExercises.map((ex, idx) => (
            <motion.div key={ex.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}>
              <Link to={`/dashboard/technique-lab/${ex.id}`} className="block bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all overflow-hidden group">
                <div className="aspect-square bg-gray-100 relative overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900 text-white p-4 text-center">
                    <span className="font-bold text-sm tracking-wide">{ex.name}</span>
                  </div>
                  {ex.technique_lab?.video_url && (
                    <div className="absolute bottom-2 right-2 w-8 h-8 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" /></svg>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="font-semibold text-gray-900 text-sm truncate group-hover:text-gray-700">{ex.name}</h3>
                  <p className="text-xs text-gray-400 capitalize mt-0.5">{ex.movement_pattern || 'N/A'}</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
