import { IPFSClient } from '../ipfs';
import { SubstrateClient, FileInput } from '../substrate';
import { getConfigValue, getEncryptionKey } from '../config';
import { formatCid, formatSize } from '../utils';

/**
 * Main client for interacting with the Hippius ecosystem.
 *
 * Provides IPFS operations, with Substrate functionality for storage requests.
 */
export class HippiusClient {
  ipfsClient: IPFSClient;
  substrateClient: SubstrateClient | null = null;

  /**
   * Initialize the Hippius client.
   *
   * @param ipfsGateway IPFS gateway URL for downloading content (from config if null)
   * @param ipfsApiUrl IPFS API URL for uploading content (from config if null)
   * @param substrateUrl WebSocket URL of the Hippius substrate node (from config if null)
   * @param substrateSeedPhrase Seed phrase for Substrate account (from config if null)
   * @param seedPhrasePassword Password to decrypt the seed phrase if it's encrypted
   * @param accountName Name of the account to use (uses active account if null)
   * @param encryptByDefault Whether to encrypt files by default (from config if null)
   * @param encryptionKey Encryption key for NaCl secretbox (from config if null)
   */
  constructor(
    ipfsGateway: string | null = null,
    ipfsApiUrl: string | null = null,
    substrateUrl: string | null = null,
    substrateSeedPhrase: string | null = null,
    seedPhrasePassword: string | null = null,
    accountName: string | null = null,
    encryptByDefault: boolean | null = null,
    encryptionKey: Buffer | null = null
  ) {
    // Load configuration values if not explicitly provided
    if (ipfsGateway === null) {
      ipfsGateway = getConfigValue('ipfs', 'gateway', 'https://get.hippius.network');
    }

    if (ipfsApiUrl === null) {
      ipfsApiUrl = getConfigValue('ipfs', 'api_url', 'https://store.hippius.network');

      // Check if local IPFS is enabled in config
      if (getConfigValue('ipfs', 'local_ipfs', false)) {
        ipfsApiUrl = 'http://localhost:5001';
      }
    }

    if (substrateUrl === null) {
      substrateUrl = getConfigValue('substrate', 'url', 'wss://rpc.hippius.network');
    }

    if (substrateSeedPhrase === null) {
      substrateSeedPhrase = getConfigValue('substrate', 'seed_phrase', null);
    }

    if (encryptByDefault === null) {
      encryptByDefault = getConfigValue('encryption', 'encrypt_by_default', false);
    }

    if (encryptionKey === null) {
      encryptionKey = getEncryptionKey();
    }

    // Initialize IPFS client
    const ipfsClient = new IPFSClient(ipfsGateway, ipfsApiUrl, encryptByDefault, encryptionKey);
    this.ipfsClient = ipfsClient;

    // Initialize Substrate client
    try {
      this.substrateClient = new SubstrateClient(
        substrateUrl,
        substrateSeedPhrase,
        seedPhrasePassword,
        accountName
      );
    } catch (error) {
      console.warn(`Warning: Could not initialize Substrate client: ${error}`);
      this.substrateClient = null;
    }
  }

  /**
   * Upload a file to IPFS with optional encryption.
   *
   * @param filePath Path to the file to upload
   * @param encrypt Whether to encrypt the file (overrides default)
   * @returns Object containing file details
   */
  async uploadFile(
    filePath: string,
    encrypt: boolean | null = null
  ): Promise<{
    cid: string;
    filename: string;
    size_bytes: number;
    size_formatted: string;
    encrypted: boolean;
  }> {
    // Use the IPFSClient method directly with encryption parameter
    const result = await this.ipfsClient.uploadFile(filePath, true, encrypt);

    // Ensure size_formatted is always present
    return {
      ...result,
      size_formatted: result.size_formatted || this.formatSize(result.size_bytes),
    };
  }

  /**
   * Upload a directory to IPFS with optional encryption.
   *
   * @param dirPath Path to the directory to upload
   * @param encrypt Whether to encrypt files (overrides default)
   * @returns Object containing directory details
   */
  async uploadDirectory(
    dirPath: string,
    encrypt: boolean | null = null
  ): Promise<{
    cid: string;
    dirname: string;
    file_count: number;
    total_size_bytes: number;
    size_formatted: string;
    encrypted: boolean;
  }> {
    // Use the IPFSClient method directly with encryption parameter
    const result = await this.ipfsClient.uploadDirectory(dirPath, true, encrypt);

    // Ensure size_formatted is always present
    return {
      ...result,
      size_formatted: result.size_formatted || this.formatSize(result.total_size_bytes),
    };
  }

  /**
   * Download a file from IPFS with optional decryption.
   *
   * @param cid Content Identifier (CID) of the file to download
   * @param outputPath Path where the downloaded file will be saved
   * @param decrypt Whether to decrypt the file (overrides default)
   * @returns Object containing download details
   */
  async downloadFile(
    cid: string,
    outputPath: string,
    decrypt: boolean | null = null
  ): Promise<{
    success: boolean;
    output_path: string;
    size_bytes: number;
    size_formatted: string;
    elapsed_seconds: number;
    decrypted: boolean;
  }> {
    return this.ipfsClient.downloadFile(cid, outputPath, decrypt);
  }

  /**
   * Get the content of a file from IPFS with optional decryption.
   *
   * @param cid Content Identifier (CID) of the file
   * @param maxDisplayBytes Maximum number of bytes to include in the preview
   * @param formatOutput Whether to attempt to decode the content as text
   * @param decrypt Whether to decrypt the file (overrides default)
   * @returns Object containing content details
   */
  async cat(
    cid: string,
    maxDisplayBytes: number = 1024,
    formatOutput: boolean = true,
    decrypt: boolean | null = null
  ): Promise<{
    content: Buffer;
    size_bytes: number;
    size_formatted: string;
    preview?: Buffer;
    is_text?: boolean;
    text_preview?: string;
    hex_preview?: string;
    decrypted: boolean;
  }> {
    return this.ipfsClient.cat(cid, maxDisplayBytes, formatOutput, decrypt);
  }

  /**
   * Check if a CID exists on IPFS.
   *
   * @param cid Content Identifier (CID) to check
   * @returns Object containing existence information
   */
  async exists(cid: string): Promise<{
    exists: boolean;
    cid: string;
    formatted_cid: string;
    gateway_url: string | null;
  }> {
    return this.ipfsClient.exists(cid);
  }

  /**
   * Pin a CID to IPFS to keep it available.
   *
   * @param cid Content Identifier (CID) to pin
   * @returns Object containing pinning status
   */
  async pin(cid: string): Promise<{
    success: boolean;
    cid: string;
    formatted_cid: string;
    message: string;
  }> {
    return this.ipfsClient.pin(cid);
  }

  /**
   * Check if a CID is pinned to IPFS
   *
   * @param cid Content Identifier (CID) to check
   * @returns Object containing pin status information
   */
  async isPinned(cid: string): Promise<{
    cid: string;
    pinned: boolean;
    formatted_cid: string;
    pin_type?: string;
    message?: string;
  }> {
    return this.ipfsClient.isPinned(cid);
  }

  /**
   * Format a CID for display.
   *
   * @param cid Content Identifier (CID) to format
   * @returns Formatted CID string
   */
  formatCid(cid: string): string {
    return formatCid(cid);
  }

  /**
   * Format a size in bytes to a human-readable string.
   *
   * @param sizeBytes Size in bytes
   * @returns Human-readable size string (e.g., '1.23 MB', '456.78 KB')
   */
  formatSize(sizeBytes: number): string {
    return formatSize(sizeBytes);
  }

  /**
   * Generate a new random encryption key for use with the SDK.
   *
   * @returns Base64-encoded encryption key
   */
  generateEncryptionKey(): string {
    return this.ipfsClient.generateEncryptionKey();
  }

  /**
   * Store a CID on the blockchain.
   *
   * @param cid Content Identifier (CID) to store
   * @param filename Original filename (optional)
   * @returns Transaction hash
   */
  async storeCid(cid: string, filename: string | null = null): Promise<string> {
    if (!this.substrateClient) {
      throw new Error('Substrate client is not initialized');
    }

    return this.substrateClient.storeCid(cid, filename);
  }

  /**
   * Submit a storage request for multiple files.
   *
   * @param files List of FileInput objects or objects with fileHash and fileName
   * @param minerIds Optional list of miner IDs to use for storage
   * @returns Transaction hash
   */
  async storageRequest(
    files: (FileInput | Record<string, string>)[],
    minerIds: string[] = []
  ): Promise<string> {
    if (!this.substrateClient) {
      throw new Error('Substrate client is not initialized');
    }

    return this.substrateClient.storageRequest(files, minerIds);
  }

  /**
   * Get the account balance.
   *
   * @param accountAddress Optional Substrate account address (uses default if not provided)
   * @returns Account balance information
   */
  async getAccountBalance(accountAddress: string | null = null): Promise<any> {
    if (!this.substrateClient) {
      throw new Error('Substrate client is not initialized');
    }

    return this.substrateClient.getAccountBalance(accountAddress);
  }

  /**
   * Get free credits available for the account.
   *
   * @param accountAddress Optional Substrate account address (uses default if not provided)
   * @returns Free credits amount
   */
  async getFreeCredits(accountAddress: string | null = null): Promise<number> {
    if (!this.substrateClient) {
      throw new Error('Substrate client is not initialized');
    }

    return this.substrateClient.getFreeCredits(accountAddress);
  }

  /**
   * Get files stored by a user.
   *
   * @param accountAddress Optional Substrate account address (uses default if not provided)
   * @returns List of file objects with details
   */
  async getUserFiles(accountAddress: string | null = null): Promise<any[]> {
    if (!this.substrateClient) {
      throw new Error('Substrate client is not initialized');
    }

    return this.substrateClient.getUserFiles(accountAddress);
  }
}
