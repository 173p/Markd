/**
 * Auto-expands YouTube description and loads comments
 * Removes the need for manual user interaction
 */

class AutoExpander {
  constructor() {
    this.descriptionExpanded = false;
    this.commentsTriggered = false;
  }

  /**
   * Auto-expand the description section
   * @returns {Promise<boolean>} - True if expanded
   */
  async expandDescription() {
    if (this.descriptionExpanded) {
      return true;
    }

    try {
      // Try multiple selectors for the "Show more" button
      const selectors = [
        '#expand', // Modern YouTube
        'tp-yt-paper-button#expand',
        '#description-inline-expander button',
        'ytd-text-inline-expander #expand',
        '[aria-label*="Show more"]'
      ];

      for (const selector of selectors) {
        const button = document.querySelector(selector);
        if (button && button.offsetParent !== null) {
          button.click();
          this.descriptionExpanded = true;

          // Wait a bit for content to load
          await new Promise(resolve => setTimeout(resolve, 300));
          return true;
        }
      }

      this.descriptionExpanded = true; // Assume already expanded
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Trigger comments loading by scrolling to comments section
   * @returns {Promise<boolean>} - True if triggered
   */
  async triggerCommentsLoad() {
    if (this.commentsTriggered) {
      return true;
    }

    try {
      // Find comments section
      const commentsSection = document.querySelector('#comments');

      if (!commentsSection) {
        return false;
      }


      // Scroll comments into view to trigger loading
      commentsSection.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest'
      });

      this.commentsTriggered = true;

      // Wait for comments to start loading
      await new Promise(resolve => setTimeout(resolve, 500));

      // Scroll back to top smoothly
      window.scrollTo({ top: 0, behavior: 'smooth' });

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get description text directly from DOM
   * @returns {string|null} - Description text or null
   */
  getDescriptionFromDOM() {
    try {
      const selectors = [
        '#description-inline-expander #description-inner',
        '#description-inner',
        'ytd-text-inline-expander #content',
        '#description yt-formatted-string'
      ];

      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          const text = element.textContent?.trim();
          if (text) {
            return text;
          }
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get comments directly from DOM
   * @returns {Array<string>} - Array of comment texts
   */
  getCommentsFromDOM() {
    try {
      const comments = [];

      // Find all comment renderers
      const commentElements = document.querySelectorAll('ytd-comment-thread-renderer');


      for (const commentEl of commentElements) {
        // Try to get comment text
        const textElement = commentEl.querySelector('#content-text');
        if (textElement) {
          const text = textElement.textContent?.trim();
          if (text) {
            comments.push(text);
          }
        }
      }

      return comments;
    } catch (error) {
      return [];
    }
  }

  /**
   * Wait for comments to be loaded in DOM
   * @param {number} timeout - Max wait time in ms
   * @returns {Promise<boolean>} - True if comments loaded
   */
  async waitForComments(timeout = 5000) {
    return new Promise((resolve) => {
      const startTime = Date.now();

      const checkComments = () => {
        const comments = document.querySelectorAll('ytd-comment-thread-renderer');

        if (comments.length > 0) {
          resolve(true);
          return;
        }

        if (Date.now() - startTime > timeout) {
          resolve(false);
          return;
        }

        setTimeout(checkComments, 100);
      };

      checkComments();
    });
  }

  /**
   * Initialize auto-expansion (expand description + trigger comments)
   * @returns {Promise<Object>} - Status of operations
   */
  async initialize() {

    const result = {
      descriptionExpanded: false,
      commentsTriggered: false
    };

    // Expand description first
    result.descriptionExpanded = await this.expandDescription();

    // Trigger comments loading
    result.commentsTriggered = await this.triggerCommentsLoad();


    return result;
  }

  /**
   * Reset state (useful for new video loads)
   */
  reset() {
    this.descriptionExpanded = false;
    this.commentsTriggered = false;
  }
}

// Create global instance
window.MarkdAutoExpander = new AutoExpander();
