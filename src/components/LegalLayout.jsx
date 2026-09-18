import Footer from './Footer';
import { Link } from 'react-router-dom';

export default function LegalLayout({ title, lastUpdated, children }) {
  const formattedDate = lastUpdated 
    ? new Date(lastUpdated).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 flex justify-between items-center">
          <Link to="/" className="tracking-tight" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
            <span className="text-chalk">LALIT</span><span style={{ color: "#C8102E" }}>LIFTS</span>
          </Link>
          <Link to="/" className="text-sm text-dim hover:text-chalk font-medium">← Back to home</Link>
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 md:px-8 py-12 md:py-16">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Legal</p>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight mb-2">{title}</h1>
        {formattedDate && <p className="text-sm text-gray-500 mb-10">Last updated: {formattedDate}</p>}
        
        <div className="prose prose-sm md:prose-base max-w-none text-gray-600 space-y-6 leading-relaxed">
          {children}
        </div>
      </main>

      <Footer />
    </div>
  );
}
