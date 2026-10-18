import { useState } from 'react';
import { nextLesson, markLessonSeen, LESSONS_HI } from '../../lib/education';
import { useLang } from '../../lib/useLang';
import LangToggle from './LangToggle';
import { appNow } from '../../lib/schedule';

const DAY_KEY = 'll-lesson-day';
const todayKey = () => appNow().toDateString();

/** One short coaching tip a day for new lifters, until they've seen them all. "Got it" = see you tomorrow. */
export default function LessonCard() {
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(DAY_KEY) === todayKey(); } catch { return false; } });
  const { lang, t } = useLang();
  const base = nextLesson();
  const lesson = base && lang === 'hi' ? { ...base, ...LESSONS_HI[base.i] } : base;
  if (!lesson || hidden) return null;
  const done = () => {
    markLessonSeen(lesson.i);
    try { localStorage.setItem(DAY_KEY, todayKey()); } catch { /* storage blocked */ }
    setHidden(true);
  };
  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">{t.tip} · {lesson.n} / {lesson.of}</p>
        <LangToggle className="shrink-0" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mt-1">{lesson.t}</h3>
      <p className="text-sm text-gray-600 mt-1 leading-relaxed">{lesson.b}</p>
      <button type="button" onClick={done} className="mt-3 text-sm font-semibold border border-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50">{t.gotIt}</button>
    </section>
  );
}
