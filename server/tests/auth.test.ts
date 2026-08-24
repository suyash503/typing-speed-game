import { describe, expect, test } from 'bun:test';
import { hashPassword, signToken, userIdFromToken, verifyPassword } from '../src/auth';

function base64Url(value: string) {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

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

  test('a token with a rewritten payload is rejected', async () => {
    const [header, , signature] = (await signToken('user_abc123')).split('.');

    // Claim to be someone else while keeping the original signature.
    const forged = base64Url(JSON.stringify({ sub: 'user_admin' }));
    expect(await userIdFromToken(`${header}.${forged}.${signature}`)).toBeNull();
  });

  test('a token wearing another token\'s signature is rejected', async () => {
    const [header, payload] = (await signToken('user_abc123')).split('.');
    const [, , otherSignature] = (await signToken('user_xyz789')).split('.');

    expect(await userIdFromToken(`${header}.${payload}.${otherSignature}`)).toBeNull();
  });

  test('nonsense is rejected rather than thrown', async () => {
    expect(await userIdFromToken('not-a-jwt')).toBeNull();
    expect(await userIdFromToken('')).toBeNull();
  });
});
