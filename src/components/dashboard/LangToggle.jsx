import { useLang } from '../../lib/useLang';

/** Small "Hinglish mein padho / Read in English" switch next to coaching text. */
export default function LangToggle({ className = '' }) {
  const { t, toggle } = useLang();
  return (
    <button type="button" onClick={toggle} className={`text-[11px] font-semibold text-blue-600 border border-blue-100 bg-blue-50 rounded-full px-2.5 py-0.5 ${className}`}>
      अ / A · {t.switchTo}
    </button>
  );
}
