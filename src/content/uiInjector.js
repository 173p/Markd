/**
 * Markd UI Injector
 * Injects chapter markers into YouTube progress bar
 */

class UIInjector {
  constructor() {
    this.progressBar = null;
    this.chaptersContainer = null;
    this.initialized = false;
  }

  /**
   * Initialize UI injector
   */
  async initialize() {
    if (this.initialized) return;

    this.progressBar = await this.waitForProgressBar();
    if (!this.progressBar) return;

    const existing = this.progressBar.querySelector('.markd-chapters-container');
    if (existing) {
      this.chaptersContainer = existing;
    } else {
      this.createChapterContainer();
    }

    this.initialized = true;
  }

  /**
   * Wait for YouTube progress bar to exist
   * @returns {Promise<HTMLElement>} - Progress bar element
   */
  waitForProgressBar() {
    return new Promise((resolve) => {
      const selectors = [
        '.ytp-progress-bar',
        '.ytp-progress-list',
        '#movie_player .ytp-progress-bar'
      ];

      const checkProgressBar = () => {
        for (const selector of selectors) {
          const progressBar = document.querySelector(selector);
          if (progressBar) {
            resolve(progressBar);
            return;
          }
        }
        setTimeout(checkProgressBar, 100);
      };
      checkProgressBar();
    });
  }

  /**
   * Create chapter container element
   */
  createChapterContainer() {
    this.chaptersContainer = document.createElement('div');
    this.chaptersContainer.className = 'markd-chapters-container';
    this.chaptersContainer.setAttribute('data-markd', 'true');
    this.progressBar.appendChild(this.chaptersContainer);
  }

  /**
   * Inject chapter markers
   * @param {Array} chapters - Chapters to display
   * @param {string} source - Chapter source (sponsorblock, description, comments)
   */
  injectChapters(chapters, source) {
    if (!this.chaptersContainer) return;

    if (!chapters || chapters.length === 0) {
      this.chaptersContainer.innerHTML = '';
      return;
    }

    const progressBarContainer = this.progressBar.parentElement || this.progressBar;
    const sbChapterBar = progressBarContainer.querySelector('.sponsorBlockChapterBar');

    if (sbChapterBar) {
      const style = getComputedStyle(sbChapterBar);
      const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && sbChapterBar.offsetParent !== null;
      const segmentChildren = sbChapterBar.querySelectorAll('[class*="sponsorBlock"], [class*="chapter"]');
      const hasActualSegments = segmentChildren.length > 1;

      if (isVisible && hasActualSegments) return;
    }

    this.chaptersContainer.innerHTML = '';
    this.chaptersContainer.setAttribute('data-source', source);

    const totalDuration = this.getDuration();

    if (totalDuration === 0) {
      setTimeout(() => {
        this.injectChapters(chapters, source);
      }, 1000);
      return;
    }

    chapters.forEach((chapter, index) => {
      const nextChapter = chapters[index + 1];
      const chapterEnd = nextChapter ? nextChapter.seconds : totalDuration;
      const chapterDuration = chapterEnd - chapter.seconds;
      const widthPercent = (chapterDuration / totalDuration) * 100;

      const marker = this.createChapterMarker(chapter, widthPercent, index);
      this.chaptersContainer.appendChild(marker);
    });
  }

  /**
   * Create individual chapter marker element
   * @param {Object} chapter - Chapter data
   * @param {number} widthPercent - Width percentage
   * @param {number} index - Chapter index
   * @returns {HTMLElement} - Chapter marker element
   */
  createChapterMarker(chapter, widthPercent, index) {
    const marker = document.createElement('div');
    marker.className = 'markd-chapter-marker';
    marker.style.width = `${widthPercent}%`;
    marker.setAttribute('data-time', chapter.seconds);
    marker.setAttribute('data-label', chapter.label);
    marker.setAttribute('data-index', index);
    marker.setAttribute('tabindex', '-1');
    marker.setAttribute('role', 'button');
    marker.setAttribute('aria-label', `${chapter.label} at ${this.formatTime(chapter.seconds)}`);

    // Create chapter label (visible on segment)
    const label = document.createElement('div');
    label.className = 'markd-chapter-label';
    label.textContent = chapter.label;
    marker.appendChild(label);

    // Create tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'markd-chapter-tooltip';
    tooltip.textContent = chapter.label;
    marker.appendChild(tooltip);

    // Click handler for seeking
    marker.addEventListener('click', (e) => {
      e.stopPropagation();
      this.seekToChapter(chapter.seconds);
    });

    // Keyboard handler (Enter or Space)
    marker.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        this.seekToChapter(chapter.seconds);
      }
    });

    return marker;
  }

  /**
   * Inject current chapter name next to time display
   * @param {string} chapterName - Current chapter name
   */
  injectChapterName(chapterName) {
    // Find YouTube's time display
    const timeDisplay = document.querySelector('.ytp-time-display');

    if (!timeDisplay) return;

    // Remove existing chapter name if present
    const existing = document.querySelector('.markd-current-chapter');
    if (existing) {
      existing.remove();
    }

    if (!chapterName) return;

    // Check if YouTube is already showing a visible chapter name to avoid duplicates
    const youtubeChapter = document.querySelector('.ytp-chapter-title');
    if (youtubeChapter &&
        youtubeChapter.offsetParent !== null &&
        youtubeChapter.textContent.trim() &&
        getComputedStyle(youtubeChapter).display !== 'none') {
      // YouTube is already showing chapters, don't duplicate
      return;
    }

    // Create chapter name element
    const chapterNameEl = document.createElement('span');
    chapterNameEl.className = 'markd-current-chapter';
    chapterNameEl.textContent = chapterName;

    // Insert after time display
    timeDisplay.parentNode.insertBefore(chapterNameEl, timeDisplay.nextSibling);
  }

  /**
   * Seek to chapter
   * @param {number} seconds - Time in seconds
   */
  seekToChapter(seconds) {
    if (window.MarkdPlayerIntegration) {
      window.MarkdPlayerIntegration.seekTo(seconds);
    }
  }

  /**
   * Get video duration
   * @returns {number} - Duration in seconds
   */
  getDuration() {
    if (window.MarkdPlayerIntegration) {
      return window.MarkdPlayerIntegration.getDuration();
    }

    // Fallback
    const player = document.querySelector('#movie_player');
    if (player && player.getDuration) {
      return player.getDuration();
    }

    return 0;
  }

  /**
   * Format seconds to time string
   * @param {number} seconds - Time in seconds
   * @returns {string} - Formatted time
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
   * Clear all chapter markers
   */
  clear() {
    if (this.chaptersContainer) {
      this.chaptersContainer.innerHTML = '';
    }
  }

  /**
   * Reset injector state
   */
  reset() {
    this.clear();

    const existing = document.querySelector('.markd-current-chapter');
    if (existing) {
      existing.remove();
    }

    this.initialized = false;
  }
}

// Create global instance
window.MarkdUIInjector = new UIInjector();
