/**
 * A short, in-memory record of what the player has been doing.
 *
 * ─── Why this exists ─────────────────────────────────────────────────────
 *
 * The queue stops advancing when the phone is locked, and that is a bug
 * nobody can watch happen: by definition the screen is off, and the one
 * machine that can reproduce it is someone's phone rather than a dev
 * machine. Three fixes have been aimed at it from reading code alone, and
 * each corrected something real without being the cause.
 *
 * So the player writes down what it does. Lock the phone, let a track end,
 * unlock, and the log says which steps ran and which never returned — the
 * difference between "the ending was never noticed", "the next track was
 * never asked for" and "it was asked for and never arrived".
 *
 * Kept in memory only. It is a diagnostic, not a feature, and it should cost
 * nothing when nobody is looking at it.
 */

const MAX_ENTRIES = 120;

const entries = [];
const listeners = new Set();

/** Wall-clock time, because the whole question is what happened when. */
const stamp = () => {
  const now = new Date();
  const pad = (n, w = 2) => String(n).padStart(w, "0");

  return (
    `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}` +
    `.${pad(now.getMilliseconds(), 3)}`
  );
};

export const logPlayer = (message, detail) => {
  entries.push({
    at: stamp(),
    message,
    detail: detail === undefined ? "" : String(detail),
  });

  // Oldest first out, so a long session cannot grow without bound.
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);

  listeners.forEach((fn) => fn());
};

export const getPlayerLog = () => entries.slice().reverse();

export const clearPlayerLog = () => {
  entries.length = 0;
  listeners.forEach((fn) => fn());
};

/** Lets an open log screen redraw as new lines arrive. */
export const subscribeToPlayerLog = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
