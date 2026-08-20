/**
 * Storage & Preference Manager
 * Manages LocalStorage settings, video playback timestamps, and IndexedDB directory handles.
 */

class StorageManager {
  constructor() {
    this.DB_NAME = 'aether-player-db';
    this.DB_VERSION = 1;
    this.STORE_NAME = 'handles';
    this.STORAGE_KEY_SETTINGS = 'aether_player_settings';
    this.STORAGE_KEY_HISTORY = 'aether_playback_history';
    this.STORAGE_KEY_RECENT = 'aether_recent_files';
  }

  // ---- Settings ----

  getDefaultSettings() {
    return {
      volume: 1,
      muted: false,
      speed: 1,
      autoplayNext: true,
      autoResume: true,
      seekTime: 10,
      theme: 'dark'
    };
  }

  getSettings() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY_SETTINGS);
      if (!data) return this.getDefaultSettings();
      return { ...this.getDefaultSettings(), ...JSON.parse(data) };
    } catch (e) {
      console.warn('Failed to load settings:', e);
      return this.getDefaultSettings();
    }
  }

  saveSettings(settings) {
    try {
      const current = this.getSettings();
      const merged = { ...current, ...settings };
      localStorage.setItem(this.STORAGE_KEY_SETTINGS, JSON.stringify(merged));
    } catch (e) {
      console.warn('Failed to save settings:', e);
    }
  }

  // ---- Playback Progress Tracking ----

  getVideoKey(filename, size) {
    return `${filename}_${size || 0}`;
  }

  savePlaybackProgress(filename, size, currentTime, duration) {
    if (!filename || isNaN(currentTime) || currentTime <= 0) return;
    try {
      const history = this.getAllPlaybackProgress();
      const key = this.getVideoKey(filename, size);
      
      // If watched > 95% of video, reset progress so it starts from 0 next time
      const isFinished = duration && currentTime / duration > 0.95;

      history[key] = {
        filename,
        size,
        currentTime: isFinished ? 0 : currentTime,
        duration: duration || 0,
        updatedAt: Date.now(),
        finished: isFinished
      };

      // Keep maximum 100 history items
      const keys = Object.keys(history);
      if (keys.length > 100) {
        const sorted = keys.sort((a, b) => history[a].updatedAt - history[b].updatedAt);
        delete history[sorted[0]];
      }

      localStorage.setItem(this.STORAGE_KEY_HISTORY, JSON.stringify(history));
    } catch (e) {
      console.warn('Failed to save progress:', e);
    }
  }

  getPlaybackProgress(filename, size) {
    try {
      const history = this.getAllPlaybackProgress();
      const key = this.getVideoKey(filename, size);
      return history[key] || null;
    } catch (e) {
      return null;
    }
  }

  getAllPlaybackProgress() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY_HISTORY);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      return {};
    }
  }

  clearPlaybackProgress(filename, size) {
    try {
      const history = this.getAllPlaybackProgress();
      const key = this.getVideoKey(filename, size);
      delete history[key];
      localStorage.setItem(this.STORAGE_KEY_HISTORY, JSON.stringify(history));
    } catch (e) {
      console.warn('Failed to clear progress:', e);
    }
  }

  // ---- IndexedDB Directory Handles ----

  openDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        return resolve(null);
      }
      const req = indexedDB.open(this.DB_NAME, this.DB_VERSION);
      req.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  }

  async saveDirectoryHandle(handle) {
    try {
      const db = await this.openDB();
      if (!db) return;
      return new Promise((resolve) => {
        const tx = db.transaction(this.STORE_NAME, 'readwrite');
        tx.objectStore(this.STORE_NAME).put(handle, 'rootDirectory');
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch (e) {
      console.warn('Failed to save dir handle to IndexedDB:', e);
    }
  }

  async getDirectoryHandle() {
    try {
      const db = await this.openDB();
      if (!db) return null;
      return new Promise((resolve) => {
        const tx = db.transaction(this.STORE_NAME, 'readonly');
        const req = tx.objectStore(this.STORE_NAME).get('rootDirectory');
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch (e) {
      return null;
    }
  }

  async clearDirectoryHandle() {
    try {
      const db = await this.openDB();
      if (!db) return;
      return new Promise((resolve) => {
        const tx = db.transaction(this.STORE_NAME, 'readwrite');
        tx.objectStore(this.STORE_NAME).delete('rootDirectory');
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch (e) {
      console.warn('Failed to clear dir handle:', e);
    }
  }
}

window.storageManager = new StorageManager();
