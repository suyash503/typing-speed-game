import { useEffect, useState } from 'react';
import { gql } from '../api';
import { formatMs } from '../game';

const LEADERBOARD = /* GraphQL */ `
  query Leaderboard {
    leaderboard(limit: 10) {
      rank
      username
      bestDurationMs
      gamesPlayed
    }
  }
`;

type Entry = {
  rank: number;
  username: string;
  bestDurationMs: number;
  gamesPlayed: number;
};

export function Leaderboard({ currentUser, refreshKey }: { currentUser: string; refreshKey: number }) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    gql<{ leaderboard: Entry[] }>(LEADERBOARD)
      .then((data) => {
        if (!cancelled) setEntries(data.leaderboard);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (error) return <p className="warning">{error}</p>;
  if (!entries) return <p className="hint">Loading...</p>;
  if (entries.length === 0) return <p className="hint">Nobody has finished a round yet.</p>;

  return (
    <table className="board">
      <thead>
        <tr>
          <th>#</th>
          <th>Player</th>
          <th>Best</th>
          <th>Rounds</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <tr key={entry.username} className={entry.username === currentUser ? 'you' : undefined}>
            <td>{entry.rank}</td>
            <td>{entry.username}</td>
            <td>{formatMs(entry.bestDurationMs)}</td>
            <td>{entry.gamesPlayed}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
