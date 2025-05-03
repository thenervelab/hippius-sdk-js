import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import { IPFSClient } from '../ipfs';

// Mock implementation to bypass TypeScript errors
jest.mock('../ipfs/ipfs-core', () => {
  return {
    IPFSCore: jest.fn().mockImplementation(() => {
      return {
        initialize: jest.fn().mockResolvedValue(undefined),
        ensureInitialized: jest.fn().mockResolvedValue(undefined),
        helia: {},
        fs: {},
        addFile: jest.fn().mockImplementation(filePath => {
          return Promise.resolve({ Hash: 'QmTestHash123' });
        }),
        cat: jest.fn().mockImplementation(cid => {
          // For testing decryption, return a mock encrypted content if cid contains "encrypted"
          if (cid.includes('encrypted')) {
            // Create a mock encrypted content (IV + encrypted data)
            const iv = Buffer.alloc(16).fill(1);
            const encryptedContent = Buffer.alloc(32).fill(2);
            return Promise.resolve(Buffer.concat([iv, encryptedContent]));
          }
          return Promise.resolve(Buffer.from('test content'));
        }),
        downloadFile: jest.fn().mockImplementation((cid, outputPath) => {
          return Promise.resolve(outputPath);
        }),
        exists: jest.fn().mockImplementation(cid => {
          return Promise.resolve(true);
        }),
        pin: jest.fn().mockImplementation(cid => {
          return Promise.resolve({ Pins: [cid] });
        }),
      };
    }),
  };
});

describe('IPFSClient', () => {
  let client: IPFSClient;
  let testFile: string;

  beforeEach(() => {
    client = new IPFSClient('https://get.hippius.network', 'http://localhost:5001', false);

    // Create a test file
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hippius-test-'));
    testFile = path.join(tmpDir, 'test-file.txt');
    fs.writeFileSync(testFile, 'test content');
  });

  afterEach(() => {
    // Clean up test file
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
      fs.rmdirSync(path.dirname(testFile));
    }

    jest.clearAllMocks();
  });

  describe('encryption functionality', () => {
    it('generates encryption keys', () => {
      const key = client.generateEncryptionKey();
      expect(key).toBeTruthy();
      expect(Buffer.from(key, 'base64').length).toBe(32); // 256 bits
    });

    // Testing encryption/decryption with a known key
    it('encrypts and decrypts data correctly', () => {
      // Create a client with a known encryption key
      const testKey = Buffer.alloc(32).fill(0); // All zeros for testing
      const encryptClient = new IPFSClient(
        'https://get.hippius.network',
        'http://localhost:5001',
        true,
        testKey
      );

      const testData = Buffer.from('secret message');
      const encrypted = encryptClient.encryptData(testData);

      // Encrypted data should be different from original
      expect(encrypted).not.toEqual(testData);

      // Should be longer due to IV prefix
      expect(encrypted.length).toBeGreaterThan(testData.length);

      // Decryption should recover the original data
      const decrypted = encryptClient.decryptData(encrypted);
      expect(decrypted).toEqual(testData);
    });
  });

  describe('file operations', () => {
    it('uploads a file successfully', async () => {
      const result = await client.uploadFile(testFile);

      expect(result.cid).toBe('QmTestHash123');
      expect(result.filename).toBe(path.basename(testFile));
      expect(result.size_bytes).toBeGreaterThan(0);
      expect(result.size_formatted).toBeDefined();
      expect(result.encrypted).toBe(false);
    });

    it('checks if a CID exists', async () => {
      const result = await client.exists('QmTestCid');

      expect(result.exists).toBe(true);
      expect(result.cid).toBe('QmTestCid');
      expect(result.formatted_cid).toBe('QmTestCid');
      expect(result.gateway_url).toBe('https://get.hippius.network/ipfs/QmTestCid');
    });

    it('pins a CID successfully', async () => {
      const result = await client.pin('QmTestCid');

      expect(result.success).toBe(true);
      expect(result.cid).toBe('QmTestCid');
      expect(result.formatted_cid).toBe('QmTestCid');
    });

    it('retrieves content correctly', async () => {
      const result = await client.cat('QmTestCid');

      expect(result.content).toEqual(Buffer.from('test content'));
      expect(result.size_bytes).toBe('test content'.length);
      expect(result.size_formatted).toBeDefined();
      expect(result.is_text).toBe(true);
      expect(result.text_preview).toBe('test content');
      expect(result.decrypted).toBe(false);
    });
  });
});
