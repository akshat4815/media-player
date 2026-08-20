/**
 * WAP Video Decoder & Media URL Manager
 * 
 * Handles obfuscated .wap files:
 * - A .wap file has [file.name.length] junk bytes at the beginning
 * - and [file.name.length] junk bytes at the end.
 * - Slicing out these bytes reveals the raw playable MP4/video stream.
 * Also handles standard video files (.mp4, .webm, .mkv, .mov, etc.) seamlessly.
 */

class WapDecoder {
  constructor() {
    this.activeObjectUrls = new Set();
  }

  /**
   * Check if a filename corresponds to a .wap file
   * @param {string} filename 
   * @returns {boolean}
   */
  isWapFile(filename) {
    if (!filename) return false;
    return filename.toLowerCase().endsWith('.wap');
  }

  /**
   * Check if a file or filename is a supported video
   * @param {string} filename 
   * @returns {boolean}
   */
  isSupportedFile(filename) {
    if (!filename) return false;
    const lower = filename.toLowerCase();
    const supportedExtensions = ['.wap', '.mp4', '.mkv', '.webm', '.mov', '.m4v', '.avi', '.ts', '.3gp'];
    return supportedExtensions.some(ext => lower.endsWith(ext));
  }

  /**
   * Decode a File or Blob into a playable object URL
   * @param {File|Blob} file 
   * @returns {Promise<{url: string, isWap: boolean, mimeType: string, filename: string, size: number, rawBlob: Blob}>}
   */
  async decodeFile(file) {
    if (!file) {
      throw new Error('No file provided for decoding.');
    }

    const filename = file.name || 'video.mp4';
    const size = file.size || 0;
    const isWap = this.isWapFile(filename);

    let playableBlob;

    if (isWap) {
      const nameLength = filename.length;
      if (size <= nameLength * 2) {
        throw new Error(`File "${filename}" is corrupted or too small to be a valid .wap video.`);
      }

      // Slice out the prepended nameLength bytes and appended nameLength bytes
      playableBlob = file.slice(nameLength, size - nameLength, 'video/mp4');
    } else {
      // Direct media file
      const ext = filename.split('.').pop().toLowerCase();
      let mimeType = 'video/mp4';
      if (ext === 'webm') mimeType = 'video/webm';
      else if (ext === 'mkv') mimeType = 'video/x-matroska';
      else if (ext === 'mov') mimeType = 'video/quicktime';
      
      playableBlob = file.slice(0, size, mimeType);
    }

    const objectUrl = URL.createObjectURL(playableBlob);
    this.activeObjectUrls.add(objectUrl);

    return {
      url: objectUrl,
      isWap,
      mimeType: playableBlob.type || 'video/mp4',
      filename,
      size,
      rawBlob: playableBlob
    };
  }

  /**
   * Revoke an active Object URL to free memory
   * @param {string} url 
   */
  revokeUrl(url) {
    if (url && this.activeObjectUrls.has(url)) {
      URL.revokeObjectURL(url);
      this.activeObjectUrls.delete(url);
    }
  }

  /**
   * Clean up all active Object URLs
   */
  cleanup() {
    for (const url of this.activeObjectUrls) {
      URL.revokeObjectURL(url);
    }
    this.activeObjectUrls.clear();
  }
}

// Export singleton instance
window.wapDecoder = new WapDecoder();
