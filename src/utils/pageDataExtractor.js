/**
 * Markd Page Data Extractor
 * Extracts YouTube data from the page context (bypasses content script isolation)
 */

class PageDataExtractor {
  constructor() {
    this.dataCache = null;
    this.messageListener = null;
    this.injectorReady = false;
  }

  /**
   * Extract YouTube data from the page context with retry logic
   * @param {number} maxRetries - Maximum number of retry attempts
   * @param {number} retryDelay - Delay between retries in ms
   * @returns {Promise<Object>} - Object with ytInitialData and ytInitialPlayerResponse
   */
  async extractPageData(maxRetries = 5, retryDelay = 500) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {

      const data = await this.extractPageDataOnce();

      // Check if we got valid data
      if (data && !data.error && (data.ytInitialData || data.ytInitialPlayerResponse)) {
        return data;
      }

      // If not the last attempt, wait before retrying
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    return { ytInitialData: null, ytInitialPlayerResponse: null, ytcfg: null };
  }

  /**
   * Extract YouTube data from the page context (single attempt)
   * Uses script injection to access page variables without CSP violations
   * @returns {Promise<Object>} - Object with ytInitialData and ytInitialPlayerResponse
   */
  async extractPageDataOnce() {
    try {

      // Try to get data via injected script (CSP-safe method)
      const injectedData = await this.extractViaInjection();

      if (injectedData.ytInitialData || injectedData.ytInitialPlayerResponse) {
        return injectedData;
      }


      // Fallback to DOM parsing (less reliable)
      return await this.extractViaDOM();
    } catch (error) {
      return { ytInitialData: null, ytInitialPlayerResponse: null, ytcfg: null };
    }
  }

  /**
   * Extract data by injecting a script into the page context
   * This bypasses CSP restrictions since the script runs in the page's context
   * @returns {Promise<Object>} - Object with ytInitialData and ytInitialPlayerResponse
   */
  async extractViaInjection() {
    // Check if injector is already loaded
    if (!this.injectorReady) {
      await this.loadInjector();
    }

    return new Promise((resolve) => {
      const messageId = `markd-extract-${Date.now()}-${Math.random()}`;
      let resolved = false;

      // Set up listener for response from injected script
      const listener = (event) => {
        if (event.source !== window || !event.data ||
            event.data.type !== 'markd-response-data' ||
            event.data.messageId !== messageId) {
          return;
        }

        if (resolved) return;
        resolved = true;

        window.removeEventListener('message', listener);

        resolve(event.data.payload || {
          ytInitialData: null,
          ytInitialPlayerResponse: null,
          ytcfg: null
        });
      };

      window.addEventListener('message', listener);

      // Request data from injected script
      window.postMessage({
        type: 'markd-request-data',
        messageId: messageId
      }, '*');

      // Timeout after 2 seconds
      setTimeout(() => {
        if (resolved) return;
        resolved = true;

        window.removeEventListener('message', listener);
        resolve({ ytInitialData: null, ytInitialPlayerResponse: null, ytcfg: null });
      }, 2000);
    });
  }

  /**
   * Load the injector script into the page
   * @returns {Promise<boolean>} - True if loaded successfully
   */
  async loadInjector() {
    if (this.injectorReady) {
      return true;
    }

    return new Promise((resolve) => {
      let resolved = false;

      // Listen for ready signal
      const readyListener = (event) => {
        if (event.source !== window || !event.data ||
            event.data.type !== 'markd-injector-ready') {
          return;
        }

        if (resolved) return;
        resolved = true;

        window.removeEventListener('message', readyListener);
        this.injectorReady = true;
        resolve(true);
      };

      window.addEventListener('message', readyListener);

      // Inject external script file (bypasses inline script CSP)
      const script = document.createElement('script');
      script.src = browserAPI.runtime.getURL('src/utils/pageDataInjector.js');
      script.onload = () => {
      };
      script.onerror = () => {
        if (resolved) return;
        resolved = true;

        window.removeEventListener('message', readyListener);
        resolve(false);
      };

      (document.head || document.documentElement).appendChild(script);

      // Timeout after 2 seconds
      setTimeout(() => {
        if (resolved) return;
        resolved = true;

        window.removeEventListener('message', readyListener);
        resolve(false);
      }, 2000);
    });
  }

  /**
   * Extract YouTube data by parsing DOM (fallback method)
   * @returns {Promise<Object>} - Object with ytInitialData and ytInitialPlayerResponse
   */
  async extractViaDOM() {
    try {
      const data = {
        ytInitialData: null,
        ytInitialPlayerResponse: null,
        ytcfg: null
      };

      // Find all script tags
      const scripts = document.querySelectorAll('script');

      for (const script of scripts) {
        const scriptContent = script.textContent || script.innerHTML;

        // Look for ytInitialData - use JSON.parse with sanitization
        if (!data.ytInitialData && scriptContent.includes('var ytInitialData')) {
          try {
            const jsonString = this.extractNestedJson(scriptContent, 'var ytInitialData');
            if (jsonString) {
              data.ytInitialData = JSON.parse(jsonString);
            }
          } catch (e) {
          }
        }

        // Look for ytInitialPlayerResponse
        if (!data.ytInitialPlayerResponse && scriptContent.includes('var ytInitialPlayerResponse')) {
          try {
            const jsonString = this.extractNestedJson(scriptContent, 'var ytInitialPlayerResponse');
            if (jsonString) {
              data.ytInitialPlayerResponse = JSON.parse(jsonString);
            }
          } catch (e) {
          }
        }

        // Look for ytcfg - extract API key and context
        if (!data.ytcfg && (scriptContent.includes('INNERTUBE_API_KEY') || scriptContent.includes('ytcfg'))) {
          try {
            const ytcfgData = {};

            // Extract API key
            const apiKeyMatch = scriptContent.match(/INNERTUBE_API_KEY["']?\s*:\s*["']([^"']+)["']/);
            if (apiKeyMatch) {
              ytcfgData.INNERTUBE_API_KEY = apiKeyMatch[1];
            }

            // Extract INNERTUBE_CONTEXT - try to find the nested object
            if (scriptContent.includes('INNERTUBE_CONTEXT')) {
              try {
                const contextStr = this.extractNestedJson(scriptContent, 'INNERTUBE_CONTEXT');
                if (contextStr) {
                  ytcfgData.INNERTUBE_CONTEXT = JSON.parse(contextStr);
                }
              } catch (e) {
              }
            }

            // Extract client name and version
            const clientNameMatch = scriptContent.match(/INNERTUBE_CLIENT_NAME["']?\s*:\s*["']?([^"',}\s]+)["']?/);
            if (clientNameMatch) {
              ytcfgData.INNERTUBE_CLIENT_NAME = clientNameMatch[1];
            }

            const clientVersionMatch = scriptContent.match(/INNERTUBE_CLIENT_VERSION["']?\s*:\s*["']([^"']+)["']/);
            if (clientVersionMatch) {
              ytcfgData.INNERTUBE_CLIENT_VERSION = clientVersionMatch[1];
            }

            if (Object.keys(ytcfgData).length > 0) {
              data.ytcfg = ytcfgData;
            }
          } catch (e) {
          }
        }

        // If we found everything, stop searching
        if (data.ytInitialData && data.ytInitialPlayerResponse && data.ytcfg) {
          break;
        }
      }



      return data;
    } catch (error) {
      return { ytInitialData: null, ytInitialPlayerResponse: null, ytcfg: null };
    }
  }

  /**
   * Sanitize JavaScript object literal to valid JSON
   * @param {string} jsString - JavaScript object string
   * @returns {string} - Valid JSON string
   */
  sanitizeToJson(jsString) {
    let sanitized = jsString;

    // Replace undefined with null
    sanitized = sanitized.replace(/:\s*undefined\s*([,}])/g, ': null$1');
    sanitized = sanitized.replace(/,\s*undefined\s*([,\]])/g, ', null$1');

    // Remove trailing commas (not valid in JSON)
    sanitized = sanitized.replace(/,(\s*[}\]])/g, '$1');

    // Handle NaN and Infinity
    sanitized = sanitized.replace(/:\s*NaN\s*([,}])/g, ': null$1');
    sanitized = sanitized.replace(/:\s*Infinity\s*([,}])/g, ': null$1');
    sanitized = sanitized.replace(/:\s*-Infinity\s*([,}])/g, ': null$1');

    return sanitized;
  }

  /**
   * Extract nested JSON from script content by counting braces
   * @param {string} scriptContent - Script tag content
   * @param {string} varName - Variable name (e.g., 'var ytInitialData')
   * @returns {string|null} - JSON string or null
   */
  extractNestedJson(scriptContent, varName) {
    try {
      // Find the variable declaration
      const startPattern = new RegExp(`${varName}\\s*=\\s*`);
      const match = scriptContent.match(startPattern);
      if (!match) return null;

      // Find where the JSON object starts
      const startIndex = match.index + match[0].length;
      let char = scriptContent[startIndex];

      // Handle case where it's not an object
      if (char !== '{' && char !== '[') return null;

      // Count braces/brackets to find the matching closing one
      const openChar = char;
      const closeChar = char === '{' ? '}' : ']';
      let depth = 0;
      let endIndex = startIndex;
      let inString = false;
      let escapeNext = false;
      let stringChar = null; // Track which quote type started the string

      for (let i = startIndex; i < scriptContent.length; i++) {
        const c = scriptContent[i];

        // Handle string escaping
        if (escapeNext) {
          escapeNext = false;
          continue;
        }

        if (c === '\\') {
          escapeNext = true;
          continue;
        }

        // Track if we're inside a string (handle both " and ')
        if ((c === '"' || c === "'") && !inString) {
          inString = true;
          stringChar = c;
          continue;
        } else if (c === stringChar && inString) {
          inString = false;
          stringChar = null;
          continue;
        }

        // Only count braces outside of strings
        if (!inString) {
          if (c === openChar) {
            depth++;
          } else if (c === closeChar) {
            depth--;
            if (depth === 0) {
              endIndex = i;
              break;
            }
          }
        }
      }

      if (depth === 0 && endIndex > startIndex) {
        const extracted = scriptContent.substring(startIndex, endIndex + 1);
        return this.sanitizeToJson(extracted);
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get YouTube initial data
   * @returns {Promise<Object|null>}
   */
  async getYtInitialData() {
    const data = await this.extractPageData();
    return data.ytInitialData || null;
  }

  /**
   * Get YouTube initial player response
   * @returns {Promise<Object|null>}
   */
  async getYtInitialPlayerResponse() {
    const data = await this.extractPageData();
    return data.ytInitialPlayerResponse || null;
  }

  /**
   * Get YouTube config
   * @returns {Promise<Object|null>}
   */
  async getYtConfig() {
    const data = await this.extractPageData();
    return data.ytcfg || null;
  }

  /**
   * Clear cached data
   */
  clearCache() {
    this.dataCache = null;
  }
}

// Create global instance
window.MarkdPageDataExtractor = new PageDataExtractor();
