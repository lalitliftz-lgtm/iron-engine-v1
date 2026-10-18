import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

/* Owner-only data panel. The server decides who the owner is (OWNER_EMAIL on Vercel); anyone else
   gets a 404 from /api/admin and is sent back to Today. */

const rupees = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
const day = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—');

async function adminCall(body, query = 'action=summary') {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(body ? '/api/admin' : `/api/admin?${query}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

function Stat({ label, value, sub }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 tabular-nums mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

const SKIP = { sick: 'Sick', busy: 'No time', gym_closed: 'Gym closed', travel: 'Travelling', injury: 'Injury / pain', other: 'Other' };
const count = (obj, label = (k) => k) => Object.entries(obj || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${label(k)} ${v}`).join(' · ') || '—';

/** Everything in one Excel file: users, assessments, blocks, sessions, every set, check-ins, payments, invites. */
async function downloadExcel() {
  const r = await adminCall(null, 'action=export');
  if (!r.ok) throw new Error(r.json.error || 'Export failed');
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const sheets = [['Users', r.json.users], ['Assessments', r.json.profiles], ['Blocks', r.json.blocks], ['Sessions', r.json.sessions], ['Sets', r.json.sets], ['Check-ins', r.json.checkins], ['Payments', r.json.payments], ['Invites', r.json.invites]];
  for (const [name, rows] of sheets) {
    const ws = wb.addWorksheet(name);
    const cols = [...new Set((rows || []).flatMap((x) => Object.keys(x)))];
    ws.columns = cols.map((c) => ({ header: c, key: c, width: Math.min(40, Math.max(10, c.length + 2)) }));
    for (const row of rows || []) ws.addRow(Object.fromEntries(cols.map((c) => [c, Array.isArray(row[c]) ? row[c].join('; ') : row[c] !== null && typeof row[c] === 'object' ? JSON.stringify(row[c]) : row[c]])));
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    if (cols.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  }
  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  Object.assign(document.createElement('a'), { href: url, download: `lalitlifts-all-data-${new Date().toISOString().slice(0, 10)}.xlsx` }).click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** One athlete, A to Z. */
function UserDetail({ email, onClose }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    adminCall(null, `action=user&email=${encodeURIComponent(email)}`).then((r) => (r.ok ? setD(r.json) : setErr(r.json.error || 'Could not load')));
  }, [email]);
  const a = d?.profile?.assessment_data || {};
  const LIFTS = [['squat', 'Squat'], ['bench', 'Bench'], ['deadlift', 'Deadlift']];
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex justify-end" onClick={onClose}>
      <div className="bg-iron w-full max-w-2xl h-full overflow-y-auto p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start gap-3">
          <div><h2 className="text-xl font-semibold text-gray-900">{d?.profile?.full_name || email}</h2><p className="text-sm text-gray-500">{email}</p></div>
          <button onClick={onClose} className="text-sm font-semibold border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg">Close</button>
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        {!d && !err && <p className="text-sm text-gray-500">Loading…</p>}
        {d && (<>
          <section className="bg-white border border-gray-200 rounded-xl p-4 text-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Account</h3>
            <p className="text-gray-700">Joined {day(d.joined)} · last login {day(d.lastLogin)}</p>
            <p className="text-gray-700">Pro: {d.subs.length ? d.subs.map((s) => `${s.products?.name || 'Pro'} ${day(s.start_date)} → ${day(s.end_date)}${String(s.razorpay_payment_id).startsWith('invite:') ? ' (invite)' : ''}`).join(' · ') : 'never'}</p>
            <p className="text-gray-700">Guides: {d.purchases.map((x) => x.products?.name).filter(Boolean).join(', ') || 'none'}</p>
          </section>
          <section className="bg-white border border-gray-200 rounded-xl p-4 text-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Strength</h3>
            <div className="grid grid-cols-3 gap-2">
              {LIFTS.map(([k, l]) => (
                <div key={k}><p className="text-xs text-gray-500">{l}</p><p className="font-semibold text-gray-900 tabular-nums">{d.profile?.[`${k}_1rm`] || '—'} kg</p><p className="text-xs text-gray-500">{d.e1rm?.[k] ? `now ~${d.e1rm[k].e1rm} (${d.e1rm[k].from})` : 'no heavy sets logged'}</p></div>
              ))}
            </div>
          </section>
          {d.profile && (
            <section className="bg-white border border-gray-200 rounded-xl p-4 text-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Assessment</h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {[['Level', d.profile.experience_level], ['Age', d.profile.age], ['Sex', d.profile.sex], ['Bodyweight', d.profile.bodyweight_kg && `${d.profile.bodyweight_kg} kg`], ['Days/week', d.profile.training_days_per_week], ['Meet', d.profile.competition_date],
                  ...Object.entries(a).filter(([, v]) => v !== '' && v !== null && v !== undefined && typeof v !== 'object').map(([k, v]) => [k.replace(/_/g, ' '), String(v)])].map(([k, v]) => (
                  <p key={k} className="text-gray-600 truncate"><span className="text-gray-400">{k}:</span> {v ?? '—'}</p>
                ))}
              </div>
            </section>
          )}
          {d.programs.map((p) => (
            <details key={p.id} className="bg-white border border-gray-200 rounded-xl p-4 text-sm">
              <summary className="cursor-pointer font-semibold text-gray-900">{p.block || 'Block'} · {day(p.created)} {p.active ? '· active' : ''} <span className="font-normal text-gray-500">· {d.logs.filter((l) => l.program_id === p.id).length} sessions{p.review ? ` · ${p.review.completion}% done` : ''}</span></summary>
              {p.review && <p className="text-gray-600 mt-2">Review: {p.review.reason}{p.review.levelUp ? ' · ready for intermediate' : ''}</p>}
              {Object.keys(p.checkins).length > 0 && <p className="text-gray-600 mt-2">Check-ins: {Object.entries(p.checkins).map(([w, c]) => `W${w} ${c.light}${c.pain ? ' (pain)' : ''}`).join(' · ')}</p>}
              {p.plan.map((w) => (
                <div key={w.week} className="mt-2"><p className="text-xs font-semibold text-gray-500">{w.label || `Week ${w.week}`}</p>
                  {w.days.map((dd) => <p key={dd.day} className="text-xs text-gray-600"><b>{dd.date} {dd.focus}:</b> {dd.exercises.join(' · ')}</p>)}
                </div>
              ))}
            </details>
          ))}
          <section className="bg-white border border-gray-200 rounded-xl p-4 text-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Every logged session ({d.logs.length})</h3>
            {d.logs.map((l) => (
              <div key={l.id} className="py-2 border-b border-gray-100 last:border-0">
                <p className="font-medium text-gray-900">{day(l.date_completed)} · W{l.week_number} D{l.day_number}{l.duration_seconds ? ` · ${Math.round(l.duration_seconds / 60)} min` : ''}{l.recovery_checklist?.skip_reason ? ` · skipped: ${SKIP[l.recovery_checklist.skip_reason] || l.recovery_checklist.skip_reason}` : ''}</p>
                {(l.logged_exercises || []).map((ex, i) => (
                  <p key={i} className="text-xs text-gray-600">{ex.name}{ex.skipped ? ' — skipped' : ''}: {(ex.loggedSets || []).filter((x) => x.completed).map((x) => `${x.weight || ''}${x.weight ? '×' : ''}${x.reps}${x.rpe ? `@${x.rpe}` : ''}${x.pain ? ' ⚠' : ''}`).join(', ') || '—'}</p>
                ))}
                {l.recovery_checklist?.session_notes && <p className="text-xs text-gray-500 mt-0.5">📝 {l.recovery_checklist.session_notes}</p>}
              </div>
            ))}
          </section>
        </>)}
      </div>
    </div>
  );
}

function downloadCsv(rows) {
  const cols = ['email', 'name', 'joined', 'lastLogin', 'level', 'days', 'meet', 'squat', 'bench', 'deadlift', 'bodyweight', 'proUntil', 'proType', 'blocks', 'sessions', 'lastSession', 'guides', 'spent'];
  const esc = (v) => `"${String(Array.isArray(v) ? v.join('; ') : v ?? '').replace(/"/g, '""')}"`;
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  Object.assign(document.createElement('a'), { href: url, download: `lalitlifts-users-${new Date().toISOString().slice(0, 10)}.csv` }).click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export default function OwnerPanel() {
  const [state, setState] = useState('loading'); // loading | denied | error | ready
  const [data, setData] = useState(null);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('users');
  const [inv, setInv] = useState({ code: '', maxUses: '10', note: '' });
  const [invMsg, setInvMsg] = useState(null);
  const [openUser, setOpenUser] = useState(null);
  const [exporting, setExporting] = useState(false);
  const exportAll = async () => { setExporting(true); try { await downloadExcel(); } catch (e) { window.alert(e.message); } finally { setExporting(false); } };

  const load = useCallback(async () => {
    const r = await adminCall();
    if (r.status === 404) { setState('denied'); return; }
    if (!r.ok) { setState('error'); return; }
    setData(r.json); setState('ready');
  }, []);
  useEffect(() => { load(); }, [load]);

  const users = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (data?.users || []).filter((u) => !t || `${u.email} ${u.name}`.toLowerCase().includes(t));
  }, [data, q]);

  const createInvite = async () => {
    setInvMsg(null);
    const r = await adminCall({ action: 'createInvite', ...inv });
    if (!r.ok) { setInvMsg({ ok: false, text: r.json.error || 'Could not create the code.' }); return; }
    setInvMsg({ ok: true, text: `Code ${inv.code.toUpperCase()} created.` });
    setInv({ code: '', maxUses: '10', note: '' });
    load();
  };
  const setActive = async (code, active) => { await adminCall({ action: 'setInviteActive', code, active }); load(); };
  const copyLink = (code) => navigator.clipboard?.writeText(`${window.location.origin}/invite/${code}`);

  if (state === 'denied') return <Navigate to="/dashboard" replace />;
  if (state === 'loading') return <div className="flex justify-center min-h-[60vh] items-center"><div className="animate-spin h-8 w-8 border-2 border-gray-900 rounded-full border-t-transparent" /></div>;
  if (state === 'error') return <div className="max-w-3xl mx-auto px-4 py-10 text-sm text-gray-600">Could not load the data. <button onClick={load} className="underline font-semibold">Try again</button></div>;

  const t = data.totals;
  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-10">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 tracking-tight">Owner panel</h1>
        <div className="flex gap-3">
          <button onClick={exportAll} disabled={exporting} className="text-sm font-semibold border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg disabled:opacity-50">{exporting ? 'Preparing…' : '⬇ All data (Excel)'}</button>
          <button onClick={load} className="text-sm font-semibold text-gray-500 hover:text-gray-900">↻ Refresh</button>
        </div>
      </div>
      <p className="text-sm text-gray-500 mt-1 mb-6">Only you can see this page.</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Users" value={t.users} sub={`+${t.new7} this week · +${t.new30} in 30 days`} />
        <Stat label="Revenue" value={rupees(t.revenue)} sub={`${rupees(t.revenueMonth)} this month`} />
        <Stat label="Pro (paid)" value={t.proActive} sub={`+ ${t.proInvite} on free invite`} />
        <Stat label="Training this week" value={t.active7} sub={`${t.sessions} sessions · ${t.blocks} blocks total`} />
      </div>

      <section className="bg-white border border-gray-200 rounded-xl p-4 mt-4 text-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Lifting</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 text-gray-700">
          <p><span className="text-gray-400">Levels:</span> {count(data.lifting.levels)}</p>
          <p><span className="text-gray-400">Average maxes:</span> SQ {data.lifting.avgMaxes.squat ?? '—'} · BP {data.lifting.avgMaxes.bench ?? '—'} · DL {data.lifting.avgMaxes.deadlift ?? '—'} kg</p>
          <p><span className="text-gray-400">Days per week:</span> {count(data.lifting.days, (k) => `${k}d`)}</p>
          <p><span className="text-gray-400">Accessory style:</span> {count(data.lifting.styles)}</p>
          <p><span className="text-gray-400">Sets logged:</span> {data.lifting.sets} · avg main-lift RPE {data.lifting.avgRpe ?? '—'}</p>
          <p><span className="text-gray-400">Pain:</span> {data.lifting.painSets} painful sets · injuries noted: {count(data.lifting.injuries)}</p>
          <p><span className="text-gray-400">Why sessions were skipped:</span> {count(data.lifting.skipReasons, (k) => SKIP[k] || k)}</p>
          <p><span className="text-gray-400">Exercise swaps:</span> {data.lifting.swaps}</p>
        </div>
      </section>

      {Object.keys(data.salesByProduct).length > 0 && (
        <section className="bg-white border border-gray-200 rounded-xl p-4 mt-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Sales by product</h2>
          {Object.entries(data.salesByProduct).sort((a, b) => b[1].amount - a[1].amount).map(([name, s]) => (
            <div key={name} className="flex justify-between text-sm py-1.5 border-b border-gray-100 last:border-0">
              <span className="text-gray-700">{name}</span><span className="text-gray-900 font-semibold tabular-nums">{s.count} × · {rupees(s.amount)}</span>
            </div>
          ))}
        </section>
      )}

      <div className="flex gap-2 mt-6 mb-3">
        {[['users', `Users (${data.users.length})`], ['payments', `Payments (${data.payments.length})`], ['invites', `Invites (${data.invites.length})`]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`text-sm font-semibold px-3 py-2 rounded-lg border ${tab === k ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600'}`}>{l}</button>
        ))}
      </div>

      {openUser && <UserDetail email={openUser} onClose={() => setOpenUser(null)} />}

      {tab === 'users' && (
        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex gap-2 p-3 border-b border-gray-200">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search email or name" className="flex-1 min-w-0 h-10 px-3 rounded-lg bg-gray-50 border border-gray-200 text-sm" />
            <button onClick={() => downloadCsv(users)} className="text-sm font-semibold border border-gray-200 text-gray-700 px-3 rounded-lg whitespace-nowrap">Download CSV</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                {['User', 'Joined', 'Level', 'SQ / BP / DL', 'Pro', 'Blocks', 'Sessions', 'Last trained', 'Guides', 'Paid'].map((h) => <th key={h} className="px-3 py-2 font-medium whitespace-nowrap">{h}</th>)}
              </tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.email} onClick={() => setOpenUser(u.email)} className="border-b border-gray-100 last:border-0 align-top cursor-pointer hover:bg-gray-50">
                    <td className="px-3 py-2"><span className="block text-gray-900 font-medium underline decoration-dotted">{u.name || '—'}</span><span className="block text-xs text-gray-500">{u.email}</span></td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">{day(u.joined)}</td>
                    <td className="px-3 py-2 text-gray-600">{u.level || '—'}{u.days ? ` · ${u.days}d` : ''}</td>
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums text-gray-600">{u.squat || '—'} / {u.bench || '—'} / {u.deadlift || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{u.proUntil ? <span className={u.proType === 'invite' ? 'text-blue-600' : 'text-green-600'}>{u.proType === 'invite' ? 'Invite' : 'Paid'} → {day(u.proUntil)}</span> : <span className="text-gray-400">Free</span>}</td>
                    <td className="px-3 py-2 tabular-nums text-gray-600">{u.blocks}</td>
                    <td className="px-3 py-2 tabular-nums text-gray-600">{u.sessions}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">{day(u.lastSession)}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">{u.guides.join(', ') || '—'}</td>
                    <td className="px-3 py-2 tabular-nums text-gray-900">{u.spent ? rupees(u.spent) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'payments' && (
        <section className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          {data.payments.length === 0 ? <p className="p-6 text-sm text-gray-500">No payments yet.</p> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-200">{['Date', 'Buyer', 'Product', 'Amount', 'PayU ID'].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
              <tbody>{data.payments.map((p) => (
                <tr key={p.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-3 py-2 whitespace-nowrap text-gray-600">{day(p.when)}</td>
                  <td className="px-3 py-2 text-gray-900">{p.email}</td>
                  <td className="px-3 py-2 text-gray-600">{p.product}</td>
                  <td className="px-3 py-2 tabular-nums text-gray-900">{rupees(p.amount)}</td>
                  <td className="px-3 py-2 text-xs font-mono text-gray-400">{p.id}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </section>
      )}

      {tab === 'invites' && (
        <section className="space-y-3">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-gray-900">New invite code — 1 free month of Pro per person</h2>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_7rem_1fr_auto] gap-2 mt-3">
              <input value={inv.code} onChange={(e) => setInv({ ...inv, code: e.target.value.toUpperCase() })} placeholder="CODE e.g. GYM-TEST-01" className="h-10 px-3 rounded-lg bg-gray-50 border border-gray-200 text-sm font-mono" />
              <input value={inv.maxUses} onChange={(e) => setInv({ ...inv, maxUses: e.target.value })} inputMode="numeric" placeholder="People" aria-label="How many people" className="h-10 px-3 rounded-lg bg-gray-50 border border-gray-200 text-sm" />
              <input value={inv.note} onChange={(e) => setInv({ ...inv, note: e.target.value })} placeholder="Note (who it's for)" className="h-10 px-3 rounded-lg bg-gray-50 border border-gray-200 text-sm" />
              <button onClick={createInvite} disabled={!inv.code} className="h-10 px-4 rounded-lg bg-gray-900 text-white text-sm font-semibold disabled:opacity-50">Create</button>
            </div>
            {invMsg && <p className={`text-sm mt-2 ${invMsg.ok ? 'text-green-600' : 'text-red-600'}`}>{invMsg.text}</p>}
          </div>
          {data.invites.map((c) => (
            <div key={c.code} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-mono font-semibold text-gray-900">{c.code} {!c.is_active && <span className="text-xs font-sans text-red-600">· stopped</span>}</p>
                  <p className="text-xs text-gray-500">{c.uses} / {c.max_uses} used{c.note ? ` · ${c.note}` : ''}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => copyLink(c.code)} className="text-xs font-semibold border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg">Copy invite link</button>
                  <button onClick={() => setActive(c.code, !c.is_active)} className="text-xs font-semibold border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg">{c.is_active ? 'Stop' : 'Restart'}</button>
                </div>
              </div>
              {c.usedBy.length > 0 && <p className="text-xs text-gray-500 mt-2">Used by: {c.usedBy.map((r) => r.email).join(', ')}</p>}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
