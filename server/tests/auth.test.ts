import { describe, expect, test } from 'bun:test';
import { hashPassword, signToken, userIdFromToken, verifyPassword } from '../src/auth';

describe('password hashing', () => {
  test('a hash verifies against the original password', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(await verifyPassword('correct horse battery', hash)).toBe(true);
  });

  test('the wrong password does not verify', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(await verifyPassword('correct horse batteru', hash)).toBe(false);
  });

  test('the same password hashes differently each time', async () => {
    const [a, b] = await Promise.all([hashPassword('same-password'), hashPassword('same-password')]);
    expect(a).not.toBe(b);
  });

  test('the plaintext never appears in the hash', async () => {
    const hash = await hashPassword('hunter2hunter2');
    expect(hash).not.toContain('hunter2');
  });
});

describe('tokens', () => {
  test('a signed token gives back the user id', async () => {
    const token = await signToken('user_abc123');
    expect(await userIdFromToken(token)).toBe('user_abc123');
  });

  test('a tampered token is rejected', async () => {
    const token = await signToken('user_abc123');
    // Flip the last character of the signature.
    const tampered = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a');
    expect(await userIdFromToken(tampered)).toBeNull();
  });

  test('nonsense is rejected rather than thrown', async () => {
    expect(await userIdFromToken('not-a-jwt')).toBeNull();
    expect(await userIdFromToken('')).toBeNull();
  });
});
