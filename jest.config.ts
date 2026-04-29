import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/', '/demo/', '/dist/', '/dist_old/'],
  modulePathIgnorePatterns: ['/demo/', '/dist/', '/dist_old/'],
};

export default config;
