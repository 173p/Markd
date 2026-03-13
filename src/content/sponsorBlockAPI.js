/**
 * Markd SponsorBlock API Integration
 * Fetches community-submitted chapters from SponsorBlock
 */

class SponsorBlockAPI {
  constructor() {
    this.apiBase = 'https://sponsor.ajay.app/api';
    this.categoryChapter = 'chapter';
  }

  /**
   * Fetch chapters from SponsorBlock API
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<Array>} - Array of chapters or empty array
   */
  async fetchChapters(videoId) {
    try {

      // SponsorBlock API endpoint: /api/skipSegments?videoID={videoID}&categories=["chapter"]
      const url = `${this.apiBase}/skipSegments?videoID=${videoId}&categories=["${this.categoryChapter}"]`;

      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 404) {
          return [];
        }
        throw new Error(`SponsorBlock API error: ${response.status}`);
      }

      const data = await response.json();

      // Parse SponsorBlock segments into Markd chapter format
      const chapters = this.parseSponsorBlockSegments(data);

      if (chapters.length > 0) {
      }

      return chapters;

    } catch (error) {
      return [];
    }
  }

  /**
   * Parse SponsorBlock segments into Markd chapter format
   * @param {Array} segments - SponsorBlock segments
   * @returns {Array} - Formatted chapters
   */
  parseSponsorBlockSegments(segments) {
    if (!Array.isArray(segments)) {
      return [];
    }

    const chapters = segments
      .filter(segment => segment.category === this.categoryChapter)
      .map(segment => ({
        seconds: Math.floor(segment.segment[0]), // Start time
        label: segment.description || `Chapter at ${this.formatTime(segment.segment[0])}`,
        source: 'sponsorblock',
        duration: segment.segment[1] - segment.segment[0],
        votes: segment.votes || 0,
        locked: segment.locked || false,
        uuid: segment.UUID
      }))
      .sort((a, b) => a.seconds - b.seconds);

    return chapters;
  }

  /**
   * Format seconds to human-readable time
   * @param {number} seconds - Time in seconds
   * @returns {string} - Formatted time string
   */
  formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  /**
   * Check if SponsorBlock has chapters for a video
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<boolean>} - True if chapters exist
   */
  async hasChapters(videoId) {
    const chapters = await this.fetchChapters(videoId);
    return chapters.length > 0;
  }
}

// Create global instance
window.MarkdSponsorBlockAPI = new SponsorBlockAPI();
