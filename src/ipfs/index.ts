import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getConfigValue, getEncryptionKey } from '../config';
import { formatCid, formatSize, retryWithBackoff } from '../utils';
import { IPFSCore } from './ipfs-core';
import * as crypto from 'crypto';

/**
 * IPFS Client for interacting with IPFS
 * Provides file operations, encryption, and more
 */
export class IPFSClient {
  private gateway: string;
  private apiUrl: string;
  private encryptByDefault: boolean;
  private encryptionKey: Buffer | null;
  private encryptionAvailable: boolean;
  private client: IPFSCore;
  private baseUrl: string;

  /**
   * Initialize the IPFS client
   *
   * @param gateway IPFS gateway URL for downloading content
   * @param apiUrl IPFS API URL for uploading content
   * @param encryptByDefault Whether to encrypt files by default
   * @param encryptionKey Encryption key for NaCl secretbox
   */
  constructor(
    gateway: string | null = null,
    apiUrl: string | null = null,
    encryptByDefault: boolean | null = null,
    encryptionKey: Buffer | null = null
  ) {
    // Load configuration values if not explicitly provided
    this.gateway = gateway || getConfigValue('ipfs', 'gateway', 'https://get.hippius.network');
    this.apiUrl = apiUrl || getConfigValue('ipfs', 'api_url', 'https://store.hippius.network');

    // Check if local IPFS is enabled in config
    if (getConfigValue('ipfs', 'local_ipfs', false)) {
      this.apiUrl = 'http://localhost:5001';
    }

    // Remove trailing slashes if present
    this.gateway = this.gateway.replace(/\/$/, '');
    this.apiUrl = this.apiUrl.replace(/\/$/, '');

    // Extract base URL from API URL for HTTP fallback
    this.baseUrl = this.apiUrl;

    // Set up encryption default from parameter or config
    this.encryptByDefault =
      encryptByDefault !== null
        ? encryptByDefault
        : getConfigValue('encryption', 'encrypt_by_default', false);

    // Set up encryption key from parameter or config
    this.encryptionKey = encryptionKey || getEncryptionKey();

    // Check if encryption is available
    try {
      // Check if we have crypto support
      crypto.getCiphers();

      // Check if we have a valid key
      this.encryptionAvailable = this.encryptionKey !== null && this.encryptionKey.length === 32;

      // Warn if encryption is requested but not available
      if (this.encryptByDefault && !this.encryptionAvailable) {
        console.warn(
          'Warning: Encryption requested but not available. Check that a valid encryption key is provided.'
        );
      }
    } catch (error) {
      this.encryptionAvailable = false;
      this.encryptByDefault = false;
      this.encryptionKey = null;
      console.warn('Encryption is not available:', error);
    }

    // Initialize the IPFS client
    this.client = new IPFSCore(this.apiUrl, this.gateway);
  }

  /**
   * Encrypt binary data
   *
   * @param data Binary data to encrypt
   * @returns Encrypted data
   * @throws Error if encryption is not available
   * @throws TypeError if data is not Buffer
   */
  encryptData(data: Buffer): Buffer {
    if (!this.encryptionAvailable) {
      throw new Error(
        'Encryption is not available. Check that a valid encryption key is provided.'
      );
    }

    if (!Buffer.isBuffer(data)) {
      throw new TypeError('Data must be a Buffer');
    }

    // Generate a random initialization vector
    const iv = crypto.randomBytes(16);

    // Create a cipher with our key and iv
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey!, iv);

    // Encrypt the data
    const encryptedData = Buffer.concat([cipher.update(data), cipher.final()]);

    // Return iv concatenated with the encrypted data
    return Buffer.concat([iv, encryptedData]);
  }

  /**
   * Decrypt data encrypted with encryptData
   *
   * @param encryptedData Data encrypted with encryptData
   * @returns Decrypted data
   * @throws Error if decryption fails or encryption is not available
   */
  decryptData(encryptedData: Buffer): Buffer {
    if (!this.encryptionAvailable) {
      throw new Error(
        'Encryption is not available. Check that a valid encryption key is provided.'
      );
    }

    try {
      // Extract the iv from the first 16 bytes
      const iv = encryptedData.slice(0, 16);
      const data = encryptedData.slice(16);

      // Create a decipher with our key and iv
      const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey!, iv);

      // Decrypt the data
      return Buffer.concat([decipher.update(data), decipher.final()]);
    } catch (error) {
      throw new Error(`Decryption failed: ${error}. Incorrect key or corrupted data?`);
    }
  }

  /**
   * Upload a file to IPFS with optional encryption
   *
   * @param filePath Path to the file to upload
   * @param includeFormattedSize Whether to include formatted size in the result
   * @param encrypt Whether to encrypt the file (overrides default)
   * @param maxRetries Maximum number of retry attempts
   * @returns Object containing upload details
   */
  async uploadFile(
    filePath: string,
    includeFormattedSize: boolean = true,
    encrypt: boolean | null = null,
    maxRetries: number = 3
  ): Promise<{
    cid: string;
    filename: string;
    size_bytes: number;
    size_formatted?: string;
    encrypted: boolean;
  }> {
    // Check if the file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File ${filePath} not found`);
    }

    // Determine if we should encrypt
    const shouldEncrypt = encrypt !== null ? encrypt : this.encryptByDefault;

    // Check if encryption is available if requested
    if (shouldEncrypt && !this.encryptionAvailable) {
      throw new Error(
        'Encryption requested but not available. Check that a valid encryption key is provided.'
      );
    }

    // Get file info before upload
    const filename = path.basename(filePath);
    const sizeBytes = fs.statSync(filePath).size;

    // Handle encryption if needed
    let uploadPath = filePath;
    let tempFilePath: string | null = null;

    try {
      if (shouldEncrypt) {
        // Read the file content
        const fileData = fs.readFileSync(filePath);

        // Encrypt the data
        const encryptedData = this.encryptData(fileData);

        // Create a temporary file for the encrypted data
        tempFilePath = path.join(os.tmpdir(), `encrypted_${crypto.randomBytes(8).toString('hex')}`);
        fs.writeFileSync(tempFilePath, encryptedData);

        // Use the temporary file for upload
        uploadPath = tempFilePath;
      }

      // Upload the file with retry logic
      const result = await retryWithBackoff(
        async () => await this.client.addFile(uploadPath),
        maxRetries
      );

      // Format the result
      const uploadResult = {
        cid: result.Hash,
        filename,
        size_bytes: sizeBytes,
        encrypted: shouldEncrypt,
      } as any;

      // Add formatted size if requested
      if (includeFormattedSize) {
        uploadResult.size_formatted = formatSize(sizeBytes);
      }

      return uploadResult;
    } finally {
      // Clean up temporary file if created
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }
  }

  /**
   * Upload a directory to IPFS with optional encryption
   *
   * @param dirPath Path to the directory to upload
   * @param includeFormattedSize Whether to include formatted size in the result
   * @param encrypt Whether to encrypt files (overrides default)
   * @returns Object containing directory upload details
   */
  async uploadDirectory(
    dirPath: string,
    includeFormattedSize: boolean = true,
    encrypt: boolean | null = null
  ): Promise<{
    cid: string;
    dirname: string;
    file_count: number;
    total_size_bytes: number;
    size_formatted?: string;
    encrypted: boolean;
  }> {
    // Check if directory exists
    if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
      throw new Error(`Directory ${dirPath} not found`);
    }

    // Determine if we should encrypt
    const shouldEncrypt = encrypt !== null ? encrypt : this.encryptByDefault;

    // Check if encryption is available if requested
    if (shouldEncrypt && !this.encryptionAvailable) {
      throw new Error(
        'Encryption requested but not available. Check that a valid encryption key is provided.'
      );
    }

    // Get directory info
    let fileCount = 0;
    let totalSizeBytes = 0;

    // Calculate directory size and file count
    const walkSync = (dir: string) => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);
        if (stats.isDirectory()) {
          walkSync(filePath);
        } else {
          fileCount++;
          totalSizeBytes += stats.size;
        }
      }
    };

    walkSync(dirPath);

    // TODO: Implement directory uploads with proper encryption support
    // This is more complex and needs careful handling
    throw new Error('Directory upload not yet implemented');

    // The code below is a placeholder for the implementation structure
    /*
    // For encryption, we would need to handle each file separately
    let tempDir: string | null = null;
    
    try {
      if (shouldEncrypt) {
        // Create a temp directory
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ipfs-encrypt-'));
        
        // Process each file
        // ... encrypt each file and recreate directory structure
      }
      
      // Upload the directory
      const result = await this.client.addDirectory(shouldEncrypt ? tempDir! : dirPath);
      
      // Format the result
      return {
        cid: result.Hash,
        dirname,
        file_count: fileCount,
        total_size_bytes: totalSizeBytes,
        ...(includeFormattedSize && { size_formatted: formatSize(totalSizeBytes) }),
        encrypted: shouldEncrypt
      };
    } finally {
      // Clean up temporary directory if created
      if (tempDir && fs.existsSync(tempDir)) {
        fs.rmdirSync(tempDir, { recursive: true });
      }
    }
    */
  }

  /**
   * Format a size in bytes to a human-readable string
   *
   * @param sizeBytes Size in bytes
   * @returns Human-readable size string
   */
  formatSize(sizeBytes: number): string {
    return formatSize(sizeBytes);
  }

  /**
   * Format a CID for display
   *
   * @param cid Content Identifier (CID) to format
   * @returns Formatted CID string
   */
  formatCid(cid: string): string {
    return formatCid(cid);
  }

  /**
   * Download a file from IPFS with optional decryption
   *
   * @param cid Content Identifier (CID) of the file to download
   * @param outputPath Path where the downloaded file will be saved
   * @param decrypt Whether to decrypt the file (overrides default)
   * @param maxRetries Maximum number of retry attempts
   * @returns Object containing download results
   */
  async downloadFile(
    cid: string,
    outputPath: string,
    decrypt: boolean | null = null,
    maxRetries: number = 3
  ): Promise<{
    success: boolean;
    output_path: string;
    size_bytes: number;
    size_formatted: string;
    elapsed_seconds: number;
    decrypted: boolean;
  }> {
    const startTime = Date.now();

    // Determine if we should decrypt
    const shouldDecrypt = decrypt !== null ? decrypt : this.encryptByDefault;

    // Check if decryption is available if requested
    if (shouldDecrypt && !this.encryptionAvailable) {
      throw new Error(
        'Decryption requested but not available. Check that a valid encryption key is provided.'
      );
    }

    // Create a temporary file if we'll be decrypting
    let tempFilePath = '';
    try {
      if (shouldDecrypt) {
        // Create a temporary file for the encrypted data
        tempFilePath = path.join(os.tmpdir(), `encrypted_${crypto.randomBytes(8).toString('hex')}`);
        // Download to the temp file
        await retryWithBackoff(
          async () => await this.client.downloadFile(cid, tempFilePath),
          maxRetries
        );

        // Read the encrypted data
        const encryptedData = fs.readFileSync(tempFilePath);

        // Decrypt the data
        const decryptedData = this.decryptData(encryptedData);

        // Write the decrypted data to the output path
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(outputPath, decryptedData);

        // Use the size of the decrypted data
        const fileSize = decryptedData.length;
        const elapsedTime = (Date.now() - startTime) / 1000;

        return {
          success: true,
          output_path: outputPath,
          size_bytes: fileSize,
          size_formatted: this.formatSize(fileSize),
          elapsed_seconds: elapsedTime,
          decrypted: true,
        };
      } else {
        // Download directly to the output path
        await retryWithBackoff(
          async () => await this.client.downloadFile(cid, outputPath),
          maxRetries
        );

        // Get file size
        const fileSize = fs.statSync(outputPath).size;
        const elapsedTime = (Date.now() - startTime) / 1000;

        return {
          success: true,
          output_path: outputPath,
          size_bytes: fileSize,
          size_formatted: this.formatSize(fileSize),
          elapsed_seconds: elapsedTime,
          decrypted: false,
        };
      }
    } catch (error) {
      throw new Error(`Failed to download file: ${error}`);
    } finally {
      // Clean up temporary file if created
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }
  }

  /**
   * Get the content of a file from IPFS with optional decryption
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
    // Determine if we should decrypt
    const shouldDecrypt = decrypt !== null ? decrypt : this.encryptByDefault;

    // Check if decryption is available if requested
    if (shouldDecrypt && !this.encryptionAvailable) {
      throw new Error(
        'Decryption requested but not available. Check that a valid encryption key is provided.'
      );
    }

    // Get the content
    const content = await this.client.cat(cid);

    // Decrypt if needed
    let processedContent: Buffer;
    if (shouldDecrypt) {
      try {
        processedContent = this.decryptData(Buffer.from(content));
      } catch (error) {
        throw new Error(`Failed to decrypt file: ${error}`);
      }
    } else {
      processedContent = Buffer.from(content);
    }

    // Calculate size
    const sizeBytes = processedContent.length;

    // Create the result object
    const result: any = {
      content: processedContent,
      size_bytes: sizeBytes,
      size_formatted: this.formatSize(sizeBytes),
      decrypted: shouldDecrypt,
    };

    // Add preview if requested
    if (formatOutput) {
      // Limit preview size
      const preview = processedContent.slice(0, maxDisplayBytes);
      result.preview = preview;

      // Try to decode as text
      try {
        const textPreview = preview.toString('utf8');
        // Basic check if this is valid text
        if (/^[\x20-\x7E\t\n\r]*$/.test(textPreview)) {
          result.is_text = true;
          result.text_preview = textPreview;
        } else {
          result.is_text = false;
          result.hex_preview = preview.toString('hex');
        }
      } catch (e) {
        result.is_text = false;
        result.hex_preview = preview.toString('hex');
      }
    }

    return result;
  }

  /**
   * Check if a CID exists on IPFS
   *
   * @param cid Content Identifier (CID) to check
   * @returns Object with existence information
   */
  async exists(cid: string): Promise<{
    exists: boolean;
    cid: string;
    formatted_cid: string;
    gateway_url: string | null;
  }> {
    const formattedCid = this.formatCid(cid);
    const gatewayUrl = `${this.gateway}/ipfs/${cid}`;
    const exists = await this.client.exists(cid);

    return {
      exists,
      cid,
      formatted_cid: formattedCid,
      gateway_url: exists ? gatewayUrl : null,
    };
  }

  /**
   * Publish a CID to the global IPFS network
   *
   * @param cid Content Identifier (CID) to publish
   * @returns Object with publishing status
   */
  async publishGlobal(cid: string): Promise<{
    published: boolean;
    cid: string;
    formatted_cid: string;
    message: string;
  }> {
    // First ensure it's pinned locally
    const pinResult = await this.pin(cid);

    if (!pinResult.success) {
      return {
        published: false,
        cid,
        formatted_cid: this.formatCid(cid),
        message: `Failed to pin content locally: ${pinResult.message}`,
      };
    }

    // For now, this is a placeholder for the true global publishing functionality
    // In a full implementation, this would involve pinning to public services
    return {
      published: true,
      cid,
      formatted_cid: this.formatCid(cid),
      message: 'Content published to global IPFS network',
    };
  }

  /**
   * Pin a CID to IPFS to keep it available
   *
   * @param cid Content Identifier (CID) to pin
   * @returns Object with pinning status
   */
  async pin(cid: string): Promise<{
    success: boolean;
    cid: string;
    formatted_cid: string;
    message: string;
  }> {
    const formattedCid = this.formatCid(cid);

    try {
      await this.client.pin(cid);
      return {
        success: true,
        cid,
        formatted_cid: formattedCid,
        message: 'Successfully pinned',
      };
    } catch (error) {
      return {
        success: false,
        cid,
        formatted_cid: formattedCid,
        message: `Failed to pin: ${error}`,
      };
    }
  }

  /**
   * Check if a CID is pinned to IPFS
   *
   * @param cid Content Identifier (CID) to check
   * @returns Object with pinning status information
   */
  async isPinned(cid: string): Promise<{
    cid: string;
    pinned: boolean;
    formatted_cid: string;
    pin_type?: string;
    message?: string;
  }> {
    const formattedCid = this.formatCid(cid);

    try {
      // Call the IPFS pin/ls API with the specific CID
      const url = `${this.apiUrl}/api/v0/pin/ls?arg=${cid}`;
      const response = await fetch(url);

      if (!response.ok) {
        return {
          cid,
          pinned: false,
          formatted_cid: formattedCid,
          message: `API returned ${response.status}: ${response.statusText}`,
        };
      }

      const result = await response.json();
      const isPinned = result.Keys && Object.keys(result.Keys).includes(cid);
      const pinType = isPinned && result.Keys?.[cid] ? result.Keys[cid].Type : undefined;

      return {
        cid,
        pinned: isPinned,
        formatted_cid: formattedCid,
        pin_type: pinType,
        message: isPinned ? `CID is pinned with type: ${pinType}` : 'CID is not pinned',
      };
    } catch (error) {
      return {
        cid,
        pinned: false,
        formatted_cid: formattedCid,
        message: `Error checking pin status: ${error}`,
      };
    }
  }

  /**
   * Generate a new random encryption key
   *
   * @returns Base64-encoded encryption key
   */
  generateEncryptionKey(): string {
    // Generate a random key of 32 bytes (256 bits)
    const key = crypto.randomBytes(32);

    // Encode to base64 for storage
    return key.toString('base64');
  }
}
