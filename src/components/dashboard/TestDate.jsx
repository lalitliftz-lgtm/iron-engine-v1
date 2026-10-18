import { useState } from 'react';
import { testToday, setTestToday } from '../../lib/schedule';

const FLAG = 'll-testmode';
const flagOn = () => {
  try {
    if (new URLSearchParams(window.location.search).get('testmode') === '1') localStorage.setItem(FLAG, '1');
    return localStorage.getItem(FLAG) === '1';
  } catch { return false; }
};

// Hidden switch without a URL (installed home-screen app has no address bar):
// tap the "Account" heading 5 times quickly to show or hide the Testing card.
let taps = [];
export function tapForTestMode() {
  const now = Date.now();
  taps = [...taps.filter((t) => now - t < 3000), now];
  if (taps.length < 5) return;
  taps = [];
  try {
    if (localStorage.getItem(FLAG) === '1') { localStorage.removeItem(FLAG); setTestToday(null); } else localStorage.setItem(FLAG, '1');
  } catch { /* storage blocked */ }
  window.location.reload();
}

/**
 * Coach testing tool (hidden): open any dashboard page with ?testmode=1, or tap "Account" 5 times.
 * "Pretend today is…" moves the app's calendar so a whole block can be walked through in one sitting.
 * Only this browser is affected. Workouts saved in test mode still carry the real time.
 */
export function TestDateCard() {
  const [on] = useState(flagOn);
  const [val, setVal] = useState(testToday() || '');
  if (!on) return null;
  const apply = (v) => { setTestToday(v || null); window.location.reload(); };
  const shift = (n) => {
    const base = val ? new Date(`${val}T12:00:00`) : new Date();
    base.setDate(base.getDate() + n);
    apply(`${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`);
  };
  return (
    <section className="bg-white border border-amber-300 rounded-xl p-5">
      <h2 className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">Testing · pretend today is</h2>
      <p className="text-sm text-gray-500 mb-3">Walk through a block day by day. Only this browser sees it; real users are not affected.</p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => shift(-1)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700">−1 day</button>
        <input type="date" id="test-date" value={val} onChange={(e) => setVal(e.target.value)} className="h-10 px-3 bg-gray-50 border border-gray-200 rounded-lg text-sm" />
        <button type="button" onClick={() => shift(1)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700">+1 day</button>
        <button type="button" onClick={() => apply(val)} disabled={!val} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold disabled:opacity-40">Apply</button>
        {testToday() && <button type="button" onClick={() => apply(null)} className="px-3 py-2 text-sm font-semibold text-red-600">Back to real date</button>}
      </div>
    </section>
  );
}

/** Thin bar on every dashboard page while a test date is active, so it's never mistaken for real. */
export function TestDateBanner() {
  flagOn(); // ?testmode=1 works on any dashboard page (it survives the login redirect less often than you'd hope)
  const t = testToday();
  if (!t) return null;
  const label = new Date(`${t}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  return (
    <div className="bg-amber-50 border-b border-amber-300 text-amber-700 text-xs font-semibold px-4 py-2 flex items-center justify-between gap-3">
      <span>TEST MODE · the app thinks today is {label}</span>
      <button type="button" onClick={() => { setTestToday(null); window.location.reload(); }} className="underline">Back to real date</button>
    </div>
  );
}
