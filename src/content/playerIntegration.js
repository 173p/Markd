/**
 * Markd Player Integration
 * Hooks into YouTube player for playback control and monitoring
 */

class PlayerIntegration {
  constructor() {
    this.player = null;
    this.video = null;
    this.currentTime = 0;
    this.duration = 0;
    this.updateInterval = null;
    this.initialized = false;
  }

  /**
   * Initialize player integration
   */
  async initialize() {
    if (this.initialized) {
      return;
    }


    // Wait for player to exist
    this.player = await this.waitForPlayer();

    if (!this.player) {
      return;
    }

    // Get video element
    this.video = this.player.querySelector('video');

    if (!this.video) {
      return;
    }

    // Setup event listeners
    this.setupEventListeners();

    // Setup keyboard shortcuts
    this.setupKeyboardShortcuts();

    // Get initial duration
    this.duration = this.getDuration();


    this.initialized = true;
  }

  /**
   * Wait for YouTube player element to exist
   * @returns {Promise<HTMLElement>} - Player element
   */
  waitForPlayer() {
    return new Promise((resolve) => {
      const checkPlayer = () => {
        const player = document.querySelector('#movie_player');
        if (player) {
          resolve(player);
        } else {
          setTimeout(checkPlayer, 100);
        }
      };
      checkPlayer();
    });
  }

  /**
   * Setup event listeners on video element
   */
  setupEventListeners() {
    if (!this.video) return;

    // Time update - track playback progress
    this.video.addEventListener('timeupdate', () => {
      this.handleTimeUpdate();
    });

    // Metadata loaded - new video loaded
    this.video.addEventListener('loadedmetadata', () => {
      this.handleVideoLoad();
    });

    // Playing - video started/resumed
    this.video.addEventListener('playing', () => {
      this.startProgressTracking();
    });

    // Paused - video paused
    this.video.addEventListener('pause', () => {
      this.stopProgressTracking();
    });

    // Ended - video finished
    this.video.addEventListener('ended', () => {
      this.stopProgressTracking();
    });

  }

  /**
   * Setup keyboard shortcuts for chapter navigation
   * Firefox: Ctrl+Arrow (to avoid conflict with SponsorBlock's Shift+Arrow)
   * Chrome/Edge/Brave: Shift+Arrow (to avoid conflict with SponsorBlock's Ctrl+Arrow)
   */
  setupKeyboardShortcuts() {
    // Detect browser - Firefox uses 'browser' namespace, Chrome uses 'chrome'
    const isFirefox = typeof browser !== 'undefined' && browser.runtime;

    document.addEventListener('keydown', (event) => {
      // Browser-specific modifier key check
      // Firefox: Ctrl+Arrow, Chrome: Shift+Arrow
      const hasModifier = isFirefox ? event.ctrlKey : event.shiftKey;

      if (!hasModifier) return;

      // Only handle Left and Right arrows
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

      // Get chapter manager
      const chapterManager = window.MarkdChapterManager;
      if (!chapterManager || !chapterManager.chapters || chapterManager.chapters.length === 0) {
        return;
      }

      // Prevent default behavior and stop propagation
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const currentTime = this.getCurrentTime();
      const chapters = chapterManager.chapters;

      if (event.key === 'ArrowRight') {
        // Skip to next chapter
        const nextChapter = chapters.find(ch => ch.seconds > currentTime + 0.5);
        if (nextChapter) {
          this.seekTo(nextChapter.seconds);
        }
      } else if (event.key === 'ArrowLeft') {
        // Skip to previous chapter or current chapter start
        const currentChapter = chapters.find((ch, idx) => {
          const nextCh = chapters[idx + 1];
          return ch.seconds <= currentTime && (!nextCh || currentTime < nextCh.seconds);
        });

        if (currentChapter) {
          // If we're more than 3 seconds into the chapter, go to chapter start
          if (currentTime - currentChapter.seconds > 3) {
            this.seekTo(currentChapter.seconds);
          } else {
            // Otherwise, go to previous chapter
            const currentIndex = chapters.indexOf(currentChapter);
            if (currentIndex > 0) {
              const prevChapter = chapters[currentIndex - 1];
              this.seekTo(prevChapter.seconds);
            }
          }
        }
      }
    }, true); // Use capture phase to intercept before other extensions

  }

  /**
   * Handle time update event
   */
  handleTimeUpdate() {
    this.currentTime = this.getCurrentTime();

    // Update active chapter highlight
    if (window.MarkdChapterManager) {
      window.MarkdChapterManager.updateActiveChapter(this.currentTime);
    }
  }

  /**
   * Handle video load event
   */
  handleVideoLoad() {
    this.duration = this.getDuration();

    // Trigger chapter loading for new video
    const videoId = window.MarkdDomObserver?.getCurrentVideoId();
    if (videoId && window.MarkdChapterManager) {
      window.MarkdChapterManager.initialize(videoId);
    }
  }

  /**
   * Start progress tracking interval
   */
  startProgressTracking() {
    if (this.updateInterval) return;

    // Update every 100ms for smooth chapter highlighting
    this.updateInterval = setInterval(() => {
      this.handleTimeUpdate();
    }, 100);

  }

  /**
   * Stop progress tracking interval
   */
  stopProgressTracking() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Seek to specific time
   * @param {number} seconds - Time in seconds
   */
  seekTo(seconds) {
    if (this.player && typeof this.player.seekTo === 'function') {
      this.player.seekTo(seconds, true);
    } else if (this.video) {
      this.video.currentTime = seconds;
    } else {
    }
  }

  /**
   * Get current playback time
   * @returns {number} - Current time in seconds
   */
  getCurrentTime() {
    if (this.player && typeof this.player.getCurrentTime === 'function') {
      return this.player.getCurrentTime();
    } else if (this.video) {
      return this.video.currentTime;
    }
    return 0;
  }

  /**
   * Get video duration
   * @returns {number} - Duration in seconds
   */
  getDuration() {
    if (this.player && typeof this.player.getDuration === 'function') {
      return this.player.getDuration();
    } else if (this.video) {
      return this.video.duration || 0;
    }
    return 0;
  }

  /**
   * Check if video is playing
   * @returns {boolean} - True if playing
   */
  isPlaying() {
    if (this.video) {
      return !this.video.paused && !this.video.ended;
    }
    return false;
  }

  /**
   * Reset integration state
   */
  reset() {
    this.stopProgressTracking();
    this.currentTime = 0;
    this.duration = 0;
    this.initialized = false;
  }
}

// Create global instance
window.MarkdPlayerIntegration = new PlayerIntegration();
