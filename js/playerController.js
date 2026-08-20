/**
 * Video Player Controller
 * Integrates Plyr, custom overlays, keyboard shortcuts, screenshot capture,
 * resume playback timestamping, and touch gestures.
 */

class PlayerController {
  constructor(options = {}) {
    this.videoElement = options.videoElement || document.querySelector('#mainVideoPlayer');
    this.container = options.container || document.querySelector('.player-wrapper');
    this.onEnded = options.onEnded || (() => {});
    this.onNext = options.onNext || (() => {});
    this.onPrev = options.onPrev || (() => {});
    
    this.player = null;
    this.currentFile = null;
    this.currentBlobUrl = null;
    this.lastSavedTime = 0;
    this.saveInterval = null;
    this.isTheater = false;

    this.initPlyr();
    this.bindEvents();
  }

  /**
   * Initialize Plyr with rich controls and custom settings
   */
  initPlyr() {
    const settings = window.storageManager ? window.storageManager.getSettings() : { volume: 1, speed: 1 };

    const plyrControls = [
      'play-large',
      'restart',
      'rewind',
      'play',
      'fast-forward',
      'progress',
      'current-time',
      'duration',
      'mute',
      'volume',
      'settings',
      'pip',
      'fullscreen'
    ];

    try {
      this.player = new Plyr(this.videoElement, {
        controls: plyrControls,
        settings: ['speed', 'quality', 'loop'],
        speed: { selected: settings.speed || 1, options: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3] },
        seekTime: settings.seekTime || 10,
        volume: settings.volume !== undefined ? settings.volume : 1,
        muted: !!settings.muted,
        keyboard: { focused: true, global: true },
        tooltips: { controls: true, seek: true },
        storage: { enabled: false } // We use our custom storageManager
      });

      this.setupPlyrListeners();
    } catch (err) {
      console.error('Failed to initialize Plyr:', err);
    }
  }

  /**
   * Set up Plyr state and time update listeners
   */
  setupPlyrListeners() {
    if (!this.player) return;

    // Progress updates to save timestamp
    this.player.on('timeupdate', () => {
      if (!this.currentFile) return;
      const now = this.player.currentTime;
      if (Math.abs(now - this.lastSavedTime) > 3) {
        this.lastSavedTime = now;
        if (window.storageManager) {
          window.storageManager.savePlaybackProgress(
            this.currentFile.name,
            this.currentFile.size,
            now,
            this.player.duration
          );
        }
      }
    });

    // Volume change
    this.player.on('volumechange', () => {
      if (window.storageManager) {
        window.storageManager.saveSettings({
          volume: this.player.volume,
          muted: this.player.muted
        });
      }
    });

    // Speed change
    this.player.on('ratechange', () => {
      if (window.storageManager) {
        window.storageManager.saveSettings({
          speed: this.player.speed
        });
      }
    });

    // Track end - auto play next
    this.player.on('ended', () => {
      if (window.storageManager) {
        const settings = window.storageManager.getSettings();
        if (settings.autoplayNext && this.onNext) {
          this.onNext();
        }
      }
    });
  }

  /**
   * Load and play a file (decodes .wap if needed)
   * @param {File} file 
   * @param {Object} metadata 
   */
  async loadFile(file, metadata = {}) {
    if (!file) return;

    this.showLoading(true);

    try {
      // Clean previous object URL
      if (this.currentBlobUrl) {
        window.wapDecoder.revokeUrl(this.currentBlobUrl);
      }

      // Decode file
      const decoded = await window.wapDecoder.decodeFile(file);
      this.currentBlobUrl = decoded.url;
      this.currentFile = file;

      // Update Player source
      this.player.source = {
        type: 'video',
        title: metadata.name || file.name,
        sources: [
          {
            src: decoded.url,
            type: decoded.mimeType || 'video/mp4'
          }
        ]
      };

      // Check if resume position exists
      const progress = window.storageManager ? window.storageManager.getPlaybackProgress(file.name, file.size) : null;

      // Hide loading once metadata loaded
      const onLoadedMetadata = () => {
        this.showLoading(false);
        this.videoElement.removeEventListener('loadedmetadata', onLoadedMetadata);

        if (progress && progress.currentTime > 5 && !progress.finished) {
          this.showResumeToast(progress.currentTime);
        } else {
          this.player.play().catch(() => {});
        }
      };

      this.videoElement.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });

      // Update Header Title & Status
      this.updatePlayerInfo(metadata.name || file.name, decoded.isWap);

    } catch (err) {
      this.showLoading(false);
      console.error('Playback failed:', err);
      this.showError(`Playback Error: ${err.message}`);
    }
  }

  /**
   * Show Resume Notification / Toast with "Resume" and "Start Over" buttons
   */
  showResumeToast(seconds) {
    const formatted = this.formatTime(seconds);
    const existing = document.querySelector('.resume-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'resume-toast animate-slide-up';
    toast.innerHTML = `
      <div class="resume-text">
        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        <span>Resume from <strong>${formatted}</strong>?</span>
      </div>
      <div class="resume-actions">
        <button class="resume-btn primary" id="btnResumeYes">Resume</button>
        <button class="resume-btn secondary" id="btnResumeNo">Start Over</button>
      </div>
    `;

    this.container.appendChild(toast);

    const removeToast = () => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    };

    toast.querySelector('#btnResumeYes').addEventListener('click', () => {
      this.player.currentTime = seconds;
      this.player.play().catch(() => {});
      removeToast();
    });

    toast.querySelector('#btnResumeNo').addEventListener('click', () => {
      this.player.currentTime = 0;
      this.player.play().catch(() => {});
      removeToast();
    });

    // Auto-dismiss after 8 seconds
    setTimeout(() => {
      if (document.body.contains(toast)) {
        removeToast();
      }
    }, 8000);
  }

  /**
   * Take Screenshot / Snapshot of current video frame
   */
  captureSnapshot() {
    if (!this.videoElement || !this.player || this.videoElement.readyState < 2) {
      this.showToast('No active video to capture snapshot.', 'warning');
      return;
    }

    try {
      const canvas = document.createElement('canvas');
      canvas.width = this.videoElement.videoWidth || 1920;
      canvas.height = this.videoElement.videoHeight || 1080;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(this.videoElement, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL('image/png');
      const filename = `${(this.currentFile ? this.currentFile.name : 'video').replace(/\.[^/.]+$/, '')}_snap_${Math.floor(this.player.currentTime)}s.png`;

      // Trigger download
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = filename;
      link.click();

      this.showToast('📸 Screenshot saved!', 'success');
    } catch (err) {
      console.error('Snapshot error:', err);
      this.showToast('Snapshot failed: ' + err.message, 'error');
    }
  }

  /**
   * Toggle Theater Mode
   */
  toggleTheater() {
    this.isTheater = !this.isTheater;
    const appContainer = document.querySelector('.app-layout');
    if (appContainer) {
      appContainer.classList.toggle('theater-mode', this.isTheater);
    }
    const btn = document.querySelector('#btnTheater');
    if (btn) {
      btn.classList.toggle('active', this.isTheater);
    }
  }

  /**
   * Update Top Header / Info Bar
   */
  updatePlayerInfo(filename, isWap) {
    const titleEl = document.querySelector('#currentVideoTitle');
    const badgeEl = document.querySelector('#currentVideoBadge');
    
    if (titleEl) {
      titleEl.textContent = filename.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ');
      titleEl.title = filename;
    }
    if (badgeEl) {
      badgeEl.textContent = isWap ? 'WAP DECODED' : filename.split('.').pop().toUpperCase();
      badgeEl.className = `video-badge ${isWap ? 'badge-wap' : 'badge-standard'}`;
      badgeEl.style.display = 'inline-block';
    }

    document.title = `${filename.replace(/\.[^/.]+$/, '')} - Aether Player`;
  }

  /**
   * Show / Hide Loading Spinner Overlay
   */
  showLoading(isLoading) {
    const spinner = document.querySelector('#playerLoadingOverlay');
    if (spinner) {
      spinner.style.display = isLoading ? 'flex' : 'none';
    }
  }

  /**
   * Show Error Toast or Banner
   */
  showError(message) {
    this.showToast(message, 'error');
  }

  /**
   * General Toast Notification
   */
  showToast(message, type = 'info') {
    const container = document.querySelector('.toast-container') || document.body;
    const toast = document.createElement('div');
    toast.className = `app-toast toast-${type} animate-slide-up`;
    toast.innerHTML = `
      <span class="toast-text">${message}</span>
      <button class="toast-close">&times;</button>
    `;

    toast.querySelector('.toast-close').addEventListener('click', () => toast.remove());
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  /**
   * Format Seconds into HH:MM:SS or MM:SS
   */
  formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Bind Global Keyboard and Touch Events
   */
  bindEvents() {
    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      // Don't trigger if user is typing in an input or textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;

      switch (e.key.toLowerCase()) {
        case 's':
          e.preventDefault();
          this.captureSnapshot();
          break;
        case 't':
          e.preventDefault();
          this.toggleTheater();
          break;
        case 'n':
          if (e.shiftKey) {
            e.preventDefault();
            this.onNext();
          }
          break;
        case 'p':
          if (e.shiftKey) {
            e.preventDefault();
            this.onPrev();
          }
          break;
        case '[':
          e.preventDefault();
          this.adjustSpeed(-0.25);
          break;
        case ']':
          e.preventDefault();
          this.adjustSpeed(0.25);
          break;
      }
    });

    // Touch double-tap gestures for mobile (left 35% = -10s, right 35% = +10s)
    let lastTap = 0;
    if (this.container) {
      this.container.addEventListener('touchend', (e) => {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTap;
        if (tapLength < 300 && tapLength > 0) {
          const touch = e.changedTouches[0];
          const rect = this.container.getBoundingClientRect();
          const x = touch.clientX - rect.left;
          const width = rect.width;

          if (x < width * 0.35) {
            // Rewind 10s
            this.player.rewind(10);
            this.showFeedbackOverlay('⏪ -10s');
          } else if (x > width * 0.65) {
            // Forward 10s
            this.player.forward(10);
            this.showFeedbackOverlay('⏩ +10s');
          }
        }
        lastTap = currentTime;
      });
    }
  }

  /**
   * Adjust Speed Incrementally
   */
  adjustSpeed(delta) {
    if (!this.player) return;
    const current = this.player.speed || 1;
    const speeds = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
    let newSpeed = Math.min(3, Math.max(0.5, current + delta));
    
    // Find closest valid speed
    newSpeed = speeds.reduce((prev, curr) => Math.abs(curr - newSpeed) < Math.abs(prev - newSpeed) ? curr : prev);
    this.player.speed = newSpeed;
    this.showFeedbackOverlay(`⚡ ${newSpeed}x`);
  }

  /**
   * Visual feedback ripple/indicator on player center
   */
  showFeedbackOverlay(text) {
    const existing = document.querySelector('.player-feedback-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'player-feedback-overlay animate-pop';
    overlay.textContent = text;
    this.container.appendChild(overlay);

    setTimeout(() => {
      overlay.classList.add('fade-out');
      setTimeout(() => overlay.remove(), 250);
    }, 600);
  }
}

window.PlayerController = PlayerController;
