// Kəsyapışdır — Electron əsas prosesi
const { app, BrowserWindow, Menu, session, desktopCapturer, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// Avtomatik oxutma icazəsi (ixrac zamanı istifadəçi hərəkəti tələb olunmasın)
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

const SMOKE = process.argv.includes('--smoke');

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 660,
    title: 'Kəsyapışdır',
    icon: path.join(__dirname, 'build', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    backgroundColor: '#141414',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false
    }
  });
  Menu.setApplicationMenu(null);
  win.once('ready-to-show', () => { if (!SMOKE) win.maximize(); win.show(); });
  // Ekran yazısı: əsas ekranı mənbə kimi ver (sistem səsi ilə)
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['screen'] })
      .then(sources => callback({ video: sources[0], audio: 'loopback' }))
      .catch(() => callback({}));
  });
  win.loadFile(path.join(__dirname, 'app', 'index.html'));

  if (SMOKE) {
    // Test rejimi: konsol mesajlarını yaz, ekran şəkli çək, çıx
    const logs = [];
    win.webContents.on('console-message', (_e, level, message, line, source) => {
      logs.push(`[${level}] ${message} (${path.basename(source || '')}:${line})`);
    });
    const outDir = path.join(__dirname, 'test', 'out');
    fs.mkdirSync(outDir, { recursive: true });
    session.defaultSession.on('will-download', (_e, item) => {
      item.setSavePath(path.join(outDir, item.getFilename()));
      item.once('done', (_ev, state) => logs.push(`[download] ${item.getFilename()} ${state} ${item.getReceivedBytes()} bayt`));
    });
    // smoke rejimində ümumi handler işləməsin deyə bayraq artıq SMOKE-dur
    win.webContents.on('did-finish-load', async () => {
      try {
        await win.webContents.executeJavaScript('window.__smokeStart && window.__smokeStart()');
        await new Promise(r => setTimeout(r, 1500));
        const img = await win.webContents.capturePage();
        fs.writeFileSync(path.join(outDir, 'editor.png'), img.toPNG());
        for (const page of ['transitions', 'import']) {
          await win.webContents.executeJavaScript(`App.showPage('${page}')`);
          await new Promise(r => setTimeout(r, 700));
          const shot = await win.webContents.capturePage();
          fs.writeFileSync(path.join(outDir, page + '.png'), shot.toPNG());
        }
        await win.webContents.executeJavaScript(`App.showPage('props')`);
        const exp = await win.webContents.executeJavaScript('window.__smokeExport ? window.__smokeExport() : "yoxdur"');
        logs.push('[export] ' + exp);
        await new Promise(r => setTimeout(r, 1000));
        const state = await win.webContents.executeJavaScript('window.__smokeReport ? window.__smokeReport() : "no report"');
        fs.writeFileSync(path.join(outDir, 'report.txt'), logs.join('\n') + '\n---\n' + state);
        console.log(logs.join('\n'));
        console.log('---');
        console.log(state);
      } catch (err) {
        console.error('SMOKE XƏTASI:', err);
      } finally {
        app.quit();
      }
    });
  }
}

/* ---- Fayl saxlama: ixrac qovluğu və yükləmələr ---- */
let nextSavePath = null;
function uniquePath(p) {
  if (!fs.existsSync(p)) return p;
  const ext = path.extname(p), base = p.slice(0, -ext.length || undefined);
  for (let i = 2; i < 1000; i++) { const c = `${base} (${i})${ext}`; if (!fs.existsSync(c)) return c; }
  return p;
}
ipcMain.handle('ksy:choose-folder', async (e, def) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const r = await dialog.showOpenDialog(win, { title: 'Saxlanma qovluğunu seçin', defaultPath: def || app.getPath('videos'), properties: ['openDirectory', 'createDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('ksy:videos-dir', () => app.getPath('videos'));
ipcMain.on('ksy:next-save-path', (_e, p) => { nextSavePath = p || null; });
ipcMain.on('ksy:show-in-folder', (_e, p) => { if (p) shell.showItemInFolder(p); });

app.whenReady().then(() => {
  session.defaultSession.on('will-download', (_e, item, wc) => {
    if (SMOKE) return; // test rejimində ayrıca idarə olunur
    const name = item.getFilename();
    const isVideo = /\.(mp4|webm|m4a)$/i.test(name);
    if (nextSavePath) { item.setSavePath(uniquePath(nextSavePath)); nextSavePath = null; }
    else item.setSaveDialogOptions({ title: 'Faylı saxla', defaultPath: path.join(app.getPath(isVideo ? 'videos' : 'documents'), name) });
    item.once('done', (_ev, state) => { try { wc.send('ksy:saved', { state, path: item.getSavePath(), name }); } catch { /* pəncərə bağlanıb */ } });
  });
  createWindow();
});
app.on('window-all-closed', () => app.quit());
