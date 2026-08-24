import { describe, expect, test } from 'bun:test';
import { GraphQLError } from 'graphql';
import { parseOrThrow, registerInput } from '../src/validation';

const valid = { username: 'suyash', email: 'Suyash@Example.com', password: 'supersecret' };

describe('registerInput', () => {
  test('normalises a valid signup', () => {
    const parsed = parseOrThrow(registerInput, { ...valid, username: '  suyash  ' });
    expect(parsed.username).toBe('suyash');
    expect(parsed.email).toBe('suyash@example.com');
  });

  test('rejects a short username', () => {
    expect(() => parseOrThrow(registerInput, { ...valid, username: 'ab' })).toThrow(
      /at least 3 characters/,
    );
  });

  test('rejects punctuation in a username', () => {
    expect(() => parseOrThrow(registerInput, { ...valid, username: 'not ok!' })).toThrow(
      /letters, numbers and underscores/,
    );
  });

  test('rejects a malformed email', () => {
    expect(() => parseOrThrow(registerInput, { ...valid, email: 'nope' })).toThrow(/valid email/);
  });

  test('rejects a short password', () => {
    expect(() => parseOrThrow(registerInput, { ...valid, password: 'short' })).toThrow(
      /at least 8 characters/,
    );
  });

  test('reports which field failed', () => {
    try {
      parseOrThrow(registerInput, { ...valid, email: 'nope' });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(GraphQLError);
      const gqlError = err as GraphQLError;
      expect(gqlError.extensions.code).toBe('BAD_USER_INPUT');
      expect(gqlError.extensions.field).toBe('email');
    }
  });
});
