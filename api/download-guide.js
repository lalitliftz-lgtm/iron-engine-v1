import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const token = req.headers.authorization?.split(' ')[1];
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Unauthorized' });

    const { productId } = req.body;
    if (!productId) return res.status(400).json({ error: 'Product ID is required' });

    const { data: product, error: prodError } = await supabaseAdmin.from('products').select('id, name, storage_path, version').eq('id', productId).single();
    if (prodError || !product) return res.status(404).json({ error: 'Product not found' });

    const { data: ownership, error: ownError } = await supabaseAdmin.from('purchases').select('id').eq('user_id', user.id).eq('product_id', productId).limit(1).maybeSingle();

    if (ownError || !ownership) return res.status(403).json({ error: 'FORBIDDEN: You do not own this product.' });

    await supabaseAdmin.from('download_history').insert({ user_id: user.id, product_id: productId, version_string: product.version });

    const { data: signedUrlData, error: urlError } = await supabaseAdmin.storage.from('pdf_guides').createSignedUrl(product.storage_path, 300);
    if (urlError || !signedUrlData) throw urlError;

    return res.status(200).json({ success: true, downloadUrl: signedUrlData.signedUrl, fileName: `${product.name}.pdf` });

  } catch (error) {
    console.error('Download API Error:', error);
    return res.status(500).json({ error: 'Failed to generate download link' });
  }
}
