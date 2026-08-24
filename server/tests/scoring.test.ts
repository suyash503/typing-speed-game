import { describe, expect, test } from 'bun:test';
import { GAME_LENGTH, PENALTY_MS, checkSubmission, penaltyFor } from '../src/game-rules';

const validRound = { durationMs: 12_000, mistakes: 3, charCount: GAME_LENGTH };

describe('penaltyFor', () => {
  test('a clean round has no penalty', () => {
    expect(penaltyFor(0)).toBe(0);
  });

  test('each mistake costs half a second', () => {
    expect(penaltyFor(1)).toBe(PENALTY_MS);
    expect(penaltyFor(3)).toBe(1_500);
  });
});

describe('checkSubmission', () => {
  test('accepts a normal round', () => {
    expect(checkSubmission(validRound)).toBeNull();
  });

  test('accepts a round that is mostly penalty time', () => {
    // 4 mistakes = 2s of penalty, plus 500ms of actual typing.
    expect(checkSubmission({ durationMs: 2_500, mistakes: 4, charCount: GAME_LENGTH })).toBeNull();
  });

  test('rejects the wrong number of characters', () => {
    expect(checkSubmission({ ...validRound, charCount: 5 })).toMatch(/20 characters/);
  });

  test('rejects negative mistakes', () => {
    expect(checkSubmission({ ...validRound, mistakes: -1 })).toMatch(/whole number/);
  });

  test('rejects a fractional duration', () => {
    expect(checkSubmission({ ...validRound, durationMs: 1200.5 })).toMatch(/whole number/);
  });

  test('rejects a duration that does not cover the penalties', () => {
    // 3 mistakes is 1.5s of penalty on its own.
    expect(checkSubmission({ ...validRound, durationMs: 900 })).toMatch(/time penalty/);
  });

  test('rejects a superhuman time', () => {
    expect(checkSubmission({ durationMs: 100, mistakes: 0, charCount: GAME_LENGTH })).toMatch(
      /humanly possible/,
    );
  });

  test('rejects a round that ran for hours', () => {
    expect(checkSubmission({ ...validRound, durationMs: 60 * 60 * 1000 })).toMatch(/too long/);
  });
});
