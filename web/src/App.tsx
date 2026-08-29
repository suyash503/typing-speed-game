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

// The stored best belongs to one player, so it can only be read once we know who
// is signed in. If the server has a faster round than this browser knows about -
// played on another machine - that becomes the local record too.
function loadBest(userId: string, serverBest: number | null): number | null {
  const local = readLocalBest(userId);

  if (serverBest !== null && (local === null || serverBest < local)) {
    writeLocalBest(userId, serverBest);
    return serverBest;
  }
  return local;
}

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [best, setBest] = useState<number | null>(null);
  const [checkingSession, setCheckingSession] = useState(Boolean(getToken()));
  const [boardKey, setBoardKey] = useState(0);

  // Restore the session on load.
  useEffect(() => {
    if (!getToken()) return;

    gql<{ me: User | null; myBest: { durationMs: number } | null }>(ME)
      .then((data) => {
        setUser(data.me);
        if (data.me) setBest(loadBest(data.me.id, data.myBest?.durationMs ?? null));
      })
      .catch(() => setToken(null))
      .finally(() => setCheckingSession(false));
  }, []);

  function signIn(signedIn: User) {
    setUser(signedIn);
    setBest(readLocalBest(signedIn.id));
  }

  function recordBest(ms: number) {
    if (user) writeLocalBest(user.id, ms);
    setBest(ms);
  }

  function signOut() {
    setToken(null);
    setUser(null);
    setBest(null);
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
          <Game best={best} onNewBest={recordBest} onFinished={() => setBoardKey((n) => n + 1)} />
          <section className="card">
            <h2>Leaderboard</h2>
            <Leaderboard currentUser={user.username} refreshKey={boardKey} />
          </section>
        </>
      ) : (
        <AuthForm onAuthenticated={signIn} />
      )}
    </main>
  );
}
