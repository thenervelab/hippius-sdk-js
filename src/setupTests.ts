// Jest setup file
// This file is used to set up the test environment for Jest
// It's referenced in the jest.config.js setupFiles option

// Mock process.env for testing
process.env = {
  ...process.env,
  NODE_ENV: 'test',
};

// Silence console logs during tests
// Comment these out if you need to debug tests
console.log = jest.fn();
console.warn = jest.fn();
console.error = jest.fn();
