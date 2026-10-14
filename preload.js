const { contextBridge, webUtils, ipcRenderer } = require('electron');
const path = require('path');
contextBridge.exposeInMainWorld('ksy', {
  isElectron: true,
  getPath(file) {
    try { return webUtils.getPathForFile(file); } catch { return null; }
  },
  chooseFolder: def => ipcRenderer.invoke('ksy:choose-folder', def),
  videosDir: () => ipcRenderer.invoke('ksy:videos-dir'),
  setNextSavePath: p => ipcRenderer.send('ksy:next-save-path', p),
  showInFolder: p => ipcRenderer.send('ksy:show-in-folder', p),
  onSaved: cb => ipcRenderer.on('ksy:saved', (_e, info) => cb(info)),
  join: (...a) => path.join(...a)
});
