/**
 * Injected script that runs in the page context
 * This script has access to page variables without CSP restrictions
 */

(function() {
  'use strict';

  // Listen for extraction requests from content script
  window.addEventListener('message', function(event) {
    // Only process messages from the same window
    if (event.source !== window) {
      return;
    }

    // Check if this is a request for YouTube data
    if (!event.data || event.data.type !== 'markd-request-data') {
      return;
    }

    const messageId = event.data.messageId;

    try {
      // Extract YouTube data from page context
      const data = {
        ytInitialData: typeof window.ytInitialData !== 'undefined' ? window.ytInitialData : null,
        ytInitialPlayerResponse: typeof window.ytInitialPlayerResponse !== 'undefined' ? window.ytInitialPlayerResponse : null,
        ytcfg: null
      };

      // Try to get ytcfg from various possible sources
      if (typeof window.ytcfg !== 'undefined' && window.ytcfg) {
        data.ytcfg = window.ytcfg;
      } else if (typeof window.yt !== 'undefined' && window.yt?.config_) {
        // Sometimes it's in window.yt.config_
        data.ytcfg = window.yt.config_;
      }

      // If ytcfg is found, make sure it's serializable (remove functions)
      if (data.ytcfg) {
        try {
          // Try to clone it to ensure it's serializable
          data.ytcfg = JSON.parse(JSON.stringify(data.ytcfg));
        } catch (e) {
          // If it fails, try to extract just the important parts
          data.ytcfg = {
            INNERTUBE_API_KEY: data.ytcfg.INNERTUBE_API_KEY || null,
            INNERTUBE_CONTEXT: data.ytcfg.INNERTUBE_CONTEXT || null,
            INNERTUBE_CLIENT_NAME: data.ytcfg.INNERTUBE_CLIENT_NAME || null,
            INNERTUBE_CLIENT_VERSION: data.ytcfg.INNERTUBE_CLIENT_VERSION || null
          };
        }
      }

      // Send data back to content script
      window.postMessage({
        type: 'markd-response-data',
        source: 'markd-injector',
        messageId: messageId,
        payload: data
      }, '*');
    } catch (error) {
      // Send empty data on error
      window.postMessage({
        type: 'markd-response-data',
        source: 'markd-injector',
        messageId: messageId,
        payload: {
          ytInitialData: null,
          ytInitialPlayerResponse: null,
          ytcfg: null
        }
      }, '*');
    }
  });

  // Signal that the injector is ready
  window.postMessage({
    type: 'markd-injector-ready'
  }, '*');
})();
