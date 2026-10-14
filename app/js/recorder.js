/* ===== Kəsyapışdır — kamera, ekran və mikrofon yazısı ===== */
const Recorder = (() => {
  const $ = id => document.getElementById(id);
  let stream = null, rec = null, chunks = [], kind = null, timer = null, startAt = 0, mime = '', ext = '';
  let meterCtx = null, analyser = null, meterRaf = 0;
  const TITLES = { camera: 'Kameradan video yaz', screen: 'Ekran yazısı', mic: 'Mikrofondan səs yaz' };

  function pickMime(k) {
    const cands = k === 'mic'
      ? [['audio/webm;codecs=opus', 'webm'], ['audio/webm', 'webm'], ['audio/mp4', 'm4a']]
      : [['video/mp4;codecs="avc1.42E01E,mp4a.40.2"', 'mp4'], ['video/webm;codecs="vp9,opus"', 'webm'], ['video/webm;codecs="vp8,opus"', 'webm'], ['video/webm', 'webm']];
    for (const [m, e] of cands) if (MediaRecorder.isTypeSupported(m)) return [m, e];
    return ['', 'webm'];
  }

  async function getStream(k) {
    if (k === 'camera') return navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true });
    if (k === 'screen') return navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true });
    return navigator.mediaDevices.getUserMedia({ audio: true });
  }

  async function open(k) {
    kind = k;
    Renderer.pause();
    try { stream = await getStream(k); }
    catch (e) {
      const msg = k === 'screen' ? 'Ekran yazısı başlamadı. İcazə verildiyinə əmin olun.' : k === 'camera' ? 'Kamera tapılmadı və ya icazə verilmədi.' : 'Mikrofon tapılmadı və ya icazə verilmədi.';
      App.toast(msg + ' (' + e.message + ')', true);
      return;
    }
    [mime, ext] = pickMime(k);
    $('rec-title').textContent = TITLES[k];
    $('rec-time').textContent = '00:00';
    $('rec-dot').classList.add('hidden');
    $('rec-toggle').textContent = 'Yazmağa başla';
    $('rec-hint').textContent = k === 'screen' ? 'Yazı bitəndə fayl kitabxanaya əlavə olunur.' : '';
    const v = $('rec-video');
    if (k === 'mic') {
      v.classList.add('hidden'); $('rec-audio-only').classList.remove('hidden');
      startMeter();
    } else {
      v.classList.remove('hidden'); $('rec-audio-only').classList.add('hidden');
      v.srcObject = stream;
    }
    stream.getVideoTracks().forEach(t => t.addEventListener('ended', () => { if (rec && rec.state === 'recording') toggle(); }));
    $('dlg-record').classList.remove('hidden');
  }

  function startMeter() {
    try {
      const ac = new AudioContext();
      const src = ac.createMediaStreamSource(stream);
      analyser = ac.createAnalyser(); analyser.fftSize = 256;
      src.connect(analyser);
      const c = $('rec-meter'); meterCtx = c.getContext('2d');
      const data = new Uint8Array(analyser.frequencyBinCount);
      const drawM = () => {
        analyser.getByteFrequencyData(data);
        meterCtx.clearRect(0, 0, c.width, c.height);
        const n = 40, bw = c.width / n;
        for (let i = 0; i < n; i++) {
          const v = data[Math.floor(i * data.length / n)] / 255;
          meterCtx.fillStyle = v > 0.8 ? '#ff5c6c' : '#2f6bff';
          meterCtx.fillRect(i * bw + 1, c.height - v * c.height, bw - 2, v * c.height);
        }
        meterRaf = requestAnimationFrame(drawM);
      };
      drawM();
    } catch { /* ölçən vacib deyil */ }
  }

  function tick() {
    const s = Math.floor((Date.now() - startAt) / 1000);
    $('rec-time').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  function toggle() {
    if (!stream) return;
    if (rec && rec.state === 'recording') {
      rec.stop();
      $('rec-toggle').disabled = true;
      return;
    }
    chunks = [];
    try { rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 8000000 } : undefined); }
    catch (e) { App.toast('Yazıcı başlamadı: ' + e.message, true); return; }
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = async () => {
      clearInterval(timer);
      const dur = (Date.now() - startAt) / 1000;
      const blob = new Blob(chunks, { type: (mime || 'video/webm').split(';')[0] });
      const d = new Date();
      const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}-${String(d.getMinutes()).padStart(2, '0')}`;
      const base = kind === 'mic' ? 'Səs yazısı' : kind === 'screen' ? 'Ekran yazısı' : 'Kamera yazısı';
      const file = new File([blob], `${base} ${stamp}.${ext}`, { type: blob.type });
      close();
      await Media.importFiles([file], { duration: dur });
      App.showPage('import');
    };
    rec.start(250);
    startAt = Date.now();
    timer = setInterval(tick, 500);
    $('rec-dot').classList.remove('hidden');
    $('rec-toggle').textContent = 'Dayandır';
  }

  function close() {
    if (rec && rec.state === 'recording') { rec.stop(); return; }
    clearInterval(timer);
    cancelAnimationFrame(meterRaf);
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    $('rec-video').srcObject = null;
    $('rec-toggle').disabled = false;
    $('dlg-record').classList.add('hidden');
    rec = null;
  }

  function init() {
    $('rec-toggle').addEventListener('click', toggle);
    $('rec-close').addEventListener('click', close);
  }
  return { init, open, close };
})();
