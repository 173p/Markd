(function() {
  'use strict';

  if (window.MarkdInitialized) return;
  window.MarkdInitialized = true;

  async function initializeMarkd() {
    try {
      window.MarkdDomObserver.initialize();
      window.MarkdDomObserver.onNavigate((newVideoId) => {
        handleVideoChange(newVideoId);
      });

      await window.MarkdPlayerIntegration.initialize();

      window.MarkdChapterManager.onChaptersChange((chapters, source) => {
        window.MarkdUIInjector.injectChapters(chapters, source);
      });

      await window.MarkdUIInjector.initialize();

      const videoId = window.MarkdDomObserver.getCurrentVideoId();
      if (videoId) {
        await window.MarkdChapterManager.initialize(videoId);
        await window.MarkdCommentScanner.initialize();
      }
    } catch (error) {
      console.error('Markd initialization error:', error);
    }
  }

  async function handleVideoChange(newVideoId) {
    try {
      window.MarkdChapterManager.reset();
      window.MarkdCommentScanner.reset();
      window.MarkdPlayerIntegration.reset();
      window.MarkdUIInjector.reset();

      await window.MarkdPlayerIntegration.initialize();
      await window.MarkdUIInjector.initialize();

      if (newVideoId) {
        await window.MarkdChapterManager.initialize(newVideoId);
        await window.MarkdCommentScanner.initialize();
      }
    } catch (error) {
      console.error('Markd video change error:', error);
    }
  }

  function start() {
    if (!window.location.href.includes('youtube.com/watch')) return;

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeMarkd);
    } else {
      initializeMarkd();
    }
  }

  browserAPI.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'APPLY_USER_TIMESTAMPS') {
      const currentVideoId = window.MarkdDomObserver?.getCurrentVideoId();

      if (currentVideoId === message.videoId) {
        window.MarkdChapterManager.applyUserTimestamps(message.timestamps);
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'Video ID mismatch' });
      }

      return true;
    }

    if (message.type === 'RESET_TO_ORIGINAL_CHAPTERS') {
      const currentVideoId = window.MarkdDomObserver?.getCurrentVideoId();

      if (currentVideoId === message.videoId) {
        window.MarkdChapterManager.reset();
        window.MarkdUIInjector.reset();

        window.MarkdChapterManager.initialize(currentVideoId).then(() => {
          sendResponse({ success: true });
        }).catch((error) => {
          sendResponse({ success: false, error: error.message });
        });
      } else {
        sendResponse({ success: false, error: 'Video ID mismatch' });
      }

      return true;
    }
  });

  start();

  window.MarkdInit = initializeMarkd;
  window.MarkdHandleVideoChange = handleVideoChange;

})();
