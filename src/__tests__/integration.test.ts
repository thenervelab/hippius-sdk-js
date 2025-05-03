import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { HippiusClient } from '../client';

// This test won't run by default - it's marked with 'skip'
// This is because it requires a real IPFS node or network access
describe.skip('Integration Tests', () => {
  let client: HippiusClient;
  let testFile: string;
  const testFileContent: string = 'This is a test file for Hippius SDK.';
  let uploadedCid: string;

  beforeAll(() => {
    // Initialize client
    client = new HippiusClient();

    // Create a test file
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hippius-integration-test-'));
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

  it('uploads a file to IPFS', async () => {
    // 1. Upload a file to IPFS
    const result = await client.uploadFile(testFile);
    uploadedCid = result.cid;

    expect(result.cid).toBeDefined();
    expect(result.cid.length).toBeGreaterThan(0);
    expect(result.filename).toBe(path.basename(testFile));
    expect(result.size_bytes).toBe(testFileContent.length);
    expect(result.size_formatted).toBeDefined();
    console.log(`File uploaded with CID: ${result.cid}`);
  }, 30000);

  it('checks if a file exists on IPFS', async () => {
    // 2. Check if the file exists
    const existsResult = await client.exists(uploadedCid);

    expect(existsResult.exists).toBe(true);
    expect(existsResult.cid).toBe(uploadedCid);
    expect(existsResult.gateway_url).toBeDefined();
    console.log(`File exists: ${existsResult.exists}`);
  }, 10000);

  it('gets file content from IPFS', async () => {
    // 3. Get file content
    const contentResult = await client.cat(uploadedCid);

    expect(contentResult.content).toBeDefined();
    expect(contentResult.is_text).toBe(true);
    expect(contentResult.text_preview).toBe(testFileContent);
    console.log(`Content preview: ${contentResult.text_preview}`);
  }, 10000);

  it('downloads a file from IPFS', async () => {
    // 4. Download the file
    const downloadPath = path.join(os.tmpdir(), 'downloaded_file.txt');
    const dlResult = await client.downloadFile(uploadedCid, downloadPath);

    expect(dlResult.success).toBe(true);
    expect(dlResult.output_path).toBe(downloadPath);
    expect(dlResult.size_bytes).toBe(testFileContent.length);

    // Verify the file exists and content matches
    expect(fs.existsSync(downloadPath)).toBe(true);
    expect(fs.readFileSync(downloadPath, 'utf8')).toBe(testFileContent);
    console.log(`Download successful: ${dlResult.success}`);
  }, 20000);

  it('pins a file on IPFS', async () => {
    // 5. Pin the file
    const pinResult = await client.pin(uploadedCid);

    expect(pinResult.success).toBe(true);
    expect(pinResult.cid).toBe(uploadedCid);
    console.log(`Pinning successful: ${pinResult.success}`);
  }, 10000);

  it('generates encryption keys', () => {
    // 7. Generate encryption key
    const encryptionKey = client.generateEncryptionKey();

    expect(encryptionKey).toBeDefined();
    expect(encryptionKey.length).toBeGreaterThan(0);
    console.log(`Encryption key generated`);
  });
});
