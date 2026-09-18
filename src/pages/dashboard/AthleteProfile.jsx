import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';

export default function AthleteProfile() {
  const { user } = useAuth();
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

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-800 mb-6">Athlete Profile</h2>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        {profile ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div><span className="font-medium text-gray-500">Name:</span> {profile.full_name}</div>
            <div><span className="font-medium text-gray-500">Experience:</span> {profile.experience_level}</div>
            <div><span className="font-medium text-gray-500">Bodyweight:</span> {profile.bodyweight_kg} kg</div>
            <div><span className="font-medium text-gray-500">Goal:</span> {profile.primary_goal}</div>
            <div><span className="font-medium text-gray-500">Squat 1RM:</span> {profile.squat_1rm} kg</div>
            <div><span className="font-medium text-gray-500">Bench 1RM:</span> {profile.bench_1rm} kg</div>
            <div><span className="font-medium text-gray-500">Deadlift 1RM:</span> {profile.deadlift_1rm} kg</div>
            <div><span className="font-medium text-gray-500">Days/Week:</span> {profile.training_days_per_week}</div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">You haven't completed your athlete assessment yet.</p>
            <Link to="/dashboard/assessment" className="bg-gray-900 hover:bg-gray-800 text-white py-2 px-4 rounded">Start Assessment</Link>
          </div>
        )}
      </div>
    </div>
  );
}
