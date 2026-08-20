/**
 * Main Application Coordinator
 * Bootstraps the UI, binds event handlers, coordinates FileExplorer & PlayerController.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const treeContainer = document.getElementById('treeContainer');
  const emptyStateHero = document.getElementById('emptyStateHero');
  const playerSection = document.getElementById('playerSection');
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const searchInput = document.getElementById('searchFiles');
  const clearSearchBtn = document.getElementById('clearSearch');
  const viewToggleBtn = document.getElementById('viewToggleBtn');
  
  // Modals & Panels
  const shortcutsModal = document.getElementById('shortcutsModal');
  const settingsModal = document.getElementById('settingsModal');
  const btnOpenShortcuts = document.getElementById('btnOpenShortcuts');
  const btnOpenSettings = document.getElementById('btnOpenSettings');
  const modalCloseButtons = document.querySelectorAll('.modal-close, .modal-backdrop');

  // Action Buttons
  const btnOpenFolderNative = document.getElementById('btnOpenFolderNative');
  const btnUploadFolder = document.getElementById('btnUploadFolder');
  const btnSelectFiles = document.getElementById('btnSelectFiles');
  const folderUploadInput = document.getElementById('folderUploadInput');
  const fileUploadInput = document.getElementById('fileUploadInput');

  // Mobile Bottom Actions
  const btnMobilePlaylist = document.getElementById('btnMobilePlaylist');
  const btnMobilePickFile = document.getElementById('btnMobilePickFile');

  // Hero Drop Zone
  const dropZoneHero = document.getElementById('dropZoneHero');

  // Player controls extra
  const btnNextVideo = document.getElementById('btnNextVideo');
  const btnPrevVideo = document.getElementById('btnPrevVideo');
  const btnSnapshot = document.getElementById('btnSnapshot');
  const btnTheater = document.getElementById('btnTheater');

  // Initialize Player Controller
  const playerCtrl = new PlayerController({
    videoElement: document.getElementById('mainVideoPlayer'),
    container: document.querySelector('.player-wrapper'),
    onNext: () => playNextFile(),
    onPrev: () => playPrevFile()
  });

  // Initialize File Explorer
  const explorer = new FileExplorer({
    container: treeContainer,
    onSelectFile: (fileNode) => {
      handlePlayFile(fileNode);
      // On mobile, close sidebar drawer when file selected
      if (window.innerWidth <= 1024) {
        closeSidebar();
      }
    }
  });

  /**
   * Play a selected File Node
   */
  async function handlePlayFile(fileNode) {
    if (!fileNode || !fileNode.fileRef) return;
    
    // Hide empty state, reveal player
    if (emptyStateHero) emptyStateHero.style.display = 'none';
    if (playerSection) playerSection.style.display = 'flex';

    await playerCtrl.loadFile(fileNode.fileRef, fileNode);
    explorer.setActiveItem(fileNode.path || fileNode.name);
    updateNavButtons();
  }

  /**
   * Play Next Video in current playlist
   */
  function playNextFile() {
    const next = explorer.getNextItem();
    if (next) {
      handlePlayFile(next);
    } else {
      playerCtrl.showToast('You reached the end of the playlist.', 'info');
    }
  }

  /**
   * Play Previous Video in current playlist
   */
  function playPrevFile() {
    const prev = explorer.getPrevItem();
    if (prev) {
      handlePlayFile(prev);
    } else {
      playerCtrl.showToast('Already at the first video.', 'info');
    }
  }

  /**
   * Update Next / Prev button states
   */
  function updateNavButtons() {
    if (btnNextVideo) btnNextVideo.disabled = !explorer.getNextItem();
    if (btnPrevVideo) btnPrevVideo.disabled = !explorer.getPrevItem();
  }

  // --- Folder & File Picker Handlers ---

  // Native Folder Picker
  if (btnOpenFolderNative) {
    if (!explorer.isNativeFsSupported()) {
      btnOpenFolderNative.style.display = 'none';
    } else {
      btnOpenFolderNative.addEventListener('click', async () => {
        try {
          const tree = await explorer.pickDirectory();
          if (tree && explorer.currentPlaylist.length > 0) {
            playerCtrl.showToast(`Loaded ${explorer.currentPlaylist.length} video(s)!`, 'success');
            // Auto play first video
            handlePlayFile(explorer.currentPlaylist[0]);
          }
        } catch (err) {
          playerCtrl.showError(err.message);
        }
      });
    }
  }

  // Fallback Folder Upload (input webkitdirectory)
  if (btnUploadFolder && folderUploadInput) {
    btnUploadFolder.addEventListener('click', () => folderUploadInput.click());
    folderUploadInput.addEventListener('change', async (e) => {
      if (e.target.files && e.target.files.length > 0) {
        try {
          await explorer.processFileList(e.target.files);
          if (explorer.currentPlaylist.length > 0) {
            playerCtrl.showToast(`Loaded ${explorer.currentPlaylist.length} video(s)!`, 'success');
            handlePlayFile(explorer.currentPlaylist[0]);
          }
        } catch (err) {
          playerCtrl.showError(err.message);
        }
      }
    });
  }

  // Select Multiple Files
  if (btnSelectFiles && fileUploadInput) {
    btnSelectFiles.addEventListener('click', () => fileUploadInput.click());
    fileUploadInput.addEventListener('change', async (e) => {
      if (e.target.files && e.target.files.length > 0) {
        try {
          await explorer.processFileList(e.target.files);
          if (explorer.currentPlaylist.length > 0) {
            playerCtrl.showToast(`Loaded ${explorer.currentPlaylist.length} file(s)!`, 'success');
            handlePlayFile(explorer.currentPlaylist[0]);
          }
        } catch (err) {
          playerCtrl.showError(err.message);
        }
      }
    });
  }

  // Mobile Action Buttons
  if (btnMobilePickFile && fileUploadInput) {
    btnMobilePickFile.addEventListener('click', () => fileUploadInput.click());
  }

  // Drag & Drop Handling
  function setupDragAndDrop(targetEl) {
    if (!targetEl) return;

    ['dragenter', 'dragover'].forEach(eventName => {
      targetEl.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        targetEl.classList.add('drag-active');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      targetEl.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        targetEl.classList.remove('drag-active');
      }, false);
    });

    targetEl.addEventListener('drop', async (e) => {
      const dt = e.dataTransfer;
      if (dt) {
        try {
          await explorer.processDropDataTransfer(dt);
          if (explorer.currentPlaylist.length > 0) {
            playerCtrl.showToast(`Loaded ${explorer.currentPlaylist.length} file(s)!`, 'success');
            handlePlayFile(explorer.currentPlaylist[0]);
          }
        } catch (err) {
          playerCtrl.showError(err.message);
        }
      }
    });
  }

  setupDragAndDrop(dropZoneHero);
  setupDragAndDrop(document.body);

  // --- Search & Filter ---
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      explorer.searchQuery = e.target.value.trim();
      if (clearSearchBtn) {
        clearSearchBtn.style.display = explorer.searchQuery ? 'block' : 'none';
      }
      explorer.render();
    });
  }

  if (clearSearchBtn && searchInput) {
    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      explorer.searchQuery = '';
      clearSearchBtn.style.display = 'none';
      explorer.render();
    });
  }

  // --- View Toggle (Tree vs Flat) ---
  if (viewToggleBtn) {
    viewToggleBtn.addEventListener('click', () => {
      explorer.viewMode = explorer.viewMode === 'tree' ? 'flat' : 'tree';
      viewToggleBtn.setAttribute('title', explorer.viewMode === 'tree' ? 'Switch to Flat List' : 'Switch to Folder Tree');
      viewToggleBtn.classList.toggle('flat-active', explorer.viewMode === 'flat');
      explorer.render();
    });
  }

  // --- Player Header Controls ---
  if (btnNextVideo) btnNextVideo.addEventListener('click', () => playNextFile());
  if (btnPrevVideo) btnPrevVideo.addEventListener('click', () => playPrevFile());
  if (btnSnapshot) btnSnapshot.addEventListener('click', () => playerCtrl.captureSnapshot());
  if (btnTheater) btnTheater.addEventListener('click', () => playerCtrl.toggleTheater());

  // --- Mobile Sidebar / Drawer Toggle ---
  function openSidebar() {
    sidebar.classList.add('open');
    if (sidebarOverlay) sidebarOverlay.classList.add('visible');
    document.body.classList.add('sidebar-open');
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
    if (sidebarOverlay) sidebarOverlay.classList.remove('visible');
    document.body.classList.remove('sidebar-open');
  }

  if (btnMobilePlaylist) {
    btnMobilePlaylist.addEventListener('click', () => {
      if (sidebar.classList.contains('open')) {
        closeSidebar();
      } else {
        openSidebar();
      }
    });
  }

  const btnCloseSidebar = document.getElementById('btnCloseSidebar');
  if (btnCloseSidebar) {
    btnCloseSidebar.addEventListener('click', () => closeSidebar());
  }

  if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', () => closeSidebar());
  }

  // --- Modals (Shortcuts & Settings) ---
  function openModal(modal) {
    if (modal) modal.classList.add('active');
  }

  function closeAllModals() {
    document.querySelectorAll('.modal-wrapper').forEach(m => m.classList.remove('active'));
  }

  if (btnOpenShortcuts) {
    btnOpenShortcuts.addEventListener('click', () => openModal(shortcutsModal));
  }

  if (btnOpenSettings) {
    btnOpenSettings.addEventListener('click', () => {
      loadSettingsToUI();
      openModal(settingsModal);
    });
  }

  modalCloseButtons.forEach(btn => {
    btn.addEventListener('click', closeAllModals);
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllModals();
  });

  // Settings form handlers
  function loadSettingsToUI() {
    if (!window.storageManager) return;
    const s = window.storageManager.getSettings();
    const chkAutoNext = document.getElementById('settingAutoplayNext');
    const chkAutoResume = document.getElementById('settingAutoResume');
    const selectSeek = document.getElementById('settingSeekTime');

    if (chkAutoNext) chkAutoNext.checked = !!s.autoplayNext;
    if (chkAutoResume) chkAutoResume.checked = !!s.autoResume;
    if (selectSeek) selectSeek.value = s.seekTime || 10;
  }

  const btnSaveSettings = document.getElementById('btnSaveSettings');
  if (btnSaveSettings) {
    btnSaveSettings.addEventListener('click', () => {
      const chkAutoNext = document.getElementById('settingAutoplayNext');
      const chkAutoResume = document.getElementById('settingAutoResume');
      const selectSeek = document.getElementById('settingSeekTime');

      if (window.storageManager) {
        window.storageManager.saveSettings({
          autoplayNext: chkAutoNext ? chkAutoNext.checked : true,
          autoResume: chkAutoResume ? chkAutoResume.checked : true,
          seekTime: selectSeek ? parseInt(selectSeek.value, 10) : 10
        });
        playerCtrl.showToast('Settings saved!', 'success');
      }
      closeAllModals();
    });
  }

  const btnClearHistory = document.getElementById('btnClearHistory');
  if (btnClearHistory) {
    btnClearHistory.addEventListener('click', () => {
      if (confirm('Clear all saved video playback progress?')) {
        localStorage.removeItem('aether_playback_history');
        playerCtrl.showToast('Playback history cleared.', 'info');
      }
    });
  }

  // --- Auto-Restore Previous Folder Handle if Available (Desktop) ---
  if (window.storageManager && explorer.isNativeFsSupported()) {
    try {
      const savedHandle = await window.storageManager.getDirectoryHandle();
      if (savedHandle) {
        const perm = await savedHandle.queryPermission({ mode: 'read' });
        if (perm === 'granted') {
          const tree = await explorer.loadDirectoryHandle(savedHandle);
          if (tree && explorer.currentPlaylist.length > 0) {
            playerCtrl.showToast(`Restored folder "${savedHandle.name}" with ${explorer.currentPlaylist.length} video(s).`, 'info');
          }
        }
      }
    } catch (e) {
      console.warn('Handle restore not available:', e);
    }
  }
});
