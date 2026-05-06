export default {
  testEnvironment: 'node',
  transform: {},
  setupFiles: ['<rootDir>/tests/setup.js'],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/frontend/',
    '<rootDir>/tests/e2e/',
    '<rootDir>/tests/performance/'
  ]
};
