import { Suspense } from 'react';
import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import Footer from '../Footer';
import { TestDateBanner } from './TestDate';

// Four places a lifter actually goes. Everything else lives inside one of them.
const TABS = [
  { to: '/dashboard', label: 'Today', end: true, icon: 'M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10' },
  { to: '/dashboard/programs', label: 'Program', icon: 'M4 5h16M4 10h16M4 15h10M4 20h7' },
  { to: '/dashboard/history', label: 'History', icon: 'M12 8v4l3 2M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5' },
  { to: '/dashboard/account', label: 'Account', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0' },
];
// Pages reached from inside a tab still light up their parent tab.
const PARENT = { '/dashboard/generate': '/dashboard/programs', '/dashboard/checkin': '/dashboard', '/dashboard/workout': '/dashboard', '/dashboard/assessment': '/dashboard/account', '/dashboard/subscription': '/dashboard/account', '/dashboard/products': '/dashboard/account', '/dashboard/library': '/dashboard/account', '/dashboard/athlete-profile': '/dashboard/account', '/dashboard/settings': '/dashboard/account' };

function Icon({ d }) {
  return <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>;
}

export default function DashboardLayout() {
  const { pathname } = useLocation();
  const parent = PARENT[Object.keys(PARENT).find((p) => pathname.startsWith(p))];
  const isActive = (t, navActive) => navActive || parent === t.to;
  // Focused flows (logging a workout, filling the assessment) hide the tab bar.
  const inWorkout = pathname.startsWith('/dashboard/workout') || pathname.startsWith('/dashboard/assessment');

  const Brand = (
    <Link to="/" className="text-2xl no-underline" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
      <span className="text-chalk">LALIT</span><span style={{ color: '#C8102E' }}>LIFTS</span>
    </Link>
  );

  return (
    <div className="min-h-screen bg-iron flex flex-col md:flex-row" style={{ fontFamily: "'Barlow', sans-serif" }}>
      {/* Phone: brand bar on top, tabs at the bottom (thumb reach in the gym) */}
      {!inWorkout && <div className="md:hidden bg-steel border-b border-line px-4 py-3">{Brand}</div>}

      {/* Laptop: slim sidebar */}
      <aside className="hidden md:flex w-56 bg-steel border-r border-line flex-col">
        <div className="p-5 border-b border-line">{Brand}</div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end}
              className={({ isActive: a }) => `flex items-center gap-3 py-2.5 px-3 rounded-lg text-sm font-semibold transition ${isActive(t, a) ? 'bg-steel2 text-chalk' : 'text-knurl hover:bg-steel2 hover:text-chalk'}`}>
              {({ isActive: a }) => (<><span className={isActive(t, a) ? 'text-red-500' : ''}><Icon d={t.icon} /></span>{t.label}</>)}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className={`flex-1 overflow-y-auto flex flex-col bg-iron ${inWorkout ? '' : 'pb-20 md:pb-0'}`}>
        <TestDateBanner />
        <div className="flex-1"><Suspense fallback={<div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-2 border-gray-900 rounded-full border-t-transparent" /></div>}><Outlet /></Suspense></div>
        <div className="hidden md:block"><Footer /></div>
      </main>

      {!inWorkout && (
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-steel border-t border-line grid grid-cols-4" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }} aria-label="Main">
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end}
              className={({ isActive: a }) => `flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold ${isActive(t, a) ? 'text-red-500' : 'text-knurl'}`}>
              <Icon d={t.icon} />{t.label}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
