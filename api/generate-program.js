import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

    const { data: profile, error: profileError } = await supabaseAdmin.from('athlete_profiles').select('*').eq('user_id', user.id).maybeSingle();
    if (profileError || !profile) return res.status(404).json({ error: 'Athlete profile not found' });

    const { data: activeSub } = await supabaseAdmin.from('subscriptions').select('id').eq('user_id', user.id).eq('status', 'active').gte('end_date', new Date().toISOString()).maybeSingle();
    const { count: programCount } = await supabaseAdmin.from('generated_programs').select('id', { count: 'exact', head: true }).eq('user_id', user.id);

    const isPro = !!activeSub;

    if (!isPro && programCount >= 1) return res.status(403).json({ error: 'UPGRADE_REQUIRED' });

    const { data: engineVersion } = await supabaseAdmin.from('engine_versions').select('id, version_string').eq('is_active', true).single();

    const decisionLog = [];
    let blockType = 'Strength Block';
    let totalWeeks = 4;

    if (profile.competition_date) {
      const daysToMeet = Math.ceil((new Date(profile.competition_date) - new Date()) / (1000 * 60 * 60 * 24));
      if (daysToMeet <= 28 && daysToMeet > 0) {
        blockType = 'Peaking Block';
        decisionLog.push({ step: 'Block Selection', decision: 'Peaking Block', reason: `Competition in ${daysToMeet} days` });
      } else {
        decisionLog.push({ step: 'Block Selection', decision: 'Strength Block', reason: `Competition too far (${daysToMeet} days), building base strength` });
      }
    } else {
      decisionLog.push({ step: 'Block Selection', decision: 'Strength Block', reason: 'No competition date, defaulting to Strength Block' });
    }

    const progression = [
      { week: 1, sets: 4, reps: 6, percentage: 0.725, rpe: 7 },
      { week: 2, sets: 4, reps: 5, percentage: 0.775, rpe: 7.5 },
      { week: 3, sets: 5, reps: 4, percentage: 0.80, rpe: 8 },
      { week: 4, sets: 3, reps: 3, percentage: 0.70, rpe: 6 }
    ];

    const mainLifts = ['Squat', 'Bench Press', 'Deadlift'];
    const programWeeks = [];

    for (const week of progression) {
      const weekData = { week: week.week, days: [] };
      mainLifts.forEach((lift, index) => {
        const oneRM = lift === 'Squat' ? profile.squat_1rm : lift === 'Bench Press' ? profile.bench_1rm : profile.deadlift_1rm;
        const targetWeight = Math.round((oneRM * week.percentage) / 2.5) * 2.5;
        weekData.days.push({
          day: index + 1,
          focus: lift,
          exercises: [{ name: lift, sets: week.sets, reps: week.reps, weight: targetWeight, rpe: week.rpe, type: 'Main' }]
        });
      });
      programWeeks.push(weekData);
    }
    decisionLog.push({ step: 'Main Lifts', decision: '4-week Wave Loading', reason: `Applied ${progression.map(w => `${w.sets}x${w.reps}@${w.percentage*100}%`).join(' -> ')}` });

    const { data: weakPoints } = await supabaseAdmin.from('weak_point_mappings').select('lift, weak_point, recommended_exercise_ids, exercises(name)').eq('engine_version_id', engineVersion.id);

    const assessmentData = profile.assessment_data || {};
    const lifts = ['squat', 'bench', 'deadlift'];

    lifts.forEach(liftKey => {
      const userWeakPoint = assessmentData[`${liftKey}_weak_point`];
      if (userWeakPoint && userWeakPoint !== 'None') {
        const mapping = weakPoints?.find(wp => wp.weak_point === userWeakPoint);
        if (mapping && mapping.exercises) {
          programWeeks[0].days[3].exercises.push({ name: mapping.exercises.name, sets: 3, reps: '8-10', weight: 'RPE 7', type: 'Accessory' });
          decisionLog.push({ step: 'Accessory Mapping', decision: mapping.exercises.name, reason: `User flagged ${liftKey} weak point: ${userWeakPoint}. Mapped to target muscle.` });
        }
      }
    });

    const { data: newProgram, error: saveError } = await supabaseAdmin.from('generated_programs').insert({
      user_id: user.id,
      athlete_profile_id: profile.id,
      engine_version_id: engineVersion.id,
      program_snapshot: { blockType, weeks: programWeeks },
      is_active: true
    }).select('id').single();

    if (saveError) throw saveError;

    await supabaseAdmin.from('decision_audit_logs').insert({
      program_id: newProgram.id,
      engine_version_id: engineVersion.id,
      decision_log: decisionLog
    });

    return res.status(200).json({ success: true, programId: newProgram.id, engineData: { blockType: blockType, log: decisionLog } });

  } catch (error) {
    console.error('Engine Error:', error);
    return res.status(500).json({ error: 'Failed to generate program' });
  }
}
