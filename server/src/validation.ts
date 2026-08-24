import { z } from 'zod';
import { badInput } from './errors';

export const registerInput = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters.')
    .max(20, 'Username must be 20 characters or fewer.')
    .regex(/^[A-Za-z0-9_]+$/, 'Username can only contain letters, numbers and underscores.'),
  email: z.string().trim().toLowerCase().email('That does not look like a valid email address.'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(72, 'Password must be 72 characters or fewer.'),
});

export const loginInput = z.object({
  username: z.string().trim().min(1, 'Username is required.'),
  password: z.string().min(1, 'Password is required.'),
});

export const submitGameInput = z.object({
  durationMs: z.number().int().positive(),
  mistakes: z.number().int().min(0),
  charCount: z.number().int().positive(),
});

// zod's own error shape isn't much use to a client, so flatten it to the first
// problem and tag it with the field that caused it.
export function parseOrThrow<T extends z.ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (result.success) return result.data;

  const issue = result.error.issues[0];
  throw badInput(issue.message, issue.path.join('.') || undefined);
}
