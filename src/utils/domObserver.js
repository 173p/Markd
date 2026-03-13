/**
 * Markd DOM Observer
 * Handles YouTube SPA navigation detection
 */

class DomObserver {
  constructor() {
    this.currentUrl = window.location.href;
    this.navigationCallbacks = [];
    this.initialized = false;
  }

  /**
   * Initialize observer
   */
  initialize() {
    if (this.initialized) return;

    // Watch for URL changes (YouTube SPA navigation)
    this.watchUrlChanges();

    // Watch for YouTube's custom navigation event
    this.watchYouTubeEvents();

    this.initialized = true;
  }

  /**
   * Watch for URL changes via history API
   */
  watchUrlChanges() {
    // Monitor pushState and replaceState
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = (...args) => {
      originalPushState.apply(history, args);
      this.checkUrlChange();
    };

    history.replaceState = (...args) => {
      originalReplaceState.apply(history, args);
      this.checkUrlChange();
    };

    // Monitor popstate (back/forward buttons)
    window.addEventListener('popstate', () => {
      this.checkUrlChange();
    });
  }

  /**
   * Watch for YouTube-specific navigation events
   */
  watchYouTubeEvents() {
    // YouTube fires 'yt-navigate-finish' when navigation completes
    document.addEventListener('yt-navigate-finish', () => {
      this.checkUrlChange();
    });

    // Also watch for 'yt-page-data-updated'
    document.addEventListener('yt-page-data-updated', () => {
      this.checkUrlChange();
    });
  }

  /**
   * Check if URL has changed
   */
  checkUrlChange() {
    const newUrl = window.location.href;

    if (newUrl !== this.currentUrl) {

      const oldUrl = this.currentUrl;
      this.currentUrl = newUrl;

      // Extract video IDs
      const oldVideoId = this.extractVideoId(oldUrl);
      const newVideoId = this.extractVideoId(newUrl);

      // Only trigger if video changed (not just timestamp or other params)
      if (oldVideoId !== newVideoId) {
        this.notifyNavigationCallbacks(newVideoId, oldVideoId);
      }
    }
  }

  /**
   * Extract video ID from URL
   * @param {string} url - YouTube URL
   * @returns {string|null} - Video ID or null
   */
  extractVideoId(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.searchParams.get('v');
    } catch {
      return null;
    }
  }

  /**
   * Register callback for navigation events
   * @param {Function} callback - Callback function
   */
  onNavigate(callback) {
    if (typeof callback === 'function') {
      this.navigationCallbacks.push(callback);
    }
  }

  /**
   * Notify all registered callbacks
   * @param {string} newVideoId - New video ID
   * @param {string} oldVideoId - Old video ID
   */
  notifyNavigationCallbacks(newVideoId, oldVideoId) {
    this.navigationCallbacks.forEach(callback => {
      try {
        callback(newVideoId, oldVideoId);
      } catch (error) {
      }
    });
  }

  /**
   * Get current video ID
   * @returns {string|null} - Current video ID
   */
  getCurrentVideoId() {
    return this.extractVideoId(this.currentUrl);
  }
}

// Create global instance
window.MarkdDomObserver = new DomObserver();
