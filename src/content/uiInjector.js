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

    this.observeNativeTooltip();

    this.initialized = true;
  }

  /**
   * Observe YouTube's native tooltip to re-inject chapter title if YouTube updates it
   */
  observeNativeTooltip() {
    if (this.tooltipObserver) return;

    const tooltip = document.querySelector('.ytp-tooltip');
    
    // Fallback to observing movie player if tooltip isn't in DOM yet
    const targetNode = tooltip || document.querySelector('#movie_player');
    if (!targetNode) return;

    this.tooltipObserver = new MutationObserver((mutations) => {
      // Only process if we are actively hovering a marked chapter
      if (!this.hoveredChapter) return;
      
      let shouldUpdate = false;
      for (const mutation of mutations) {
        if (mutation.target.closest && mutation.target.closest('.ytp-tooltip')) {
          shouldUpdate = true;
          break;
        }
      }
      
      if (shouldUpdate) {
        this.updateNativeTooltip();
      }
    });

    this.tooltipObserver.observe(targetNode, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'aria-hidden']
    });
  }

  /**
   * Inject chapter title into YouTube's native tooltip
   */
  updateNativeTooltip() {
    const tooltip = document.querySelector('.ytp-tooltip');
    if (!tooltip) return;

    let pill = tooltip.querySelector('.ytp-tooltip-progress-bar-pill');

    if (!pill && this.hoveredChapter) {
      const textWrapper = tooltip.querySelector('.ytp-tooltip-text-wrapper');
      if (textWrapper) {
        pill = document.createElement('div');
        pill.className = 'ytp-tooltip-progress-bar-pill';
        pill.setAttribute('data-markd-forged', 'true');
        
        const nativeText = textWrapper.querySelector('.ytp-tooltip-text');
        if (nativeText) {
          nativeText.classList.add('ytp-tooltip-progress-bar-pill-time-stamp');
          pill.appendChild(nativeText);
        }
        textWrapper.appendChild(pill);
      }
    }

    if (pill) {
      let pillTitle = pill.querySelector('.ytp-tooltip-progress-bar-pill-title');
      
      // If YouTube doesn't have the title element natively, create it
      if (!pillTitle) {
         pillTitle = document.createElement('div');
         pillTitle.className = 'ytp-tooltip-progress-bar-pill-title';
         pill.appendChild(pillTitle);
      }

      if (this.hoveredChapter) {
        if (pillTitle.textContent !== this.hoveredChapter.label) {
          pillTitle.textContent = this.hoveredChapter.label;
        }
        if (pillTitle.style.display !== 'block') {
          pillTitle.style.display = 'block';
        }
        if (pill.getAttribute('data-markd-pill') !== 'true') {
          pill.setAttribute('data-markd-pill', 'true');
        }
      } else {
        if (pillTitle.style.display !== 'none') {
          pillTitle.style.display = 'none';
        }
        if (pill.hasAttribute('data-markd-pill')) {
          pill.removeAttribute('data-markd-pill');
        }
        
        if (pill.getAttribute('data-markd-forged') === 'true') {
          const nativeText = pill.querySelector('.ytp-tooltip-text');
          if (nativeText) {
            nativeText.classList.remove('ytp-tooltip-progress-bar-pill-time-stamp');
            pill.parentNode.appendChild(nativeText);
          }
          pill.remove();
        }
      }
    }
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
   * @param {string} source - Chapter source (sponsorblock, description, comments, native)
   */
  injectChapters(chapters, source) {
    if (!this.chaptersContainer) return;

    if (source === 'native') {
      this.chaptersContainer.innerHTML = '';
      return;
    }

    // Don't inject during ads, wait until ad is over
    const moviePlayer = document.querySelector('#movie_player');
    if (moviePlayer && moviePlayer.classList.contains('ad-showing')) {
      setTimeout(() => {
        this.injectChapters(chapters, source);
      }, 1000);
      return;
    }

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

    // Hover handlers for native tooltip injection
    marker.addEventListener('mouseenter', () => {
      this.hoveredChapter = chapter;
      this.updateNativeTooltip();
    });

    marker.addEventListener('mousemove', () => {
      if (this.hoveredChapter !== chapter) {
         this.hoveredChapter = chapter;
      }
      this.updateNativeTooltip();
    });

    marker.addEventListener('mouseleave', () => {
      this.hoveredChapter = null;
      this.updateNativeTooltip();
    });

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

    if (this.tooltipObserver) {
      this.tooltipObserver.disconnect();
      this.tooltipObserver = null;
    }
    
    this.hoveredChapter = null;
    this.updateNativeTooltip();

    this.initialized = false;
  }
}

// Create global instance
window.MarkdUIInjector = new UIInjector();
