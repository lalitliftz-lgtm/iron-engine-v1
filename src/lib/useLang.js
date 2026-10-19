import { useEffect, useState } from 'react';
import { getLang, setLang, LANG_EVENT, EDU_TEXT } from './education';

/** App language ('en' | 'hi' = Hinglish), shared by every screen.
 *  `L(en, hi)` picks the text for the current language (falls back to English when no Hinglish is given). */
export function useLang() {
  const [lang, set] = useState(getLang);
  useEffect(() => {
    const on = () => set(getLang());
    window.addEventListener(LANG_EVENT, on);
    return () => window.removeEventListener(LANG_EVENT, on);
  }, []);
  const L = (en, hi) => (lang === 'hi' && hi ? hi : en);
  return { lang, t: EDU_TEXT[lang], L, toggle: () => setLang(lang === 'hi' ? 'en' : 'hi'), setLang };
}
