import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';

dotenv.config();

// Default config path (exported for testing purposes)
export const CONFIG_DIR = path.join(os.homedir(), '.hippius');
export const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// Default configuration values
const DEFAULT_CONFIG = {
  ipfs: {
    gateway: 'https://get.hippius.network',
    api_url: 'https://store.hippius.network',
    local_ipfs: false,
  },
  substrate: {
    url: 'wss://rpc.hippius.network',
    seed_phrase: null,
    default_miners: [],
    default_address: null,
    accounts: {},
  },
  encryption: {
    encrypt_by_default: false,
    encryption_key: null,
  },
  cli: {
    verbose: false,
    max_retries: 3,
  },
};

// Ensure config directory exists
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

// Ensure config file exists
if (!fs.existsSync(CONFIG_FILE)) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
}

/**
 * Load the configuration file
 */
export function loadConfig(): any {
  try {
    const configData = fs.readFileSync(CONFIG_FILE, 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    console.warn('Error loading config file, using defaults:', error);
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Save the configuration file
 *
 * @param config The configuration object to save
 */
export function saveConfig(config: any): void {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('Error saving config file:', error);
  }
}

/**
 * Get a configuration value
 *
 * @param section The section of the configuration
 * @param key The key within the section
 * @param defaultValue The default value if not found
 * @returns The configuration value
 */
export function getConfigValue(section: string, key: string, defaultValue: any = null): any {
  // First check environment variables (HIPPIUS_SECTION_KEY)
  const envKey = `HIPPIUS_${section.toUpperCase()}_${key.toUpperCase()}`;
  if (process.env[envKey] !== undefined) {
    return process.env[envKey];
  }

  // Then check config file
  try {
    const config = loadConfig();
    if (config[section] && config[section][key] !== undefined) {
      return config[section][key];
    }
  } catch (error) {
    console.warn('Error reading config value, using default:', error);
  }

  // Return default value
  return defaultValue;
}

/**
 * Set a configuration value
 *
 * @param section The section of the configuration
 * @param key The key within the section
 * @param value The value to set
 */
export function setConfigValue(section: string, key: string, value: any): void {
  try {
    const config = loadConfig();

    // Create section if it doesn't exist
    if (!config[section]) {
      config[section] = {};
    }

    // Set the value
    config[section][key] = value;

    // Save the config
    saveConfig(config);
  } catch (error) {
    console.error('Error setting config value:', error);
  }
}

/**
 * Get the currently active account name
 *
 * @returns The active account name or null if none
 */
export function getActiveAccount(): string | null {
  return getConfigValue('substrate', 'active_account', null);
}

/**
 * Set the active account
 *
 * @param accountName The name of the account to set as active
 */
export function setActiveAccount(accountName: string): void {
  setConfigValue('substrate', 'active_account', accountName);
}

/**
 * Get the address of an account by name
 *
 * @param accountName The name of the account
 * @returns The account address or null if not found
 */
export function getAccountAddress(accountName: string | null = null): string | null {
  const name = accountName || getActiveAccount();
  if (!name) return null;

  const config = loadConfig();
  if (config.substrate.accounts && config.substrate.accounts[name]) {
    return config.substrate.accounts[name].ss58_address || null;
  }

  return null;
}

/**
 * Get the encryption key either from config or env
 *
 * @returns The encryption key as a Buffer or null if not found
 */
export function getEncryptionKey(): Buffer | null {
  // First check environment variable
  const envKey = process.env.HIPPIUS_ENCRYPTION_KEY;
  if (envKey) {
    try {
      return Buffer.from(envKey, 'base64');
    } catch (e) {
      console.warn('Invalid encryption key format in environment variable');
    }
  }

  // Then check config file
  const configKey = getConfigValue('encryption', 'encryption_key', null);
  if (configKey) {
    try {
      return Buffer.from(configKey, 'base64');
    } catch (e) {
      console.warn('Invalid encryption key format in config file');
    }
  }

  return null;
}

// This function has been replaced with the updated version below

/**
 * Set or update a seed phrase in configuration
 *
 * @param seedPhrase The seed phrase to store
 * @param encode Whether to encrypt the seed phrase
 * @param password Password for encryption (required if encode is true)
 * @param accountName Account name (uses active account if null)
 * @returns True if successful, false otherwise
 */
export function setSeedPhrase(
  seedPhrase: string,
  encode: boolean = false,
  password: string | null = null,
  accountName: string | null = null
): boolean {
  const name = accountName || getActiveAccount();
  if (!name) {
    throw new Error('No account specified and no active account');
  }

  const config = loadConfig();
  if (!config.substrate.accounts) {
    config.substrate.accounts = {};
  }

  if (!config.substrate.accounts[name]) {
    config.substrate.accounts[name] = {};
  }

  if (encode) {
    if (!password) {
      throw new Error('Password required for encrypting seed phrase');
    }

    // Generate a key from the password using PBKDF2
    const salt = crypto.randomBytes(16);
    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');

    // Generate an IV for AES encryption
    const iv = crypto.randomBytes(16);

    // Encrypt the seed phrase
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(Buffer.from(seedPhrase, 'utf-8')),
      cipher.final(),
    ]);

    // Store the encrypted seed phrase with salt and IV
    const encryptedData = Buffer.concat([salt, iv, encrypted]).toString('base64');

    config.substrate.accounts[name].seed_phrase = encryptedData;
    config.substrate.accounts[name].seed_phrase_encoded = true;
  } else {
    config.substrate.accounts[name].seed_phrase = seedPhrase;
    config.substrate.accounts[name].seed_phrase_encoded = false;
  }

  saveConfig(config);
  return true;
}

/**
 * Get a decrypted seed phrase from the configuration
 *
 * @param accountName Account name to get the seed phrase for (uses active account if null)
 * @param password Password for decryption (required if the seed phrase is encrypted)
 * @returns The decrypted seed phrase
 */
export function getSeedPhrase(
  accountName: string | null = null,
  password: string | null = null
): string {
  const name = accountName || getActiveAccount();
  if (!name) {
    throw new Error('No account specified and no active account');
  }

  const config = loadConfig();
  if (!config.substrate.accounts || !config.substrate.accounts[name]) {
    throw new Error(`Account '${name}' not found`);
  }

  const account = config.substrate.accounts[name];
  if (!account.seed_phrase) {
    throw new Error(`No seed phrase found for account '${name}'`);
  }

  // If the seed phrase is not encrypted, return it as is
  if (!account.seed_phrase_encoded) {
    return account.seed_phrase;
  }

  // If the seed phrase is encrypted, decrypt it
  if (!password) {
    throw new Error('Password required for decrypting seed phrase');
  }

  try {
    // Decode the base64 encrypted data
    const encryptedData = Buffer.from(account.seed_phrase, 'base64');

    // Extract salt, IV, and encrypted seed phrase
    const salt = encryptedData.slice(0, 16);
    const iv = encryptedData.slice(16, 32);
    const encrypted = encryptedData.slice(32);

    // Derive the key using the same parameters as encryption
    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');

    // Decrypt the seed phrase
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    return decrypted.toString('utf-8');
  } catch (error) {
    throw new Error('Failed to decrypt seed phrase: Invalid password or corrupted data');
  }
}

/**
 * Get the entire configuration object
 *
 * @returns The complete configuration object
 */
export function getAllConfig(): any {
  return loadConfig();
}
