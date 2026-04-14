// Default config runs unit tests only (no DB required).
// Run integration tests separately: npm run test:integration
export default {
  testEnvironment: 'node',
  transform: {},
  moduleFileExtensions: ['js', 'json'],
  transformIgnorePatterns: [
    'node_modules/(?!(supertest)/)'
  ],
  roots: ['<rootDir>/__tests__'],
  modulePaths: ['<rootDir>'],
  testMatch: [
    '**/__tests__/**/*.tests.js'
  ],
  testPathIgnorePatterns: [
    '<rootDir>/__tests__/integration/'
  ],
  collectCoverageFrom: [
    'app/**/*.js',
    '!app/config/**/*.js',
    '!**/node_modules/**'
  ],
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],
  testTimeout: 30000,
  verbose: true
};
