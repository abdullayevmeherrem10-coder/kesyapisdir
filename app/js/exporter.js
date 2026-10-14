/* ===== Kəsyapışdır — ixrac (MediaRecorder ilə real vaxt yazılması) ===== */
const Exporter = (() => {
  const $ = id => document.getElementById(id);
  const dlg = $('dlg-export');
  const CANDIDATES = [
    { label: 'MP4 (H.264 + AAC)', mime: 'video/mp4;codecs="avc1.42E01E,mp4a.40.2"', ext: 'mp4' },
    { label: 'MP4 (H.264 + Opus)', mime: 'video/mp4;codecs="avc1.42E01E,opus"', ext: 'mp4' },
    { label: 'MP4 (H.264)', mime: 'video/mp4;codecs=avc1', ext: 'mp4' },
    { label: 'MP4', mime: 'video/mp4', ext: 'mp4' },
    { label: 'WebM (VP9 + Opus)', mime: 'video/webm;codecs="vp9,opus"', ext: 'webm' },
    { label: 'WebM (H.264 + Opus)', mime: 'video/webm;codecs="h264,opus"', ext: 'webm' },
    { label: 'WebM (VP8 + Opus)', mime: 'video/webm;codecs="vp8,opus"', ext: 'webm' },
    { label: 'WebM', mime: 'video/webm', ext: 'webm' }
  ];
  let formats = [];
  let running = false, cancelled = false, recorder = null;
  let exportDir = null, lastSaved = null;
  const electron = !!(window.ksy && window.ksy.isElectron);

  /* ---- Saxlanma yeri ---- */
  function loadDir() { try { exportDir = localStorage.getItem('ksy-export-dir') || null; } catch { exportDir = null; } }
  function saveDir() { try { if (exportDir) localStorage.setItem('ksy-export-dir', exportDir); else localStorage.removeItem('ksy-export-dir'); } catch { /* boş */ } }
  async function renderDir() {
    const el = $('exp-dir');
    if (!electron) { $('exp-dir-row').classList.add('hidden'); return; }
    if (exportDir) { el.textContent = exportDir; el.title = exportDir; }
    else { const v = await window.ksy.videosDir(); el.textContent = `Hər dəfə soruş (standart: ${v})`; el.title = v; }
  }
  async function pickDir() {
    const def = exportDir || await window.ksy.videosDir();
    const dir = await window.ksy.chooseFolder(def);
    if (dir) { exportDir = dir; saveDir(); renderDir(); }
  }

  function detectFormats() {
    formats = typeof MediaRecorder === 'undefined' ? [] : CANDIDATES.filter(c => { try { return MediaRecorder.isTypeSupported(c.mime); } catch { return false; } });
    const sel = $('exp-format');
    sel.innerHTML = '';
    formats.forEach((f, i) => { const o = document.createElement('option'); o.value = i; o.textContent = f.label; sel.appendChild(o); });
    if (!formats.length) { const o = document.createElement('option'); o.textContent = 'Dəstəklənən format yoxdur'; sel.appendChild(o); }
  }

  function open() {
    if (State.duration() <= 0) { App.toast('Zaman xətti boşdur — ixrac ediləcək heç nə yoxdur.', true); return; }
    Renderer.pause();
    detectFormats();
    $('exp-name').value = (State.project.name || 'video').replace(/[\\/:*?"<>|]/g, '_');
    $('exp-fps').value = String(State.project.fps || 30);
    $('exp-cover').parentElement.classList.toggle('hidden', !State.project.cover);
    $('exp-saved').textContent = '';
    $('exp-show').classList.add('hidden');
    lastSaved = null;
    renderDir();
    $('exp-progress').classList.add('hidden');
    $('exp-start').disabled = !formats.length;
    $('exp-start').textContent = 'İxraca başla';
    $('exp-cancel').textContent = 'Bağla';
    dlg.classList.remove('hidden');
  }
  function close() {
    if (running) { cancel(); return; }
    dlg.classList.add('hidden');
  }
  function cancel() {
    if (!running) return;
    cancelled = true;
    Renderer.pause();
  }

  function setProgress(frac, text) {
    $('exp-bar').style.width = Math.round(frac * 100) + '%';
    $('exp-status').textContent = text;
  }

  async function start() {
    if (running || !formats.length) return null;
    const fmt = formats[+$('exp-format').value] || formats[0];
    const fps = +$('exp-fps').value || 30;
    const scale = +$('exp-res').value || 1;
    const bitrate = +$('exp-quality').value || 8000000;
    const name = ($('exp-name').value.trim() || 'video');
    const p = State.project;
    const total = State.duration();

    running = true; cancelled = false;
    $('exp-progress').classList.remove('hidden');
    $('exp-start').disabled = true;
    $('exp-cancel').textContent = 'Ləğv et';
    setProgress(0, 'Hazırlanır…');

    // Çıxış kanvası (ölçü azaldılarsa ayrıca kanvasa köçürülür)
    let outCanvas = Renderer.canvas, copyFn = null;
    if (scale !== 1) {
      outCanvas = document.createElement('canvas');
      outCanvas.width = Math.round(p.width * scale / 2) * 2;
      outCanvas.height = Math.round(p.height * scale / 2) * 2;
      const octx = outCanvas.getContext('2d');
      copyFn = () => octx.drawImage(Renderer.canvas, 0, 0, outCanvas.width, outCanvas.height);
    }

    const stream = outCanvas.captureStream(fps);
    const audio = Renderer.getAudioStream();
    if (audio) for (const tr of audio.getAudioTracks()) stream.addTrack(tr);

    let rec;
    try {
      rec = new MediaRecorder(stream, { mimeType: fmt.mime, videoBitsPerSecond: bitrate, audioBitsPerSecond: 192000 });
    } catch (e) {
      App.toast('Yazıcı başlamadı: ' + e.message, true);
      finish(); return null;
    }
    recorder = rec;
    const chunks = [];
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    const stopped = new Promise(res => { rec.onstop = res; rec.onerror = res; });

    // Oynatmanı başdan başlat, monitor səsini söndür
    Renderer.seek(0);
    Renderer.setMonitor(false);
    Renderer.exporting = true;
    await new Promise(r => setTimeout(r, 300)); // media elementləri hazırlansın

    const prevTime = Renderer.hooks.onTime, prevEnded = Renderer.hooks.onEnded;
    const ended = new Promise(res => {
      Renderer.hooks.onEnded = () => { prevEnded && prevEnded(); res(); };
    });
    Renderer.hooks.onTime = t => {
      prevTime && prevTime(t);
      copyFn && copyFn();
      setProgress(t / total, `${Math.round(t / total * 100)}%  (${Media.fmtTime(t)} / ${Media.fmtTime(total)})`);
    };

    rec.start(500);
    // Qapaq: ilk kadr kimi qısa müddət göstər
    const coverImg = $('exp-cover').checked ? await Cover.image() : null;
    if (coverImg) {
      const c = Renderer.canvas.getContext('2d');
      c.setTransform(1, 0, 0, 1, 0, 0); c.filter = 'none'; c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 3; i++) { c.drawImage(coverImg, 0, 0, Renderer.canvas.width, Renderer.canvas.height); copyFn && copyFn(); await new Promise(r => setTimeout(r, 1000 / fps)); }
    }
    Renderer.play();
    await Promise.race([ended, new Promise(res => { const iv = setInterval(() => { if (cancelled) { clearInterval(iv); res(); } }, 100); })]);

    if (rec.state !== 'inactive') rec.stop();
    await stopped;
    Renderer.hooks.onTime = prevTime;
    Renderer.hooks.onEnded = prevEnded;
    Renderer.setMonitor(true);
    Renderer.exporting = false;

    if (cancelled) {
      App.toast('İxrac ləğv edildi');
      finish(); return null;
    }
    const blob = new Blob(chunks, { type: fmt.mime.split(';')[0] });
    setProgress(1, `Hazır — ${(blob.size / 1048576).toFixed(1)} MB`);
    const url = URL.createObjectURL(blob);
    const fileName = `${name}.${fmt.ext}`;
    if (electron) window.ksy.setNextSavePath(exportDir ? window.ksy.join(exportDir, fileName) : null);
    const a = document.createElement('a');
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    $('exp-saved').textContent = electron ? (exportDir ? `Saxlanılır: ${window.ksy.join(exportDir, fileName)}` : 'Saxlama dialoqunda yeri seçin.') : 'Fayl brauzerin Yükləmələr qovluğuna saxlanıldı.';
    App.toast(`İxrac tamamlandı: ${fileName}`);
    finish(true);
    return { size: blob.size, type: blob.type };
  }

  function finish(done = false) {
    running = false; recorder = null;
    $('exp-start').disabled = false;
    $('exp-start').textContent = done ? 'Yenidən ixrac et' : 'İxraca başla';
    $('exp-cancel').textContent = 'Bağla';
    Renderer.setMonitor(true);
    Renderer.exporting = false;
    Renderer.seek(0);
  }

  function init() {
    loadDir();
    $('exp-dir-pick').addEventListener('click', pickDir);
    $('exp-dir-ask').addEventListener('click', () => { exportDir = null; saveDir(); renderDir(); });
    $('exp-show').addEventListener('click', () => { if (lastSaved) window.ksy.showInFolder(lastSaved); });
    if (electron) window.ksy.onSaved(info => {
      if (!/\.(mp4|webm)$/i.test(info.name)) { if (info.state === 'completed') App.toast(`Saxlanıldı: ${info.path}`); return; }
      if (info.state === 'completed') { lastSaved = info.path; $('exp-saved').textContent = `Saxlanıldı: ${info.path}`; $('exp-show').classList.remove('hidden'); App.toast(`Video saxlanıldı: ${info.path}`); }
      else if (info.state === 'cancelled') { $('exp-saved').textContent = 'Saxlama ləğv edildi. Video yadda saxlanılmadı.'; App.toast('Saxlama ləğv edildi', true); }
      else { $('exp-saved').textContent = 'Fayl saxlanıla bilmədi.'; App.toast('Fayl saxlanıla bilmədi', true); }
    });
    $('exp-start').addEventListener('click', start);
    $('exp-cancel').addEventListener('click', close);
    dlg.addEventListener('click', e => { if (e.target === dlg && !running) close(); });
  }

  return { init, open, close, start, get running() { return running; } };
})();
