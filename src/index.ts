// Main module exports for Hippius SDK

// Export the main client
export { HippiusClient } from './client';

// Export the IPFS client for direct usage
export { IPFSClient } from './ipfs';

// Export the Substrate client and FileInput for direct usage
export { SubstrateClient, FileInput } from './substrate';

// Export configuration utilities
export {
  getConfigValue,
  setConfigValue,
  getActiveAccount,
  setActiveAccount,
  getAccountAddress,
  getEncryptionKey,
  getSeedPhrase,
  setSeedPhrase,
  getAllConfig,
} from './config';

// Export utility functions
export { formatCid, formatSize, hexToIpfsCid, retryWithBackoff } from './utils';
