const ENDPOINT = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/graphql';
const TOKEN_KEY = 'tsg.token';

export class ApiError extends Error {
  code: string;
  field?: string;

  constructor(message: string, code = 'UNKNOWN', field?: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.field = field;
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

// Small hand-rolled client. The app makes about six different requests, which is
// nowhere near enough to justify pulling in Apollo.
export async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const token = getToken();

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    throw new ApiError('Could not reach the server. Is it running?', 'NETWORK');
  }

  const body = await response.json();

  if (body.errors?.length) {
    const [first] = body.errors;
    throw new ApiError(first.message, first.extensions?.code, first.extensions?.field);
  }

  return body.data as T;
}
