/* ===== Kəsyapışdır — media idxalı, kitabxana, miniatürlər ===== */
const Media = (() => {
  const grid = document.getElementById('media-grid');
  const dropHint = document.getElementById('drop-hint');

  function typeOf(file) {
    const t = (file.type || '').toLowerCase();
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (t.startsWith('video/') || ['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v'].includes(ext)) return 'video';
    if (t.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext)) return 'audio';
    if (t.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) return 'image';
    return null;
  }

  function fmtTime(sec, frac = false) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    const base = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    if (!frac) return base;
    const cs = Math.floor((sec - Math.floor(sec)) * 100);
    return `${base}.${String(cs).padStart(2, '0')}`;
  }

  function waitEvent(el, ok, fail, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => { cleanup(); reject(new Error('vaxt bitdi')); }, timeout);
      const onOk = () => { cleanup(); resolve(); };
      const onFail = () => { cleanup(); reject(new Error('yüklənmədi')); };
      function cleanup() { clearTimeout(t); el.removeEventListener(ok, onOk); el.removeEventListener(fail, onFail); }
      el.addEventListener(ok, onOk, { once: true });
      el.addEventListener(fail, onFail, { once: true });
    });
  }

  function thumbFrom(source, w, h) {
    const c = document.createElement('canvas');
    const r = w / h;
    c.width = 192; c.height = Math.max(40, Math.round(192 / r));
    c.getContext('2d').drawImage(source, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.7);
  }

  async function probe(m) {
    if (m.type === 'image') {
      const img = new Image();
      img.src = m.url;
      await waitEvent(img, 'load', 'error');
      m.width = img.naturalWidth; m.height = img.naturalHeight;
      m.thumb = thumbFrom(img, m.width, m.height);
      return;
    }
    const el = document.createElement(m.type === 'audio' ? 'audio' : 'video');
    el.preload = 'metadata'; el.muted = true; el.src = m.url;
    await waitEvent(el, 'loadedmetadata', 'error');
    m.duration = isFinite(el.duration) ? el.duration : 0;
    if (m.type === 'video') {
      m.width = el.videoWidth; m.height = el.videoHeight;
      try {
        el.currentTime = Math.min(1, m.duration / 2);
        await waitEvent(el, 'seeked', 'error', 5000);
        if (m.width) m.thumb = thumbFrom(el, m.width, m.height);
      } catch { /* miniatür alınmadı — vacib deyil */ }
    }
    el.removeAttribute('src'); el.load();
  }

  /* Səs dalğası üçün piklər: saniyədə PEAKS_PER_SEC dəyər (0..1) */
  const PEAKS_PER_SEC = 50;
  // Bütöv dekod yalnız kiçik/qısa fayllar üçün: uzun faylın PCM-i yaddaşı doldurur (1 saat stereo ≈ 1,3 GB)
  const MAX_DECODE_BYTES = 400 * 1024 * 1024;
  const MAX_DECODE_SEC = 15 * 60;
  const SCAN_RATE = 4; // ehtiyat yolda oxutma sürəti: 4×-dən yuxarıda Chromium səsin bir hissəsini buraxır, dalğa boşluqlu çıxır

  function finishPeaks(m, peaks) {
    let max = 0; for (let i = 0; i < peaks.length; i++) if (peaks[i] > max) max = peaks[i];
    m.peakMax = max;
    // normallaşdır (sakit səslər də görünsün)
    if (max > 0 && max < 0.9) for (let i = 0; i < peaks.length; i++) peaks[i] = peaks[i] / max * 0.9;
    m.peaks = peaks; m.peaksPerSec = PEAKS_PER_SEC;
    m.noAudio = max === 0;
  }

  /* 1-ci yol: faylı bütöv dekod et (sürətli, amma hər konteyner/kodek üçün işləmir) */
  async function peaksByDecode(m) {
    if (m.size > MAX_DECODE_BYTES || (m.duration && m.duration > MAX_DECODE_SEC)) return false;
    try {
      const buf = await m.file.arrayBuffer();
      const octx = new OfflineAudioContext(1, 1, 44100);
      const audio = await octx.decodeAudioData(buf);
      const sr = audio.sampleRate, chans = audio.numberOfChannels;
      const bucket = Math.max(1, Math.floor(sr / PEAKS_PER_SEC));
      const count = Math.ceil(audio.length / bucket);
      const peaks = new Float32Array(count);
      for (let ch = 0; ch < chans; ch++) {
        const data = audio.getChannelData(ch);
        for (let i = 0; i < count; i++) {
          let v = 0;
          const end = Math.min(data.length, (i + 1) * bucket);
          for (let j = i * bucket; j < end; j += 2) { const a = data[j] < 0 ? -data[j] : data[j]; if (a > v) v = a; }
          if (v > peaks[i]) peaks[i] = v;
        }
      }
      finishPeaks(m, peaks);
      if (!m.duration) m.duration = audio.duration;
      return true;
    } catch (e) {
      return false; // konteyner/kodek dəstəklənmir və ya fayl çox böyükdür
    }
  }

  /* 2-ci yol: faylı səssiz audio elementləri ilə sürətli oxudub pikləri topla.
     Böyük (GB-lıq) MP4 və decodeAudioData-nın oxumadığı formatlar üçün. Fayl bir neçə
     hissəyə bölünür, hissələr eyni anda oxunur; dalğa tədricən görünür.
     Qeyd: 4×-dən yuxarı sürətdə Chromium səsin bir hissəsini buraxır (ölçülüb: 16× → 40%, 8× → 68%, 4× → 100%). */
  const SCAN_PARALLEL = 4;
  let scanChain = Promise.resolve();
  function peaksByPlayback(m) {
    const run = () => new Promise(resolve => {
      if (!m.duration || !isFinite(m.duration) || !State.media.has(m.id)) { resolve(false); return; }
      let ctx;
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { resolve(false); return; }
      const count = Math.ceil(m.duration * PEAKS_PER_SEC);
      const peaks = new Float32Array(count);
      m.peaks = peaks; m.peaksPerSec = PEAKS_PER_SEC; m.peakMax = 1; // tədricən dolacaq
      const nSeg = Math.max(1, Math.min(SCAN_PARALLEL, Math.floor(m.duration / 20)));
      const segLen = m.duration / nSeg;
      const workers = [];
      let active = nSeg, done = false, got = false, lastDraw = 0, decodedCheck = null;
      const finish = () => {
        if (done) return; done = true;
        clearTimeout(guard); clearTimeout(decodedCheck);
        for (const w of workers) w.stop();
        ctx.close().catch(() => {});
        if (got) finishPeaks(m, peaks); else m.peaks = null;
        resolve(got);
      };
      const segDone = () => { if (--active <= 0) finish(); };
      const guard = setTimeout(finish, (segLen / SCAN_RATE + 60) * 2000);
      const redraw = () => { const now = performance.now(); if (now - lastDraw > 1500) { lastDraw = now; if (State.project) Timeline.render(); } };

      function startWorker(from, to) {
        const el = document.createElement('audio'); // video faylında da yalnız səs yolunu oxuyur
        el.preload = 'auto'; el.preservesPitch = false; el.src = m.url;
        const src = ctx.createMediaElementSource(el);
        const proc = ctx.createScriptProcessor(4096, 2, 1);
        const gain = ctx.createGain(); gain.gain.value = 0;
        src.connect(proc); proc.connect(gain); gain.connect(ctx.destination);
        let tPrev = from, stopped = false;
        const stop = () => {
          if (stopped) return; stopped = true;
          try { proc.disconnect(); src.disconnect(); gain.disconnect(); } catch {}
          try { el.pause(); el.removeAttribute('src'); el.load(); } catch {}
        };
        const end = () => { if (!stopped) { stop(); segDone(); } };
        proc.onaudioprocess = ev => {
          if (stopped) return;
          const tNow = el.currentTime;
          if (tNow <= tPrev) return; // hələ irəliləməyib (bufer gözləyir)
          const ib = ev.inputBuffer, n = ib.length, chans = ib.numberOfChannels;
          const span = tNow - tPrev;
          for (let ch = 0; ch < chans; ch++) {
            const data = ib.getChannelData(ch);
            for (let j = 0; j < n; j++) {
              const a = data[j] < 0 ? -data[j] : data[j];
              if (a === 0) continue;
              const idx = Math.floor((tPrev + span * j / n) * PEAKS_PER_SEC);
              if (idx >= 0 && idx < count && a > peaks[idx]) { peaks[idx] = a; got = true; }
            }
          }
          tPrev = tNow;
          redraw();
          if (tNow >= to) end();
        };
        const go = () => { el.playbackRate = SCAN_RATE; el.play().catch(end); };
        el.addEventListener('ended', end);
        el.addEventListener('error', end);
        el.addEventListener('loadedmetadata', () => {
          if (from > 0.05) { el.addEventListener('seeked', go, { once: true }); el.currentTime = from; } else go();
        }, { once: true });
        return { stop, el };
      }
      for (let i = 0; i < nSeg; i++) workers.push(startWorker(i * segLen, i === nSeg - 1 ? m.duration : (i + 1) * segLen));
      // Səs yolu yoxdursa boş yerə gözləməyək: bir neçə saniyədən sonra dekod olunan bayt yoxdursa bitir
      decodedCheck = setTimeout(() => {
        const w = workers[0] && workers[0].el;
        if (!got && w && 'webkitAudioDecodedByteCount' in w && w.webkitAudioDecodedByteCount === 0 && w.currentTime > 2) finish();
      }, 8000);
    });
    const p = scanChain.then(run, run);
    scanChain = p.catch(() => {});
    return p;
  }

  async function computePeaks(m) {
    if (m.type === 'image' || m.peaks || m.peaksBusy) return;
    m.peaksBusy = true;
    let ok = await peaksByDecode(m);
    if (!ok) ok = await peaksByPlayback(m);
    if (!ok) { m.peaks = null; m.noAudio = true; } // səs yolu yoxdur və ya oxunmadı
    m.peaksBusy = false;
    if (State.project) Timeline.render();
  }

  async function importFiles(files, opts = {}) {
    let added = 0;
    for (const f of files) {
      const type = typeOf(f);
      if (!type) { App.toast(`Dəstəklənməyən fayl: ${f.name}`, true); continue; }
      const m = {
        id: State.uid(), name: f.name, type, file: f, size: f.size,
        url: URL.createObjectURL(f), duration: 0, width: 0, height: 0, thumb: null,
        path: window.ksy?.getPath ? window.ksy.getPath(f) : null
      };
      try {
        await probe(m);
        if ((!m.duration || !isFinite(m.duration)) && opts.duration) m.duration = opts.duration;
        State.media.set(m.id, m);
        added++;
        computePeaks(m); // arxa planda, gözləmirik
      } catch (e) {
        URL.revokeObjectURL(m.url);
        App.toast(`"${f.name}" oxuna bilmədi (${e.message})`, true);
      }
    }
    renderLibrary();
    if (added) App.toast(`${added} media faylı əlavə edildi`);
    return added;
  }

  function removeMedia(id) {
    const m = State.media.get(id);
    if (!m) return;
    const used = State.project.tracks.some(t => t.clips.some(c => c.mediaId === id));
    if (used) { App.toast('Bu media zaman xəttində istifadə olunur. Əvvəl klipləri silin.', true); return; }
    URL.revokeObjectURL(m.url);
    State.media.delete(id);
    renderLibrary();
  }

  /* Medianı zaman xəttinə əlavə et (oynatma başlığından) */
  function addToTimeline(mediaId, atTime = State.playhead, trackId = null) {
    const m = State.media.get(mediaId);
    if (!m) return;
    State.mutate(p => {
      const dur = m.type === 'image' ? State.IMAGE_DEFAULT_DURATION : (m.duration || 5);
      const clip = State.makeClip(m.type, null, atTime, { mediaId: m.id, duration: dur, srcDuration: m.duration || null });
      let track = trackId ? State.findTrack(trackId) : null;
      if (!track || !State.trackAccepts(track, clip.type)) track = State.pickTrackFor(clip.type, atTime, dur);
      State.addClip(clip, track.id);
      State.select([clip.id]);
    });
  }

  const ICONS = {
    video: '<svg class="ic"><use href="#i-film"/></svg>',
    audio: '<svg class="ic"><use href="#i-music"/></svg>',
    image: '<svg class="ic"><use href="#i-image"/></svg>'
  };

  function makeCard(m, { list = false } = {}) {
    const card = document.createElement('div');
    card.className = 'media-card' + (list ? ' row' : '');
    card.draggable = true;
    card.dataset.mediaId = m.id;
    card.title = `${m.name}
${m.type === 'image' ? `${m.width}×${m.height}` : fmtTime(m.duration)}`;
    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    if (m.thumb) thumb.style.backgroundImage = `url(${m.thumb})`; else thumb.innerHTML = ICONS[m.type];
    card.appendChild(thumb);
    if (m.type !== 'image') { const d = document.createElement('span'); d.className = 'dur'; d.textContent = fmtTime(m.duration); card.appendChild(d); }
    const name = document.createElement('div'); name.className = 'name'; name.textContent = m.name; card.appendChild(name);
    const used = State.project && State.project.tracks.some(t => t.clips.some(c => c.mediaId === m.id));
    if (used) { const u = document.createElement('span'); u.className = 'used'; u.innerHTML = '<svg class="ic"><use href="#i-check"/></svg>'; u.title = 'Zaman xəttində istifadə olunur'; card.appendChild(u); }
    const add = document.createElement('button'); add.className = 'add'; add.innerHTML = '<svg class="ic"><use href="#i-plus"/></svg>'; add.title = 'Zaman xəttinə əlavə et';
    add.onclick = e => { e.stopPropagation(); addToTimeline(m.id); };
    const del = document.createElement('button'); del.className = 'del'; del.innerHTML = '<svg class="ic"><use href="#i-x"/></svg>'; del.title = 'Kitabxanadan sil';
    del.onclick = e => { e.stopPropagation(); removeMedia(m.id); };
    card.appendChild(add); card.appendChild(del);
    card.addEventListener('dragstart', e => { e.dataTransfer.setData('application/x-ksy-media', m.id); e.dataTransfer.effectAllowed = 'copy'; });
    card.addEventListener('dblclick', () => addToTimeline(m.id));
    return card;
  }

  let filesCat = 'all', filesQuery = '';
  function setFilesFilter(cat, query) { if (cat != null) filesCat = cat; if (query != null) filesQuery = query; renderLibrary(); }

  function renderLibrary() {
    const items = [...State.media.values()];
    const byType = t => items.filter(m => m.type === t);
    // İdxal səhifəsi
    const grid = document.getElementById('media-grid');
    const dropHint = document.getElementById('drop-hint');
    if (grid) { grid.innerHTML = ''; for (const m of items) grid.appendChild(makeCard(m)); }
    if (dropHint) dropHint.classList.toggle('compact', items.length > 0);
    // Səs səhifəsi
    const ag = document.getElementById('audio-grid');
    if (ag) { ag.innerHTML = ''; for (const m of byType('audio')) ag.appendChild(makeCard(m, { list: true })); }
    const ae = document.getElementById('audio-empty'); if (ae) ae.classList.toggle('hidden', byType('audio').length > 0);
    // Layihə faylları
    const fg = document.getElementById('files-grid');
    if (fg) {
      fg.innerHTML = '';
      const q = filesQuery.trim().toLowerCase();
      const list = items.filter(m => (filesCat === 'all' || m.type === filesCat) && (!q || m.name.toLowerCase().includes(q)));
      for (const m of list) fg.appendChild(makeCard(m));
      const names = { all: 'Hamısı', video: 'Video', image: 'Şəkil', audio: 'Səs' };
      const title = document.getElementById('files-title'); if (title) title.textContent = names[filesCat] + (q ? ` — "${filesQuery}"` : '');
      for (const k of ['all', 'video', 'image', 'audio']) { const el = document.getElementById('cnt-' + k); if (el) el.textContent = k === 'all' ? items.length : byType(k).length; }
    }
  }

  return { typeOf, fmtTime, probe, computePeaks, importFiles, removeMedia, addToTimeline, renderLibrary, setFilesFilter, ICONS };
})();
