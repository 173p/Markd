/**
 * Invidious API Client
 * Free, public API for YouTube data - no keys, no manipulation, no scrolling
 * Docs: https://docs.invidious.io/api/
 */

class InvidiousAPI {
  constructor() {
    // List of public Invidious instances (fallback chain)
    this.instances = [
      'https://inv.nadeko.net',
      'https://invidious.nerdvpn.de',
      'https://yewtu.be',
      'https://inv.us.projectsegfau.lt',
      'https://invidious.privacydev.net'
    ];
    this.currentInstanceIndex = 0;
    this.timeout = 5000; // 5 second timeout
  }

  /**
   * Get current instance URL
   * @returns {string} - Current Invidious instance URL
   */
  getCurrentInstance() {
    return this.instances[this.currentInstanceIndex];
  }

  /**
   * Rotate to next instance on failure
   */
  rotateInstance() {
    this.currentInstanceIndex = (this.currentInstanceIndex + 1) % this.instances.length;
  }

  /**
   * Make a request with timeout and instance fallback
   * @param {string} path - API path
   * @returns {Promise<Object|null>} - Response data or null
   */
  async request(path) {
    const maxRetries = this.instances.length;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const instance = this.getCurrentInstance();
      const url = `${instance}${path}`;

      try {

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json'
          }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data;

      } catch (error) {

        // Try next instance
        if (attempt < maxRetries - 1) {
          this.rotateInstance();
        }
      }
    }

    return null;
  }

  /**
   * Get video metadata including description
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<Object|null>} - Video metadata or null
   */
  async getVideoInfo(videoId) {
    try {

      const data = await this.request(`/api/v1/videos/${videoId}`);

      if (!data) {
        return null;
      }

      return {
        title: data.title,
        description: data.description || data.descriptionHtml?.replace(/<[^>]*>/g, '') || '',
        lengthSeconds: data.lengthSeconds,
        viewCount: data.viewCount,
        author: data.author,
        publishedText: data.publishedText
      };

    } catch (error) {
      return null;
    }
  }

  /**
   * Get video comments (no scrolling or page manipulation needed!)
   * @param {string} videoId - YouTube video ID
   * @param {string} continuation - Continuation token for pagination
   * @returns {Promise<Object|null>} - Comments data or null
   */
  async getComments(videoId, continuation = null) {
    try {

      const path = continuation
        ? `/api/v1/comments/${videoId}?continuation=${continuation}`
        : `/api/v1/comments/${videoId}`;

      const data = await this.request(path);

      if (!data) {
        return null;
      }

      return {
        comments: data.comments || [],
        continuation: data.continuation || null
      };

    } catch (error) {
      return null;
    }
  }

  /**
   * Extract comment text from Invidious comment object
   * @param {Object} comment - Invidious comment object
   * @returns {string} - Comment text
   */
  extractCommentText(comment) {
    // Invidious returns 'content' or 'contentHtml'
    if (comment.content) {
      return comment.content;
    }

    // Strip HTML if only HTML version available
    if (comment.contentHtml) {
      return comment.contentHtml.replace(/<[^>]*>/g, '');
    }

    return '';
  }

  /**
   * Get all top-level comments for a video (no replies)
   * @param {string} videoId - YouTube video ID
   * @param {number} maxComments - Maximum comments to fetch (default 200)
   * @returns {Promise<Array<string>>} - Array of comment texts
   */
  async getAllComments(videoId, maxComments = 200) {
    try {
      const commentTexts = [];
      let continuation = null;
      let fetchCount = 0;
      const maxFetches = 5; // Limit to 5 API calls


      while (fetchCount < maxFetches && commentTexts.length < maxComments) {
        const result = await this.getComments(videoId, continuation);

        if (!result || !result.comments || result.comments.length === 0) {
          break;
        }

        // Extract comment texts
        for (const comment of result.comments) {
          if (commentTexts.length >= maxComments) {
            break;
          }

          const text = this.extractCommentText(comment);
          if (text) {
            commentTexts.push(text);
          }
        }

        // Check if there are more comments
        continuation = result.continuation;
        if (!continuation) {
          break;
        }

        fetchCount++;
      }

      return commentTexts;

    } catch (error) {
      return [];
    }
  }

  /**
   * Test if Invidious API is accessible
   * @returns {Promise<boolean>} - True if accessible
   */
  async testConnection() {
    try {
      // Test with a known video ID
      const data = await this.request('/api/v1/videos/dQw4w9WgXcQ');
      return data !== null;
    } catch (error) {
      return false;
    }
  }
}

// Create global instance
window.MarkdInvidiousAPI = new InvidiousAPI();
