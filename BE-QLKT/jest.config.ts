import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  // Integration tests hit a real DB over HTTP — run them via `npm run test:integration`
  // (jest.integration.config.ts), not the mocked unit run.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/tests/integration/'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  setupFiles: ['<rootDir>/tests/env.setup.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  clearMocks: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/generated/**',
    '!src/index.ts',
    '!src/scripts/**',
    '!src/configs/**',
    '!src/types/**',
  ],
  coverageReporters: ['text-summary', 'lcov'],
  // Ratchet floor — just below current actuals so CI passes today; raise as coverage grows.
  coverageThreshold: {
    global: { statements: 66, branches: 51, functions: 60, lines: 67 },
  },
};

export default config;
