export const GAME_LENGTH = 20;
export const PENALTY_MS = 500;

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const BEST_KEY = 'tsg.best';

export function makeSequence(length = GAME_LENGTH): string[] {
  return Array.from(
    { length },
    () => LETTERS[Math.floor(Math.random() * LETTERS.length)],
  );
}

export function formatMs(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

// The spec asks for the best score to live in localStorage, so this is the source
// of truth on first paint. App.tsx reconciles it with the server score afterwards,
// since the server knows about rounds played on other machines.
export function readLocalBest(): number | null {
  const raw = localStorage.getItem(BEST_KEY);
  if (!raw) return null;

  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function writeLocalBest(ms: number) {
  localStorage.setItem(BEST_KEY, String(ms));
}
