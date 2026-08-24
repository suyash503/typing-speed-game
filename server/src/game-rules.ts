export const GAME_LENGTH = 20;
export const PENALTY_MS = 500;

// Nobody clears 20 characters in under a fifth of a second, and nothing legitimate
// runs past ten minutes. These bounds only exist so a hand-written mutation can't
// drop a 1ms world record onto the leaderboard - it's a sanity check, not anti-cheat.
const MIN_MS_PER_CHAR = 10;
const MAX_DURATION_MS = 10 * 60 * 1000;

export type Submission = {
  durationMs: number;
  mistakes: number;
  charCount: number;
};

export function penaltyFor(mistakes: number): number {
  return mistakes * PENALTY_MS;
}

// Returns a human-readable reason the submission is bogus, or null if it looks fine.
export function checkSubmission(s: Submission): string | null {
  if (s.charCount !== GAME_LENGTH) {
    return `A round is ${GAME_LENGTH} characters, but this result claims ${s.charCount}.`;
  }
  if (s.mistakes < 0 || !Number.isInteger(s.mistakes)) {
    return 'Mistakes must be a whole number of zero or more.';
  }
  if (!Number.isInteger(s.durationMs) || s.durationMs <= 0) {
    return 'Duration must be a positive whole number of milliseconds.';
  }

  const penalty = penaltyFor(s.mistakes);
  if (s.durationMs < penalty) {
    return 'Duration must include the time penalty for every mistake.';
  }

  // Compare typing time only - the penalty is dead time, not typing speed.
  const typingMs = s.durationMs - penalty;
  if (typingMs < s.charCount * MIN_MS_PER_CHAR) {
    return 'That result is faster than humanly possible.';
  }
  if (s.durationMs > MAX_DURATION_MS) {
    return 'That round took too long to be a valid result.';
  }

  return null;
}
