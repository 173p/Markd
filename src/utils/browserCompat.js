/**
 * Markd Browser Compatibility Layer
 * Provides unified API for both Chrome and Firefox
 */

// Create a unified browser API that works in both Chrome and Firefox
// Firefox uses 'browser' namespace, Chrome uses 'chrome' namespace
window.browserAPI = (function() {
  // Check if we're in Firefox (has native browser API) or Chrome
  const isFirefox = typeof browser !== 'undefined' && browser.runtime;
  const api = isFirefox ? browser : chrome;

  return {
    // Runtime API
    runtime: {
      getURL: (path) => api.runtime.getURL(path),
      onMessage: api.runtime.onMessage
    },

    // Storage API
    storage: {
      local: {
        get: (keys) => api.storage.local.get(keys),
        set: (items) => api.storage.local.set(items),
        remove: (keys) => api.storage.local.remove(keys),
        clear: () => api.storage.local.clear()
      }
    },

    // Tabs API (for popup)
    tabs: {
      query: (queryInfo) => api.tabs.query(queryInfo),
      sendMessage: (tabId, message) => api.tabs.sendMessage(tabId, message)
    }
  };
})();
