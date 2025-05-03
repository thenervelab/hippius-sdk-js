import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  setSeedPhrase,
  getSeedPhrase,
  setActiveAccount,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getActiveAccount,
  loadConfig,
} from '../config';

describe('Seed Phrase Encryption Tests', () => {
  const TEST_CONFIG_DIR = path.join(os.tmpdir(), '.hippius-test');
  const TEST_CONFIG_FILE = path.join(TEST_CONFIG_DIR, 'config.json');
  const ORIGINAL_CONFIG_DIR = path.join(os.homedir(), '.hippius');
  const ORIGINAL_CONFIG_FILE = path.join(ORIGINAL_CONFIG_DIR, 'config.json');

  // Backup and restore original config
  let originalConfig: string | null = null;

  beforeAll(() => {
    // Create test directory and backup original config if it exists
    if (!fs.existsSync(TEST_CONFIG_DIR)) {
      fs.mkdirSync(TEST_CONFIG_DIR, { recursive: true });
    }

    if (fs.existsSync(ORIGINAL_CONFIG_FILE)) {
      originalConfig = fs.readFileSync(ORIGINAL_CONFIG_FILE, 'utf8');
    }

    // Mock the config paths
    jest.mock('../config', () => {
      const originalModule = jest.requireActual('../config');
      return {
        ...originalModule,
        CONFIG_DIR: TEST_CONFIG_DIR,
        CONFIG_FILE: TEST_CONFIG_FILE,
      };
    });
  });

  afterAll(() => {
    // Clean up test directory
    if (fs.existsSync(TEST_CONFIG_DIR)) {
      fs.rmSync(TEST_CONFIG_DIR, { recursive: true, force: true });
    }

    // Restore original config if it existed
    if (originalConfig && fs.existsSync(ORIGINAL_CONFIG_DIR)) {
      fs.writeFileSync(ORIGINAL_CONFIG_FILE, originalConfig);
    }
  });

  beforeEach(() => {
    // Clean test config before each test
    if (fs.existsSync(TEST_CONFIG_FILE)) {
      fs.unlinkSync(TEST_CONFIG_FILE);
    }
  });

  it('can set and retrieve unencrypted seed phrase', () => {
    const testAccount = 'test-account';
    const testSeedPhrase =
      'test word one two three four five six seven eight nine ten eleven twelve';

    // Set the seed phrase without encryption
    setSeedPhrase(testSeedPhrase, false, null, testAccount);
    setActiveAccount(testAccount);

    // Retrieve the seed phrase
    const retrievedSeedPhrase = getSeedPhrase(testAccount);

    // Verify the seed phrase was stored and retrieved correctly
    expect(retrievedSeedPhrase).toBe(testSeedPhrase);

    // Check the config file was updated correctly
    const config = loadConfig();
    expect(config.substrate.accounts[testAccount].seed_phrase).toBe(testSeedPhrase);
    expect(config.substrate.accounts[testAccount].seed_phrase_encoded).toBe(false);
  });

  it('can set and retrieve encrypted seed phrase', () => {
    const testAccount = 'secure-account';
    const testSeedPhrase =
      'secure word one two three four five six seven eight nine ten eleven twelve';
    const testPassword = 'strong-test-password';

    // Set the seed phrase with encryption
    setSeedPhrase(testSeedPhrase, true, testPassword, testAccount);
    setActiveAccount(testAccount);

    // Verify the config file was updated correctly with encrypted data
    const config = loadConfig();
    expect(config.substrate.accounts[testAccount].seed_phrase).not.toBe(testSeedPhrase);
    expect(config.substrate.accounts[testAccount].seed_phrase_encoded).toBe(true);

    // Verify the stored seed phrase is actually encrypted (base64 encoded)
    const encryptedSeedPhrase = config.substrate.accounts[testAccount].seed_phrase;
    expect(encryptedSeedPhrase).toMatch(/^[A-Za-z0-9+/=]+$/); // Base64 pattern

    // Retrieve the seed phrase with the correct password
    const retrievedSeedPhrase = getSeedPhrase(testAccount, testPassword);
    expect(retrievedSeedPhrase).toBe(testSeedPhrase);
  });

  it('throws error when trying to decrypt with wrong password', () => {
    const testAccount = 'secure-account';
    const testSeedPhrase =
      'secure word one two three four five six seven eight nine ten eleven twelve';
    const correctPassword = 'correct-password';
    const wrongPassword = 'wrong-password';

    // Set the seed phrase with encryption
    setSeedPhrase(testSeedPhrase, true, correctPassword, testAccount);

    // Try to retrieve with wrong password
    expect(() => {
      getSeedPhrase(testAccount, wrongPassword);
    }).toThrow('Failed to decrypt seed phrase');
  });

  it('throws error when trying to get encrypted seed phrase without password', () => {
    const testAccount = 'secure-account';
    const testSeedPhrase =
      'secure word one two three four five six seven eight nine ten eleven twelve';
    const password = 'test-password';

    // Set the seed phrase with encryption
    setSeedPhrase(testSeedPhrase, true, password, testAccount);

    // Try to retrieve without password
    expect(() => {
      getSeedPhrase(testAccount, null);
    }).toThrow('Password required for decrypting seed phrase');
  });
});
