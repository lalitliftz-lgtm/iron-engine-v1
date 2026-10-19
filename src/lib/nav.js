/** "/dashboard/subscription?x=1" + { product: "A B" } → "/dashboard/subscription?x=1&product=A%20B" (empty values skipped). */
export function withParams(path, params = {}) {
  const u = new URL(path || '/dashboard', 'https://x.invalid');
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== '') u.searchParams.set(k, v);
  return u.pathname + u.search;
}

/** Only same-site paths are followed after login (no open redirect to another website). */
export const safeNext = (v) => (typeof v === 'string' && v.startsWith('/') && !v.startsWith('//') ? v : '/dashboard');
