import { useEffect, useState } from 'react';
import { getLang, setLang, LANG_EVENT, EDU_TEXT } from './education';

/** Coaching-text language ('en' | 'hi' = Hinglish), shared by every component that shows tips. */
export function useLang() {
  const [lang, set] = useState(getLang);
  useEffect(() => {
    const on = () => set(getLang());
    window.addEventListener(LANG_EVENT, on);
    return () => window.removeEventListener(LANG_EVENT, on);
  }, []);
  return { lang, t: EDU_TEXT[lang], toggle: () => setLang(lang === 'hi' ? 'en' : 'hi'), setLang };
}
