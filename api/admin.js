import { createClient } from '@supabase/supabase-js';
import { e1rmFromLogs, evaluateBlock } from '../src/lib/autoreg.js';

const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Owner-only data panel. The owner is whoever's login email equals OWNER_EMAIL (a Vercel environment
// variable — not in the code, never sent to the browser). Everyone else gets a plain 404.
const ownerEmail = () => String(process.env.OWNER_EMAIL || '').trim().toLowerCase();
const DAY = 24 * 3600 * 1000;

async function all(query) {
  // PostgREST caps a response at 1000 rows; page through so the totals stay right as the app grows.
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await query().range(from, from + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) return out;
  }
}

async function summary() {
  const users = [];
  for (let page = 1; ; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) break;
  }
  const [profiles, subs, programs, logs, txns, purchases, invites, redemptions] = await Promise.all([
    all(() => supabaseAdmin.from('athlete_profiles').select('user_id, full_name, experience_level, training_days_per_week, competition_date, squat_1rm, bench_1rm, deadlift_1rm, bodyweight_kg, sex, assessment_data')),
    all(() => supabaseAdmin.from('subscriptions').select('user_id, status, start_date, end_date, razorpay_payment_id, products(name)')),
    all(() => supabaseAdmin.from('generated_programs').select('user_id, created_at')),
    all(() => supabaseAdmin.from('workout_logs').select('user_id, date_completed, logged_exercises, recovery_checklist').eq('is_deleted', false)),
    all(() => supabaseAdmin.from('payment_transactions').select('user_id, amount_paid, status, payment_timestamp, provider_payment_id, products(name, type)').order('payment_timestamp', { ascending: false })),
    all(() => supabaseAdmin.from('purchases').select('user_id, product_id, products(name)')),
    supabaseAdmin.from('invite_codes').select('*').order('created_at', { ascending: false }).then((r) => r.data || []), // table may not exist yet
    supabaseAdmin.from('invite_redemptions').select('code, user_id, redeemed_at').then((r) => r.data || []),
  ]);

  const now = Date.now();
  const by = (rows, key = 'user_id') => rows.reduce((m, r) => ((m[r[key]] ||= []).push(r), m), {});
  const profOf = Object.fromEntries(profiles.map((p) => [p.user_id, p]));
  const subsOf = by(subs), progOf = by(programs), logOf = by(logs), buysOf = by(purchases);
  const emailOf = Object.fromEntries(users.map((u) => [u.id, u.email]));
  const paid = txns.filter((t) => t.status === 'captured');
  const proUntil = (uid) => (subsOf[uid] || []).filter((s) => s.status === 'active' && new Date(s.end_date) > now).reduce((m, s) => (!m || s.end_date > m ? s.end_date : m), null);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

  const userRows = users.map((u) => {
    const p = profOf[u.id] || {}, l = logOf[u.id] || [];
    const until = proUntil(u.id);
    const invitePro = until && (subsOf[u.id] || []).some((s) => String(s.razorpay_payment_id).startsWith('invite:') && s.end_date === until);
    return {
      email: u.email, name: p.full_name || '', joined: u.created_at, lastLogin: u.last_sign_in_at,
      level: p.experience_level || '', days: p.training_days_per_week || null, meet: p.competition_date || null,
      proUntil: until, proType: until ? (invitePro ? 'invite' : 'paid') : null,
      blocks: (progOf[u.id] || []).length, sessions: l.length,
      lastSession: l.reduce((m, x) => (!m || x.date_completed > m ? x.date_completed : m), null),
      squat: p.squat_1rm || null, bench: p.bench_1rm || null, deadlift: p.deadlift_1rm || null, bodyweight: p.bodyweight_kg || null,
      guides: (buysOf[u.id] || []).map((b) => b.products?.name).filter(Boolean),
      spent: paid.filter((t) => t.user_id === u.id).reduce((s, t) => s + Number(t.amount_paid || 0), 0),
    };
  }).sort((a, b) => String(b.joined).localeCompare(String(a.joined)));

  const salesByProduct = {};
  for (const t of paid) { const n = t.products?.name || 'Unknown'; (salesByProduct[n] ||= { count: 0, amount: 0 }); salesByProduct[n].count++; salesByProduct[n].amount += Number(t.amount_paid || 0); }

  // Lifting picture across everyone: who trains, how hard, what hurts, why sessions get skipped.
  const lifting = { levels: {}, sets: 0, painSets: 0, rpeSum: 0, rpeN: 0, skipReasons: {}, swaps: 0, injuries: {}, styles: {}, days: {} };
  for (const p of profiles) {
    const a = p.assessment_data || {};
    lifting.levels[p.experience_level || 'Not set'] = (lifting.levels[p.experience_level || 'Not set'] || 0) + 1;
    if (a.training_style) lifting.styles[a.training_style] = (lifting.styles[a.training_style] || 0) + 1;
    if (p.training_days_per_week) lifting.days[p.training_days_per_week] = (lifting.days[p.training_days_per_week] || 0) + 1;
    const inj = String(a.current_injuries || '').toLowerCase();
    for (const [k, re] of [['Back', /back|spine|lumbar|disc|sciatic/], ['Knee', /knee|patell|menisc/], ['Shoulder', /shoulder|rotator|impinge|labrum/], ['Elbow/Wrist', /elbow|wrist/], ['Hip', /hip|groin/]]) if (re.test(inj)) lifting.injuries[k] = (lifting.injuries[k] || 0) + 1;
  }
  for (const l of logs) {
    const meta = l.recovery_checklist || {};
    if (meta.skip_reason) lifting.skipReasons[meta.skip_reason] = (lifting.skipReasons[meta.skip_reason] || 0) + 1;
    for (const ex of l.logged_exercises || []) {
      if (ex.originalName) lifting.swaps++;
      for (const st of ex.loggedSets || []) {
        if (!st.completed) continue;
        lifting.sets++;
        if (st.pain) lifting.painSets++;
        const r = Number(st.rpe);
        if (ex.type === 'Main' && r >= 5 && r <= 10) { lifting.rpeSum += r; lifting.rpeN++; }
      }
    }
  }
  const avg = (k) => { const v = profiles.map((p) => Number(p[k])).filter((x) => x > 0); return v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length) : null; };
  lifting.avgMaxes = { squat: avg('squat_1rm'), bench: avg('bench_1rm'), deadlift: avg('deadlift_1rm') };
  lifting.avgRpe = lifting.rpeN ? Math.round((lifting.rpeSum / lifting.rpeN) * 10) / 10 : null;
  delete lifting.rpeSum; delete lifting.rpeN;

  return {
    lifting,
    totals: {
      users: users.length,
      new7: users.filter((u) => now - new Date(u.created_at) < 7 * DAY).length,
      new30: users.filter((u) => now - new Date(u.created_at) < 30 * DAY).length,
      assessed: profiles.length,
      proActive: userRows.filter((u) => u.proType === 'paid').length,
      proInvite: userRows.filter((u) => u.proType === 'invite').length,
      revenue: paid.reduce((s, t) => s + Number(t.amount_paid || 0), 0),
      revenueMonth: paid.filter((t) => new Date(t.payment_timestamp) >= monthStart).reduce((s, t) => s + Number(t.amount_paid || 0), 0),
      blocks: programs.length,
      sessions: logs.length,
      active7: new Set(logs.filter((l) => now - new Date(l.date_completed) < 7 * DAY).map((l) => l.user_id)).size,
    },
    salesByProduct,
    payments: paid.slice(0, 100).map((t) => ({ when: t.payment_timestamp, email: emailOf[t.user_id] || '', product: t.products?.name || '', amount: Number(t.amount_paid || 0), id: t.provider_payment_id })),
    users: userRows,
    invites: invites.map((c) => ({ ...c, usedBy: redemptions.filter((r) => r.code === c.code).map((r) => ({ email: emailOf[r.user_id] || r.user_id, at: r.redeemed_at })) })),
  };
}

/** Everything about one athlete: assessment, every block, every logged set, check-ins, strength trend. */
async function userDetail(email) {
  let user = null;
  for (let page = 1; !user; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    user = data.users.find((u) => String(u.email).toLowerCase() === String(email).toLowerCase()) || null;
    if (data.users.length < 1000) break;
  }
  if (!user) return null;
  const [{ data: profile }, programs, logs, subs, purchases] = await Promise.all([
    supabaseAdmin.from('athlete_profiles').select('*').eq('user_id', user.id).maybeSingle(),
    all(() => supabaseAdmin.from('generated_programs').select('id, created_at, is_active, program_snapshot').eq('user_id', user.id).order('created_at', { ascending: false })),
    all(() => supabaseAdmin.from('workout_logs').select('id, program_id, week_number, day_number, date_completed, duration_seconds, logged_exercises, recovery_checklist').eq('user_id', user.id).eq('is_deleted', false).order('date_completed', { ascending: false })),
    all(() => supabaseAdmin.from('subscriptions').select('status, start_date, end_date, razorpay_payment_id, products(name)').eq('user_id', user.id)),
    all(() => supabaseAdmin.from('purchases').select('purchased_at, products(name)').eq('user_id', user.id)),
  ]);
  return {
    email: user.email, joined: user.created_at, lastLogin: user.last_sign_in_at,
    profile, subs, purchases,
    e1rm: e1rmFromLogs(logs),
    programs: programs.map((p) => {
      const snap = p.program_snapshot || {};
      const own = logs.filter((l) => l.program_id === p.id);
      return {
        id: p.id, created: p.created_at, active: p.is_active, block: snap.blockType, weeks: snap.weeks?.length || 0,
        maxes: snap.meta?.maxes || null, exp: snap.meta?.form?.exp || null, notes: snap.meta?.notes || [],
        checkins: snap.adjustments?.checkins || {},
        review: (() => { try { return snap.weeks && own.length ? evaluateBlock(snap, own, snap.adjustments?.checkins || {}) : null; } catch { return null; } })(), // one odd old block must not hide the athlete
        plan: (snap.weeks || []).map((w) => ({ week: w.week, label: w.label, days: (w.days || []).filter((d) => !d.rest).map((d) => ({ day: d.day, date: d.date, focus: d.focus, exercises: (d.exercises || []).map((e) => `${e.name} ${e.sets}×${e.reps}${e.weight ? ` @ ${e.weight} kg` : ''}${e.rpe ? ` RPE ${e.rpe}` : ''}`) })) })),
      };
    }),
    logs,
  };
}

/** Raw rows for the full Excel export (one row per logged set, so it can be filtered and pivoted). */
async function exportAll() {
  const s = await summary();
  const users = [];
  for (let page = 1; ; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) break;
  }
  const mail = Object.fromEntries(users.map((u) => [u.id, u.email]));
  const [profiles, programs, logs] = await Promise.all([
    all(() => supabaseAdmin.from('athlete_profiles').select('*')),
    all(() => supabaseAdmin.from('generated_programs').select('id, user_id, created_at, is_active, program_snapshot')),
    all(() => supabaseAdmin.from('workout_logs').select('user_id, program_id, week_number, day_number, date_completed, duration_seconds, logged_exercises, recovery_checklist').eq('is_deleted', false)),
  ]);
  const blockOf = Object.fromEntries(programs.map((p) => [p.id, p.program_snapshot?.blockType || '']));
  const sets = [];
  for (const l of logs) for (const ex of l.logged_exercises || []) for (const [i, st] of (ex.loggedSets || []).entries()) {
    sets.push({ email: mail[l.user_id] || l.user_id, date: l.date_completed, block: blockOf[l.program_id] || '', week: l.week_number, day: l.day_number, exercise: ex.name, type: ex.type, lift: ex.lift || '', set: i + 1, plannedReps: ex.reps, plannedRpe: ex.rpe, weight: st.weight, reps: st.reps, rpe: st.rpe, done: !!st.completed, pain: !!st.pain, skipped: !!ex.skipped, swappedFrom: ex.originalName || '' });
  }
  const checkins = [];
  for (const p of programs) for (const [week, c] of Object.entries(p.program_snapshot?.adjustments?.checkins || {})) {
    checkins.push({ email: mail[p.user_id] || p.user_id, block: p.program_snapshot?.blockType || '', week, light: c.light, reason: c.reason, sleepHours: c.sleepHours, soreness: c.soreness, mood: c.mood, motivation: c.motivation, pain: c.pain, painWhere: c.painWhere, notes: c.notes, at: c.at });
  }
  return {
    users: s.users, payments: s.payments, invites: s.invites.map(({ usedBy, ...c }) => ({ ...c, usedBy: usedBy.map((u) => u.email).join(', ') })),
    profiles: profiles.map(({ assessment_data: a, ...p }) => ({ email: mail[p.user_id] || p.user_id, ...p, ...(a || {}), recent_sets: JSON.stringify(a?.recent_sets || {}) })),
    blocks: programs.map((p) => ({ email: mail[p.user_id] || p.user_id, created: p.created_at, active: p.is_active, block: p.program_snapshot?.blockType || '', weeks: p.program_snapshot?.weeks?.length || 0, level: p.program_snapshot?.meta?.form?.exp || '', squat: p.program_snapshot?.meta?.maxes?.squat, bench: p.program_snapshot?.meta?.maxes?.bench, deadlift: p.program_snapshot?.meta?.maxes?.deadlift })),
    sessions: logs.map((l) => ({ email: mail[l.user_id] || l.user_id, date: l.date_completed, block: blockOf[l.program_id] || '', week: l.week_number, day: l.day_number, minutes: Math.round((l.duration_seconds || 0) / 60), skipReason: l.recovery_checklist?.skip_reason || '', notes: l.recovery_checklist?.session_notes || '' })),
    sets, checkins,
  };
}

export default async function handler(req, res) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(404).json({ error: 'Not found' });
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    const owner = ownerEmail();
    if (error || !user || !owner || String(user.email || '').toLowerCase() !== owner || !user.email_confirmed_at) {
      return res.status(404).json({ error: 'Not found' });
    }

    const action = req.method === 'GET' ? req.query.action : req.body?.action;
    if (action === 'check') return res.status(200).json({ owner: true });
    if (action === 'summary') return res.status(200).json(await summary());
    if (action === 'user') {
      const d = await userDetail(String(req.query.email || ''));
      return d ? res.status(200).json(d) : res.status(404).json({ error: 'No such user' });
    }
    if (action === 'export') return res.status(200).json(await exportAll());

    if (req.method === 'POST' && action === 'createInvite') {
      const code = String(req.body.code || '').trim().toUpperCase();
      const maxUses = Math.floor(Number(req.body.maxUses));
      if (!/^[A-Z0-9-]{4,32}$/.test(code)) return res.status(400).json({ error: 'Code: 4–32 letters, numbers or dashes.' });
      if (!(maxUses >= 1 && maxUses <= 1000)) return res.status(400).json({ error: 'People: 1 to 1000.' });
      const { error: insErr } = await supabaseAdmin.from('invite_codes').insert({ code, max_uses: maxUses, note: String(req.body.note || '').slice(0, 200) || null });
      if (insErr) return res.status(400).json({ error: insErr.code === '23505' ? 'That code already exists.' : insErr.message });
      return res.status(200).json({ success: true });
    }
    if (req.method === 'POST' && action === 'setInviteActive') {
      const { error: upErr } = await supabaseAdmin.from('invite_codes').update({ is_active: !!req.body.active }).eq('code', String(req.body.code || ''));
      if (upErr) throw upErr;
      return res.status(200).json({ success: true });
    }
    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    console.error('Admin API error:', err);
    // Only the owner ever reaches this point, so the real reason is shown to help fix it.
    return res.status(500).json({ error: `Something went wrong loading the data: ${err?.message || 'unknown error'}` });
  }
}
