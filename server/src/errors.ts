import { GraphQLError } from 'graphql';

// Yoga masks anything that isn't a GraphQLError, so these are the errors we
// deliberately let the client see. Everything else surfaces as "Unexpected error".

export function badInput(message: string, field?: string) {
  return new GraphQLError(message, { extensions: { code: 'BAD_USER_INPUT', field } });
}

export function unauthenticated(message = 'You need to be signed in to do that.') {
  return new GraphQLError(message, { extensions: { code: 'UNAUTHENTICATED' } });
}

export function conflict(message: string, field?: string) {
  return new GraphQLError(message, { extensions: { code: 'CONFLICT', field } });
}

export function notFound(message: string) {
  return new GraphQLError(message, { extensions: { code: 'NOT_FOUND' } });
}
