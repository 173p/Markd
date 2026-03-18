/**
 * Markd Chapter Manager
 * Manages chapter sourcing, validation, and tracking
 * Priority: SponsorBlock → Description → Comments
 */

class ChapterManager {
  constructor() {
    this.chapters = [];
    this.activeChapterIndex = -1;
    this.listeners = [];
    this.videoId = null;
    this.initialized = false;
    this.chapterSource = null; // 'sponsorblock', 'description', 'comments', or 'mixed'
  }

  /**
   * Initialize chapter manager for a video
   * @param {string} videoId - YouTube video ID
   */
  async initialize(videoId) {
    if (this.videoId === videoId && this.initialized) {
      return;
    }


    this.videoId = videoId;
    this.chapters = [];
    this.activeChapterIndex = -1;
    this.chapterSource = null;

    // Attempt to load chapters in priority order
    await this.loadChapters();

    this.initialized = true;
  }

  /**
   * Load chapters from sources in priority order
   * Priority: SponsorBlock → Description → Comments
   */
  async loadChapters() {
    const sponsorBlockPromise = this.loadFromSponsorBlock();
    const descriptionPromise = this.loadFromDescription();

    await new Promise(resolve => setTimeout(resolve, 250));

    // 1. Try Native YouTube chapters first
    if (this.hasNativeChapters()) {
      this.chapters = [];
      this.chapterSource = 'native';
      this.notifyListeners();
      return;
    }

    // 2. Try video description (official YouTube chapters or timestamps)
    const descriptionChapters = await descriptionPromise;
    if (descriptionChapters.length > 0) {
      this.chapters = descriptionChapters;
      this.chapterSource = 'description';
      this.notifyListeners();
      return;
    }

    // 3. Try SponsorBlock API
    const sponsorBlockChapters = await sponsorBlockPromise;
    if (sponsorBlockChapters.length > 0) {
      this.chapters = sponsorBlockChapters;
      this.notifyListeners();
    }

    // 4. Fall back to comments
    this.chapterSource = 'comments';

    if (window.MarkdCommentScanner && window.MarkdCommentScanner.foundTimestamps.length > 0) {
      const accepted = this.addChaptersFromComments(window.MarkdCommentScanner.foundTimestamps);
      if (accepted) {
        window.MarkdCommentScanner.foundTimestamps = [];
      }
    }
  }

  /**
   * Load chapters from SponsorBlock API
   * @returns {Promise<Array>} - Chapters from SponsorBlock
   */
  async loadFromSponsorBlock() {
    if (!window.MarkdSponsorBlockAPI) {
      return [];
    }

    try {
      const chapters = await window.MarkdSponsorBlockAPI.fetchChapters(this.videoId);
      return this.validateAndFormat(chapters);
    } catch (error) {
      return [];
    }
  }

  /**
   * Load chapters from video description
   * @returns {Promise<Array>} - Chapters from description
   */
  async loadFromDescription() {
    if (!window.MarkdDescriptionParser) {
      return [];
    }

    try {
      const chapters = await window.MarkdDescriptionParser.parse();
      return this.validateAndFormat(chapters);
    } catch (error) {
      return [];
    }
  }

  /**
   * Add chapters from comments
   * @param {Array} newChapters - Chapters to add
   */
  addChaptersFromComments(newChapters) {
    if (this.chapterSource !== 'comments') {
      return false;
    }

    this.chapters = this.validateAndFormat(newChapters);

    this.notifyListeners();
    return true;
  }

  /**
   * Apply user-provided timestamps from popup
   * This overrides any existing chapters
   * @param {Array} userTimestamps - User timestamps from popup [{time: seconds, title: string}]
   */
  applyUserTimestamps(userTimestamps) {

    // Convert to chapter format
    const userChapters = userTimestamps.map(ts => ({
      seconds: ts.time,
      label: ts.title,
      source: 'user'
    }));

    // Replace current chapters with user chapters
    this.chapters = this.validateAndFormat(userChapters);
    this.chapterSource = 'user';

    // Notify listeners to update UI
    this.notifyListeners();

  }

  /**
   * Check if YouTube has loaded its own native chapters
   * @returns {boolean} - True if native chapters exist
   */
  hasNativeChapters() {
    const progressList = document.querySelector('.ytp-progress-list');
    if (progressList) {
      const hoverContainers = progressList.querySelectorAll('.ytp-chapter-hover-container');
      if (hoverContainers.length > 1) {
        return true;
      }
    }

    // Also check for engagement panels that list chapters
    const chapterPanel = document.querySelector('ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-macro-markers-description-chapters"]');
    if (chapterPanel) {
      return true;
    }

    return false;
  }

  /**
   * Validate and format chapters
   * @param {Array} chapters - Raw chapters
   * @returns {Array} - Validated and formatted chapters
   */
  validateAndFormat(chapters) {
    if (!chapters || chapters.length === 0) {
      return [];
    }

    // Remove duplicates (within 2-second window)
    const unique = this.removeDuplicates(chapters);

    // Sort chronologically
    unique.sort((a, b) => a.seconds - b.seconds);

    // Validate timestamps are within video duration
    const duration = this.getVideoDuration();
    const valid = duration > 0
      ? unique.filter(ch => ch.seconds < duration)
      : unique;

    // Ensure first chapter starts at 0:00 (or add one)
    if (valid.length > 0 && valid[0].seconds > 5) {
      valid.unshift({
        seconds: 0,
        label: 'Start',
        source: 'generated'
      });
    }

    return valid;
  }

  /**
   * Remove duplicate chapters (within 2-second window)
   * @param {Array} chapters - Chapters to deduplicate
   * @returns {Array} - Deduplicated chapters
   */
  removeDuplicates(chapters) {
    const seen = new Map();

    chapters.forEach(ch => {
      // Use 2-second buckets to group similar timestamps
      const roundedTime = Math.floor(ch.seconds / 2) * 2;

      if (!seen.has(roundedTime)) {
        seen.set(roundedTime, ch);
      } else {
        // Keep chapter with better label (longer, more descriptive)
        const existing = seen.get(roundedTime);
        if (ch.label && ch.label.length > existing.label.length) {
          seen.set(roundedTime, ch);
        }
      }
    });

    return Array.from(seen.values());
  }

  /**
   * Update active chapter based on current playback time
   * @param {number} currentTime - Current playback time in seconds
   */
  updateActiveChapter(currentTime) {
    if (this.chapters.length === 0) return;

    // Find which chapter is currently playing
    let newActiveIndex = -1;

    for (let i = this.chapters.length - 1; i >= 0; i--) {
      if (currentTime >= this.chapters[i].seconds) {
        newActiveIndex = i;
        break;
      }
    }

    if (newActiveIndex !== this.activeChapterIndex) {
      this.activeChapterIndex = newActiveIndex;
      this.highlightActiveChapter();
    }
  }

  /**
   * Highlight active chapter in UI
   */
  highlightActiveChapter() {
    // Remove previous active class
    document.querySelectorAll('.markd-chapter-marker.active')
      .forEach(el => el.classList.remove('active'));

    // Add active class to current chapter
    if (this.activeChapterIndex >= 0) {
      const markers = document.querySelectorAll('.markd-chapter-marker');
      if (markers[this.activeChapterIndex]) {
        markers[this.activeChapterIndex].classList.add('active');

        // Update chapter name display
        const chapterName = this.chapters[this.activeChapterIndex]?.label;
        if (chapterName && window.MarkdUIInjector) {
          window.MarkdUIInjector.injectChapterName(chapterName);
        }
      }
    }
  }

  /**
   * Get video duration from player
   * @returns {number} - Duration in seconds
   */
  getVideoDuration() {
    if (window.MarkdPlayerIntegration) {
      return window.MarkdPlayerIntegration.getDuration();
    }

    // Fallback: try to get from player element
    const player = document.querySelector('#movie_player');
    if (player && player.getDuration) {
      return player.getDuration();
    }

    return 0;
  }

  /**
   * Register callback for chapter changes
   * @param {Function} callback - Callback function
   */
  onChaptersChange(callback) {
    if (typeof callback === 'function') {
      this.listeners.push(callback);
    }
  }

  /**
   * Notify all listeners of chapter changes
   */
  notifyListeners() {
    this.listeners.forEach(callback => {
      try {
        callback(this.chapters, this.chapterSource);
      } catch (error) {
      }
    });
  }

  /**
   * Get current chapters
   * @returns {Array} - Current chapters
   */
  getChapters() {
    return [...this.chapters];
  }

  /**
   * Get chapter source
   * @returns {string|null} - Chapter source
   */
  getSource() {
    return this.chapterSource;
  }

  /**
   * Reset manager state
   */
  reset() {
    this.chapters = [];
    this.activeChapterIndex = -1;
    this.videoId = null;
    this.initialized = false;
    this.chapterSource = null;
  }
}

// Create global instance
window.MarkdChapterManager = new ChapterManager();
