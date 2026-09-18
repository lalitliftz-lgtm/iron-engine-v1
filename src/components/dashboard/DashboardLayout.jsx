import { useState } from 'react';
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Footer from '../Footer';

export default function DashboardLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const navLinkClass = ({ isActive }) =>
    `block py-2.5 px-4 rounded-lg text-sm font-semibold transition duration-200 ${
      isActive
        ? 'bg-red-600 text-white'
        : 'text-knurl hover:bg-steel2 hover:text-chalk'
    }`;

  const Brand = (
    <Link to="/" className="text-2xl no-underline" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
      <span className="text-chalk">LALIT</span><span style={{ color: '#C8102E' }}>LIFTS</span>
    </Link>
  );

  const links = [
    ['/dashboard', 'Overview', true],
    ['/dashboard/generate', 'Generate Program', false],
    ['/dashboard/subscription', 'My Subscription', false],
    ['/dashboard/products', 'My Products', false],
    ['/dashboard/library', 'My Library', false],
    ['/dashboard/athlete-profile', 'Athlete Profile', false],
    ['/dashboard/programs', 'Generated Programs', false],
    ['/dashboard/technique-lab', 'Technique Lab', false],
    ['/dashboard/history', 'Workout History', false],
    ['/dashboard/settings', 'Settings', false],
  ];

  return (
    <div className="min-h-screen bg-iron flex flex-col md:flex-row" style={{ fontFamily: "'Barlow', sans-serif" }}>
      {/* Mobile bar */}
      <div className="md:hidden bg-steel border-b border-line p-4 flex justify-between items-center">
        {Brand}
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-chalk focus:outline-none">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d={isSidebarOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
          </svg>
        </button>
      </div>

      <aside className={`w-64 bg-steel border-r border-line flex-col ${isSidebarOpen ? 'flex' : 'hidden'} md:flex`}>
        <div className="p-5 hidden md:block border-b border-line">{Brand}</div>
        <nav className="flex-1 px-3 py-4 space-y-1.5">
          {links.map(([to, label, end]) => (
            <NavLink key={to} to={to} end={end} className={navLinkClass} onClick={() => setIsSidebarOpen(false)}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-line">
          <p className="text-xs text-dim truncate mb-2">{user?.email}</p>
          <button onClick={handleSignOut}
            className="w-full border border-line hover:border-red-600 text-knurl hover:text-chalk py-2 px-4 rounded-lg text-sm font-semibold transition">
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 p-6 md:p-10 overflow-y-auto flex flex-col bg-iron">
        <div className="flex-1"><Outlet /></div>
        <Footer />
      </main>
    </div>
  );
}
