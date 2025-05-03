import { HippiusClient } from '../src';
import * as fs from 'fs';
import * as path from 'path';

/**
 * This example demonstrates basic usage of the Hippius SDK.
 */
async function main() {
  console.log('=== Hippius SDK Example ===');

  // Initialize the client
  const client = new HippiusClient();

  // Create a test file
  const testFile = path.join(__dirname, 'test_file.txt');
  fs.writeFileSync(testFile, 'This is a test file for Hippius SDK.');

  try {
    // 1. Upload a file to IPFS
    console.log('Uploading file...');
    const result = await client.uploadFile(testFile);
    const cid = result.cid;
    console.log(`File uploaded with CID: ${cid}`);
    console.log(`File size: ${result.size_formatted}`);
    console.log(`Encrypted: ${result.encrypted}`);
    console.log();

    // 2. Check if the file exists
    console.log(`Checking if CID ${cid} exists...`);
    const existsResult = await client.exists(cid);
    console.log(`File exists: ${existsResult.exists}`);
    if (existsResult.exists && existsResult.gateway_url) {
      console.log(`Gateway URL: ${existsResult.gateway_url}`);
    }
    console.log();

    // 3. Get file content
    console.log(`Getting content for CID ${cid}...`);
    const contentResult = await client.cat(cid);
    if (contentResult.is_text) {
      console.log(`Content preview: ${contentResult.text_preview}`);
    } else {
      console.log(`Binary content (hex): ${contentResult.hex_preview}`);
    }
    console.log(`Content size: ${contentResult.size_formatted}`);
    console.log();

    // 4. Download the file
    const downloadPath = path.join(__dirname, 'downloaded_file.txt');
    console.log(`Downloading file to ${downloadPath}...`);
    const dlResult = await client.downloadFile(cid, downloadPath);
    console.log(`Download successful: ${dlResult.success}`);
    console.log(`Download size: ${dlResult.size_formatted}`);
    console.log(`Time taken: ${dlResult.elapsed_seconds} seconds`);
    console.log();

    // 5. Pin the file
    console.log(`Pinning file with CID ${cid}...`);
    const pinResult = await client.pin(cid);
    console.log(`Pinning successful: ${pinResult.success}`);
    if (!pinResult.success) {
      console.log(`Reason: ${pinResult.message}`);
    }
    console.log();
    
    // 5b. Check if file is pinned (wait for pinning to complete)
    console.log(`Waiting 60 seconds for pinning to complete...`);
    await new Promise(resolve => setTimeout(resolve, 60000)); // Wait 60 seconds
    
    console.log(`Checking if CID ${cid} is pinned...`);
    const isPinnedResult = await client.isPinned(cid);
    console.log(`File is pinned: ${isPinnedResult.pinned}`);
    if (isPinnedResult.pinned && isPinnedResult.pin_type) {
      console.log(`Pin type: ${isPinnedResult.pin_type}`);
    }
    console.log();

    // 6. Store on blockchain (if Substrate client is available)
    try {
      console.log(`Storing CID ${cid} on blockchain...`);
      const txHash = await client.storeCid(cid, 'test_file.txt');
      console.log(`Transaction hash: ${txHash}`);
    } catch (error) {
      console.log(`Blockchain storage not available: ${error}`);
    }
    console.log();

    // 7. Generate encryption key example
    console.log('Generating encryption key...');
    const encryptionKey = client.generateEncryptionKey();
    console.log(`Encryption key: ${encryptionKey.substring(0, 10)}...`);
    console.log();

    console.log('Example completed successfully!');
  } catch (error) {
    console.error('Error running example:', error);
  } finally {
    // Clean up test files
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
      console.log(`Removed test file: ${testFile}`);
    }

    const downloadedFile = path.join(__dirname, 'downloaded_file.txt');
    if (fs.existsSync(downloadedFile)) {
      fs.unlinkSync(downloadedFile);
      console.log(`Removed downloaded file: ${downloadedFile}`);
    }
  }
}

// Run the example
main().catch(console.error);