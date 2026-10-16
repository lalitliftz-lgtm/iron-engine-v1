/**
 * An unfinished workout is kept in this browser so leaving the logger (tapping
 * Program, a reload, the phone locking) never loses ticked sets. Cleared on
 * Finish or on a confirmed "leave without saving". No activity for 18 h = abandoned.
 */
const MAX_AGE = 18 * 3600 * 1000;
const key = (userId) => `ll-workout-draft-${userId}`;

export function readDraft(userId) {
  try {
    const d = JSON.parse(localStorage.getItem(key(userId)) || 'null');
    if (!d || !d.startedAt || Date.now() - (d.lastActiveAt || d.startedAt) > MAX_AGE) return null;
    return d;
  } catch { return null; }
}

export function saveDraft(userId, draft) {
  try { localStorage.setItem(key(userId), JSON.stringify(draft)); } catch { /* storage blocked: logger still works, just no resume */ }
}

export function clearDraft(userId) {
  try { localStorage.removeItem(key(userId)); } catch { /* ignore */ }
}

/** Ticked sets in a draft — shown on Today's "resume" card. */
export const draftSetsDone = (d) => (d?.exercises || []).reduce((n, ex) => n + (ex.loggedSets || []).filter((s) => s.completed).length, 0);
