import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  loadConfig,
  saveConfig,
  getConfigValue,
  setConfigValue,
  getActiveAccount,
  setActiveAccount,
  getAccountAddress,
  getEncryptionKey,
} from '../config';

// Mock fs module
jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    writeFileSync: jest.fn(),
    readFileSync: jest.fn(),
    existsSync: jest.fn().mockReturnValue(true),
    mkdirSync: jest.fn(),
  };
});

describe('Config Module', () => {
  const configDir = path.join(os.homedir(), '.hippius');
  const configFile = path.join(configDir, 'config.json');

  const mockConfig = {
    ipfs: {
      gateway: 'https://test-gateway.io',
      api_url: 'https://test-api.io',
      local_ipfs: false,
    },
    substrate: {
      url: 'wss://test.network',
      seed_phrase: null,
      default_miners: [],
      default_address: null,
      accounts: {
        'test-account': {
          ss58_address: 'test-address',
          seed_phrase: 'test seed phrase',
          seed_phrase_encoded: false,
        },
      },
      active_account: 'test-account',
    },
    encryption: {
      encrypt_by_default: false,
      encryption_key: 'dGVzdA==', // base64 encoded 'test'
    },
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mock for readFileSync to return our test config
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockConfig));

    // Mock process.env
    process.env = {
      ...process.env,
      HIPPIUS_TEST_ENV_KEY: 'env-value',
    };
  });

  afterEach(() => {
    // Clean up any test keys from process.env
    delete process.env.HIPPIUS_TEST_ENV_KEY;
    delete process.env.HIPPIUS_ENCRYPTION_KEY;
  });

  describe('loadConfig', () => {
    it('loads configuration from file', () => {
      const config = loadConfig();

      expect(fs.readFileSync).toHaveBeenCalledWith(configFile, 'utf8');
      expect(config).toEqual(mockConfig);
    });

    it('returns default config if file reading fails', () => {
      (fs.readFileSync as jest.Mock).mockImplementationOnce(() => {
        throw new Error('File not found');
      });

      const config = loadConfig();

      expect(config).toBeDefined();
      expect(config.ipfs).toBeDefined();
      expect(config.substrate).toBeDefined();
      expect(config.encryption).toBeDefined();
    });
  });

  describe('saveConfig', () => {
    it('saves configuration to file', () => {
      saveConfig(mockConfig);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        configFile,
        JSON.stringify(mockConfig, null, 2)
      );
    });
  });

  describe('getConfigValue', () => {
    it('returns value from environment variables if available', () => {
      const value = getConfigValue('test', 'env_key', 'default');

      expect(value).toBe('env-value');
    });

    it('returns value from config file if not in environment', () => {
      const value = getConfigValue('ipfs', 'gateway', 'default');

      expect(value).toBe('https://test-gateway.io');
    });

    it('returns default value if not found anywhere', () => {
      const value = getConfigValue('nonexistent', 'key', 'default-value');

      expect(value).toBe('default-value');
    });
  });

  describe('setConfigValue', () => {
    it('sets a config value and saves to file', () => {
      setConfigValue('test', 'new_key', 'new-value');

      // Should have loaded the config first
      expect(fs.readFileSync).toHaveBeenCalled();

      // Should have saved the updated config
      expect(fs.writeFileSync).toHaveBeenCalled();

      // Check the correct arguments were passed to writeFileSync
      const writeArgs = (fs.writeFileSync as jest.Mock).mock.calls[0];
      const savedConfig = JSON.parse(writeArgs[1]);

      expect(savedConfig.test.new_key).toBe('new-value');
    });

    it("creates new sections if they don't exist", () => {
      setConfigValue('new_section', 'key', 'value');

      const writeArgs = (fs.writeFileSync as jest.Mock).mock.calls[0];
      const savedConfig = JSON.parse(writeArgs[1]);

      expect(savedConfig.new_section.key).toBe('value');
    });
  });

  describe('getActiveAccount', () => {
    it('returns the active account name', () => {
      const account = getActiveAccount();

      expect(account).toBe('test-account');
    });
  });

  describe('setActiveAccount', () => {
    it('sets the active account name', () => {
      setActiveAccount('new-account');

      const writeArgs = (fs.writeFileSync as jest.Mock).mock.calls[0];
      const savedConfig = JSON.parse(writeArgs[1]);

      expect(savedConfig.substrate.active_account).toBe('new-account');
    });
  });

  describe('getAccountAddress', () => {
    it('returns the address for the specified account', () => {
      const address = getAccountAddress('test-account');

      expect(address).toBe('test-address');
    });

    it('returns the address for the active account if no name specified', () => {
      const address = getAccountAddress();

      expect(address).toBe('test-address');
    });

    it('returns null if account not found', () => {
      const address = getAccountAddress('nonexistent');

      expect(address).toBeNull();
    });
  });

  describe('getEncryptionKey', () => {
    it('returns key from environment variable if available', () => {
      process.env.HIPPIUS_ENCRYPTION_KEY = 'ZW52LWtleQ=='; // base64 for 'env-key'

      const key = getEncryptionKey();

      expect(key).toBeInstanceOf(Buffer);
      expect(key?.toString()).toBe('env-key');
    });

    it('returns key from config if not in environment', () => {
      const key = getEncryptionKey();

      expect(key).toBeInstanceOf(Buffer);
      expect(key?.toString()).toBe('test');
    });

    it('returns null if no key is found', () => {
      // Mock empty encryption key
      (fs.readFileSync as jest.Mock).mockReturnValueOnce(
        JSON.stringify({
          ...mockConfig,
          encryption: { encrypt_by_default: false, encryption_key: null },
        })
      );

      const key = getEncryptionKey();

      expect(key).toBeNull();
    });
  });
});
