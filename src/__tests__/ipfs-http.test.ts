import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import fetch from 'node-fetch';

// This test uses direct HTTP calls to IPFS gateways and APIs
describe('IPFS HTTP API Tests', () => {
  const ipfsGateway = 'https://get.hippius.network';
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const ipfsApiUrl = 'https://store.hippius.network';

  let testFile: string;
  let testFileContent: string;

  beforeAll(() => {
    // Create a temporary test file
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hippius-test-'));
    testFile = path.join(tmpDir, 'test_file.txt');
    testFileContent = 'This is a test file for Hippius SDK. ' + Date.now();
    fs.writeFileSync(testFile, testFileContent);

    console.log(`Created test file at: ${testFile}`);
    console.log(`File content: ${testFileContent}`);
  });

  afterAll(() => {
    // Clean up test file
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
      fs.rmdirSync(path.dirname(testFile), { recursive: true });
    }
  });

  // Test uploading a file to IPFS using fetch with FormData
  it('can upload a file to IPFS using HTTP API', async () => {
    // This test depends on external IPFS service availability
    // We'll use the w3s.link gateway which allows uploads
    const uploadUrl = 'https://api.web3.storage/upload';
    const apiKey = process.env.WEB3_STORAGE_API_KEY;

    // Skip test if no API key is available
    if (!apiKey) {
      console.log('Skipping upload test - no Web3.Storage API key available');
      return;
    }

    // Read the file
    const fileContent = fs.readFileSync(testFile);

    // Upload using fetch
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: fileContent,
    });

    if (response.ok) {
      const result = await response.json();
      console.log('Upload successful:', result);
      expect(result.cid).toBeDefined();
    } else {
      console.log('Upload failed:', await response.text());
      // Not failing the test as this is dependent on external services
    }
  }, 30000);

  // Test checking if a known IPFS resource exists
  it('can check if content exists on IPFS', async () => {
    // Use a known IPFS CID that should always exist
    const knownCid = 'QmPChd2hVbrJ6bfo3WBcTW4iZnpHm8TEzWkLHmLpXhF68A'; // Small text file

    // Check existence using a HEAD request
    const response = await fetch(`${ipfsGateway}/ipfs/${knownCid}`, {
      method: 'HEAD',
    });

    expect(response.ok).toBe(true);
    console.log(`Content exists: ${response.ok}`);
  }, 10000);

  // Test fetching content from IPFS
  it('can fetch content from IPFS', async () => {
    // Use a known IPFS CID that should always exist
    const knownCid = 'QmPChd2hVbrJ6bfo3WBcTW4iZnpHm8TEzWkLHmLpXhF68A'; // Small text file

    // Fetch the content
    const response = await fetch(`${ipfsGateway}/ipfs/${knownCid}`);

    expect(response.ok).toBe(true);

    const content = await response.text();
    expect(content).toBeDefined();
    expect(content.length).toBeGreaterThan(0);

    console.log(`Fetched content: ${content.substring(0, 50)}...`);
  }, 10000);

  // Test encryption and decryption
  it('can encrypt and decrypt data', () => {
    // Generate a random encryption key
    const key = crypto.randomBytes(32); // 256 bits for AES-256

    // Create an IV (Initialization Vector)
    const iv = crypto.randomBytes(16);

    // Create test data
    const data = Buffer.from(testFileContent);

    // Encrypt the data
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    const encryptedData = Buffer.concat([cipher.update(data), cipher.final()]);

    // Add the IV to the encrypted data (needed for decryption)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const encryptedWithIv = Buffer.concat([iv, encryptedData]);

    // Decrypt the data
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    const decryptedData = Buffer.concat([decipher.update(encryptedData), decipher.final()]);

    // Verify decryption worked
    expect(decryptedData.toString()).toBe(testFileContent);
    console.log('Encryption and decryption successful');
  });
});
