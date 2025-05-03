# Getting Started with Hippius SDK

This guide will walk you through the basics of using the Hippius SDK to interact with the decentralized storage network.

## Installation

Install the Hippius SDK using npm:

```bash
npm install hippius-sdk
```

Or using yarn:

```bash
yarn add hippius-sdk
```

## Initializing the Client

The simplest way to create a client instance:

```javascript
const { HippiusClient } = require('hippius-sdk');

// Initialize with default settings (using configuration file if available)
const client = new HippiusClient();
```

If you want to specify connection options:

```javascript
const client = new HippiusClient(
  'https://get.hippius.network',                   // IPFS gateway
  'https://store.hippius.network',     // IPFS API URL
  'wss://rpc.hippius.network',         // Substrate URL
  null,                                // Seed phrase (from config if null)
  null,                                // Password (if seed phrase is encrypted)
  null,                                // Account name (uses active account if null)
  false                                // Don't encrypt files by default
);
```

See [Credential Management](./credentials.md) for more details on setting up your account.

## Basic Operations

Let's explore the core functionality of the Hippius SDK step by step.

### Uploading Files

```javascript
// Upload a file to IPFS
const result = await client.uploadFile('/path/to/your/file.txt');

console.log(`File uploaded with CID: ${result.cid}`);
console.log(`File size: ${result.size_formatted}`);
console.log(`Encrypted: ${result.encrypted}`);
```

### Checking if Content Exists

```javascript
// Check if content with a specific CID exists on IPFS
const existsResult = await client.exists('QmExampleCID123456789');

if (existsResult.exists) {
  console.log(`File exists at: ${existsResult.gateway_url}`);
} else {
  console.log('File not found');
}
```

### Retrieving Content

```javascript
// Get the content of a file from IPFS
const content = await client.cat('QmExampleCID123456789');

if (content.is_text) {
  console.log(`Content preview: ${content.text_preview}`);
} else {
  console.log(`Binary content (hex): ${content.hex_preview}`);
}
console.log(`Content size: ${content.size_formatted}`);
```

### Downloading Files

```javascript
// Download a file from IPFS to a local path
const downloadResult = await client.downloadFile(
  'QmExampleCID123456789',
  '/path/to/save/downloaded_file.txt'
);

console.log(`Download successful: ${downloadResult.success}`);
console.log(`Downloaded size: ${downloadResult.size_formatted}`);
console.log(`Time taken: ${downloadResult.elapsed_seconds} seconds`);
```

### Pinning Content

Pinning content ensures it remains available on the IPFS network:

```javascript
// Pin a file to keep it available
const pinResult = await client.pin('QmExampleCID123456789');

console.log(`Pinning successful: ${pinResult.success}`);
if (pinResult.success) {
  console.log('Content is now pinned and will be preserved on the network');
} else {
  console.log(`Pinning failed: ${pinResult.message}`);
}
```

## Working with Blockchain Storage

If you've configured your account with a valid seed phrase, you can interact with the Substrate blockchain:

```javascript
// Store a CID on the blockchain
try {
  const txHash = await client.storeCid('QmExampleCID123456789', 'example_file.txt');
  console.log(`Transaction hash: ${txHash}`);
} catch (error) {
  console.error(`Blockchain interaction failed: ${error.message}`);
}
```

Get your account balance:

```javascript
// Get account balance
try {
  const balance = await client.getAccountBalance();
  console.log(`Free balance: ${balance.free}`);
  console.log(`Total balance: ${balance.total}`);
} catch (error) {
  console.error(`Failed to get balance: ${error.message}`);
}
```

## Advanced Features

### Working with Encryption

Generate a new encryption key:

```javascript
// Generate a random encryption key
const encryptionKey = client.generateEncryptionKey();
console.log(`New encryption key: ${encryptionKey.substring(0, 10)}...`);

// Store it in your secure location for later use
```

Upload a file with encryption:

```javascript
// Upload with encryption (regardless of default setting)
const encryptedResult = await client.uploadFile('/path/to/file.txt', true);
console.log(`Encrypted file uploaded with CID: ${encryptedResult.cid}`);
```

Download and decrypt:

```javascript
// Download with decryption
const decryptedResult = await client.downloadFile(
  encryptedResult.cid,
  '/path/to/decrypted_file.txt',
  true  // Decrypt while downloading
);
```

### Utility Functions

Format a CID for display:

```javascript
const formattedCid = client.formatCid('QmExampleCID123456789');
console.log(`Formatted CID: ${formattedCid}`);
```

Format file sizes:

```javascript
const readableSize = client.formatSize(1024 * 1024);
console.log(`Formatted size: ${readableSize}`); // Outputs: "1.00 MB"
```

## Complete Example

Here's a complete example that demonstrates the main features of the Hippius SDK:

```javascript
const fs = require('fs');
const path = require('path');
const { HippiusClient } = require('hippius-sdk');

async function runExample() {
  console.log('=== Hippius SDK Example ===');
  
  // Initialize the client
  const client = new HippiusClient();
  
  // Create a test file
  const testFile = path.join(__dirname, 'test_file.txt');
  fs.writeFileSync(testFile, 'This is a test file for Hippius SDK.');
  console.log(`Created test file: ${testFile}`);
  
  try {
    // 1. Generate an encryption key
    console.log('\n1. Generating encryption key...');
    const encryptionKey = client.generateEncryptionKey();
    console.log(`Encryption key: ${encryptionKey.substring(0, 10)}...`);
    
    // 2. Upload a file to IPFS
    console.log('\n2. Uploading file to IPFS...');
    const uploadResult = await client.uploadFile(testFile);
    console.log(`File uploaded with CID: ${uploadResult.cid}`);
    console.log(`File size: ${uploadResult.size_formatted}`);
    console.log(`Encrypted: ${uploadResult.encrypted}`);
    
    // 3. Check if the file exists
    console.log('\n3. Checking if file exists...');
    const existsResult = await client.exists(uploadResult.cid);
    console.log(`File exists: ${existsResult.exists}`);
    if (existsResult.exists && existsResult.gateway_url) {
      console.log(`Gateway URL: ${existsResult.gateway_url}`);
    }
    
    // 4. Get file content
    console.log('\n4. Getting file content...');
    const contentResult = await client.cat(uploadResult.cid);
    if (contentResult.is_text) {
      console.log(`Content preview: ${contentResult.text_preview}`);
    } else {
      console.log(`Binary content (hex): ${contentResult.hex_preview}`);
    }
    console.log(`Content size: ${contentResult.size_formatted}`);
    
    // 5. Download the file
    const downloadPath = path.join(__dirname, 'downloaded_file.txt');
    console.log(`\n5. Downloading file to ${downloadPath}...`);
    const dlResult = await client.downloadFile(uploadResult.cid, downloadPath);
    console.log(`Download successful: ${dlResult.success}`);
    console.log(`Download size: ${dlResult.size_formatted}`);
    console.log(`Time taken: ${dlResult.elapsed_seconds} seconds`);
    
    // 6. Pin the file
    console.log('\n6. Pinning file...');
    const pinResult = await client.pin(uploadResult.cid);
    console.log(`Pinning successful: ${pinResult.success}`);
    console.log(`Message: ${pinResult.message}`);
    
    // 7. Store on blockchain (if account is configured)
    console.log('\n7. Storing CID on blockchain...');
    try {
      const txHash = await client.storeCid(uploadResult.cid, 'test_file.txt');
      console.log(`Transaction hash: ${txHash}`);
    } catch (error) {
      console.log(`Blockchain storage not available: ${error.message}`);
    }
    
    // 8. Get account balance (if account is configured)
    console.log('\n8. Checking account balance...');
    try {
      const balance = await client.getAccountBalance();
      console.log(`Free balance: ${balance.free}`);
      console.log(`Total balance: ${balance.total}`);
    } catch (error) {
      console.log(`Balance check not available: ${error.message}`);
    }
    
    console.log('\nExample completed successfully!');
  } catch (error) {
    console.error('Error running example:', error);
  } finally {
    // Clean up test files
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
      console.log(`\nRemoved test file: ${testFile}`);
    }
    
    const downloadedFile = path.join(__dirname, 'downloaded_file.txt');
    if (fs.existsSync(downloadedFile)) {
      fs.unlinkSync(downloadedFile);
      console.log(`Removed downloaded file: ${downloadedFile}`);
    }
  }
}

// Run the example
runExample().catch(console.error);
```

## Next Steps

Now that you're familiar with the basics, check out these additional resources:

- [Credential Management](./credentials.md) - Learn more about securing your accounts
- [API Reference](./api-reference.md) - Full documentation of all SDK functions
- [Examples](../examples/) - More examples for common use cases

## Troubleshooting

If you encounter any issues:

1. Ensure your account is properly configured
2. Check network connectivity to the IPFS and Substrate endpoints
3. For large files, allow more time for network operations
4. If using encryption, verify that your encryption key is correctly set

For further assistance, please file an issue on our GitHub repository.