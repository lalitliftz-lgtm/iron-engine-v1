import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Input, Select, TextArea } from '../../components/ui/FormControls';
import { useNavigate, Link } from 'react-router-dom';

const steps = [
  { id: 'basics', title: 'Basic Info', fields: ['full_name', 'age', 'sex', 'height_cm', 'bodyweight_kg', 'experience_level'] },
  { id: 'strength', title: 'Strength Metrics', fields: ['squat_1rm', 'bench_1rm', 'deadlift_1rm', 'training_days_per_week'] },
  { id: 'goals', title: 'Goals & Competition', fields: ['primary_goal', 'competition_status'] },
  { id: 'diagnostics', title: 'Diagnostics', fields: ['squat_weak_point', 'bench_weak_point', 'deadlift_weak_point', 'rpe_experience'] },
  { id: 'constraints', title: 'Constraints & Equipment', fields: ['current_injuries', 'equipment_level', 'available_equipment', 'restricted_exercises', 'coach_notes'] },
  { id: 'review', title: 'Review', fields: [] }
];

export default function AssessmentWizard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [loadState, setLoadState] = useState(true);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const { register, handleSubmit, watch, trigger, formState: { errors }, reset, getValues } = useForm({ mode: 'onChange' });

  useEffect(() => {
    const fetchProfile = async () => {
      const { data } = await supabase.from('athlete_profiles').select('*').eq('user_id', user.id).maybeSingle();
      if (data) {
        const formData = { ...data, ...(data.assessment_data || {}) };
        if (formData.competition_status !== undefined) formData.competition_status = String(formData.competition_status);
        reset(formData);
      }
      setLoadState(false);
    };
    fetchProfile();
  }, [user, reset]);

  const saveData = useCallback(async (formData) => {
    setIsSaving(true);
    const { assessment_data, ...dbFields } = formData;
    dbFields.competition_status = formData.competition_status === 'true';
    const jsonFields = {
      squat_weak_point: formData.squat_weak_point, bench_weak_point: formData.bench_weak_point, deadlift_weak_point: formData.deadlift_weak_point,
      current_injuries: formData.current_injuries, available_equipment: formData.available_equipment, restricted_exercises: formData.restricted_exercises,
      rpe_experience: formData.rpe_experience, coach_notes: formData.coach_notes,
      weak_type: formData.weak_type, equipment_level: formData.equipment_level
    };
    const payload = { ...dbFields, user_id: user.id, assessment_data: jsonFields, updated_at: new Date().toISOString() };
    await supabase.from('athlete_profiles').upsert(payload, { onConflict: 'user_id' });
    setIsSaving(false);
  }, [user.id]);

  useEffect(() => {
    const subscription = watch((value) => {
      const timer = setTimeout(() => { saveData(value); }, 1500);
      return () => clearTimeout(timer);
    });
    return () => subscription.unsubscribe();
  }, [watch, saveData]);

  useEffect(() => {
    const handleBeforeUnload = (e) => { if (isSaving) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isSaving]);

  const nextStep = async () => {
    const isStepValid = await trigger(steps[currentStep].fields);
    if (isStepValid) { setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  };

  const prevStep = () => { setCurrentStep((prev) => Math.max(prev - 1, 0)); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const onSubmit = async (data) => { await saveData(data); setIsSubmitted(true); };

  if (loadState) return <div className="flex justify-center min-h-[60vh] items-center"><div className="animate-spin h-8 w-8 border-2 border-gray-900 rounded-full border-t-transparent"></div></div>;

  if (isSubmitted) {
    const formData = getValues();
    return (
      <div className="max-w-xl mx-auto px-4 py-20 min-h-[80vh] flex flex-col items-center justify-center text-center">
        <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 260, damping: 20 }} className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-8">
          <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
        </motion.div>
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Athlete Profile Created Successfully</h1>
        <p className="text-gray-500 mb-8 max-w-md">Welcome to the team, {formData.full_name?.split(' ')[0]}. Your baseline is set. The Iron Engine is ready to calibrate your first training block.</p>
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 w-full mb-8 text-left">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Profile Summary</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-500">Experience:</span> <span className="font-medium text-gray-900">{formData.experience_level}</span></div>
            <div><span className="text-gray-500">Days/Week:</span> <span className="font-medium text-gray-900">{formData.training_days_per_week}</span></div>
            <div><span className="text-gray-500">Squat 1RM:</span> <span className="font-medium text-gray-900">{formData.squat_1rm} kg</span></div>
            <div><span className="text-gray-500">Bench 1RM:</span> <span className="font-medium text-gray-900">{formData.bench_1rm} kg</span></div>
            <div><span className="text-gray-500">Deadlift 1RM:</span> <span className="font-medium text-gray-900">{formData.deadlift_1rm} kg</span></div>
            <div><span className="text-gray-500">Goal:</span> <span className="font-medium text-gray-900">{formData.primary_goal}</span></div>
          </div>
        </div>
        <Link to="/dashboard/programs" className="bg-gray-900 hover:bg-gray-800 text-white px-8 py-3.5 rounded-lg text-sm font-medium transition-colors w-full md:w-auto">Continue to Iron Engine →</Link>
      </div>
    );
  }

  const progress = ((currentStep + 1) / steps.length) * 100;
  const formData = watch();

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 min-h-screen flex flex-col">
      <div className="mb-12">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Step {currentStep + 1} of {steps.length}</h2>
            <span className="text-xs text-gray-400 hidden md:inline-block">·</span>
            <span className="text-xs text-gray-400 hidden md:inline-block">⏱ 2–3 minutes</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            {isSaving ? <span className="flex items-center gap-1.5 text-gray-400"><span className="h-1.5 w-1.5 bg-yellow-500 rounded-full animate-pulse"></span> Saving...</span> : <span className="flex items-center gap-1.5 text-green-600"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg> Saved</span>}
          </div>
        </div>
        <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
          <motion.div className="h-full bg-gray-900 rounded-full" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.4, ease: "easeInOut" }} />
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div key={currentStep} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3, ease: "easeInOut" }} className="flex-1">
            {currentStep === 0 && (
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-6">Let's start with the basics.</h1>
                <Input label="Full Name" {...register('full_name', { required: 'Name is required' })} error={errors.full_name} placeholder="Lalit Sharma" />
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Age" type="number" {...register('age', { required: 'Age is required', valueAsNumber: true })} error={errors.age} placeholder="25" />
                  <Select label="Sex" {...register('sex', { required: 'Sex is required' })} error={errors.sex}>
                    <option value="">Select...</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Height (cm)" type="number" {...register('height_cm', { required: 'Height is required', valueAsNumber: true })} error={errors.height_cm} placeholder="175" />
                  <Input label="Bodyweight (kg)" type="number" step="0.1" {...register('bodyweight_kg', { required: 'Bodyweight is required', valueAsNumber: true })} error={errors.bodyweight_kg} placeholder="82.5" />
                </div>
                <Select label="Training Experience" {...register('experience_level', { required: 'Experience level is required' })} error={errors.experience_level}>
                  <option value="">Select...</option><option value="Beginner">Beginner (0-2 yrs)</option><option value="Intermediate">Intermediate (2-4 yrs)</option><option value="Advanced">Advanced (4+ yrs)</option>
                </Select>
              </div>
            )}
            {currentStep === 1 && (
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-6">What are your current numbers?</h1>
                <div className="grid grid-cols-1 gap-4">
                  <Input label="Squat 1RM (kg)" type="number" step="0.5" {...register('squat_1rm', { required: 'Required', valueAsNumber: true })} error={errors.squat_1rm} placeholder="140" />
                  <Input label="Bench Press 1RM (kg)" type="number" step="0.5" {...register('bench_1rm', { required: 'Required', valueAsNumber: true })} error={errors.bench_1rm} placeholder="100" />
                  <Input label="Deadlift 1RM (kg)" type="number" step="0.5" {...register('deadlift_1rm', { required: 'Required', valueAsNumber: true })} error={errors.deadlift_1rm} placeholder="180" />
                </div>
                <div className="mt-4">
                  <Select label="Training Days Per Week" {...register('training_days_per_week', { required: 'Required', valueAsNumber: true })} error={errors.training_days_per_week}>
                    <option value="">Select...</option><option value="3">3 Days</option><option value="4">4 Days</option><option value="5">5 Days</option><option value="6">6 Days</option>
                  </Select>
                </div>
              </div>
            )}
            {currentStep === 2 && (
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-6">What are we chasing?</h1>
                <Select label="Primary Goal" {...register('primary_goal', { required: 'Goal is required' })} error={errors.primary_goal}>
                  <option value="">Select...</option><option value="Strength">Raw Strength</option><option value="Hypertrophy">Hypertrophy / Muscle</option><option value="General Powerlifting">General Powerlifting</option><option value="Meet Prep">Meet Prep</option>
                </Select>
                <Select label="Competition Status" {...register('competition_status', { required: 'Required' })} error={errors.competition_status}>
                  <option value="false">No upcoming meet</option><option value="true">I have a meet planned</option>
                </Select>
                {watch('competition_status') === 'true' && <Input label="Competition Date" type="date" {...register('competition_date')} error={errors.competition_date} />}
              </div>
            )}
            {currentStep === 3 && (
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-6">Where do you break down?</h1>
                <p className="text-sm text-gray-500 mb-6">This helps us map weak points to specific accessory work.</p>
                <Select label="Squat Weak Point" {...register('squat_weak_point')}><option value="None">No specific weakness</option><option value="Hole">Fails in the hole (bottom)</option><option value="Mid-range">Stalls mid-range (above parallel)</option><option value="Lockout">Can't finish the lockout (hips)</option><option value="Core/Collapse">Chest drops / hips shoot up</option></Select>
                <Select label="Bench Weak Point" {...register('bench_weak_point')}><option value="None">No specific weakness</option><option value="Chest/Off-chest">Off the chest (bottom)</option><option value="Mid-range">Stalls mid-range</option><option value="Lockout">Fails at lockout</option><option value="Unstable">Bar path / touch point changes every rep</option></Select>
                <Select label="Deadlift Weak Point" {...register('deadlift_weak_point')}><option value="None">No specific weakness</option><option value="Off-floor">Can't break the floor</option><option value="Mid-range">Stalls around the knee</option><option value="Lockout">Can't finish the lockout</option></Select>
                <Select label="Where does the problem show up?" {...register('weak_type')}>
                  <option value="strength">Technique is fine, the bar just slows down when it's heavy (strength issue)</option>
                  <option value="technique">Form breaks even with light weight — depth, bar path or position (technique issue)</option>
                  <option value="fatigue">Even warm-ups feel heavy lately, recovery feels incomplete (fatigue)</option>
                </Select>
                <p className="text-xs text-gray-400 -mt-3 mb-5">System 2.0 rule: technique issue → lighter variations, not more accessories. Fatigue → less volume, not a new exercise.</p>
                <Select label="RPE Experience" {...register('rpe_experience')}><option value="true">Yes, I understand RPE</option><option value="false">No, explain it to me</option></Select>
              </div>
            )}
            {currentStep === 4 && (
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-6">Any physical constraints?</h1>
                <TextArea label="Current Injuries or Pain" {...register('current_injuries')} placeholder="e.g., Lower back tightness, right shoulder impingement..." />
                <Select label="Gym Setup" {...register('equipment_level')}>
                  <option value="commercial">Commercial gym — machines, cables, dumbbells, everything</option>
                  <option value="basic">Basic gym — barbell, rack, bench, plates, dumbbells, pull-up bar</option>
                  <option value="minimal">Minimal — barbell, rack, bench and plates only</option>
                </Select>
                <TextArea label="Anything else about your equipment? (optional)" {...register('available_equipment')} placeholder="e.g., no leg press, have bands and a belt..." />
                <TextArea label="Restricted Exercises" {...register('restricted_exercises')} placeholder="e.g., No barbell bench press due to shoulder..." />
                <TextArea label="Coach Notes (Optional)" {...register('coach_notes')} placeholder="Anything else I should know?" />
              </div>
            )}
            {currentStep === 5 && (
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Review your profile.</h1>
                <p className="text-sm text-gray-500 mb-8">Make sure everything looks correct before generating your program.</p>
                <div className="space-y-6">
                  <ReviewSection title="Basic Info" onEdit={() => setCurrentStep(0)}>
                    <ReviewItem label="Name" value={formData.full_name} />
                    <ReviewItem label="Age / Sex" value={`${formData.age} / ${formData.sex}`} />
                    <ReviewItem label="Weight / Height" value={`${formData.bodyweight_kg}kg / ${formData.height_cm}cm`} />
                    <ReviewItem label="Experience" value={formData.experience_level} />
                  </ReviewSection>
                  <ReviewSection title="Strength & Frequency" onEdit={() => setCurrentStep(1)}>
                    <ReviewItem label="Squat / Bench / Deadlift" value={`${formData.squat_1rm} / ${formData.bench_1rm} / ${formData.deadlift_1rm} kg`} />
                    <ReviewItem label="Days per week" value={formData.training_days_per_week} />
                  </ReviewSection>
                  <ReviewSection title="Goals" onEdit={() => setCurrentStep(2)}>
                    <ReviewItem label="Primary Goal" value={formData.primary_goal} />
                    {formData.competition_status === 'true' && <ReviewItem label="Meet Date" value={formData.competition_date ? new Date(formData.competition_date).toLocaleDateString() : 'N/A'} />}
                  </ReviewSection>
                  <ReviewSection title="Diagnostics" onEdit={() => setCurrentStep(3)}>
                    <ReviewItem label="Squat Weak Point" value={formData.squat_weak_point} />
                    <ReviewItem label="Bench Weak Point" value={formData.bench_weak_point} />
                    <ReviewItem label="Deadlift Weak Point" value={formData.deadlift_weak_point} />
                  </ReviewSection>
                  <ReviewSection title="Constraints" onEdit={() => setCurrentStep(4)}>
                    <ReviewItem label="Injuries" value={formData.current_injuries || 'None'} />
                    <ReviewItem label="Gym Setup" value={formData.equipment_level || 'commercial'} />
                  </ReviewSection>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="flex justify-between mt-12 pt-6 border-t border-gray-100">
          <button type="button" onClick={prevStep} disabled={currentStep === 0} className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${currentStep === 0 ? 'opacity-0 pointer-events-none' : 'text-gray-700 hover:bg-gray-100'}`}>Back</button>
          {currentStep < steps.length - 1 ? <button type="button" onClick={nextStep} className="bg-gray-900 hover:bg-gray-800 text-white px-8 py-2.5 rounded-lg text-sm font-medium transition-colors">Continue →</button> : <button type="submit" className="bg-green-600 hover:bg-green-700 text-white px-8 py-2.5 rounded-lg text-sm font-medium transition-colors">Save Profile & Continue</button>}
        </div>
      </form>
    </div>
  );
}

const ReviewSection = ({ title, children, onEdit }) => (
  <div className="bg-white border border-gray-200 rounded-xl p-5">
    <div className="flex justify-between items-center mb-3">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <button type="button" onClick={onEdit} className="text-xs text-blue-600 hover:underline font-medium">Edit</button>
    </div>
    <div className="grid grid-cols-2 gap-4">{children}</div>
  </div>
);

const ReviewItem = ({ label, value }) => (
  <div>
    <p className="text-xs text-gray-500 mb-0.5">{label}</p>
    <p className="text-sm font-medium text-gray-900 capitalize">{value || '—'}</p>
  </div>
);
