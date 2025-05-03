import { ApiPromise, WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';
import { hexToU8a, u8aToHex } from '@polkadot/util';
import { mnemonicGenerate, mnemonicValidate } from '@polkadot/util-crypto';
import {
  getConfigValue,
  getAccountAddress,
  getActiveAccount,
  setActiveAccount,
  setSeedPhrase,
  getSeedPhrase,
} from '../config';
import { hexToIpfsCid } from '../utils';

/**
 * File input for storage requests
 */
export class FileInput {
  fileHash: string;
  fileName: string;

  /**
   * Initialize a file input
   *
   * @param fileHash IPFS hash (CID) of the file
   * @param fileName Name of the file
   */
  constructor(fileHash: string, fileName: string) {
    this.fileHash = fileHash;
    this.fileName = fileName;
  }

  /**
   * Convert to dictionary representation
   */
  toDict(): Record<string, string> {
    return {
      fileHash: this.fileHash,
      fileName: this.fileName,
    };
  }
}

/**
 * Client for interacting with the Hippius Substrate blockchain
 *
 * Provides functionality for storage requests and other blockchain operations
 */
export class SubstrateClient {
  private url: string;
  private _substrate: ApiPromise | null = null;
  private _keypair: any = null;
  private _accountName: string | null;
  private _accountAddress: string | null = null;
  private _readOnly: boolean = false;
  private _seedPhrase: string | null = null;
  private _seedPhrasePassword: string | null = null;

  /**
   * Initialize the Substrate client
   *
   * @param url WebSocket URL of the Hippius substrate node
   * @param seedPhrase Seed phrase for the account (mnemonic)
   * @param password Optional password to decrypt the seed phrase if it's encrypted
   * @param accountName Optional name of the account to use (uses active account if null)
   */
  constructor(
    url: string | null = null,
    seedPhrase: string | null = null,
    password: string | null = null,
    accountName: string | null = null
  ) {
    // Load configuration values if not explicitly provided
    this.url = url || getConfigValue('substrate', 'url', 'wss://rpc.hippius.network');
    this._accountName = accountName || getActiveAccount();
    this._seedPhrasePassword = password;

    // Get the account address for read-only operations
    const addr = getAccountAddress(this._accountName);
    if (addr) {
      this._accountAddress = addr;
    }

    // Set seed phrase if provided
    if (seedPhrase) {
      this.setSeedPhrase(seedPhrase);
    }
  }

  /**
   * Connect to the Substrate node
   */
  async connect(): Promise<boolean> {
    try {
      console.log(`Connecting to Substrate node at ${this.url}...`);

      const provider = new WsProvider(this.url);
      this._substrate = await ApiPromise.create({ provider });

      // Only create keypair if seed phrase is available
      if (this._seedPhrase) {
        const keyring = new Keyring({ type: 'sr25519' });
        this._keypair = keyring.addFromMnemonic(this._seedPhrase);
        this._accountAddress = this._keypair.address;
        console.log(`Connected successfully. Account address: ${this._keypair.address}`);
        this._readOnly = false;
      } else if (this._accountAddress) {
        console.log(
          `Connected successfully in read-only mode. Account address: ${this._accountAddress}`
        );
        this._readOnly = true;
      } else {
        console.log('Connected successfully (read-only mode, no account)');
        this._readOnly = true;
      }

      return true;
    } catch (error) {
      console.error(`Failed to connect to Substrate node: ${error}`);
      throw new Error(`Could not connect to Substrate node at ${this.url}: ${error}`);
    }
  }

  /**
   * Ensure we have a keypair for signing transactions
   * Will prompt for password if needed
   *
   * @returns True if keypair is available, False if it couldn't be created
   */
  private async _ensureKeypair(): Promise<boolean> {
    if (this._keypair) {
      return true;
    }

    // If we have a seed phrase, create the keypair
    if (this._seedPhrase) {
      try {
        const keyring = new Keyring({ type: 'sr25519' });
        this._keypair = keyring.addFromMnemonic(this._seedPhrase);
        this._accountAddress = this._keypair.address;
        console.log(`Keypair created for account: ${this._keypair.address}`);
        this._readOnly = false;
        return true;
      } catch (error) {
        console.warn(`Warning: Could not create keypair from seed phrase: ${error}`);
        return false;
      }
    }

    // Otherwise, try to get the seed phrase from config
    try {
      const configSeed = getSeedPhrase(this._seedPhrasePassword, this._accountName);
      if (configSeed) {
        this._seedPhrase = configSeed;
        const keyring = new Keyring({ type: 'sr25519' });
        this._keypair = keyring.addFromMnemonic(this._seedPhrase);
        this._accountAddress = this._keypair.address;
        console.log(`Keypair created for account: ${this._keypair.address}`);
        this._readOnly = false;
        return true;
      } else {
        console.warn('No seed phrase available. Cannot sign transactions.');
        return false;
      }
    } catch (error) {
      console.warn(`Warning: Could not get seed phrase from config: ${error}`);
      return false;
    }
  }

  /**
   * Generate a new random 12-word mnemonic phrase
   *
   * @returns A 12-word mnemonic seed phrase
   */
  generateMnemonic(): string {
    try {
      return mnemonicGenerate();
    } catch (error) {
      throw new Error(`Error generating mnemonic: ${error}`);
    }
  }

  /**
   * Set or update the seed phrase used for signing transactions
   *
   * @param seedPhrase Mnemonic seed phrase for the account
   */
  setSeedPhrase(seedPhrase: string): void {
    if (!seedPhrase || !seedPhrase.trim()) {
      throw new Error('Seed phrase cannot be empty');
    }

    // Validate the mnemonic
    if (!mnemonicValidate(seedPhrase)) {
      throw new Error('Invalid mnemonic seed phrase');
    }

    // Store the seed phrase in memory for this session
    this._seedPhrase = seedPhrase.trim();
    this._readOnly = false;

    // Try to create the keypair if possible
    try {
      const keyring = new Keyring({ type: 'sr25519' });
      this._keypair = keyring.addFromMnemonic(this._seedPhrase);
      this._accountAddress = this._keypair.address;
      console.log(`Keypair created for account: ${this._keypair.address}`);
    } catch (error) {
      console.warn(`Warning: Could not create keypair from seed phrase: ${error}`);
      console.log(`Keypair will be created when needed`);
    }
  }

  /**
   * Submit a storage request for IPFS files to the marketplace
   *
   * @param files List of FileInput objects or dictionaries with fileHash and fileName
   * @param minerIds List of miner IDs to store the files (optional)
   * @returns Transaction hash
   */
  async storageRequest(
    files: (FileInput | Record<string, string>)[],
    minerIds: string[] = []
  ): Promise<string> {
    // Check if we have a keypair for signing transactions
    if (!(await this._ensureKeypair())) {
      throw new Error('Seed phrase must be set before making transactions');
    }

    // Ensure we have a substrate connection
    if (!this._substrate) {
      await this.connect();
    }

    if (!this._substrate) {
      throw new Error('Could not connect to Substrate node');
    }

    // Convert any dict inputs to FileInput objects
    const fileInputs: FileInput[] = files.map(file => {
      if (file instanceof FileInput) {
        return file;
      } else {
        return new FileInput(
          file.fileHash || file.cid || '',
          file.fileName || file.filename || 'unknown'
        );
      }
    });

    console.log(`Preparing storage request for ${fileInputs.length} files:`);
    for (const file of fileInputs) {
      console.log(`  - ${file.fileName}: ${file.fileHash}`);
    }

    if (minerIds.length > 0) {
      console.log(`Targeted miners: ${minerIds.join(', ')}`);
    } else {
      console.log('No specific miners targeted (using default selection)');
    }

    try {
      // Create JSON file with list of files to pin
      const fileList = fileInputs.map(input => ({
        filename: input.fileName,
        cid: input.fileHash,
      }));

      // Convert to JSON string
      const filesJson = JSON.stringify(fileList, null, 2);
      console.log(`Created file list with ${fileList.length} entries`);

      // TODO: Upload the JSON file to IPFS
      // In actual implementation, this would upload the file list to IPFS
      // and get back a CID for the file list
      // This is a placeholder for now
      const filesListCid = 'QmPlaceholderCidForFileList';

      // Create call parameters
      const callParams = {
        files_input: [
          {
            file_hash: filesListCid,
            file_name: `files_list_${Date.now()}`,
          },
        ],
        miner_ids: minerIds,
      };

      console.log(`Call parameters: ${JSON.stringify(callParams, null, 2)}`);

      // TODO: Implement the actual blockchain transaction
      // This will need to compose and sign the call to the Marketplace module
      // For now, return a placeholder transaction hash

      // In a complete implementation:
      // 1. Compose the call
      // 2. Sign the extrinsic with keypair
      // 3. Submit the extrinsic and wait for inclusion
      // 4. Return the transaction hash

      return 'simulated-tx-hash';
    } catch (error) {
      console.error(`Error interacting with Substrate: ${error}`);
      throw error;
    }
  }

  /**
   * Store a CID on the blockchain
   *
   * @param cid Content Identifier (CID) to store
   * @param filename Original filename (optional)
   * @param metadata Additional metadata to store with the CID (optional)
   * @returns Transaction hash
   */
  async storeCid(
    cid: string,
    filename: string | null = null,
    metadata: Record<string, any> | null = null
  ): Promise<string> {
    const fileInput = new FileInput(cid, filename || 'unnamed_file');
    return this.storageRequest([fileInput]);
  }

  /**
   * Get the account balance
   *
   * @param accountAddress Substrate account address (uses keypair address if not specified)
   * @returns Account balances (free, reserved, total)
   */
  async getAccountBalance(accountAddress: string | null = null): Promise<{
    free: number;
    reserved: number;
    frozen: number;
    total: number;
    raw: {
      free: string;
      reserved: string;
      frozen: string;
    };
  }> {
    try {
      // Initialize Substrate connection if not already connected
      if (!this._substrate) {
        await this.connect();
      }

      if (!this._substrate) {
        throw new Error('Could not connect to Substrate node');
      }

      // Use provided account address or default to keypair/configured address
      let address = accountAddress;
      if (!address) {
        if (this._accountAddress) {
          address = this._accountAddress;
          console.log(`Using account address: ${address}`);
        } else {
          // Try to get the address from the keypair (requires seed phrase)
          if (!(await this._ensureKeypair())) {
            throw new Error('No account address available');
          }
          address = this._keypair.address;
          console.log(`Using keypair address: ${address}`);
        }
      }

      // Query the blockchain for account balance
      console.log(`Querying balance for account: ${address}`);

      // @ts-ignore - The types for query might not match perfectly, but this works
      const result = await this._substrate.query.system.account(address);

      // If account exists, extract the balance information
      if (result) {
        // Use type assertion to handle the unknown structure
        const resultObj = result as any;
        const data = resultObj.data;

        // Extract balance components
        const freeBalance = data.free.toString();
        const reservedBalance = data.reserved.toString();
        const frozenBalance = data.frozen ? data.frozen.toString() : '0';

        // Convert from blockchain units to float (divide by 10^18)
        const divisor = 1_000_000_000_000_000_000n; // 18 zeros for decimals

        const free = Number(BigInt(freeBalance) / divisor);
        const reserved = Number(BigInt(reservedBalance) / divisor);
        const frozen = Number(BigInt(frozenBalance) / divisor);

        // Calculate total (free + reserved - frozen)
        const total = free + reserved - frozen;

        return {
          free,
          reserved,
          frozen,
          total,
          raw: {
            free: freeBalance,
            reserved: reservedBalance,
            frozen: frozenBalance,
          },
        };
      } else {
        console.log(`No account data found for: ${address}`);
        return {
          free: 0.0,
          reserved: 0.0,
          frozen: 0.0,
          total: 0.0,
          raw: {
            free: '0',
            reserved: '0',
            frozen: '0',
          },
        };
      }
    } catch (error) {
      const errorMsg = `Error querying account balance: ${error}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
  }

  /**
   * Get the free credits available for an account in the marketplace
   *
   * @param accountAddress Substrate account address (uses keypair address if not specified)
   * @returns Free credits amount
   */
  async getFreeCredits(accountAddress: string | null = null): Promise<number> {
    try {
      // Initialize Substrate connection if not already connected
      if (!this._substrate) {
        await this.connect();
      }

      if (!this._substrate) {
        throw new Error('Could not connect to Substrate node');
      }

      // Use provided account address or default to keypair/configured address
      let address = accountAddress;
      if (!address) {
        if (this._accountAddress) {
          address = this._accountAddress;
          console.log(`Using account address: ${address}`);
        } else {
          // Try to get the address from the keypair (requires seed phrase)
          if (!(await this._ensureKeypair())) {
            throw new Error('No account address available');
          }
          address = this._keypair.address;
          console.log(`Using keypair address: ${address}`);
        }
      }

      // Query the blockchain for free credits
      console.log(`Querying free credits for account: ${address}`);

      // @ts-ignore - The types for query might not match perfectly, but this works
      const result = await this._substrate.query.credits.freeCredits(address);

      // If credits exist, convert to a float with 18 decimal places
      if (result) {
        // Convert from blockchain u128 to float (divide by 10^18)
        const creditsRaw = result.toString();
        const creditsFloat = Number(BigInt(creditsRaw) / 1_000_000_000_000_000_000n);
        console.log(`Free credits: ${creditsFloat} (${creditsRaw} raw value)`);
        return creditsFloat;
      } else {
        console.log(`No credits found for account: ${address}`);
        return 0;
      }
    } catch (error) {
      const errorMsg = `Error querying free credits: ${error}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
  }

  /**
   * Get detailed information about files stored by a user
   *
   * @param accountAddress Substrate account address (uses keypair address if not specified)
   * @returns List of file objects with details
   */
  async getUserFiles(accountAddress: string | null = null): Promise<any[]> {
    return this.getUserFilesFromProfile(accountAddress);
  }

  /**
   * Get user files by fetching the user profile CID
   *
   * @param accountAddress Substrate account address (uses keypair address if not specified)
   * @returns List of file objects from the user profile
   */
  async getUserFilesFromProfile(accountAddress: string | null = null): Promise<any[]> {
    try {
      // Initialize Substrate connection if not already connected
      if (!this._substrate) {
        await this.connect();
      }

      if (!this._substrate) {
        throw new Error('Could not connect to Substrate node');
      }

      // Use provided account address or default to keypair/configured address
      let address = accountAddress;
      if (!address) {
        if (this._accountAddress) {
          address = this._accountAddress;
          console.log(`Using account address: ${address}`);
        } else {
          // Try to get the address from the keypair (requires seed phrase)
          if (!(await this._ensureKeypair())) {
            throw new Error('No account address available');
          }
          address = this._keypair.address;
          console.log(`Using keypair address: ${address}`);
        }
      }

      // Query the blockchain for the user profile CID
      console.log(`Querying user profile for account: ${address}`);

      // @ts-ignore - The types for query might not match perfectly, but this works
      const result = await this._substrate.query.ipfsPallet.userProfile(address);

      // Check if a profile was found
      if (!result || result.toString() === '') {
        console.log(`No profile found for account: ${address}`);
        return [];
      }

      // The result is a hex-encoded IPFS CID
      // Handle both cases: bytes (needs hex conversion) and string (already hex)
      let hexCid: string;

      // Use type assertion to handle the unknown result type
      const resultValue = result as any;

      if (typeof resultValue === 'string') {
        hexCid = resultValue.startsWith('0x') ? resultValue.substring(2) : resultValue;
      } else {
        // Convert to Uint8Array for hex conversion
        hexCid = u8aToHex(resultValue as unknown as Uint8Array).substring(2);
      }

      console.log(`Found user profile CID (hex): ${hexCid}`);

      // Convert the hex CID to a readable IPFS CID
      const profileCid = hexToIpfsCid(hexCid);
      console.log(`Decoded IPFS CID: ${profileCid}`);

      // TODO: Fetch the profile JSON from IPFS
      // In a complete implementation, this would:
      // 1. Use an IPFSClient to get the profile data
      // 2. Parse the JSON
      // 3. Process the files from the profile

      // For now, return an empty array as a placeholder
      return [];
    } catch (error) {
      const errorMsg = `Error retrieving user files from profile: ${error}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
  }
}
