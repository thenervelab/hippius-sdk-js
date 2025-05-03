import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { HippiusClient } from '../client';
import { IPFSClient } from '../ipfs';
import { SubstrateClient } from '../substrate';

// Mock the dependencies
// Use a more direct mock approach to avoid type issues
jest.mock('../ipfs');
const mockIpfsClient = {
  uploadFile: jest.fn().mockResolvedValue({
    cid: 'QmTestHash123',
    filename: 'test-file.txt',
    size_bytes: 100,
    encrypted: false,
  }),
  downloadFile: jest.fn().mockResolvedValue({
    success: true,
    output_path: '/output/path',
    size_bytes: 100,
    size_formatted: '100 B',
    elapsed_seconds: 0.5,
    decrypted: false,
  }),
  cat: jest.fn().mockResolvedValue({
    content: Buffer.from('test content'),
    size_bytes: 'test content'.length,
    size_formatted: '12 B',
    is_text: true,
    text_preview: 'test content',
    decrypted: false,
  }),
  exists: jest.fn().mockResolvedValue({
    exists: true,
    cid: 'QmTestCid',
    formatted_cid: 'QmTestCid',
    gateway_url: 'https://get.hippius.network/ipfs/QmTestCid',
  }),
  pin: jest.fn().mockResolvedValue({
    success: true,
    cid: 'QmTestCid',
    formatted_cid: 'QmTestCid',
    message: 'Successfully pinned',
  }),
  generateEncryptionKey: jest.fn().mockReturnValue('dGVzdEtleQ=='), // 'testKey' in base64
};

(IPFSClient as jest.Mock).mockImplementation(() => mockIpfsClient);

jest.mock('../substrate');
const mockSubstrateClient = {
  connect: jest.fn().mockResolvedValue(true),
  storeCid: jest.fn().mockResolvedValue('test-tx-hash'),
  storageRequest: jest.fn().mockResolvedValue('test-tx-hash'),
  getAccountBalance: jest.fn().mockResolvedValue({
    free: 100,
    reserved: 50,
    frozen: 0,
    total: 150,
  }),
  getFreeCredits: jest.fn().mockResolvedValue(1000),
  getUserFiles: jest.fn().mockResolvedValue([]),
};

(SubstrateClient as jest.Mock).mockImplementation(() => mockSubstrateClient);

// Also mock the FileInput class
class MockFileInput {
  fileHash: string;
  fileName: string;

  constructor(fileHash: string, fileName: string) {
    this.fileHash = fileHash;
    this.fileName = fileName;
  }

  toDict() {
    return { fileHash: this.fileHash, fileName: this.fileName };
  }
}

describe('HippiusClient', () => {
  let client: HippiusClient;
  let testFile: string;

  beforeEach(() => {
    client = new HippiusClient();

    // Create a test file
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hippius-test-'));
    testFile = path.join(tmpDir, 'test-file.txt');
    fs.writeFileSync(testFile, 'test content');
  });

  afterEach(() => {
    // Clean up the test file
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
      fs.rmdirSync(path.dirname(testFile));
    }

    jest.clearAllMocks();
  });

  it('initializes with default values', () => {
    expect(client.ipfsClient).toBeDefined();
    expect(client.substrateClient).not.toBeNull();
  });

  it('uploads a file successfully', async () => {
    const result = await client.uploadFile(testFile);

    expect(result.cid).toBe('QmTestHash123');
    expect(result.filename).toBe('test-file.txt');
    expect(result.size_bytes).toBe(100);
    expect(result.size_formatted).toBeDefined();
    expect(result.encrypted).toBe(false);

    expect(client.ipfsClient.uploadFile).toHaveBeenCalledWith(testFile, true, null);
  });

  it('checks if a file exists', async () => {
    const result = await client.exists('QmTestCid');

    expect(result.exists).toBe(true);
    expect(result.cid).toBe('QmTestCid');
    expect(result.formatted_cid).toBe('QmTestCid');
    expect(result.gateway_url).toBe('https://get.hippius.network/ipfs/QmTestCid');

    expect(client.ipfsClient.exists).toHaveBeenCalledWith('QmTestCid');
  });

  it('pins a file successfully', async () => {
    const result = await client.pin('QmTestCid');

    expect(result.success).toBe(true);
    expect(result.cid).toBe('QmTestCid');
    expect(result.message).toBe('Successfully pinned');

    expect(client.ipfsClient.pin).toHaveBeenCalledWith('QmTestCid');
  });

  it('gets file content correctly', async () => {
    const result = await client.cat('QmTestCid');

    expect(result.content).toEqual(Buffer.from('test content'));
    expect(result.size_bytes).toBe('test content'.length);
    expect(result.is_text).toBe(true);
    expect(result.text_preview).toBe('test content');

    expect(client.ipfsClient.cat).toHaveBeenCalledWith('QmTestCid', 1024, true, null);
  });

  it('downloads a file correctly', async () => {
    const outputPath = path.join(os.tmpdir(), 'downloaded-test-file.txt');
    const result = await client.downloadFile('QmTestCid', outputPath);

    expect(result.success).toBe(true);
    expect(result.output_path).toBe('/output/path');
    expect(result.size_bytes).toBe(100);
    expect(result.elapsed_seconds).toBe(0.5);

    expect(client.ipfsClient.downloadFile).toHaveBeenCalledWith('QmTestCid', outputPath, null);
  });

  it('stores a CID on the blockchain', async () => {
    const result = await client.storeCid('QmTestCid', 'test-file.txt');

    expect(result).toBe('test-tx-hash');
    expect(client.substrateClient?.storeCid).toHaveBeenCalledWith('QmTestCid', 'test-file.txt');
  });

  it('generates an encryption key', () => {
    const key = client.generateEncryptionKey();

    expect(key).toBe('dGVzdEtleQ==');
    expect(client.ipfsClient.generateEncryptionKey).toHaveBeenCalled();
  });

  it('formats a CID correctly', () => {
    const formatted = client.formatCid('QmTestCid');
    expect(formatted).toBe('QmTestCid');
  });

  it('formats sizes correctly', () => {
    expect(client.formatSize(1024)).toBe('1.00 KB');
    expect(client.formatSize(1048576)).toBe('1.00 MB');
  });
});
