import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { HippiusClient } from '../client';
import { IPFSClient } from '../ipfs';

// This test directly uses the IPFS network
// It is skipped by default to avoid network dependencies in CI
// Run with: npx jest src/__tests__/real-ipfs.test.ts
describe('Hippius SDK Integration Tests (Real IPFS)', () => {
  let client: HippiusClient;
  let ipfsClient: IPFSClient;
  let testFile: string;
  const testFileContent: string = 'This is a test file for Hippius SDK.';
  let uploadedCid: string;

  beforeAll(() => {
    // Initialize client with real IPFS endpoints
    client = new HippiusClient(
      'https://get.hippius.network', // Standard IPFS gateway
      'https://store.hippius.network', // Hippius API URL from Python SDK config
      null, // Use default Substrate URL
      null, // No seed phrase for now
      null, // No password
      null, // No account name
      false, // Don't encrypt by default
      null // No encryption key
    );

    ipfsClient = new IPFSClient(
      'https://get.hippius.network',
      'https://store.hippius.network',
      false // Don't encrypt by default
    );

    // Create a test file
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hippius-test-'));
    testFile = path.join(tmpDir, 'test_file.txt');
    fs.writeFileSync(testFile, testFileContent);
  });

  afterAll(() => {
    // Clean up test file
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
      fs.rmdirSync(path.dirname(testFile), { recursive: true });
    }

    // Clean up downloaded file if it exists
    const downloadPath = path.join(os.tmpdir(), 'downloaded_file.txt');
    if (fs.existsSync(downloadPath)) {
      fs.unlinkSync(downloadPath);
    }
  });

  // Note: This test might take time as it needs network access
  it('uploads a file to IPFS', async () => {
    // 1. Upload a file to IPFS
    const result = await ipfsClient.uploadFile(testFile, true, false);
    uploadedCid = result.cid;

    expect(result.cid).toBeDefined();
    expect(result.cid.length).toBeGreaterThan(0);
    expect(result.filename).toBe(path.basename(testFile));
    expect(result.size_bytes).toBe(testFileContent.length);
    expect(result.size_formatted).toBeDefined();
    console.log(`File uploaded with CID: ${result.cid}`);
  }, 60000); // 1 minute timeout

  it('checks if a file exists on IPFS', async () => {
    // Skip if upload failed
    if (!uploadedCid) {
      console.warn('Skipping test because upload failed');
      return;
    }

    // 2. Check if the file exists
    const existsResult = await ipfsClient.exists(uploadedCid);

    expect(existsResult.exists).toBe(true);
    expect(existsResult.cid).toBe(uploadedCid);
    expect(existsResult.gateway_url).toBeDefined();
    console.log(`File exists: ${existsResult.exists}`);
  }, 30000); // 30 second timeout

  it('gets file content from IPFS', async () => {
    // Skip if upload failed
    if (!uploadedCid) {
      console.warn('Skipping test because upload failed');
      return;
    }

    // 3. Get file content
    const contentResult = await ipfsClient.cat(uploadedCid);

    expect(contentResult.content).toBeDefined();
    expect(contentResult.is_text).toBe(true);
    expect(contentResult.text_preview).toBe(testFileContent);
    console.log(`Content preview: ${contentResult.text_preview}`);
  }, 30000); // 30 second timeout

  it('downloads a file from IPFS', async () => {
    // Skip if upload failed
    if (!uploadedCid) {
      console.warn('Skipping test because upload failed');
      return;
    }

    // 4. Download the file
    const downloadPath = path.join(os.tmpdir(), 'downloaded_file.txt');
    const dlResult = await ipfsClient.downloadFile(uploadedCid, downloadPath);

    expect(dlResult.success).toBe(true);
    expect(dlResult.output_path).toBe(downloadPath);
    expect(dlResult.size_bytes).toBe(testFileContent.length);

    // Verify the file exists and content matches
    expect(fs.existsSync(downloadPath)).toBe(true);
    expect(fs.readFileSync(downloadPath, 'utf8')).toBe(testFileContent);
    console.log(`Download successful: ${dlResult.success}`);
  }, 30000); // 30 second timeout

  it('pins a file on IPFS', async () => {
    // Skip if upload failed
    if (!uploadedCid) {
      console.warn('Skipping test because upload failed');
      return;
    }

    // 5. Pin the file
    const pinResult = await ipfsClient.pin(uploadedCid);

    // Pinning might fail on some public gateways, so we don't strictly test for success
    console.log(`Pinning result: ${JSON.stringify(pinResult)}`);
    expect(pinResult.cid).toBe(uploadedCid);
  }, 30000); // 30 second timeout

  it('generates encryption keys', () => {
    // 7. Generate encryption key
    const encryptionKey = ipfsClient.generateEncryptionKey();

    expect(encryptionKey).toBeDefined();
    expect(encryptionKey.length).toBeGreaterThan(0);

    // Verify it's a valid base64 string
    const buffer = Buffer.from(encryptionKey, 'base64');
    expect(buffer.length).toBe(32); // 256 bits
    console.log(`Encryption key generated: ${encryptionKey.substring(0, 10)}...`);
  });
});
