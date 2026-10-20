// Cloudflare Pages: runs the same /api handlers as Vercel (api/*.js), unchanged.
// Each handler is written for Vercel's Node-style (req, res); this file gives it a small
// req/res adapter and turns the result into a Fetch Response. Nothing in api/ needs to know
// which host it is running on, so the app can live on either while we switch.

const ROUTES = {
  'admin': () => import('../../api/admin.js'),
  'download-guide': () => import('../../api/download-guide.js'),
  'generate-program': () => import('../../api/generate-program.js'),
  'redeem-invite': () => import('../../api/redeem-invite.js'),
  'remove-workout': () => import('../../api/remove-workout.js'),
  'save-workout': () => import('../../api/save-workout.js'),
  'weekly-checkin': () => import('../../api/weekly-checkin.js'),
  'payments/create-order': () => import('../../api/payments/create-order.js'),
  'payments/payu-callback': () => import('../../api/payments/payu-callback.js'),
  'payments/verify-status': () => import('../../api/payments/verify-status.js'),
};

// Server secrets the handlers read from process.env (set in Cloudflare → Settings → Variables and Secrets).
const ENV_KEYS = ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'PAYMENT_PROVIDER', 'PAYU_KEY', 'PAYU_SALT', 'PAYU_MODE', 'OWNER_EMAIL', 'OWNER_USER_ID'];

async function readBody(request) {
  if (request.method === 'GET' || request.method === 'HEAD') return undefined;
  const type = request.headers.get('content-type') || '';
  const text = await request.text();
  if (!text) return undefined;
  // Same parsing Vercel does: JSON and form posts (PayU posts its callback as a form) become objects.
  if (type.includes('application/json')) { try { return JSON.parse(text); } catch { return text; } }
  if (type.includes('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(text));
  return text;
}

export async function onRequest({ request, env, params }) {
  const path = [].concat(params.path || []).join('/');
  const load = ROUTES[path];
  if (!load) return Response.json({ error: 'Not found' }, { status: 404 });

  // The handlers create their Supabase client when the module loads, so env must be set before the import.
  globalThis.process = globalThis.process || { env: {} };
  process.env = process.env || {};
  for (const k of ENV_KEYS) if (env[k] !== undefined) process.env[k] = env[k];

  const url = new URL(request.url);
  const headers = Object.fromEntries([...request.headers].map(([k, v]) => [k.toLowerCase(), v]));
  headers.host = headers.host || url.host;
  headers['x-forwarded-proto'] = headers['x-forwarded-proto'] || url.protocol.replace(':', '');
  const req = { method: request.method, headers, query: Object.fromEntries(url.searchParams), body: await readBody(request), url: url.pathname + url.search };

  let status = 200, outHeaders = {}, body = null;
  const res = {
    status(code) { status = code; return res; },
    setHeader(k, v) { outHeaders[k] = v; return res; },
    json(obj) { outHeaders['Content-Type'] = 'application/json'; body = JSON.stringify(obj); return res; },
    send(data) { body = typeof data === 'string' ? data : JSON.stringify(data); return res; },
    writeHead(code, h = {}) { status = code; Object.assign(outHeaders, h); return res; },
    end(data) { if (data !== undefined) body = data; return res; },
  };

  const mod = await load();
  await mod.default(req, res);
  return new Response(body, { status, headers: outHeaders });
}
