import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { useLang } from '../../lib/useLang';

export default function MyProducts() {
  const { user } = useAuth();
  const { L } = useLang();
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

  if (loading) return <div>{L('Loading...', 'Load ho raha hai...')}</div>;

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-800 mb-6">{L('My Products', 'Mere Products')}</h2>
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        {products.length === 0 ? <div className="p-6 text-center text-gray-500">{L("You haven't purchased any products yet.", 'Aapne abhi tak koi product nahi kharida.')}</div> : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-4 font-medium text-gray-600">{L('Product', 'Product')}</th>
                <th className="p-4 font-medium text-gray-600">{L('Type', 'Type')}</th>
                <th className="p-4 font-medium text-gray-600">{L('Status', 'Status')}</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="p-4 text-gray-800">{p.name}</td>
                  <td className="p-4 text-gray-600">{p.type === 'Subscription' ? L('Subscription', 'Subscription') : p.type === 'PDF Guide' ? L('PDF Guide', 'PDF Guide') : p.type}</td>
                  <td className="p-4"><span className={`px-2 py-1 text-xs rounded-full ${p.status === 'active' || p.status === 'Owned' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{p.status === 'Owned' ? L('Owned', 'Kharida hua') : p.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
