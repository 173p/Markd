/**
 * Markd Logger
 * Centralized logging utility with [Markd] prefix
 */

class Logger {
  constructor(prefix = 'Markd') {
    this.prefix = prefix;
    this.enabled = true; // Set to false in production to silence logs
  }

  log(...args) {
    if (this.enabled) {
      console.log(`[${this.prefix}]`, ...args);
    }
  }

  warn(...args) {
    if (this.enabled) {
      console.warn(`[${this.prefix}]`, ...args);
    }
  }

  error(...args) {
    if (this.enabled) {
      console.error(`[${this.prefix}]`, ...args);
    }
  }

  info(...args) {
    if (this.enabled) {
      console.info(`[${this.prefix}]`, ...args);
    }
  }

  debug(...args) {
    if (this.enabled) {
      console.debug(`[${this.prefix}]`, ...args);
    }
  }
}

// Create global instance
