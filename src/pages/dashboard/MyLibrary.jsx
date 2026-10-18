import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';

export default function MyLibrary() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [ownedIds, setOwnedIds] = useState([]);
  const [downloadedVersions, setDownloadedVersions] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [downloadingId, setDownloadingId] = useState(null);
  const [expandedHistory, setExpandedHistory] = useState(null);

  useEffect(() => {
    const fetchLibrary = async () => {
      const { data: prods } = await supabase.from('products').select('id, name, short_description, version, cover_image_url, price_cents, release_notes, updated_at').eq('type', 'pdf_guide').eq('is_active', true);
      const { data: purchases } = await supabase.from('purchases').select('product_id').eq('user_id', user.id);
      const { data: history } = await supabase.from('download_history').select('product_id, version_string, downloaded_at').eq('user_id', user.id).order('downloaded_at', { ascending: false });

      const versionMap = {};
      (history || []).forEach(h => { if (!versionMap[h.product_id]) { versionMap[h.product_id] = h.version_string; } });

      setProducts(prods || []);
      setOwnedIds((purchases || []).map(p => p.product_id));
      setDownloadedVersions(versionMap);
      setLoading(false);
    };
    fetchLibrary();
  }, [user]);

  const handleDownload = async (productId) => {
    setDownloadingId(productId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/download-guide', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const link = document.createElement('a');
      link.href = data.downloadUrl;
      link.download = data.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setDownloadedVersions(prev => ({ ...prev, [productId]: products.find(p => p.id === productId)?.version }));
    } catch (err) {
      alert(err.message);
    } finally {
      setDownloadingId(null);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const isOwned = ownedIds.includes(p.id);
    const matchesFilter = filter === 'all' || (filter === 'owned' && isOwned) || (filter === 'locked' && !isOwned);
    return matchesSearch && matchesFilter;
  });

  if (loading) return <div className="flex justify-center min-h-[60vh] items-center"><div className="animate-spin h-8 w-8 border-2 border-gray-900 rounded-full border-t-transparent"></div></div>;

  const isNewRelease = (updatedAt) => { const daysSinceUpdate = (new Date() - new Date(updatedAt)) / (1000 * 60 * 60 * 24); return daysSinceUpdate <= 7; };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 tracking-tight">My Library</h1>
          <p className="text-gray-500 mt-1">Your premium digital guides and resources.</p>
        </div>
        <div className="flex gap-3">
          <input type="text" placeholder="Search guides..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 w-full md:w-64" />
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
            <option value="all">All</option><option value="owned">Owned</option><option value="locked">Locked</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProducts.map((product, idx) => {
          const isOwned = ownedIds.includes(product.id);
          const isNew = isNewRelease(product.updated_at);
          const hasUpdate = isOwned && downloadedVersions[product.id] && downloadedVersions[product.id] !== product.version;
          const releaseNotes = product.release_notes || [];
          return (
            <motion.div key={product.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }} className={`bg-white rounded-2xl border ${isOwned ? 'border-gray-200 shadow-sm' : 'border-gray-100 shadow-sm'} overflow-hidden flex flex-col`}>
              <div className="h-52 bg-gray-100 relative overflow-hidden">
                {product.cover_image_url ? <img src={product.cover_image_url} alt={product.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900"><span className="text-white font-bold text-xl tracking-wider">LALITLIFTS</span></div>}
                <div className="absolute top-3 right-3 flex flex-col gap-2 items-end">
                  {isOwned && <span className="px-2.5 py-1 text-xs font-semibold rounded-full backdrop-blur-md bg-green-500/90 text-white">Owned</span>}
                  {!isOwned && <span className="px-2.5 py-1 text-xs font-semibold rounded-full backdrop-blur-md bg-black/50 text-white border border-white/20">Locked</span>}
                  {isNew && <span className="px-2.5 py-1 text-xs font-semibold rounded-full backdrop-blur-md bg-blue-500/90 text-white">New</span>}
                  {hasUpdate && <span className="px-2.5 py-1 text-xs font-semibold rounded-full backdrop-blur-md bg-amber-500/90 text-white">Update Available</span>}
                </div>
              </div>
              <div className="p-6 flex-1 flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-gray-400 uppercase tracking-wider">v{product.version}</span>
                  <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                  <span className="text-xs text-gray-400">Updated {new Date(product.updated_at).toLocaleDateString()}</span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{product.name}</h3>
                <p className="text-sm text-gray-500 mb-4 flex-1 line-clamp-2">{product.short_description || "Premium powerlifting knowledge to elevate your training."}</p>
                {isOwned && releaseNotes.length > 0 && (
                  <div className="mb-4 border-t border-gray-100 pt-3">
                    <button onClick={() => setExpandedHistory(expandedHistory === product.id ? null : product.id)} className="w-full flex justify-between items-center text-xs font-medium text-gray-500 hover:text-gray-900">
                      <span>Version History</span>
                      <svg className={`w-4 h-4 transition-transform ${expandedHistory === product.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    <AnimatePresence>
                      {expandedHistory === product.id && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mt-2 space-y-2">
                          {releaseNotes.map((rn, i) => (
                            <div key={i} className="text-xs bg-gray-50 p-2 rounded border border-gray-100">
                              <div className="flex justify-between font-semibold text-gray-700"><span>v{rn.version}</span><span>{new Date(rn.date).toLocaleDateString()}</span></div>
                              <p className="text-gray-500 mt-1">{rn.notes}</p>
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
                {isOwned ? (
                  <button onClick={() => handleDownload(product.id)} disabled={downloadingId === product.id} className={`w-full py-3 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${hasUpdate ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-gray-900 hover:bg-gray-800 text-white'}`}>
                    {downloadingId === product.id ? <><div className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full"></div> Generating Link...</> : <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg> {hasUpdate ? 'Download Latest' : 'Download PDF'}</>}
                  </button>
                ) : (
                  <button onClick={() => navigate(`/dashboard/subscription?product=${encodeURIComponent(product.name)}`)} className="w-full bg-white border border-gray-300 hover:bg-gray-50 text-gray-900 py-3 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                    Buy for ₹{(product.price_cents / 100).toLocaleString('en-IN')} <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
