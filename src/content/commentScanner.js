/**
 * Markd Comment Scanner
 * Scans YouTube comments for timestamps (fallback source)
 */

class CommentScanner {
  constructor() {
    this.scannedComments = new Set();
    this.foundTimestamps = [];
    this.observer = null;
    this.initialized = false;
    this.scanTimeout = null;
    this.lastScanTime = 0;
    this.scanDebounceMs = 500; // Debounce scans to avoid performance issues
    this.maxCommentsToScan = 200; // Limit scanning to top 200 comments
  }

  /**
   * Initialize comment scanner
   * Only scan if ChapterManager is using 'comments' source
   */
  async initialize() {
    // Only scan comments if we need them (no SponsorBlock or description chapters)
    if (window.MarkdChapterManager?.getSource() !== 'comments') {
      return;
    }

    if (this.initialized) {
      return;
    }


    // Reset state
    this.scannedComments.clear();
    this.foundTimestamps = [];

    // 1. Try Invidious API first (no scrolling, no page manipulation!)
    if (window.MarkdInvidiousAPI) {
      const videoId = window.MarkdDomObserver?.getCurrentVideoId();
      if (videoId) {
        const comments = await window.MarkdInvidiousAPI.getAllComments(videoId, this.maxCommentsToScan);

        if (comments.length > 0) {
          this.processCommentTexts(comments);

          if (this.foundTimestamps.length > 0) {
            this.notifyChapterManager();
            this.initialized = true;
            return;
          }
        }
      }
    }

    // 2. Try YouTube's InnerTube API as fallback
    const apiSuccess = await this.fetchCommentsFromAPI();

    if (apiSuccess && this.foundTimestamps.length > 0) {
      this.notifyChapterManager();
      this.initialized = true;
      return;
    }

    // 3. Final fallback: DOM scanning (requires user to scroll to comments)

    // Wait for comments section to load
    await this.waitForComments();

    // Scan any visible comments (if user has already scrolled)
    this.scanVisibleComments();

    // Setup observer for new comments (will trigger when user scrolls)
    this.setupObserver();

    this.initialized = true;
  }

  /**
   * Fetch comments directly from YouTube's InnerTube API
   * @returns {Promise<boolean>} - True if successful
   */
  async fetchCommentsFromAPI() {
    try {
      const videoId = window.MarkdDomObserver?.getCurrentVideoId();
      if (!videoId) {
        return false;
      }


      // Get YouTube page data using PageDataExtractor
      const pageData = await window.MarkdPageDataExtractor?.extractPageData();
      if (!pageData || !pageData.ytInitialData) {
        return false;
      }

      // First, try to extract comments directly from ytInitialData (they might already be there!)
      const commentsFromData = this.extractCommentsFromYtInitialData(pageData.ytInitialData);
      if (commentsFromData.length > 0) {
        this.processCommentTexts(commentsFromData);
        return this.foundTimestamps.length > 0;
      }


      // If no comments in initial data and we don't have API credentials, fail silently
      if (!pageData.ytcfg || !pageData.ytcfg.INNERTUBE_API_KEY) {
        return false;
      }


      // Extract YouTube config
      const ytcfg = {
        INNERTUBE_API_KEY: pageData.ytcfg.INNERTUBE_API_KEY,
        INNERTUBE_CONTEXT: pageData.ytcfg.INNERTUBE_CONTEXT
      };

      if (!ytcfg.INNERTUBE_API_KEY) {
        return false;
      }


      // Get continuation token from ytInitialData
      const continuationToken = this.extractContinuationToken(pageData.ytInitialData);
      if (!continuationToken) {
        return false;
      }


      // Make request to YouTube's comment endpoint
      const response = await fetch(`https://www.youtube.com/youtubei/v1/next?key=${ytcfg.INNERTUBE_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-YouTube-Client-Name': '1',
          'X-YouTube-Client-Version': ytcfg.INNERTUBE_CONTEXT?.client?.clientVersion || '2.0',
        },
        body: JSON.stringify({
          context: ytcfg.INNERTUBE_CONTEXT,
          continuation: continuationToken
        })
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();

      // Extract comments from response
      const comments = this.extractCommentsFromContinuationResponse(data);


      // Parse timestamps from comments
      let timestampsFound = 0;
      comments.slice(0, this.maxCommentsToScan).forEach(commentText => {
        const timestamps = this.extractTimestamps(commentText);
        if (timestamps.length > 0) {
          this.foundTimestamps.push(...timestamps);
          timestampsFound += timestamps.length;
        }
      });


      return timestampsFound > 0;

    } catch (error) {
      return false;
    }
  }

  /**
   * Extract comments directly from ytInitialData
   * @param {Object} data - ytInitialData object
   * @returns {Array<string>} - Array of comment texts
   */
  extractCommentsFromYtInitialData(data) {
    const comments = [];

    try {

      // Navigate to engagement panels
      const panels = data?.engagementPanels;
      if (!panels) {
        return comments;
      }

      // Find comments panel
      for (const panel of panels) {
        const panelRenderer = panel?.engagementPanelSectionListRenderer;
        if (!panelRenderer) continue;

        // Check if this is the comments panel
        if (panelRenderer.targetId === 'engagement-panel-comments-section' ||
            panelRenderer.panelIdentifier?.includes('comment')) {

          const content = panelRenderer.content?.sectionListRenderer;
          if (!content) continue;

          const contents = content.contents || [];
          for (const item of contents) {
            const itemSection = item?.itemSectionRenderer;
            if (!itemSection) continue;

            const sectionContents = itemSection.contents || [];
            for (const sectionItem of sectionContents) {
              // Look for comment threads
              const commentThread = sectionItem?.commentThreadRenderer;
              if (commentThread) {
                const commentText = this.extractCommentText(commentThread);
                if (commentText) {
                  comments.push(commentText);
                }
              }
            }
          }
        }
      }

    } catch (error) {
    }

    return comments;
  }

  /**
   * Process an array of comment texts for timestamps
   * @param {Array<string>} commentTexts - Array of comment text strings
   */
  processCommentTexts(commentTexts) {
    if (!window.MarkdTimestampParser) {
      return;
    }

    for (const text of commentTexts) {
      if (!text) continue;

      // Parse timestamps from comment text
      const timestamps = window.MarkdTimestampParser.parse(text);
      if (timestamps && timestamps.length > 0) {
        this.foundTimestamps.push(...timestamps);
      }
    }

  }

  /**
   * Extract continuation token from ytInitialData
   * @param {Object} data - ytInitialData object
   * @returns {string|null} - Continuation token or null
   */
  extractContinuationToken(data) {
    try {

      // Navigate through engagement panels for comments
      const panels = data?.engagementPanels;
      if (panels) {

        for (const panel of panels) {
          const panelRenderer = panel?.engagementPanelSectionListRenderer;
          if (!panelRenderer) continue;


          // Look for comments panel
          if (panelRenderer.targetId === 'engagement-panel-comments-section' ||
            panelRenderer.panelIdentifier?.includes('comment')) {


            const content = panelRenderer.content?.sectionListRenderer;
            if (!content) {
              continue;
            }

            const contents = content.contents || [];

            for (const item of contents) {
              const itemSection = item?.itemSectionRenderer;
              if (!itemSection) continue;

              // Look for continuation in contents
              const sectionContents = itemSection.contents || [];

              for (const sectionItem of sectionContents) {
                const continuation = sectionItem?.continuationItemRenderer;
                if (continuation?.continuationEndpoint?.continuationCommand?.token) {
                  const token = continuation.continuationEndpoint.continuationCommand.token;
                  return token;
                }
              }
            }
          }
        }
      } else {
      }

      // Fallback: Look in main contents
      const contents = data?.contents?.twoColumnWatchNextResults?.results?.results?.contents;
      if (contents) {

        for (const content of contents) {
          const itemSection = content?.itemSectionRenderer;
          if (!itemSection) continue;

          const sectionContents = itemSection.contents || [];
          for (const item of sectionContents) {
            const continuation = item?.continuationItemRenderer;
            if (continuation?.continuationEndpoint?.continuationCommand?.token) {
              const token = continuation.continuationEndpoint.continuationCommand.token;
              return token;
            }
          }
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract comments from continuation API response
   * @param {Object} data - API response
   * @returns {Array<string>} - Comment texts
   */
  extractCommentsFromContinuationResponse(data) {
    const comments = [];

    try {
      const actions = data?.onResponseReceivedEndpoints;
      if (!actions) {
        return comments;
      }

      for (const action of actions) {
        const items = action?.reloadContinuationItemsCommand?.continuationItems ||
          action?.appendContinuationItemsAction?.continuationItems;

        if (!items) continue;

        for (const item of items) {
          const commentThread = item?.commentThreadRenderer;
          if (commentThread) {
            const commentText = this.extractCommentText(commentThread);
            if (commentText) {
              comments.push(commentText);
            }
          }
        }
      }

    } catch (error) {
    }

    return comments;
  }

  /**
   * Extract text from comment thread renderer
   * @param {Object} commentThread - Comment thread renderer object
   * @returns {string|null} - Comment text
   */
  extractCommentText(commentThread) {
    try {
      const comment = commentThread?.comment?.commentRenderer;
      if (!comment) return null;

      const contentText = comment.contentText;
      if (!contentText) return null;

      // Extract text from runs
      if (contentText.runs) {
        return contentText.runs.map(run => run.text).join('');
      }

      // Or simple text
      if (contentText.simpleText) {
        return contentText.simpleText;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Wait for comments section to exist AND have actual comments
   * @returns {Promise<void>}
   */
  waitForComments() {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 50; // 10 seconds max

      const checkComments = () => {
        attempts++;

        const commentsSection = document.querySelector('#comments');
        if (!commentsSection) {
          if (attempts < maxAttempts) {
            setTimeout(checkComments, 200);
          } else {
            resolve();
          }
          return;
        }

        // Check if there are actual comment elements
        const commentSelectors = [
          'ytd-comment-renderer',
          'ytd-comment-view-model'
        ];

        let hasComments = false;
        for (const selector of commentSelectors) {
          const comments = commentsSection.querySelectorAll(selector);
          if (comments.length > 0) {
            hasComments = true;
            break;
          }
        }

        if (hasComments || attempts >= maxAttempts) {
          if (!hasComments) {
          }
          resolve();
        } else {
          setTimeout(checkComments, 200);
        }
      };
      checkComments();
    });
  }

  /**
   * Scan all visible comments for timestamps
   */
  scanVisibleComments() {
    // Debounce scanning
    const now = Date.now();
    if (now - this.lastScanTime < this.scanDebounceMs) {
      return;
    }
    this.lastScanTime = now;


    // Try multiple selectors for comment text (YouTube changes their DOM frequently)
    const selectors = [
      'ytd-comment-renderer #content-text',
      'ytd-comment-renderer yt-attributed-string',
      'ytd-comment-renderer #comment-content',
      'ytd-comment-renderer #body #content-text',
      'ytd-comment-renderer #expander #content-text',
      'ytd-comment-view-model #content-text',
      'ytd-comment-view-model yt-attributed-string'
    ];

    let comments = [];
    for (const selector of selectors) {
      comments = document.querySelectorAll(selector);
      if (comments.length > 0) {
        break;
      }
    }

    if (comments.length === 0) {
      return;
    }

    let newTimestampsFound = 0;
    let commentsScanned = 0;

    comments.forEach(commentEl => {
      // Limit number of comments scanned
      if (commentsScanned >= this.maxCommentsToScan) {
        return;
      }

      const commentId = this.getCommentId(commentEl);

      // Skip if already scanned
      if (this.scannedComments.has(commentId)) {
        return;
      }

      // Mark as scanned
      this.scannedComments.add(commentId);
      commentsScanned++;

      // Extract text
      const text = commentEl.textContent || commentEl.innerText || '';

      if (!text) return;

      // Parse timestamps
      const timestamps = this.extractTimestamps(text);

      if (timestamps.length > 0) {
        this.foundTimestamps.push(...timestamps);
        newTimestampsFound += timestamps.length;
      }
    });

    if (newTimestampsFound > 0) {
      this.notifyChapterManager();
    } else {
    }
  }

  /**
   * Setup MutationObserver to watch for new comments
   */
  setupObserver() {
    const commentsSection = document.querySelector('#comments');

    if (!commentsSection) {
      // Retry after a delay (might be blocked by ads)
      setTimeout(() => this.setupObserver(), 2000);
      return;
    }

    this.observer = new MutationObserver((mutations) => {
      // Debounce scanning
      if (this.scanTimeout) {
        clearTimeout(this.scanTimeout);
      }

      this.scanTimeout = setTimeout(() => {
        try {
          this.scanVisibleComments();
        } catch (error) {
          // Retry on error (might be ad interference)
          setTimeout(() => this.scanVisibleComments(), 1000);
        }
      }, this.scanDebounceMs);
    });

    try {
      this.observer.observe(commentsSection, {
        childList: true,
        subtree: true
      });

    } catch (error) {
      // Retry after delay
      setTimeout(() => this.setupObserver(), 2000);
    }
  }

  /**
   * Get unique comment ID
   * @param {HTMLElement} commentEl - Comment element
   * @returns {string} - Unique comment ID
   */
  getCommentId(commentEl) {
    // Try to get comment ID from parent
    const renderer = commentEl.closest('ytd-comment-renderer');
    if (renderer) {
      const commentId = renderer.getAttribute('comment-id');
      if (commentId) return commentId;
    }

    // Fallback: use text hash
    const text = commentEl.textContent || '';
    return this.hashCode(text);
  }

  /**
   * Simple hash function for text
   * @param {string} str - String to hash
   * @returns {string} - Hash code
   */
  hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  /**
   * Extract timestamps from comment text
   * @param {string} text - Comment text
   * @returns {Array} - Array of timestamps
   */
  extractTimestamps(text) {
    if (!window.MarkdTimestampParser) {
      return [];
    }

    const timestamps = window.MarkdTimestampParser.parse(text);

    return timestamps.map(ts => ({
      seconds: ts.seconds,
      label: ts.label,
      source: 'comments',
      fixed: ts.fixed || false
    }));
  }

  /**
   * Notify ChapterManager of found timestamps
   */
  notifyChapterManager() {
    if (window.MarkdChapterManager && this.foundTimestamps.length > 0) {
      window.MarkdChapterManager.addChaptersFromComments(this.foundTimestamps);

      // Clear found timestamps after notifying
      this.foundTimestamps = [];
    }
  }

  /**
   * Disconnect observer
   */
  disconnect() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    if (this.scanTimeout) {
      clearTimeout(this.scanTimeout);
      this.scanTimeout = null;
    }
  }

  /**
   * Reset scanner state
   */
  reset() {
    this.disconnect();
    this.scannedComments.clear();
    this.foundTimestamps = [];
    this.initialized = false;
    this.lastScanTime = 0;
  }
}

// Create global instance
window.MarkdCommentScanner = new CommentScanner();
