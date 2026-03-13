/**
 * Markd Description Parser
 * Extracts timestamps from YouTube video description
 */

class DescriptionParser {
  constructor() {
    this.descriptionSelector = [
      'ytd-text-inline-expander#description-inline-expander',
      '#description-inline-expander',
      '#description',
      'yt-formatted-string.content',
      '#structured-description',
      'ytd-video-secondary-info-renderer #description',
      'ytd-expander#description',
      '#description-inner'
    ];
  }

  /**
   * Initialize and parse description
   * @returns {Promise<Array>} - Array of chapters from description
   */
  async parse() {
    try {

      const descriptionText = await this.getDescriptionText();

      if (!descriptionText) {
        return [];
      }

      // Check if description already has YouTube's official chapter format
      const officialChapters = this.parseOfficialChapters(descriptionText);

      if (officialChapters.length > 0) {
        return officialChapters;
      }

      // Fall back to general timestamp parsing
      const timestamps = this.parseTimestamps(descriptionText);

      if (timestamps.length > 0) {
      }

      return timestamps;

    } catch (error) {
      return [];
    }
  }

  /**
   * Get description text from YouTube data or DOM
   * @returns {Promise<string|null>} - Description text or null
   */
  async getDescriptionText() {
    // Try to get from YouTube's initial data first (faster, no user interaction needed)
    const descriptionFromData = await this.getDescriptionFromYouTubeData();
    if (descriptionFromData) {
      return descriptionFromData;
    }

    // Fallback: Try Invidious API (no page manipulation needed!)
    if (window.MarkdInvidiousAPI) {
      const videoId = window.MarkdDomObserver?.getCurrentVideoId();
      if (videoId) {
        const videoInfo = await window.MarkdInvidiousAPI.getVideoInfo(videoId);
        if (videoInfo?.description) {
          return videoInfo.description;
        }
      }
    }

    // Last resort: DOM parsing (requires description to be visible)
    await this.waitForDescription();

    for (const selector of this.descriptionSelector) {
      const element = document.querySelector(selector);
      if (element) {
        return element.textContent || element.innerText || '';
      }
    }

    return null;
  }

  /**
   * Get description from YouTube's initial page data
   * @returns {Promise<string|null>} - Description text or null
   */
  async getDescriptionFromYouTubeData() {
    try {

      // Use PageDataExtractor to access page context data
      const pageData = await window.MarkdPageDataExtractor?.extractPageData();

      if (!pageData) {
        return null;
      }

      // Try ytInitialPlayerResponse first
      if (pageData.ytInitialPlayerResponse?.videoDetails?.shortDescription) {
        const desc = pageData.ytInitialPlayerResponse.videoDetails.shortDescription;
        return desc;
      }


      // Try ytInitialData
      if (pageData.ytInitialData) {
        const data = pageData.ytInitialData;

        // Navigate to description in ytInitialData structure
        const contents = data?.contents?.twoColumnWatchNextResults?.results?.results?.contents;

        if (contents) {

          for (const content of contents) {
            const videoSecondary = content?.videoSecondaryInfoRenderer;
            if (videoSecondary?.attributedDescription?.content) {
              return videoSecondary.attributedDescription.content;
            }

            // Alternative path
            const description = content?.videoSecondaryInfoRenderer?.description;
            if (description?.simpleText) {
              return description.simpleText;
            }
            if (description?.runs) {
              const desc = description.runs.map(run => run.text).join('');
              return desc;
            }
          }
        } else {
        }
      } else {
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Wait for description element to appear
   * @returns {Promise<void>}
   */
  waitForDescription() {
    return new Promise((resolve) => {
      const checkDescription = () => {
        for (const selector of this.descriptionSelector) {
          if (document.querySelector(selector)) {
            resolve();
            return;
          }
        }
        setTimeout(checkDescription, 100);
      };
      checkDescription();
    });
  }

  /**
   * Parse official YouTube chapter format
   * Format: "0:00 Chapter Title" with at least 3 timestamps, first must be 0:00
   * @param {string} text - Description text
   * @returns {Array} - Formatted chapters
   */
  parseOfficialChapters(text) {
    const lines = text.split('\n');
    const chapters = [];

    // Official chapter regex: timestamp at start of line followed by text
    const chapterRegex = /^(?:(\d+):)?(\d{1,2}):(\d{2})\s+(.+)/;

    for (const line of lines) {
      const match = line.trim().match(chapterRegex);
      if (match) {
        const hours = match[1] ? parseInt(match[1]) : 0;
        const minutes = parseInt(match[2]);
        const seconds = parseInt(match[3]);
        const label = match[4].trim();

        const totalSeconds = hours * 3600 + minutes * 60 + seconds;

        chapters.push({
          seconds: totalSeconds,
          label: label,
          source: 'description',
          isOfficial: true
        });
      }
    }

    // Validate official chapter requirements
    if (chapters.length >= 3 && chapters[0].seconds === 0) {
      return chapters;
    }

    // Doesn't meet official chapter criteria
    return [];
  }

  /**
   * Parse general timestamps from description
   * @param {string} text - Description text
   * @returns {Array} - Formatted chapters
   */
  parseTimestamps(text) {
    if (!window.MarkdTimestampParser) {
      return [];
    }

    const timestamps = window.MarkdTimestampParser.parse(text);

    return timestamps.map(ts => ({
      seconds: ts.seconds,
      label: ts.label,
      source: 'description',
      isOfficial: false,
      fixed: ts.fixed || false
    }));
  }

  /**
   * Check if description contains official YouTube chapters
   * @returns {Promise<boolean>}
   */
  async hasOfficialChapters() {
    const chapters = await this.parse();
    return chapters.some(ch => ch.isOfficial);
  }
}

// Create global instance
window.MarkdDescriptionParser = new DescriptionParser();
