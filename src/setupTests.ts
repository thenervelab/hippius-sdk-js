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

// Mock node-fetch
jest.mock('node-fetch', () => {
  return jest.fn().mockImplementation(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: () => Promise.resolve('This is a test file for Hippius SDK.'),
      json: () => Promise.resolve({ Hash: 'QmTestHash123', cid: 'QmTestHash123' }),
      arrayBuffer: () =>
        Promise.resolve(new TextEncoder().encode('This is a test file for Hippius SDK.').buffer),
    })
  );
});
