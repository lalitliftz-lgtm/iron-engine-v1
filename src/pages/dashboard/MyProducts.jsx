import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

export default function MyProducts() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      const { data: subData } = await supabase.from('subscriptions').select('product_id, products(name), status, end_date').eq('user_id', user.id);
      const { data: purchData } = await supabase.from('purchases').select('product_id, products(name)').eq('user_id', user.id);
      const combined = [
        ...(subData || []).map(s => ({ type: 'Subscription', name: s.products?.name, status: s.status, expiry: s.end_date })),
        ...(purchData || []).map(p => ({ type: 'PDF Guide', name: p.products?.name, status: 'Owned', expiry: null }))
      ];
      setProducts(combined);
      setLoading(false);
    };
    fetchProducts();
  }, [user]);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-800 mb-6">My Products</h2>
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        {products.length === 0 ? <div className="p-6 text-center text-gray-500">You haven't purchased any products yet.</div> : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-4 font-medium text-gray-600">Product</th>
                <th className="p-4 font-medium text-gray-600">Type</th>
                <th className="p-4 font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="p-4 text-gray-800">{p.name}</td>
                  <td className="p-4 text-gray-600">{p.type}</td>
                  <td className="p-4"><span className={`px-2 py-1 text-xs rounded-full ${p.status === 'active' || p.status === 'Owned' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{p.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
