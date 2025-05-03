const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { HippiusClient } = require('../dist'); // Use the compiled JS version

// Change this to the path of the file you want to upload
const FILE_PATH = "your-file-path";

/**
 * Calculate file hash (SHA-256)
 */
function calculateFileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    
    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', (error) => reject(error));
  });
}

/**
 * Basic usage example to demonstrate the Hippius SDK
 */
async function runExample(filePath) {
  console.log('=== Hippius SDK Example ===');
  
  // Initialize client with default settings
  const client = new HippiusClient();
  
  // Use the provided file path or create a test file
  let testFile = filePath;
  let cleanupFile = false;
  
  if (!testFile) {
    // Create a test file if no path was provided
    testFile = path.join(__dirname, 'test_file.txt');
    fs.writeFileSync(testFile, 'This is a test file for Hippius SDK.');
    console.log(`Created test file: ${testFile}`);
    cleanupFile = true;
  } else {
    // Validate the provided file path
    if (!fs.existsSync(testFile)) {
      console.error(`Error: File not found at ${testFile}`);
      return;
    }
    
    if (!fs.statSync(testFile).isFile()) {
      console.error(`Error: ${testFile} is not a file`);
      return;
    }
    
    console.log(`Using file: ${testFile}`);
  }
  
  const downloadPath = path.join(__dirname, 'downloaded_file.txt');
  
  try {
    // 1. Upload file to IPFS
    console.log('\n1. Uploading file to IPFS...');
    const uploadResult = await client.uploadFile(testFile, false); // Explicitly disable encryption
    console.log(`File uploaded with CID: ${uploadResult.cid}`);
    console.log(`File size: ${uploadResult.size_formatted}`);
    console.log(`Encrypted: ${uploadResult.encrypted}`);
    
    // 2. Check if file exists
    const existsResult = await client.exists(uploadResult.cid);
    console.log(`\n2. File exists: ${existsResult.exists}`);
    if (existsResult.exists && existsResult.gateway_url) {
      console.log(`Gateway URL: ${existsResult.gateway_url}`);
    }
    
    // 3. Get file content (for small text files)
    if (uploadResult.size_bytes < 100000) {
      console.log('\n3. Getting file content...');
      const contentResult = await client.cat(uploadResult.cid);
      if (contentResult.is_text) {
        console.log(`Content preview: ${contentResult.text_preview}`);
      }
    }
    
    // 4. Download the file
    console.log(`\n4. Downloading file to ${downloadPath}...`);
    const dlResult = await client.downloadFile(uploadResult.cid, downloadPath);
    console.log(`Download successful: ${dlResult.success}`);
    
    // 5. Pin the file
    console.log('\n5. Pinning file...');
    const pinResult = await client.pin(uploadResult.cid);
    console.log(`Pinning successful: ${pinResult.success}`);
    
    // 5b. Check if file is pinned (wait for pinning to complete)
    console.log('\n5b. Waiting 60 seconds for pinning to complete...');
    await new Promise(resolve => setTimeout(resolve, 60000)); // Wait 60 seconds
    
    console.log('Checking if file is pinned...');
    const isPinnedResult = await client.isPinned(uploadResult.cid);
    console.log(`File is pinned: ${isPinnedResult.pinned}`);
    if (isPinnedResult.pinned && isPinnedResult.pin_type) {
      console.log(`Pin type: ${isPinnedResult.pin_type}`);
    }
    
    // 6. Verify file integrity
    console.log('\n6. Verifying file integrity...');
    const originalHash = await calculateFileHash(testFile);
    const downloadedHash = await calculateFileHash(downloadPath);
    const hashesMatch = originalHash === downloadedHash;
    console.log(`Integrity check: ${hashesMatch ? 'Passed ✅' : 'Failed ❌'}`);
    
    // Summary
    console.log('\n=== Summary ===');
    console.log(`CID: ${uploadResult.cid}`);
    console.log(`Gateway URL: ${existsResult.gateway_url || 'N/A'}`);
    console.log(`Size: ${uploadResult.size_formatted}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    // Clean up files
    if (cleanupFile && fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
    }
    
    if (fs.existsSync(downloadPath)) {
      fs.unlinkSync(downloadPath);
    }
  }
}

// Run the example when this script is executed directly
if (require.main === module) {
  // Use the global FILE_PATH variable if it's been changed from the default
  const filePath = FILE_PATH !== "your-file-path" ? FILE_PATH : null;
  
  runExample(filePath).catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}