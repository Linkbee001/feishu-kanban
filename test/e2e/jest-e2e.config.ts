import type { Config } from 'jest';

/**
 * Jest configuration for E2E tests.
 *
 * E2E tests (*.e2e-spec.ts) run separately from unit tests (*.spec.ts):
 * - Longer timeout (30s) for async flows and database operations
 * - Sequential execution (--runInBand) to avoid database conflicts
 * - Separate from unit tests for CI/CD pipeline optimization
 *
 * Usage:
 * ```bash
 * npm run test:e2e           # Run all E2E tests
 * npm run test:e2e -- path   # Run specific E2E test file
 * ```
 */
const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.e2e-spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  testEnvironment: 'node',
  testTimeout: 30000, // E2E tests need longer timeout for async flows
  testPathIgnorePatterns: ['/node_modules/'],
  modulePathIgnorePatterns: ['/dist/'],
  // Transform ES modules in node_modules (nanoid is an ES module)
  transformIgnorePatterns: ['node_modules/(?!(nanoid)/)'],
};

export default config;