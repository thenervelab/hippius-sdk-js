# Hippius SDK for JavaScript

A JavaScript SDK for interacting with the Hippius IPFS network, built on blockchain technology.

## Features

- Upload files to IPFS with optional encryption
- Download files from IPFS with automatic decryption
- Store CIDs on the Hippius blockchain
- Check account balances and storage credits
- View stored files
- Simple and consistent API
- Fully tested with both unit and integration tests

## Installation

```bash
npm install hippius-sdk
```

## Development Setup

```bash
# Clone the repository
git clone https://github.com/thenervelab/hippius-sdk-js.git
cd hippius-sdk-js

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Run example
npm run example
```

## Basic Usage

```javascript
import { HippiusClient } from 'hippius-sdk';

// Create a client
const client = new HippiusClient();

// Upload a file
async function uploadFile() {
  const result = await client.uploadFile('/path/to/file.txt');
  console.log(`File uploaded with CID: ${result.cid}`);
  return result.cid;
}

// Download a file
async function downloadFile(cid) {
  const result = await client.downloadFile(cid, 'downloaded_file.txt');
  console.log(`File downloaded to: ${result.output_path}`);
}

// Check if a file exists
async function checkExists(cid) {
  const result = await client.exists(cid);
  console.log(`File exists: ${result.exists}`);
}
```

## Configuration

The SDK uses a configuration file stored at `~/.hippius/config.json`. You can set values programmatically:

```javascript
import { setConfigValue } from 'hippius-sdk';

// Set IPFS gateway URL
setConfigValue('ipfs', 'gateway', 'https://custom-gateway.example');

// Enable file encryption by default
setConfigValue('encryption', 'encrypt_by_default', true);
```

## Documentation

For complete API documentation, check out the [API Reference](https://docs.hippius.network/api).

## Testing

The SDK includes comprehensive tests:

- Unit tests for utility functions, configuration, and IPFS operations
- Integration tests with real IPFS network
- HTTP API tests for IPFS operations

Run the tests:

```bash
# Run all tests
npm test

# Run specific test categories
npm test -- --testPathPattern=src/__tests__/utils
npm test -- --testPathPattern=src/__tests__/ipfs-http
```

## License

MIT