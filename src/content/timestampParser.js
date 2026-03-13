/**
 * Markd Timestamp Parser
 * Regex-based parsing with auto-fix for invalid formats
 */

class TimestampParser {
  constructor() {
    // Regex patterns for different timestamp formats
    this.patterns = {
      // Colon format: 0:00, 1:45, 1:23:45
      colon: /\b(?:(\d+):)?(\d{1,2}):(\d{2})\b/g,
      // Hybrid format: 45s, 1m45s, 1h3m30s
      hybrid: /\b(?:(\d+)h)?(?:(\d+)m)?(\d+)s\b/gi
    };
  }

  /**
   * Parse text for all timestamp formats
   * @param {string} text - Text to parse
   * @returns {Array} - Array of {seconds, label, originalText, fixed, position}
   */
  parse(text) {
    const timestamps = [];

    // Parse colon format
    timestamps.push(...this.parseColonFormat(text));

    // Parse hybrid format
    timestamps.push(...this.parseHybridFormat(text));

    // Deduplicate overlapping matches
    const unique = this.deduplicateTimestamps(timestamps);

    // Extract labels
    const withLabels = this.extractLabels(text, unique);

    return withLabels;
  }

  /**
   * Parse colon format timestamps (H:MM:SS or M:SS)
   * @param {string} text - Text to parse
   * @returns {Array} - Parsed timestamps
   */
  parseColonFormat(text) {
    const matches = [];
    const regex = new RegExp(this.patterns.colon);
    let match;

    while ((match = regex.exec(text)) !== null) {
      const hours = match[1] ? parseInt(match[1]) : 0;
      const minutes = parseInt(match[2]);
      const seconds = parseInt(match[3]);

      let totalSeconds;
      let fixed = false;

      // Auto-fix: If minutes >= 60 and no hours specified, convert to hours
      if (minutes >= 60 && !match[1]) {
        const actualHours = Math.floor(minutes / 60);
        const actualMinutes = minutes % 60;
        totalSeconds = actualHours * 3600 + actualMinutes * 60 + seconds;
        fixed = true;
      } else {
        totalSeconds = hours * 3600 + minutes * 60 + seconds;
      }

      // Auto-fix: Invalid seconds (>59)
      if (seconds > 59) {
        const extraMinutes = Math.floor(seconds / 60);
        const actualSeconds = seconds % 60;
        totalSeconds = hours * 3600 + (minutes + extraMinutes) * 60 + actualSeconds;
        fixed = true;
      }

      matches.push({
        originalText: match[0],
        position: match.index,
        seconds: totalSeconds,
        fixed: fixed
      });
    }

    return matches;
  }

  /**
   * Parse hybrid format timestamps (1h2m3s)
   * @param {string} text - Text to parse
   * @returns {Array} - Parsed timestamps
   */
  parseHybridFormat(text) {
    const matches = [];
    const regex = new RegExp(this.patterns.hybrid);
    let match;

    while ((match = regex.exec(text)) !== null) {
      const hours = match[1] ? parseInt(match[1]) : 0;
      const minutes = match[2] ? parseInt(match[2]) : 0;
      const seconds = match[3] ? parseInt(match[3]) : 0;

      const totalSeconds = hours * 3600 + minutes * 60 + seconds;

      matches.push({
        originalText: match[0],
        position: match.index,
        seconds: totalSeconds,
        fixed: false
      });
    }

    return matches;
  }

  /**
   * Extract labels for timestamps
   * @param {string} text - Original text
   * @param {Array} timestamps - Parsed timestamps
   * @returns {Array} - Timestamps with labels
   */
  extractLabels(text, timestamps) {
    return timestamps.map(ts => {
      // Get text after timestamp on same line
      const afterTimestamp = text.substring(ts.position + ts.originalText.length);
      const lineEnd = afterTimestamp.indexOf('\n');
      const line = lineEnd === -1 ? afterTimestamp : afterTimestamp.substring(0, lineEnd);

      // Extract label (trim leading separators: spaces, dashes, colons)
      let label = line.replace(/^[\s\-:]+/, '').trim();

      // If label is too long, truncate
      if (label.length > 100) {
        label = label.substring(0, 97) + '...';
      }

      // If no label found, generate one
      if (!label || label.length === 0) {
        label = `Chapter at ${this.formatTime(ts.seconds)}`;
      }

      return {
        ...ts,
        label: label
      };
    });
  }

  /**
   * Remove duplicate timestamps
   * @param {Array} timestamps - Array of timestamps
   * @returns {Array} - Deduplicated timestamps
   */
  deduplicateTimestamps(timestamps) {
    const seen = new Map();

    timestamps.forEach(ts => {
      // Key by position and seconds to avoid duplicates
      const key = `${ts.position}_${ts.seconds}`;

      if (!seen.has(key)) {
        seen.set(key, ts);
      }
    });

    // Sort by seconds
    return Array.from(seen.values()).sort((a, b) => a.seconds - b.seconds);
  }

  /**
   * Format seconds to human-readable time
   * @param {number} seconds - Time in seconds
   * @returns {string} - Formatted time (H:MM:SS or M:SS)
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
   * Validate timestamp is within video duration
   * @param {number} seconds - Timestamp in seconds
   * @param {number} duration - Video duration in seconds
   * @returns {boolean} - True if valid
   */
  isValidTimestamp(seconds, duration) {
    return seconds >= 0 && seconds < duration;
  }
}

// Create global instance
window.MarkdTimestampParser = new TimestampParser();
