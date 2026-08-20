/**
 * File Explorer & Directory Manager
 * Handles Native Directory Picker (File System Access API), Fallback Directory Upload,
 * Drag & Drop, Natural Chapter Sorting, Tree/List Rendering, and Search.
 */

class FileExplorer {
  constructor(options = {}) {
    this.container = options.container || null;
    this.onSelectFile = options.onSelectFile || (() => {});
    this.currentPlaylist = []; // Flat list of playable files for next/prev
    this.treeData = [];
    this.activeItemKey = null;
    this.searchQuery = '';
    this.viewMode = 'tree'; // 'tree' or 'flat'
  }

  /**
   * Helper to format bytes into readable strings (MB, GB)
   */
  formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Format friendly title from filename (removes extension, cleans dashes/underscores)
   */
  formatTitle(filename) {
    if (!filename) return '';
    const withoutExt = filename.replace(/\.[^/.]+$/, '');
    return withoutExt
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Natural Sort comparator for files and folders (e.g. Chapter 1, Chapter 2, Chapter 10)
   */
  naturalSort(a, b) {
    // Folders come before files
    if (a.type === 'folder' && b.type !== 'folder') return -1;
    if (a.type !== 'folder' && b.type === 'folder') return 1;

    // Use Intl.Collator with numeric collation for smart natural sorting
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
    return collator.compare(a.name, b.name);
  }

  /**
   * Check if Native File System Access API is supported
   */
  isNativeFsSupported() {
    return typeof window.showDirectoryPicker === 'function';
  }

  /**
   * Open native folder picker dialog
   */
  async pickDirectory() {
    if (!this.isNativeFsSupported()) {
      throw new Error('Native Directory Picker is not supported in this browser. Please use the "Choose Folder (Upload)" or "Choose Files" button.');
    }

    try {
      const dirHandle = await window.showDirectoryPicker({
        mode: 'read'
      });

      if (window.storageManager) {
        await window.storageManager.saveDirectoryHandle(dirHandle);
      }

      return await this.loadDirectoryHandle(dirHandle);
    } catch (err) {
      if (err.name === 'AbortError') {
        return null; // User cancelled
      }
      throw err;
    }
  }

  /**
   * Recursively read FileSystemDirectoryHandle
   */
  async loadDirectoryHandle(dirHandle) {
    const readDir = async (handle, path = '') => {
      const items = [];
      for await (const [name, entry] of handle.entries()) {
        const itemPath = path ? `${path}/${name}` : name;
        if (entry.kind === 'directory') {
          const children = await readDir(entry, itemPath);
          // Only include folder if it contains playable files or subfolders with files
          if (children.length > 0) {
            const totalFiles = children.reduce((sum, c) => sum + (c.type === 'file' ? 1 : (c.totalFiles || 0)), 0);
            items.push({
              name,
              path: itemPath,
              type: 'folder',
              handle: entry,
              children: children.sort(this.naturalSort.bind(this)),
              totalFiles
            });
          }
        } else if (entry.kind === 'file') {
          if (window.wapDecoder.isSupportedFile(name)) {
            const file = await entry.getFile();
            items.push({
              name,
              path: itemPath,
              type: 'file',
              size: file.size,
              sizeFormatted: this.formatBytes(file.size),
              lastModified: file.lastModified,
              handle: entry,
              fileRef: file,
              isWap: window.wapDecoder.isWapFile(name)
            });
          }
        }
      }
      return items.sort(this.naturalSort.bind(this));
    };

    const tree = await readDir(dirHandle);
    this.setTreeData(tree);
    return tree;
  }

  /**
   * Process Files from input[type=file] (both multiple files or webkitdirectory)
   */
  async processFileList(fileList) {
    const files = Array.from(fileList).filter(f => window.wapDecoder.isSupportedFile(f.name));
    if (files.length === 0) {
      throw new Error('No supported video or .wap files found in the selection.');
    }

    // Build hierarchy from webkitRelativePath if available
    const root = {};

    for (const file of files) {
      const relPath = file.webkitRelativePath || file.name;
      const parts = relPath.split('/');
      
      if (parts.length === 1) {
        // Root level file
        if (!root['__files__']) root['__files__'] = [];
        root['__files__'].push({
          name: file.name,
          path: file.name,
          type: 'file',
          size: file.size,
          sizeFormatted: this.formatBytes(file.size),
          lastModified: file.lastModified,
          fileRef: file,
          isWap: window.wapDecoder.isWapFile(file.name)
        });
      } else {
        // Nested folder structure
        let current = root;
        for (let i = 0; i < parts.length - 1; i++) {
          const folderName = parts[i];
          if (!current[folderName]) {
            current[folderName] = { __files__: {}, __folders__: {} };
          }
          current = current[folderName].__folders__;
        }

        const fileName = parts[parts.length - 1];
        if (!current['__files__']) current['__files__'] = [];
        current['__files__'].push({
          name: fileName,
          path: relPath,
          type: 'file',
          size: file.size,
          sizeFormatted: this.formatBytes(file.size),
          lastModified: file.lastModified,
          fileRef: file,
          isWap: window.wapDecoder.isWapFile(fileName)
        });
      }
    }

    // Convert object hierarchy to tree array
    const buildTree = (obj, parentPath = '') => {
      const list = [];
      for (const key of Object.keys(obj)) {
        if (key === '__files__') {
          list.push(...obj[key]);
        } else {
          const currentPath = parentPath ? `${parentPath}/${key}` : key;
          const subTree = buildTree(obj[key].__folders__ || obj[key], currentPath);
          if (obj[key].__files__ && Array.isArray(obj[key].__files__)) {
            subTree.push(...obj[key].__files__);
          }
          
          if (subTree.length > 0) {
            const totalFiles = subTree.reduce((sum, c) => sum + (c.type === 'file' ? 1 : (c.totalFiles || 0)), 0);
            list.push({
              name: key,
              path: currentPath,
              type: 'folder',
              children: subTree.sort(this.naturalSort.bind(this)),
              totalFiles
            });
          }
        }
      }
      return list.sort(this.naturalSort.bind(this));
    };

    const tree = buildTree(root);
    this.setTreeData(tree);
    return tree;
  }

  /**
   * Process dropped items (DataTransferItemList with webkitGetAsEntry support)
   */
  async processDropDataTransfer(dataTransfer) {
    const items = dataTransfer.items;
    const fileEntries = [];

    const traverseEntry = async (entry, path = '') => {
      if (entry.isFile) {
        return new Promise((resolve) => {
          entry.file((file) => {
            if (window.wapDecoder.isSupportedFile(file.name)) {
              fileEntries.push({
                file,
                path: path ? `${path}/${file.name}` : file.name
              });
            }
            resolve();
          }, () => resolve());
        });
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        const readEntries = async () => {
          return new Promise((resolve) => {
            reader.readEntries(async (entries) => {
              if (!entries || entries.length === 0) {
                resolve();
              } else {
                for (const e of entries) {
                  await traverseEntry(e, path ? `${path}/${entry.name}` : entry.name);
                }
                await readEntries(); // Continue reading in batches
                resolve();
              }
            }, () => resolve());
          });
        };
        await readEntries();
      }
    };

    if (items && items.length > 0 && typeof items[0].webkitGetAsEntry === 'function') {
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry();
        if (entry) {
          await traverseEntry(entry);
        }
      }
    } else if (dataTransfer.files && dataTransfer.files.length > 0) {
      return await this.processFileList(dataTransfer.files);
    }

    if (fileEntries.length > 0) {
      // Reconstruct file list with path simulation
      const mockFileList = fileEntries.map(e => {
        // Define webkitRelativePath property on File
        Object.defineProperty(e.file, 'webkitRelativePath', {
          value: e.path,
          writable: false
        });
        return e.file;
      });
      return await this.processFileList(mockFileList);
    }

    throw new Error('No supported video or .wap files found in the dropped items.');
  }

  /**
   * Set tree data and update flattened playlist
   */
  setTreeData(tree) {
    this.treeData = tree;
    this.updatePlaylist();
    this.render();
  }

  /**
   * Create a flattened playlist array from treeData
   */
  updatePlaylist() {
    const list = [];
    const extractFiles = (nodes) => {
      for (const node of nodes) {
        if (node.type === 'file') {
          list.push(node);
        } else if (node.children) {
          extractFiles(node.children);
        }
      }
    };
    extractFiles(this.treeData);
    this.currentPlaylist = list;
  }

  /**
   * Set active video item key (path or name)
   */
  setActiveItem(pathOrName) {
    this.activeItemKey = pathOrName;
    this.render();
  }

  /**
   * Get currently active item index in playlist
   */
  getActiveIndex() {
    if (!this.activeItemKey) return -1;
    return this.currentPlaylist.findIndex(
      item => item.path === this.activeItemKey || item.name === this.activeItemKey
    );
  }

  /**
   * Get Next Item in Playlist
   */
  getNextItem() {
    const idx = this.getActiveIndex();
    if (idx >= 0 && idx < this.currentPlaylist.length - 1) {
      return this.currentPlaylist[idx + 1];
    }
    return null;
  }

  /**
   * Get Previous Item in Playlist
   */
  getPrevItem() {
    const idx = this.getActiveIndex();
    if (idx > 0) {
      return this.currentPlaylist[idx - 1];
    }
    return null;
  }

  /**
   * Filter tree data based on search query
   */
  filterNodes(nodes, query) {
    if (!query) return nodes;
    const lower = query.toLowerCase();

    const filtered = [];
    for (const node of nodes) {
      if (node.type === 'file') {
        if (node.name.toLowerCase().includes(lower)) {
          filtered.push(node);
        }
      } else if (node.type === 'folder' && node.children) {
        const matchingChildren = this.filterNodes(node.children, query);
        if (matchingChildren.length > 0 || node.name.toLowerCase().includes(lower)) {
          filtered.push({
            ...node,
            children: matchingChildren
          });
        }
      }
    }
    return filtered;
  }

  /**
   * Render Tree View / Flat View to Container
   */
  render() {
    if (!this.container) return;
    this.container.innerHTML = '';

    const nodesToRender = this.filterNodes(this.treeData, this.searchQuery);

    if (nodesToRender.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'explorer-empty';
      emptyMsg.innerHTML = `
        <div class="empty-icon">📁</div>
        <p>${this.searchQuery ? 'No matching files found' : 'No files loaded yet'}</p>
        <span class="empty-subtext">${this.searchQuery ? 'Try a different search term' : 'Open a folder or drag & drop files'}</span>
      `;
      this.container.appendChild(emptyMsg);
      return;
    }

    const fragment = document.createDocumentFragment();

    if (this.viewMode === 'flat') {
      const flatList = this.filterNodes(this.currentPlaylist, this.searchQuery);
      const listEl = document.createElement('div');
      listEl.className = 'explorer-flat-list';
      flatList.forEach((item, index) => {
        listEl.appendChild(this.createFileElement(item, index + 1));
      });
      fragment.appendChild(listEl);
    } else {
      nodesToRender.forEach(node => {
        fragment.appendChild(this.createNodeElement(node));
      });
    }

    this.container.appendChild(fragment);
  }

  /**
   * Create DOM Element for a Folder Node or File Node
   */
  createNodeElement(node, depth = 0) {
    if (node.type === 'folder') {
      const folderWrapper = document.createElement('div');
      folderWrapper.className = 'explorer-folder-wrapper';
      folderWrapper.style.setProperty('--depth', depth);

      const header = document.createElement('div');
      header.className = 'explorer-folder-header';
      header.innerHTML = `
        <span class="folder-chevron">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </span>
        <span class="folder-icon">
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
        </span>
        <span class="folder-name" title="${node.name}">${this.formatTitle(node.name)}</span>
        <span class="folder-badge">${node.totalFiles || (node.children ? node.children.length : 0)}</span>
      `;

      const body = document.createElement('div');
      body.className = 'explorer-folder-body collapsed';

      if (node.children && node.children.length > 0) {
        node.children.forEach(child => {
          body.appendChild(this.createNodeElement(child, depth + 1));
        });
      }

      // Auto-expand if active item is inside this folder, or on search
      const hasActiveChild = node.children && node.children.some(c => 
        (c.type === 'file' && (c.path === this.activeItemKey || c.name === this.activeItemKey)) ||
        (c.type === 'folder' && c.children && c.children.some(cc => cc.path === this.activeItemKey))
      );

      if (hasActiveChild || this.searchQuery) {
        body.classList.remove('collapsed');
        header.classList.add('expanded');
      }

      header.addEventListener('click', () => {
        const isCollapsed = body.classList.toggle('collapsed');
        header.classList.toggle('expanded', !isCollapsed);
      });

      folderWrapper.appendChild(header);
      folderWrapper.appendChild(body);
      return folderWrapper;
    } else {
      return this.createFileElement(node);
    }
  }

  /**
   * Create DOM Element for a File
   */
  createFileElement(fileNode, sequenceNum = null) {
    const fileEl = document.createElement('div');
    const isActive = fileNode.path === this.activeItemKey || fileNode.name === this.activeItemKey;
    
    fileEl.className = `explorer-file-item ${isActive ? 'active' : ''}`;
    fileEl.dataset.path = fileNode.path || fileNode.name;

    const title = this.formatTitle(fileNode.name);
    const ext = fileNode.name.split('.').pop().toUpperCase();
    const isWap = fileNode.isWap || ext === 'WAP';

    fileEl.innerHTML = `
      <div class="file-icon-box ${isWap ? 'icon-wap' : 'icon-video'}">
        ${isActive ? `
          <span class="playing-bars">
            <span></span><span></span><span></span>
          </span>
        ` : `
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        `}
      </div>
      <div class="file-info">
        <div class="file-title-row">
          ${sequenceNum ? `<span class="file-seq">${sequenceNum}.</span>` : ''}
          <span class="file-title" title="${fileNode.name}">${title}</span>
          <span class="file-tag ${isWap ? 'tag-wap' : 'tag-mp4'}">${ext}</span>
        </div>
        <div class="file-meta">
          <span>${fileNode.sizeFormatted || ''}</span>
        </div>
      </div>
      <button class="file-play-btn" title="Play Video" aria-label="Play Video">
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
      </button>
    `;

    fileEl.addEventListener('click', async (e) => {
      e.stopPropagation();
      this.setActiveItem(fileNode.path || fileNode.name);
      
      // Get real File object if backed by handle
      let realFile = fileNode.fileRef;
      if (!realFile && fileNode.handle) {
        try {
          realFile = await fileNode.handle.getFile();
        } catch (err) {
          console.error('Failed to get file from handle:', err);
        }
      }

      if (realFile && this.onSelectFile) {
        this.onSelectFile({
          ...fileNode,
          fileRef: realFile
        });
      }
    });

    return fileEl;
  }
}

window.FileExplorer = FileExplorer;
