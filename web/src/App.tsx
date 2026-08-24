import { useEffect, useState } from 'react';
import { getToken, gql, setToken } from './api';
import { readLocalBest, writeLocalBest } from './game';
import { AuthForm } from './components/AuthForm';
import { Game } from './components/Game';
import { Leaderboard } from './components/Leaderboard';
import type { User } from './types';

const ME = /* GraphQL */ `
  query Me {
    me {
      id
      username
    }
    myBest {
      durationMs
    }
  }
`;

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [best, setBest] = useState<number | null>(readLocalBest);
  const [checkingSession, setCheckingSession] = useState(Boolean(getToken()));
  const [boardKey, setBoardKey] = useState(0);

  // Restore the session on load, and take the server's best score if it beats
  // whatever this browser happens to have in localStorage.
  useEffect(() => {
    if (!getToken()) return;

    gql<{ me: User | null; myBest: { durationMs: number } | null }>(ME)
      .then((data) => {
        setUser(data.me);
        if (data.myBest) {
          const local = readLocalBest();
          if (local === null || data.myBest.durationMs < local) {
            writeLocalBest(data.myBest.durationMs);
            setBest(data.myBest.durationMs);
          }
        }
      })
      .catch(() => setToken(null))
      .finally(() => setCheckingSession(false));
  }, []);

  function signOut() {
    setToken(null);
    setUser(null);
  }

  if (checkingSession) {
    return <main className="app">Loading...</main>;
  }

  return (
    <main className="app">
      <header>
        <h1>Typing Speed Game</h1>
        {user && (
          <p className="who">
            {user.username}
            <button className="link" onClick={signOut}>
              sign out
            </button>
          </p>
        )}
      </header>

      {user ? (
        <>
          <Game best={best} onNewBest={setBest} onFinished={() => setBoardKey((n) => n + 1)} />
          <section className="card">
            <h2>Leaderboard</h2>
            <Leaderboard currentUser={user.username} refreshKey={boardKey} />
          </section>
        </>
      ) : (
        <AuthForm onAuthenticated={setUser} />
      )}
    </main>
  );
}
