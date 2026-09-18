import { Link } from 'react-router-dom';

// Branded dark wrapper for Login / Signup / ForgotPassword.
export default function AuthShell({ title, subtitle, children }) {
  return (
    <div className="min-h-screen bg-iron flex flex-col items-center justify-center px-4 py-12"
         style={{ fontFamily: "'Barlow', sans-serif" }}>
      <Link to="/" className="mb-8 text-2xl no-underline" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
        <span className="text-chalk">LALIT</span><span style={{ color: '#C8102E' }}>LIFTS</span>
      </Link>
      <div className="max-w-md w-full bg-steel p-8 rounded-2xl border border-line shadow-xl">
        <h2 className="text-2xl text-chalk mb-1" style={{ fontFamily: "'Archivo Black', sans-serif" }}>{title}</h2>
        {subtitle && <p className="text-dim text-sm mb-6">{subtitle}</p>}
        {children}
      </div>
      <Link to="/" className="mt-6 text-dim text-sm hover:text-chalk">← Back to lalitlifts</Link>
    </div>
  );
}
