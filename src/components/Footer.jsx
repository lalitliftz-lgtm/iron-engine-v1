import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-iron border-t border-line mt-auto">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-dim">
            <span style={{ fontFamily: "'Archivo Black', sans-serif" }}>
              <span className="text-chalk">LALIT</span><span style={{ color: '#C8102E' }}>LIFTS</span>
            </span>
            <span className="ml-2">© {new Date().getFullYear()} · All rights reserved.</span>
          </p>
          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-dim">
            <Link to="/privacy-policy" className="hover:text-chalk transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-chalk transition-colors">Terms &amp; Conditions</Link>
            <Link to="/refund-policy" className="hover:text-chalk transition-colors">Refund Policy</Link>
            <Link to="/disclaimer" className="hover:text-chalk transition-colors">Disclaimer</Link>
            <Link to="/contact" className="hover:text-chalk transition-colors">Contact</Link>
            <Link to="/about" className="hover:text-chalk transition-colors">About</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
