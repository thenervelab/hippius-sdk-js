# Credential Management in Hippius SDK

The Hippius SDK offers several ways to manage your account credentials. You can choose the method that works best for your application's security requirements.

## Option 1: Direct Configuration in Your Application

You can pass your credentials directly when initializing the client:

```javascript
const { HippiusClient } = require('hippius-sdk');

const client = new HippiusClient(
  'https://get.hippius.network',                           // IPFS gateway
  'https://store.hippius.network',             // IPFS API URL
  'wss://rpc.hippius.network',                 // Substrate URL
  'your seed phrase here',                     // Your seed phrase
  null,                                        // Password (if seed phrase is encrypted)
  'my-account',                                // Account name
  false                                        // Don't encrypt uploads by default
);
```

## Option 2: Using the Configuration File

The SDK stores credentials in `~/.hippius/config.json`. You can manage accounts programmatically:

```javascript
const { 
  HippiusClient, 
  setActiveAccount, 
  setSeedPhrase,
  getSeedPhrase
} = require('hippius-sdk');

// Set up an account with unencrypted seed phrase (not recommended for production)
setSeedPhrase('your seed phrase', false, null, 'my-account');

// Set up an account with encrypted seed phrase (recommended for production)
setSeedPhrase('your seed phrase', true, 'strong-password', 'secure-account');

// Get a seed phrase (will require password if encrypted)
const seedPhrase = getSeedPhrase('secure-account', 'strong-password');

// Set the active account
setActiveAccount('my-account');

// The client will use the configured account
const client = new HippiusClient();
```

## Option 3: Using Environment Variables

You can set the following environment variables:

```bash
# Set these in your environment before running your application
export HIPPIUS_SUBSTRATE_SEED_PHRASE='your seed phrase'
export HIPPIUS_SUBSTRATE_URL='wss://rpc.hippius.network'
export HIPPIUS_IPFS_GATEWAY='https://get.hippius.network'
export HIPPIUS_IPFS_API_URL='https://store.hippius.network'
```

Then initialize the client without parameters:

```javascript
const { HippiusClient } = require('hippius-sdk');
const client = new HippiusClient();
```

## Configuration File Structure

The configuration file is located at `~/.hippius/config.json` and has the following structure:

```json
{
  "ipfs": {
    "gateway": "https://get.hippius.network",
    "api_url": "https://store.hippius.network",
    "local_ipfs": false
  },
  "substrate": {
    "url": "wss://rpc.hippius.network",
    "seed_phrase": null,
    "active_account": "my-account",
    "default_miners": [],
    "accounts": {
      "my-account": {
        "ss58_address": "<your-account-id>",
        "seed_phrase": "<your-12-word-seed-phrase>",
        "seed_phrase_encoded": false
      }
    }
  },
  "encryption": {
    "encrypt_by_default": false,
    "encryption_key": null
  }
}
```

## Recommended Practices

1. **Development**: During development, it's convenient to use the configuration file approach.

2. **Production**:
   - For server applications: Use environment variables to avoid storing credentials in code
   - For user applications: Use the configuration file with account management functions

3. **Security Considerations**:
   - Never hardcode seed phrases in your application code
   - Always use encryption for seed phrases in the configuration file
   - Use strong, unique passwords for seed phrase encryption 
   - For highest security, use environment variables set through a secure process
   - Regularly rotate passwords used for encryption

## Account Management Functions

The SDK exports several utility functions for managing accounts:

```javascript
// Get the active account name
const activeAccount = getActiveAccount();

// Set the active account
setActiveAccount('my-account');

// Store a seed phrase (unencrypted)
setSeedPhrase('your seed phrase', false, null, 'my-account');

// Store a seed phrase (encrypted - recommended)
setSeedPhrase('your seed phrase', true, 'strong-password', 'secure-account');

// Retrieve a seed phrase (requires password if encrypted)
const seedPhrase = getSeedPhrase('secure-account', 'strong-password');

// Get the account's address
const address = getAccountAddress('my-account');

// Get all configuration
const config = getAllConfig();
```

## Working with Multiple Accounts

The configuration file can store multiple accounts, making it easy to switch between them:

```javascript
// Set up multiple accounts
setSeedPhrase('first seed phrase', false, null, 'account1');
setSeedPhrase('second seed phrase', false, null, 'account2');

// Switch active account when needed
setActiveAccount('account1');
// Do operations with account1

setActiveAccount('account2');
// Do operations with account2
```

The active account is used automatically when initializing a client without explicit credentials:

```javascript
const client = new HippiusClient(); // Uses the active account
```