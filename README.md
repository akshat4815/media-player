# Aether Player - .WAP & HD Video Player Suite

A modern, responsive, and ultra-fast web application built to play **`.wap`** obfuscated video files and full media libraries directly in your browser. 

100% client-side, zero server requirements, completely private, and works across desktop and mobile devices.

---

## ✨ Features

- **⚡ .WAP Video Decoding**: Instantly strips header/footer padding from `.wap` files in-memory using Blobs without writing to disk or sending files to any server.
- **📱 Mobile-First & Touch Ready**: Responsive mobile drawer, bottom quick-action bar, and double-tap gestures (tap left to rewind 10s, tap right to forward 10s).
- **📁 Smart Folder & Chapter Explorer**:
  - **Native File System Access API** (`window.showDirectoryPicker` on Chrome/Edge/Desktop).
  - **Folder Upload Fallback** (`<input webkitdirectory>`) for all mobile & other browsers.
  - **Drag & Drop** files or entire directories.
  - **Natural Chapter Sorting**: Automatically sorts `Chapter 1`, `Chapter 2`, `Chapter 10`, `ch-01`, etc.
- **🎥 Rich Player Controls**:
  - Speed presets (0.5x, 0.75x, 1x, 1.25x, 1.5x, 1.75x, 2x, 2.5x, 3x).
  - Auto-play next video in playlist.
  - Playback position memory (prompt to resume where you left off).
  - 📸 1-click HD Frame Screenshot grabber.
  - Picture-in-Picture (PiP) and Theater mode.
- **🔒 100% Private & Client-Side**: No video data is ever sent across the network.

---

## 🚀 How to Host

Because Aether Player is a pure static web app, you can host it for free anywhere in under 1 minute:

### Option 1: GitHub Pages
1. Create a new GitHub repository (e.g. `wap-player`).
2. Push this folder to your repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of Aether Player"
   git branch -M main
   git remote add origin https://github.com/<your-username>/wap-player.git
   git push -u origin main
   ```
3. In your GitHub repo, go to **Settings** > **Pages**.
4. Under **Branch**, select `main` and `/ (root)`, then click **Save**.
5. Your player is live at `https://<your-username>.github.io/wap-player/`!

### Option 2: Netlify
1. Go to [Netlify](https://app.netlify.com).
2. Drag and drop this folder directly into Netlify's **"Deploy manually"** area.
3. *Or* connect your GitHub repo for continuous deployment (the included `netlify.toml` will handle the configuration automatically).

### Option 3: Run Locally
You can run it locally with any static server:
```bash
# Using Python
python -m http.server 8080

# Using Node.js (npx serve)
npx serve .
```
Then open `http://localhost:8080` in your browser.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| <kbd>Space</kbd> or <kbd>K</kbd> | Play / Pause |
| <kbd>J</kbd> or <kbd>←</kbd> | Seek 10s Backward |
| <kbd>L</kbd> or <kbd>→</kbd> | Seek 10s Forward |
| <kbd>↑</kbd> / <kbd>↓</kbd> | Volume Up / Down |
| <kbd>M</kbd> | Mute / Unmute |
| <kbd>F</kbd> | Fullscreen |
| <kbd>S</kbd> | Capture Screenshot |
| <kbd>T</kbd> | Theater Mode |
| <kbd>[</kbd> / <kbd>]</kbd> | Decrease / Increase Speed |
| <kbd>Shift</kbd> + <kbd>N</kbd> | Next Video in Playlist |
| <kbd>Shift</kbd> + <kbd>P</kbd> | Previous Video in Playlist |

---

## 🛠️ How .WAP Decoding Works

A `.wap` file is simply an MP4/video file that has `name.length` junk bytes prepended to the start and `name.length` junk bytes appended to the end to prevent generic media players from opening it directly.

Aether Player extracts the playable media stream using the Web File API:
```javascript
const nameLength = file.name.length;
const rawVideoBlob = file.slice(nameLength, file.size - nameLength, 'video/mp4');
const videoUrl = URL.createObjectURL(rawVideoBlob);
```

---

## 📄 License
MIT License - Open and customizable for your personal portfolio and hosting.
