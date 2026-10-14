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
  const MAX_DECODE_BYTES = 600 * 1024 * 1024;
  async function computePeaks(m) {
    if (m.type === 'image' || m.peaks || m.size > MAX_DECODE_BYTES) return;
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
      // normallaşdır (sakit səslər də görünsün)
      let max = 0; for (let i = 0; i < count; i++) if (peaks[i] > max) max = peaks[i];
      m.peakMax = max;
      if (max > 0 && max < 0.9) for (let i = 0; i < count; i++) peaks[i] = peaks[i] / max * 0.9;
      m.peaks = peaks; m.peaksPerSec = PEAKS_PER_SEC;
      if (!m.duration) m.duration = audio.duration;
    } catch (e) {
      m.peaks = null; m.noAudio = true; // səs yolu yoxdur və ya oxunmadı
    }
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
