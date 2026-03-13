/**
 * Markd Storage
 * Wrapper for browser storage API (works in both Chrome and Firefox)
 */

class Storage {
  constructor() {
    this.storage = window.browserAPI.storage.local;
  }

  /**
   * Get value from storage
   * @param {string} key - Storage key
   * @returns {Promise<any>} - Stored value or null
   */
  async get(key) {
    try {
      const result = await this.storage.get(key);
      return result[key] || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Set value in storage
   * @param {string} key - Storage key
   * @param {any} value - Value to store
   * @returns {Promise<boolean>} - Success status
   */
  async set(key, value) {
    try {
      await this.storage.set({ [key]: value });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Remove value from storage
   * @param {string} key - Storage key
   * @returns {Promise<boolean>} - Success status
   */
  async remove(key) {
    try {
      await this.storage.remove(key);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clear all storage
   * @returns {Promise<boolean>} - Success status
   */
  async clear() {
    try {
      await this.storage.clear();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get chapters for specific video ID
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<Array>} - Cached chapters or empty array
   */
  async getChaptersForVideo(videoId) {
    const key = `chapters_${videoId}`;
    return (await this.get(key)) || [];
  }

  /**
   * Save chapters for specific video ID
   * @param {string} videoId - YouTube video ID
   * @param {Array} chapters - Chapters to cache
   * @returns {Promise<boolean>} - Success status
   */
  async saveChaptersForVideo(videoId, chapters) {
    const key = `chapters_${videoId}`;
    return await this.set(key, chapters);
  }
}

// Create global instance
window.MarkdStorage = new Storage();
