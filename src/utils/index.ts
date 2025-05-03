/**
 * Format a CID for display.
 * This handles both regular CIDs and hex-encoded CIDs.
 *
 * @param cid Content Identifier (CID) to format
 * @returns Formatted CID string
 */
export function formatCid(cid: string): string {
  if (!cid) return '';

  // If it's already a valid IPFS CID (starts with 'Qm' or similar)
  if (cid.startsWith('Qm') || cid.startsWith('bafy')) {
    return cid;
  }

  // If it's a hex-encoded CID, convert it
  if (/^[0-9a-fA-F]+$/.test(cid)) {
    return hexToIpfsCid(cid);
  }

  // Default case, just return the CID as is
  return cid;
}

/**
 * Convert a hex-encoded IPFS CID to a regular IPFS CID.
 *
 * @param hexString Hex string representation of an IPFS CID
 * @returns Regular IPFS CID
 */
export function hexToIpfsCid(hexString: string): string {
  // TODO: Implement proper CID conversion from hex
  // This would depend on how the CIDs are encoded in the Hippius network
  // For now, we'll leave this as a placeholder
  return hexString;
}

/**
 * Format a size in bytes to a human-readable string.
 *
 * @param sizeBytes Size in bytes
 * @returns Human-readable size string (e.g., '1.23 MB', '456.78 KB')
 */
export function formatSize(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  } else if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(2)} KB`;
  } else if (sizeBytes < 1024 * 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;
  } else {
    return `${(sizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
}

/**
 * Generate a retry with backoff function to handle retries for async operations
 *
 * @param fn The async function to retry
 * @param maxRetries Maximum number of retry attempts
 * @returns A function that will retry with exponential backoff
 */
export function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries: number = 3): Promise<T> {
  return new Promise(async (resolve, reject) => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await fn();
        return resolve(result);
      } catch (error) {
        lastError = error as Error;

        // Last attempt, don't wait, just fail
        if (attempt === maxRetries - 1) {
          break;
        }

        // Calculate wait time with exponential backoff
        const waitTime = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s, ...
        console.warn(`Attempt ${attempt + 1} failed: ${error}. Retrying in ${waitTime / 1000}s...`);

        // Wait before next attempt
        await new Promise(r => setTimeout(r, waitTime));
      }
    }

    // All retries failed
    reject(lastError);
  });
}
