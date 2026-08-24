import { SignJWT, jwtVerify } from 'jose';
import { config } from './config';

const secret = new TextEncoder().encode(config.jwtSecret);
const TOKEN_LIFETIME = '7d';

// Bun ships argon2id hashing, so there's no reason to pull in bcrypt.
export function hashPassword(plain: string): Promise<string> {
  return Bun.password.hash(plain);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return Bun.password.verify(plain, hash);
}

export function signToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(TOKEN_LIFETIME)
    .sign(secret);
}

// Any bad token (expired, tampered, wrong secret, garbage) is just "not signed in".
export async function userIdFromToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload.sub ?? null;
  } catch {
    return null;
  }
}
