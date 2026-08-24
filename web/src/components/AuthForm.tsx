import { useState } from 'react';
import { ApiError, gql, setToken } from '../api';
import type { User } from '../types';

const REGISTER = /* GraphQL */ `
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      token
      user {
        id
        username
      }
    }
  }
`;

const LOGIN = /* GraphQL */ `
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      token
      user {
        id
        username
      }
    }
  }
`;

export function AuthForm({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const registering = mode === 'register';

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const input = registering ? { username, email, password } : { username, password };
      const data = await gql<Record<string, { token: string; user: User }>>(
        registering ? REGISTER : LOGIN,
        { input },
      );

      const payload = registering ? data.register : data.login;
      setToken(payload.token);
      onAuthenticated(payload.user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card narrow">
      <div className="tabs">
        <button className={!registering ? 'active' : ''} onClick={() => setMode('login')}>
          Sign in
        </button>
        <button className={registering ? 'active' : ''} onClick={() => setMode('register')}>
          Create account
        </button>
      </div>

      <form onSubmit={submit}>
        <label>
          Username
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </label>

        {registering && (
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
        )}

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={registering ? 'new-password' : 'current-password'}
            required
          />
        </label>

        {error && <p className="warning">{error}</p>}

        <button className="primary" type="submit" disabled={busy}>
          {busy ? 'Please wait...' : registering ? 'Create account' : 'Sign in'}
        </button>
      </form>
    </section>
  );
}
