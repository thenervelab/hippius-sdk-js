import { formatCid, formatSize, retryWithBackoff } from '../utils';

describe('Utils', () => {
  describe('formatCid', () => {
    it('returns empty string for falsy values', () => {
      expect(formatCid('')).toBe('');
      expect(formatCid(null as any)).toBe('');
      expect(formatCid(undefined as any)).toBe('');
    });

    it('returns the same CID for valid IPFS CIDs', () => {
      const validCid = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG';
      expect(formatCid(validCid)).toBe(validCid);

      const validCidV1 = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';
      expect(formatCid(validCidV1)).toBe(validCidV1);
    });

    it('returns the original value for other formats', () => {
      const otherValue = 'some-random-string';
      expect(formatCid(otherValue)).toBe(otherValue);
    });
  });

  describe('formatSize', () => {
    it('formats bytes correctly', () => {
      expect(formatSize(0)).toBe('0 B');
      expect(formatSize(1)).toBe('1 B');
      expect(formatSize(999)).toBe('999 B');
    });

    it('formats kilobytes correctly', () => {
      expect(formatSize(1024)).toBe('1.00 KB');
      expect(formatSize(1536)).toBe('1.50 KB');
      expect(formatSize(10240)).toBe('10.00 KB');
    });

    it('formats megabytes correctly', () => {
      expect(formatSize(1048576)).toBe('1.00 MB');
      expect(formatSize(5242880)).toBe('5.00 MB');
    });

    it('formats gigabytes correctly', () => {
      expect(formatSize(1073741824)).toBe('1.00 GB');
      expect(formatSize(10737418240)).toBe('10.00 GB');
    });
  });

  describe('retryWithBackoff', () => {
    it('returns the result if the function succeeds on first try', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      const result = await retryWithBackoff(fn);
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries the function if it fails', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('failure'))
        .mockResolvedValueOnce('success');

      const result = await retryWithBackoff(fn, 2);
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('throws an error if all retries fail', async () => {
      const error = new Error('persistent failure');
      const fn = jest.fn().mockRejectedValue(error);

      await expect(retryWithBackoff(fn, 3)).rejects.toThrow(error);
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });
});
