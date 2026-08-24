import { createSchema } from 'graphql-yoga';
import type { Context } from './context';
import { userResolvers } from './resolvers/user';
import { gameResolvers } from './resolvers/game';

const typeDefs = /* GraphQL */ `
  type User {
    id: ID!
    username: String!
    email: String!
    createdAt: String!
  }

  type GameResult {
    id: ID!
    durationMs: Int!
    penaltyMs: Int!
    mistakes: Int!
    charCount: Int!
    createdAt: String!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type LeaderboardEntry {
    rank: Int!
    username: String!
    bestDurationMs: Int!
    gamesPlayed: Int!
  }

  type SubmitGameResult {
    game: GameResult!
    isPersonalBest: Boolean!
    "Null when this was the player's first ever round."
    previousBestMs: Int
  }

  input RegisterInput {
    username: String!
    email: String!
    password: String!
  }

  input LoginInput {
    username: String!
    password: String!
  }

  input SubmitGameInput {
    "Total time including the penalty for every mistake."
    durationMs: Int!
    mistakes: Int!
    charCount: Int!
  }

  type Query {
    me: User
    myBest: GameResult
    myGames(limit: Int = 10): [GameResult!]!
    leaderboard(limit: Int = 10): [LeaderboardEntry!]!
  }

  type Mutation {
    register(input: RegisterInput!): AuthPayload!
    login(input: LoginInput!): AuthPayload!
    submitGame(input: SubmitGameInput!): SubmitGameResult!
  }
`;

export const schema = createSchema<Context>({
  typeDefs,
  resolvers: {
    Query: {
      ...userResolvers.Query,
      ...gameResolvers.Query,
    },
    Mutation: {
      ...userResolvers.Mutation,
      ...gameResolvers.Mutation,
    },
    User: userResolvers.User,
    GameResult: gameResolvers.GameResult,
  },
});
