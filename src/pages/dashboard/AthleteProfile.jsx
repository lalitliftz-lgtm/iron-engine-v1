import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';
import { useLang } from '../../lib/useLang';

export default function AthleteProfile() {
  const { user } = useAuth();
  const { L } = useLang();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data } = await supabase.from('athlete_profiles').select('*').eq('user_id', user.id).maybeSingle();
      setProfile(data);
      setLoading(false);
    };
    fetchProfile();
  }, [user]);

  if (loading) return <div>{L('Loading...', 'Load ho raha hai...')}</div>;

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-800 mb-6">{L('Athlete Profile', 'Athlete Profile')}</h2>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        {profile ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div><span className="font-medium text-gray-500">{L('Name:', 'Naam:')}</span> {profile.full_name}</div>
            <div><span className="font-medium text-gray-500">{L('Experience:', 'Experience:')}</span> {profile.experience_level}</div>
            <div><span className="font-medium text-gray-500">{L('Bodyweight:', 'Body weight:')}</span> {profile.bodyweight_kg} kg</div>
            <div><span className="font-medium text-gray-500">{L('Goal:', 'Goal:')}</span> {profile.primary_goal}</div>
            <div><span className="font-medium text-gray-500">Squat 1RM:</span> {profile.squat_1rm} kg</div>
            <div><span className="font-medium text-gray-500">Bench 1RM:</span> {profile.bench_1rm} kg</div>
            <div><span className="font-medium text-gray-500">Deadlift 1RM:</span> {profile.deadlift_1rm} kg</div>
            <div><span className="font-medium text-gray-500">{L('Days/Week:', 'Din/Hafta:')}</span> {profile.training_days_per_week}</div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">{L("You haven't completed your athlete assessment yet.", 'Aapne abhi tak apna athlete assessment poora nahi kiya hai.')}</p>
            <Link to="/dashboard/assessment" className="bg-gray-900 hover:bg-gray-800 text-white py-2 px-4 rounded">{L('Start Assessment', 'Assessment shuru karo')}</Link>
          </div>
        )}
      </div>
    </div>
  );
}
