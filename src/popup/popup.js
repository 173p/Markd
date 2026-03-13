(function() {
  'use strict';

  const timestampInput = document.getElementById('timestampInput');
  const applyBtn = document.getElementById('applyBtn');
  const clearBtn = document.getElementById('clearBtn');
  const statusEl = document.getElementById('status');
  const previewEl = document.getElementById('preview');
  const previewListEl = document.getElementById('previewList');

  let currentVideoId = null;
  let parsedTimestamps = [];

  // Initialize
  init();

  async function init() {
    // Get current YouTube tab
    const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.url || !tab.url.includes('youtube.com/watch')) {
      showStatus('Please open a YouTube video to use this feature', 'error');
      applyBtn.disabled = true;
      timestampInput.disabled = true;
      return;
    }

    // Extract video ID from URL
    const urlParams = new URLSearchParams(new URL(tab.url).search);
    currentVideoId = urlParams.get('v');

    if (!currentVideoId) {
      showStatus('Could not detect video ID', 'error');
      applyBtn.disabled = true;
      timestampInput.disabled = true;
      return;
    }

    // Load saved timestamps for this video
    loadSavedTimestamps();

    // Event listeners
    applyBtn.addEventListener('click', applyTimestamps);
    clearBtn.addEventListener('click', clearInput);
    timestampInput.addEventListener('input', handleInput);

    // Auto-focus on textarea
    timestampInput.focus();
  }

  async function loadSavedTimestamps() {
    try {
      const result = await browserAPI.storage.local.get(`userTimestamps_${currentVideoId}`);
      const saved = result[`userTimestamps_${currentVideoId}`];

      if (saved && saved.length > 0) {
        // Show saved timestamps in preview
        parsedTimestamps = saved;
        updatePreview(saved);
        showStatus('Loaded saved custom timestamps', 'info');
      }
    } catch (error) {
      console.error('Error loading saved timestamps:', error);
    }
  }

  function handleInput() {
    const text = timestampInput.value.trim();

    if (!text) {
      previewEl.style.display = 'none';
      parsedTimestamps = [];
      return;
    }

    // Parse timestamps
    const timestamps = parseTimestamps(text);

    if (timestamps.length > 0) {
      parsedTimestamps = timestamps;
      updatePreview(timestamps);
      showStatus(`Found ${timestamps.length} timestamp(s)`, 'info');
    } else {
      previewEl.style.display = 'none';
      parsedTimestamps = [];
      showStatus('No valid timestamps found', 'error');
    }
  }

  function parseTimestamps(text) {
    const lines = text.split('\n');
    const timestamps = [];

    // Regex patterns for timestamp detection
    // Matches: "0:00 Title", "0:00 - Title", "00:00 Title", "[0:00] Title", etc.
    const patterns = [
      /(?:\[)?(\d{1,2}:(?:\d{2}:)?\d{2})(?:\])?[\s\-–—:]*(.+)/,  // [0:00] Title or 0:00 Title or 0:00 - Title
      /^(\d{1,2}:(?:\d{2}:)?\d{2})[\s\-–—:]+(.+)$/,              // 0:00 - Title
      /^(.+?)[\s\-–—]+(\d{1,2}:(?:\d{2}:)?\d{2})$/                // Title - 0:00
    ];

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      for (const pattern of patterns) {
        const match = trimmedLine.match(pattern);
        if (match) {
          let timeStr, title;

          // Check if time is first or second group
          if (match[1].includes(':')) {
            timeStr = match[1];
            title = match[2];
          } else {
            timeStr = match[2];
            title = match[1];
          }

          const seconds = parseTimeToSeconds(timeStr);
          if (seconds !== null && title && title.trim()) {
            timestamps.push({
              time: seconds,
              title: title.trim()
            });
            break; // Found a match, move to next line
          }
        }
      }
    }

    // Sort by time
    timestamps.sort((a, b) => a.time - b.time);

    return timestamps;
  }

  function parseTimeToSeconds(timeStr) {
    const parts = timeStr.split(':').map(p => parseInt(p, 10));

    if (parts.some(isNaN)) return null;

    let seconds = 0;
    if (parts.length === 2) {
      // MM:SS
      seconds = parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      // HH:MM:SS
      seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else {
      return null;
    }

    return seconds;
  }

  function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  function updatePreview(timestamps) {
    previewListEl.innerHTML = '';

    timestamps.forEach((ts, index) => {
      const item = document.createElement('div');
      item.className = 'preview-item';

      const time = document.createElement('span');
      time.className = 'preview-time';
      time.textContent = formatTime(ts.time);

      const title = document.createElement('span');
      title.className = 'preview-title';
      title.textContent = ts.title;

      item.appendChild(time);
      item.appendChild(title);
      previewListEl.appendChild(item);
    });

    previewEl.style.display = 'block';
  }

  async function applyTimestamps() {
    if (parsedTimestamps.length === 0) {
      showStatus('Please paste some timestamps first', 'error');
      return;
    }

    try {
      applyBtn.disabled = true;
      applyBtn.textContent = 'Applying...';

      // Save to storage
      await browserAPI.storage.local.set({
        [`userTimestamps_${currentVideoId}`]: parsedTimestamps
      });

      // Send message to content script
      const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });

      await browserAPI.tabs.sendMessage(tab.id, {
        type: 'APPLY_USER_TIMESTAMPS',
        timestamps: parsedTimestamps,
        videoId: currentVideoId
      });

      showStatus(`✓ Applied ${parsedTimestamps.length} timestamp(s)!`, 'success');

      // Close popup after a short delay
      setTimeout(() => {
        window.close();
      }, 1500);

    } catch (error) {
      console.error('Error applying timestamps:', error);
      showStatus('Error applying timestamps. Make sure you\'re on a YouTube video.', 'error');
      applyBtn.disabled = false;
      applyBtn.textContent = 'Apply Timestamps';
    }
  }

  async function clearInput() {
    try {
      // Clear the input and preview
      timestampInput.value = '';
      previewEl.style.display = 'none';
      parsedTimestamps = [];

      // Remove saved user timestamps from storage
      await browserAPI.storage.local.remove(`userTimestamps_${currentVideoId}`);

      // Send message to content script to reset to original chapters
      const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });

      await browserAPI.tabs.sendMessage(tab.id, {
        type: 'RESET_TO_ORIGINAL_CHAPTERS',
        videoId: currentVideoId
      });

      showStatus('✓ Reset to original chapters', 'success');

      // Close popup after a short delay
      setTimeout(() => {
        window.close();
      }, 1200);

    } catch (error) {
      console.error('Error clearing timestamps:', error);
      statusEl.textContent = '';
      statusEl.className = 'status';
      timestampInput.focus();
    }
  }

  function showStatus(message, type) {
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
  }
})();
