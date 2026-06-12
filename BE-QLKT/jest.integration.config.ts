import type { Config } from 'jest';

/**
 * Integration tests run against a REAL database over HTTP (supertest), so they
 * must NOT load `tests/setup.ts` (which jest.mocks `src/models` to a Prisma
 * mock). This config omits that setup and points at `tests/integration` only.
 *
 *     npm run test:integration   # requires a seeded DB + DATABASE_URL in .env
 */
const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/integration'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  setupFiles: ['<rootDir>/tests/env.setup.ts'],
  testTimeout: 30000,
};

export default config;
