import { useEffect, useRef, useState } from 'react';
import { ApiError, gql } from '../api';
import {
  GAME_LENGTH,
  PENALTY_MS,
  formatMs,
  makeSequence,
  readLocalBest,
  writeLocalBest,
} from '../game';

const SUBMIT_GAME = /* GraphQL */ `
  mutation SubmitGame($input: SubmitGameInput!) {
    submitGame(input: $input) {
      isPersonalBest
      previousBestMs
      game {
        durationMs
        mistakes
      }
    }
  }
`;

type Status = 'idle' | 'playing' | 'done';

type Outcome = {
  durationMs: number;
  mistakes: number;
  isPersonalBest: boolean;
  previousBestMs: number | null;
};

type Props = {
  best: number | null;
  onNewBest: (ms: number) => void;
  onFinished: () => void;
};

export function Game({ best, onNewBest, onFinished }: Props) {
  const [status, setStatus] = useState<Status>('idle');
  const [sequence, setSequence] = useState<string[]>(makeSequence);
  const [index, setIndex] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [wrong, setWrong] = useState(false);
  const [focused, setFocused] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const startedAt = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Elapsed time is always recomputed from the start timestamp rather than
  // accumulated per tick, so a throttled background tab can't skew the score.
  useEffect(() => {
    if (status !== 'playing') return;

    const id = setInterval(() => {
      setElapsed(performance.now() - startedAt.current + mistakes * PENALTY_MS);
    }, 50);

    return () => clearInterval(id);
  }, [status, mistakes]);

  useEffect(() => {
    if (status === 'playing') inputRef.current?.focus();
  }, [status]);

  function start() {
    setSequence(makeSequence());
    setIndex(0);
    setMistakes(0);
    setElapsed(0);
    setOutcome(null);
    setSaveError(null);
    setWrong(false);
    startedAt.current = performance.now();
    setStatus('playing');
  }

  async function finish(finalMistakes: number) {
    const durationMs = Math.round(
      performance.now() - startedAt.current + finalMistakes * PENALTY_MS,
    );

    setStatus('done');
    setElapsed(durationMs);

    const localBest = readLocalBest();
    const beatLocalBest = localBest === null || durationMs < localBest;
    if (beatLocalBest) {
      writeLocalBest(durationMs);
      onNewBest(durationMs);
    }

    // Show the round immediately using what we know locally, then let the server's
    // answer replace it - the server has the authoritative best across devices.
    setOutcome({
      durationMs,
      mistakes: finalMistakes,
      isPersonalBest: beatLocalBest,
      previousBestMs: localBest,
    });

    try {
      const data = await gql<{
        submitGame: { isPersonalBest: boolean; previousBestMs: number | null };
      }>(SUBMIT_GAME, {
        input: { durationMs, mistakes: finalMistakes, charCount: GAME_LENGTH },
      });

      setOutcome({
        durationMs,
        mistakes: finalMistakes,
        isPersonalBest: data.submitGame.isPersonalBest,
        previousBestMs: data.submitGame.previousBestMs,
      });
      onFinished();
    } catch (err) {
      setSaveError(
        err instanceof ApiError ? err.message : 'Could not save this round to the server.',
      );
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (status !== 'playing') return;

    // Ignore Shift, Tab, arrows and anything else that isn't a printable character.
    if (event.key.length !== 1 || event.ctrlKey || event.altKey || event.metaKey) return;
    event.preventDefault();

    if (event.key.toUpperCase() === sequence[index]) {
      const next = index + 1;
      setIndex(next);
      setWrong(false);
      if (next === GAME_LENGTH) void finish(mistakes);
      return;
    }

    const missed = mistakes + 1;
    setMistakes(missed);
    setWrong(true);
    window.setTimeout(() => setWrong(false), 200);
  }

  const playing = status === 'playing';

  return (
    <section className="card" onClick={() => inputRef.current?.focus()}>
      <input
        ref={inputRef}
        className="capture"
        // The game reads raw keystrokes, so the field itself stays empty. It exists
        // to own keyboard focus, which the browser will happily take away otherwise.
        value=""
        onChange={() => {}}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          if (playing) requestAnimationFrame(() => inputRef.current?.focus());
        }}
        aria-label="Typing input"
      />

      <div className="stats">
        <div>
          <span className="label">Time</span>
          <span className="value timer">{formatMs(elapsed)}</span>
        </div>
        <div>
          <span className="label">Progress</span>
          <span className="value">
            {index} / {GAME_LENGTH}
          </span>
        </div>
        <div>
          <span className="label">Mistakes</span>
          <span className="value">{mistakes}</span>
        </div>
        <div>
          <span className="label">Best</span>
          <span className="value">{best === null ? '--' : formatMs(best)}</span>
        </div>
      </div>

      {status === 'idle' && (
        <div className="stage">
          <p className="hint">
            Type the letter shown on screen. Every wrong key adds {PENALTY_MS / 1000} seconds.
          </p>
          <button className="primary" onClick={start}>
            Start game
          </button>
        </div>
      )}

      {playing && (
        <div className="stage">
          <div className={wrong ? 'letter shake' : 'letter'}>{sequence[index]}</div>
          <div className="progress-bar">
            <span style={{ width: `${(index / GAME_LENGTH) * 100}%` }} />
          </div>
          {!focused && <p className="warning">Click here to keep typing</p>}
        </div>
      )}

      {status === 'done' && outcome && (
        <div className="stage">
          <p className={outcome.isPersonalBest ? 'verdict success' : 'verdict failure'}>
            {outcome.isPersonalBest ? 'Success' : 'Try again'}
          </p>
          <p className="score">{formatMs(outcome.durationMs)}</p>
          <p className="hint">
            {outcome.mistakes} mistake{outcome.mistakes === 1 ? '' : 's'}
            {outcome.mistakes > 0 && ` (+${formatMs(outcome.mistakes * PENALTY_MS)} penalty)`}
            {outcome.previousBestMs !== null
              ? ` - previous best was ${formatMs(outcome.previousBestMs)}`
              : ' - this was your first round'}
          </p>
          {saveError && <p className="warning">{saveError}</p>}
          <button className="primary" onClick={start}>
            Play again
          </button>
        </div>
      )}
    </section>
  );
}
