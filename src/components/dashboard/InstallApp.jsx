import { useEffect, useState } from 'react';
import { useLang } from '../../lib/useLang';

// Android/desktop Chrome fires this once, early — keep it for when the Account page asks.
let deferred = null;
if (typeof window !== 'undefined') window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; });

const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

/** "Add to Home Screen" card: opens full screen like an app, icon on the phone. Hidden once installed. */
export default function InstallApp() {
  const { L } = useLang();
  const [canPrompt, setCanPrompt] = useState(!!deferred);
  const [done, setDone] = useState(standalone());

  useEffect(() => {
    const onPrompt = () => setCanPrompt(true);
    const onInstalled = () => setDone(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);

  if (done) return null;
  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    const { outcome } = await deferred.userChoice.catch(() => ({}));
    if (outcome === 'accepted') setDone(true);
    deferred = null; setCanPrompt(false);
  };

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-5">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{L('Use it like an app', 'Isse app ki tarah use karo')}</h2>
      <p className="text-sm text-gray-500 mb-3">{L('Put LalitLifts on your home screen — opens full screen, one tap from the gym floor.', 'LalitLifts ko home screen pe daalo — full screen khulega, gym mein bas ek tap door.')}</p>
      {canPrompt ? (
        <button onClick={install} className="bg-gray-900 text-white px-4 py-2.5 rounded-lg text-sm font-semibold">{L('Install app', 'App install karo')}</button>
      ) : isIOS() ? (
        <p className="text-sm text-gray-700">{L(<>In Safari tap <b>Share</b> (square with arrow) → <b>Add to Home Screen</b>.</>, <>Safari mein <b>Share</b> (arrow wala square) tap karo → <b>Add to Home Screen</b>.</>)}</p>
      ) : (
        <p className="text-sm text-gray-700">{L(<>In Chrome open the <b>⋮ menu</b> → <b>Add to Home screen</b> / <b>Install app</b>.</>, <>Chrome mein <b>⋮ menu</b> kholo → <b>Add to Home screen</b> / <b>Install app</b>.</>)}</p>
      )}
    </section>
  );
}
