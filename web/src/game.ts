export const GAME_LENGTH = 20;
export const PENALTY_MS = 500;

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Keyed per user. A single shared key meant that signing out and into another
// account on the same browser showed the previous player's best score.
const bestKey = (userId: string) => `tsg.best:${userId}`;

export function makeSequence(length = GAME_LENGTH): string[] {
  return Array.from(
    { length },
    () => LETTERS[Math.floor(Math.random() * LETTERS.length)],
  );
}

export function formatMs(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

// The spec asks for the best score to live in localStorage, so this is what the
// game shows first. App.tsx reconciles it with the server on load, since the
// server knows about rounds played in other browsers.
export function readLocalBest(userId: string): number | null {
  const raw = localStorage.getItem(bestKey(userId));
  if (!raw) return null;

  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function writeLocalBest(userId: string, ms: number) {
  localStorage.setItem(bestKey(userId), String(ms));
}
