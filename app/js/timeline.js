/* ===== Kəsyapışdır — zaman xətti (treklər, kliplər, sürükləmə, kəsmə, maqnit) ===== */
const Timeline = (() => {
  const $ = id => document.getElementById(id);
  const scroll = $('timeline-scroll'), content = $('timeline-content'), ruler = $('ruler');
  const tracksEl = $('tracks'), headersEl = $('track-headers'), playheadEl = $('playhead'), hoverEl = $('hoverline');
  const TRACK_H = { video: 96, audio: 60, text: 42 };
  const ICON = n => `<svg class="ic"><use href="#i-${n}"/></svg>`;
  const TRACK_ICON = { video: ICON('film'), audio: ICON('music'), text: ICON('type') };
  const PAD_SEC = 15;
  const SNAP_PX = 8;
  let pxPerSec = 80, snap = true;
  let drag = null, scrubbing = false, marquee = null, suppressCtx = false;

  const x2t = x => x / pxPerSec;
  const t2x = t => t * pxPerSec;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function contentWidth() { return Math.max(scroll.clientWidth, t2x(State.duration() + PAD_SEC)); }

  /* ---- Xətkeş ---- */
  function renderRuler(width) {
    ruler.innerHTML = '';
    const steps = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
    let step = steps.find(s => t2x(s) >= 70) || 600;
    const minor = step / 5;
    const total = x2t(width);
    const frag = document.createDocumentFragment();
    const count = Math.ceil(total / minor);
    for (let i = 0; i <= count; i++) {
      const t = Math.round(i * minor * 1000) / 1000;
      const isMajor = Math.abs(t / step - Math.round(t / step)) < 1e-6;
      const tick = document.createElement('div');
      tick.className = 'tick' + (isMajor ? ' major' : '');
      tick.style.left = t2x(t) + 'px';
      frag.appendChild(tick);
      if (isMajor) {
        const lbl = document.createElement('div');
        lbl.className = 'tick-label';
        lbl.style.left = t2x(t) + 'px';
        lbl.textContent = step < 1 ? Media.fmtTime(t, true).replace(/^00:/, '') : Media.fmtTime(t);
        frag.appendChild(lbl);
      }
    }
    ruler.appendChild(frag);
  }

  /* ---- Kliplər ---- */
  function renderClip(clip) {
    const el = document.createElement('div');
    el.className = `clip clip-${clip.type}` + (State.selection.includes(clip.id) ? ' selected' : '');
    // Videodan ayrılmış səs: ayrıca görünüş (yaşılımtıl, dalğa aşağıdan yuxarı)
    if (clip.type === 'audio' && State.media.get(clip.mediaId)?.type === 'video') el.classList.add('clip-detached');
    el.dataset.clipId = clip.id;
    positionClipEl(el, clip);
    const m = State.media.get(clip.mediaId);
    const label = clip.type === 'text' ? clip.text.content.split('\n')[0] : (m ? m.name : 'Media tapılmadı');
    el.innerHTML = `<div class="clip-handle left"></div><div class="clip-body"></div><span class="clip-label">${esc(label)}</span><div class="clip-handle right"></div>`;
    const body = el.querySelector('.clip-body');
    if (m && m.thumb && clip.type !== 'audio') body.style.backgroundImage = `url(${m.thumb})`;
    // Səsi ayrılmış (səssiz) video klipdə dalğa göstərmə — səs artıq audio trekdədir
    if (m && m.peaks && (clip.type === 'audio' || (clip.type === 'video' && !clip.audioDetached))) {
      const wave = document.createElement('canvas');
      wave.className = 'clip-wave';
      el.appendChild(wave);
      el.classList.add('has-wave');
      wave.dataset.clipId = clip.id;
      waveRO.observe(wave, { box: 'device-pixel-content-box' }); // ölçüsü bilinəndə çəkiləcək
    }
    if (m && (clip.type === 'audio' || el.classList.contains('has-wave'))) el.appendChild(volUI(clip));
    if (!m && clip.type !== 'text') el.style.background = '#6b2d2d';
    if (clip.speed !== 1) {
      const sp = document.createElement('span'); sp.className = 'clip-speed'; sp.textContent = `${clip.speed}×`; el.appendChild(sp);
    }
    if (clip.fadeIn > 0) { const f = document.createElement('span'); f.className = 'clip-fade'; f.style.left = '0'; f.style.width = t2x(clip.fadeIn) + 'px'; f.style.background = 'linear-gradient(90deg, rgba(0,0,0,.55), transparent)'; el.appendChild(f); }
    if (clip.fadeOut > 0) { const f = document.createElement('span'); f.className = 'clip-fade'; f.style.right = '0'; f.style.width = t2x(clip.fadeOut) + 'px'; f.style.background = 'linear-gradient(270deg, rgba(0,0,0,.55), transparent)'; el.appendChild(f); }
    const tr = Renderer.transitionOf(clip);
    if (tr) {
      const tm = document.createElement('span'); tm.className = 'clip-transition';
      tm.style.width = Math.max(14, t2x(tr.d)) + 'px';
      tm.innerHTML = ICON('transition');
      tm.title = `Keçid: ${(Transitions.byId(tr.type) || {}).name || tr.type} (${tr.d.toFixed(1)} s)`;
      el.appendChild(tm);
    }
    el.title = `${label}\nBaşlama: ${Media.fmtTime(clip.start, true)}  Müddət: ${Media.fmtTime(clip.duration, true)}`;
    return el;
  }
  function positionClipEl(el, clip) {
    el.style.left = t2x(clip.start) + 'px';
    el.style.width = Math.max(4, t2x(clip.duration)) + 'px';
    const vu = el.querySelector('.vol-ui'); if (vu) updateVolUI(vu, clip);
  }

  /* Klipin görünən hissəsinə uyğun səs dalğasını çək.
     Kətan ekranın real piksel ölçüsündə çəkilir (ResizeObserver, device-pixel-content-box):
     brauzer onu dartmır, ona görə istənilən miqyasda və ekran böyütməsində kəskin qalır. */
  const WAVE_MAX_W = 32000; // kətanın maksimum eni (Chromium həddi ~32767)
  const waveRO = new ResizeObserver(entries => {
    for (const en of entries) {
      const c = en.target, box = en.devicePixelContentBoxSize && en.devicePixelContentBoxSize[0];
      const dpr = window.devicePixelRatio || 1;
      c.__dw = box ? box.inlineSize : Math.round(en.contentRect.width * dpr);
      c.__dh = box ? box.blockSize : Math.round(en.contentRect.height * dpr);
      drawWave(c);
    }
  });
  function drawWave(canvas) {
    const found = State.findClip(canvas.dataset.clipId);
    if (!found) return;
    const clip = found.clip, m = State.media.get(clip.mediaId);
    if (!m || !m.peaks || !canvas.__dw || !canvas.__dh) return;
    const w = Math.min(canvas.__dw, WAVE_MAX_W), h = canvas.__dh;
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    const detached = clip.type === 'audio' && m.type === 'video';
    const bottomUp = detached || clip.type === 'video';
    const vis = Math.min(1, Math.max(0, clip.volume ?? 1)); // səs azaldıqca dalğa da kiçilir
    ctx.fillStyle = detached ? '#17594d' : clip.type === 'audio' ? 'rgba(120,190,255,0.9)' : '#2c3274';
    const pps = m.peaksPerSec, peaks = m.peaks;
    const segStart = clip.in, segLen = clip.duration * clip.speed;
    const perPx = segLen / w;
    const dpx = w / Math.max(1, canvas.clientWidth || w); // bir CSS pikselə düşən ekran pikseli
    // Doldurulmuş, pilləli siluet: 3 CSS piksellik bloklar, aralarında boşluq yoxdur; tam piksel koordinatları
    const blk = Math.max(1, Math.round(3 * dpx));
    const pad = bottomUp ? Math.max(1, Math.round(2 * dpx)) : 0;
    for (let x = 0; x < w; x += blk) {
      const t0 = segStart + x * perPx;
      const i0 = Math.floor(t0 * pps), i1 = Math.max(i0 + 1, Math.ceil((t0 + blk * perPx) * pps));
      let v = 0;
      for (let i = i0; i < i1 && i < peaks.length; i++) if (peaks[i] > v) v = peaks[i];
      // Kvadrat kök miqyası: sakit danışıq da aydın görünsün
      v = Math.sqrt(v) * vis;
      const bw = Math.min(blk, w - x);
      if (bottomUp) { const bh = Math.max(1, Math.round(v * (h - pad))); ctx.fillRect(x, h - bh, bw, bh); } // aşağıdan yuxarı
      else { const bh = Math.max(1, Math.round(v * h)); ctx.fillRect(x, Math.round((h - bh) / 2), bw, bh); }
    }
  }


  /* ---- Səs xətti (Movavi kimi): seçilmiş klipin səs hissəsində ağ xətt + uclarda dairələr ----
     Xətti yuxarı/aşağı çək → səs səviyyəsi; dairəni içəri çək → aydınlanma / qaralma */
  const VOL_TOP = 8, VOL_SPAN = 88; // xəttin hündürlüyü (%): səs 1 → 8%, səs 0 → 96%
  const SVG_NS = 'http://www.w3.org/2000/svg';
  function volUI(clip) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'vol-ui');
    svg.innerHTML = '<line class="vl vl-in"/><line class="vl vl-mid"/><line class="vl vl-out"/><line class="vl-hit"/>'
      + '<circle class="vh vh-in" r="4.5"/><circle class="vh vh-out" r="4.5"/>';
    updateVolUI(svg, clip);
    return svg;
  }
  function updateVolUI(svg, clip) {
    const d = Math.max(clip.duration, 1e-6);
    const fi = clip.fadeIn || 0, fo = clip.fadeOut || 0;
    const a = Math.min(100, fi / d * 100), b = Math.max(0, 100 - fo / d * 100);
    const y = VOL_TOP + (1 - Math.min(1, Math.max(0, clip.volume))) * VOL_SPAN;
    const q = sel => svg.querySelector(sel);
    const line = (el, x1, y1, x2, y2) => { el.setAttribute('x1', x1); el.setAttribute('y1', y1); el.setAttribute('x2', x2); el.setAttribute('y2', y2); };
    line(q('.vl-in'), '0%', '100%', a + '%', y + '%'); q('.vl-in').style.display = fi > 0 ? '' : 'none';
    line(q('.vl-mid'), a + '%', y + '%', b + '%', y + '%');
    line(q('.vl-hit'), a + '%', y + '%', b + '%', y + '%');
    line(q('.vl-out'), b + '%', y + '%', '100%', '100%'); q('.vl-out').style.display = fo > 0 ? '' : 'none';
    const ci = q('.vh-in'), co = q('.vh-out');
    ci.style.setProperty('cx', fi > 0 ? a + '%' : '5px'); ci.style.setProperty('cy', y + '%');
    co.style.setProperty('cx', fo > 0 ? b + '%' : 'calc(100% - 5px)'); co.style.setProperty('cy', y + '%');
  }
  function rerenderClip(clip) {
    const old = content.querySelector(`[data-clip-id="${clip.id}"]`);
    if (old) { const ow = old.querySelector('.clip-wave'); if (ow) waveRO.unobserve(ow); old.replaceWith(renderClip(clip)); }
  }

  /* Sürükləyərkən siçanın yanında kiçik ipucu */
  let tipEl = null;
  function showTip(e, text) {
    if (!text) return;
    if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'tl-tip'; document.body.appendChild(tipEl); }
    tipEl.textContent = text;
    tipEl.style.left = (e.clientX + 14) + 'px';
    tipEl.style.top = (e.clientY - 30) + 'px';
    tipEl.classList.remove('hidden');
  }
  function hideTip() { if (tipEl) tipEl.classList.add('hidden'); }
  function tipText(mode, clip, o) {
    const f = s => Media.fmtTime(s, true);
    if (mode === 'move') return `Başlanğıc ${f(clip.start)}`;
    if (mode === 'trim-l' || mode === 'trim-r') { const d = clip.duration - o.duration; return `${f(clip.duration)}  (${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(2)} s)`; }
    if (mode === 'volume') return clip.volume > 0 ? `Səs ${(20 * Math.log10(clip.volume)).toFixed(1)} dB` : 'Səssiz';
    if (mode === 'fade-in') return `Aydınlanma ${clip.fadeIn.toFixed(2)} s`;
    if (mode === 'fade-out') return `Qaralma ${clip.fadeOut.toFixed(2)} s`;
    return '';
  }

  /* ---- Tam yenidən qurma ---- */
  function render() {
    const p = State.project;
    if (!p) return;
    const width = contentWidth();
    content.style.width = width + 'px';
    renderRuler(width);
    headersEl.innerHTML = '';
    waveRO.disconnect(); // köhnə kətanlar silinir, yeniləri müşahidə olunacaq
    tracksEl.innerHTML = '';
    for (const track of p.tracks) {
      const h = TRACK_H[track.type] || 50;
      const hd = document.createElement('div');
      hd.className = 'track-header';
      hd.style.height = h + 'px';
      hd.dataset.trackId = track.id;
      hd.title = `${track.name} — sağ klik: menyu`;
      hd.innerHTML = `<span class="track-icon" title="${esc(track.name)}">${TRACK_ICON[track.type]}</span>
        <button class="hbtn ${track.hidden ? 'on' : ''}" data-act="hide" title="${track.hidden ? 'Göstər' : 'Gizlət'}">${ICON(track.hidden ? 'eye-off' : 'eye')}</button>
        <button class="hbtn ${track.muted ? 'on' : ''}" data-act="mute" title="${track.muted ? 'Səsi aç' : 'Səssiz et'}">${ICON(track.muted ? 'mute' : 'volume')}</button>`;
      if (track.type === 'audio') hd.querySelector('[data-act=hide]').style.visibility = 'hidden';
      if (track.type === 'text') hd.querySelector('[data-act=mute]').style.visibility = 'hidden';
      headersEl.appendChild(hd);

      const lane = document.createElement('div');
      lane.className = 'track-lane';
      lane.style.height = h + 'px';
      lane.style.opacity = track.hidden ? 0.45 : 1;
      lane.dataset.trackId = track.id;
      lane.dataset.type = track.type;
      for (const clip of track.clips) lane.appendChild(renderClip(clip));
      if (track.type === 'video' && !track.clips.length && track === [...p.tracks].reverse().find(t => t.type === 'video')) {
        const ph = document.createElement('div'); ph.className = 'lane-placeholder'; ph.textContent = 'Faylları bura buraxın'; lane.appendChild(ph);
      }
      tracksEl.appendChild(lane);
    }
    renderAddRow();
    updatePlayhead();
    $('tl-undo').disabled = !State.canUndo;
    $('tl-redo').disabled = !State.canRedo;
  }

  /* ---- Treklərin altında "Yeni trek" sırası ---- */
  const ADD_ROW_H = 44;
  function addTrackMenu(x, y) {
    App.contextMenu(x, y, [
      { label: 'Video / şəkil treki', action: () => App.addTrack('video') },
      { label: 'Mətn treki', action: () => App.addTrack('text') },
      { label: 'Audio treki', action: () => App.addTrack('audio') },
      { sep: true },
      { label: 'Mikrofondan yaz', action: () => Recorder.open('mic') }
    ]);
  }
  function renderAddRow() {
    const hd = document.createElement('div');
    hd.className = 'add-track-head';
    hd.style.height = ADD_ROW_H + 'px';
    hd.innerHTML = `<button class="hbtn" title="Yeni trek əlavə et">${ICON('plus')}</button>`;
    hd.querySelector('button').addEventListener('click', e => {
      const r = e.currentTarget.getBoundingClientRect();
      addTrackMenu(r.right + 4, r.top);
    });
    headersEl.appendChild(hd);

    const lane = document.createElement('div');
    lane.className = 'add-lane';
    lane.style.height = ADD_ROW_H + 'px';
    lane.title = 'Sağ klik: yeni trek əlavə et';
    // Bu sırada çərçivə seçimi və klip menyusu işləməsin
    lane.addEventListener('pointerdown', e => e.stopPropagation());
    lane.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); addTrackMenu(e.clientX, e.clientY); });
    tracksEl.appendChild(lane);
  }

  function refreshSelection() {
    for (const el of content.querySelectorAll('.clip')) el.classList.toggle('selected', State.selection.includes(el.dataset.clipId));
  }

  function updatePlayhead() {
    playheadEl.style.left = t2x(State.playhead) + 'px';
  }
  function followPlayhead() {
    const px = t2x(State.playhead);
    const left = scroll.scrollLeft, w = scroll.clientWidth;
    if (px < left || px > left + w - 30) scroll.scrollLeft = Math.max(0, px - 80);
  }

  /* ---- Maqnit ---- */
  function snapPoints(excludeIds) {
    const pts = [0, State.playhead];
    for (const t of State.project.tracks) for (const c of t.clips) if (!excludeIds.includes(c.id)) pts.push(c.start, c.start + c.duration);
    return pts;
  }
  function snapPoint(t, excludeIds) {
    if (!snap) return t;
    const thr = x2t(SNAP_PX);
    let best = t, bestD = thr;
    for (const p of snapPoints(excludeIds)) { const d = Math.abs(p - t); if (d < bestD) { bestD = d; best = p; } }
    return best;
  }
  function snapRange(start, dur, excludeIds) {
    if (!snap) return start;
    const thr = x2t(SNAP_PX);
    let best = start, bestD = thr;
    for (const p of snapPoints(excludeIds)) {
      const d1 = Math.abs(p - start); if (d1 < bestD) { bestD = d1; best = p; }
      const d2 = Math.abs(p - (start + dur)); if (d2 < bestD) { bestD = d2; best = p - dur; }
    }
    return Math.max(0, best);
  }

  /* ---- Göstərici hadisələri ---- */
  function timeFromEvent(e) {
    const rect = content.getBoundingClientRect();
    return Math.max(0, x2t(e.clientX - rect.left));
  }
  function laneAtY(y) {
    for (const lane of tracksEl.children) {
      const r = lane.getBoundingClientRect();
      if (y >= r.top && y < r.bottom) return lane;
    }
    return null;
  }
  function neighbours(track, clip) {
    let prevEnd = 0, nextStart = Infinity;
    for (const c of track.clips) {
      if (c.id === clip.id) continue;
      const end = c.start + c.duration;
      if (end <= clip.start + 1e-6 && end > prevEnd) prevEnd = end;
      if (c.start >= clip.start + clip.duration - 1e-6 && c.start < nextStart) nextStart = c.start;
    }
    return { prevEnd, nextStart };
  }

  function onClipContext(e) {
    if (suppressCtx) { suppressCtx = false; e.preventDefault(); return; }
    const clipEl = e.target.closest('.clip');
    if (!clipEl) {
      // Boş trek sahəsi: trekin öz menyusu (sil, adını dəyiş, köçür...)
      const laneEl = e.target.closest('.track-lane');
      const track = laneEl && State.findTrack(laneEl.dataset.trackId);
      if (!track) return;
      e.preventDefault();
      trackMenu(track, e.clientX, e.clientY);
      return;
    }
    e.preventDefault();
    const id = clipEl.dataset.clipId;
    if (!State.selection.includes(id)) State.select([id]);
    const canDetach = State.selectedClips().some(c => c.type === 'video' && !c.audioDetached && State.media.get(c.mediaId)?.type === 'video');
    App.contextMenu(e.clientX, e.clientY, [
      { label: 'Böl', shortcut: 'Ctrl+B', action: () => App.splitAtPlayhead() },
      { label: 'Kəs', shortcut: 'Ctrl+X', action: () => App.cutSelected() },
      { label: 'Kopyala', shortcut: 'Ctrl+C', action: () => App.copySelected() },
      { label: 'Dublikat', shortcut: 'Ctrl+D', action: () => App.duplicateSelected() },
      ...(canDetach ? [{ label: 'Səsi ayır', action: () => App.detachAudio() }] : []),
      { sep: true },
      { label: 'Xüsusiyyətlər', action: () => App.showPage('props') },
      { label: 'Keçid əlavə et', action: () => App.showPage('transitions') },
      { sep: true },
      { label: 'Sil', shortcut: 'Delete', danger: true, action: () => App.deleteSelected() }
    ]);
  }

  /* Çərçivə ilə seçim: sağ düymə hər yerdə, sol düymə boş sahədə */
  function startMarquee(e) {
    marquee = { cx: e.clientX, cy: e.clientY, button: e.button, moved: false, additive: e.shiftKey, base: e.shiftKey ? [...State.selection] : [], el: null };
    e.preventDefault();
  }
  function marqueeHits(e) {
    const x1 = Math.min(marquee.cx, e.clientX), x2 = Math.max(marquee.cx, e.clientX);
    const y1 = Math.min(marquee.cy, e.clientY), y2 = Math.max(marquee.cy, e.clientY);
    const ids = [];
    for (const el of tracksEl.querySelectorAll('.clip')) {
      const r = el.getBoundingClientRect();
      if (r.left < x2 && r.right > x1 && r.top < y2 && r.bottom > y1) ids.push(el.dataset.clipId);
    }
    return [...new Set([...marquee.base, ...ids])];
  }
  function updateMarquee(e) {
    const rect = content.getBoundingClientRect();
    if (!marquee.el) { marquee.el = document.createElement('div'); marquee.el.className = 'marquee'; content.appendChild(marquee.el); }
    const x1 = Math.min(marquee.cx, e.clientX) - rect.left, x2 = Math.max(marquee.cx, e.clientX) - rect.left;
    const y1 = Math.min(marquee.cy, e.clientY) - rect.top, y2 = Math.max(marquee.cy, e.clientY) - rect.top;
    Object.assign(marquee.el.style, { left: x1 + 'px', top: y1 + 'px', width: (x2 - x1) + 'px', height: (y2 - y1) + 'px' });
    const ids = marqueeHits(e);
    for (const el of tracksEl.querySelectorAll('.clip')) el.classList.toggle('selected', ids.includes(el.dataset.clipId));
  }

  function onPointerDown(e) {
    if (e.button === 2) { startMarquee(e); return; }
    if (e.button !== 0) return;
    const clipEl = e.target.closest('.clip');
    if (!clipEl) { startMarquee(e); return; }
    const id = clipEl.dataset.clipId;
    const found = State.findClip(id);
    if (!found) return;
    const { clip, track } = found;
    if (e.shiftKey) State.select([id], true);
    else if (!State.selection.includes(id)) State.select([id]);
    const tc = e.target.classList;
    const mode = tc.contains('vh-in') ? 'fade-in' : tc.contains('vh-out') ? 'fade-out' : tc.contains('vl-hit') ? 'volume'
      : tc.contains('clip-handle') ? (tc.contains('left') ? 'trim-l' : 'trim-r') : 'move';
    const origs = new Map();
    for (const c of State.selectedClips()) origs.set(c.id, { start: c.start, trackId: c.trackId });
    drag = {
      mode, id, startX: e.clientX, startY: e.clientY, moved: false,
      volRect: /^(volume|fade)/.test(mode) ? clipEl.querySelector('.vol-ui').getBoundingClientRect() : null,
      orig: JSON.parse(JSON.stringify(clip)), origTrackId: track.id, origs,
      prevEnd: 0, nextStart: Infinity
    };
    Object.assign(drag, neighbours(track, clip));
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (scrubbing) { Renderer.seek(timeFromEvent(e)); return; }
    if (marquee) {
      if (!marquee.moved) { if (Math.hypot(e.clientX - marquee.cx, e.clientY - marquee.cy) < 4) return; marquee.moved = true; }
      updateMarquee(e);
      return;
    }
    if (!drag) return;
    if (!drag.moved) {
      if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 3) return;
      drag.moved = true;
      if (/^(trim|fade)/.test(drag.mode)) document.body.classList.add('tl-drag-ew');
      else if (drag.mode === 'volume') document.body.classList.add('tl-drag-ns');
      State.pushHistory();
      const el = content.querySelector(`[data-clip-id="${drag.id}"]`);
      el && el.classList.add('dragging');
    }
    const dx = x2t(e.clientX - drag.startX);
    const found = State.findClip(drag.id);
    if (!found) return;
    const { clip, track } = found;
    const o = drag.orig;

    if (drag.mode === 'move') {
      const group = State.selectedClips().filter(c => drag.origs.has(c.id));
      const ids = group.map(c => c.id);
      let newStart = Math.max(0, o.start + dx);
      newStart = snapRange(newStart, o.duration, ids);
      let delta = newStart - o.start;
      const minOrig = Math.min(...group.map(c => drag.origs.get(c.id).start));
      if (minOrig + delta < 0) delta = -minOrig;

      // tək klip: trek dəyişikliyi
      let targetTrack = track;
      if (group.length === 1) {
        const lane = laneAtY(e.clientY);
        if (lane && lane.dataset.trackId !== track.id) {
          const cand = State.findTrack(lane.dataset.trackId);
          if (cand && State.trackAccepts(cand, clip.type)) targetTrack = cand;
        }
      }
      // toqquşma yoxlaması
      let ok = true;
      for (const c of group) {
        const tr = c.id === clip.id ? targetTrack : State.findTrack(c.trackId);
        const s = drag.origs.get(c.id).start + delta;
        const end = s + c.duration;
        // seçilmiş qrupdakı kliplər bir-biri ilə toqquşma sayılmır
        const others = tr.clips.filter(x => !ids.includes(x.id));
        if (others.some(x => s < x.start + x.duration - 1e-6 && end > x.start + 1e-6)) { ok = false; break; }
      }
      if (!ok) return;
      for (const c of group) {
        c.start = drag.origs.get(c.id).start + delta;
        const el = content.querySelector(`[data-clip-id="${c.id}"]`);
        el && positionClipEl(el, c);
      }
      if (targetTrack !== track) {
        track.clips = track.clips.filter(c => c.id !== clip.id);
        clip.trackId = targetTrack.id;
        targetTrack.clips.push(clip);
        const el = content.querySelector(`[data-clip-id="${clip.id}"]`);
        const lane = tracksEl.querySelector(`[data-track-id="${targetTrack.id}"]`);
        if (el && lane) lane.appendChild(el);
      }
    } else if (drag.mode === 'trim-l') {
      let d = dx;
      d = Math.max(d, drag.prevEnd - o.start);
      d = Math.min(d, o.duration - State.MIN_CLIP);
      if (clip.type === 'video' || clip.type === 'audio') d = Math.max(d, -o.in / o.speed);
      let ns = snapPoint(o.start + d, [clip.id]);
      d = State.clamp(ns - o.start, Math.max(drag.prevEnd - o.start, (clip.type === 'video' || clip.type === 'audio') ? -o.in / o.speed : -Infinity), o.duration - State.MIN_CLIP);
      clip.start = o.start + d;
      clip.duration = o.duration - d;
      clip.in = o.in + d * o.speed;
      const el = content.querySelector(`[data-clip-id="${clip.id}"]`);
      el && positionClipEl(el, clip);
    } else if (drag.mode === 'trim-r') {
      let d = dx;
      const maxDur = Math.min(State.maxDuration(o), drag.nextStart - o.start);
      let nd = o.duration + d;
      nd = snapPoint(o.start + nd, [clip.id]) - o.start;
      nd = State.clamp(nd, State.MIN_CLIP, maxDur);
      clip.duration = nd;
      const el = content.querySelector(`[data-clip-id="${clip.id}"]`);
      el && positionClipEl(el, clip);
    } else if (drag.mode === 'volume') {
      const r = drag.volRect;
      let v = State.clamp(1 - ((e.clientY - r.top) / r.height * 100 - VOL_TOP) / VOL_SPAN, 0, 1);
      if (v < 0.005) v = 0;
      clip.volume = Math.round(v * 1000) / 1000;
      rerenderClip(clip);
    } else if (drag.mode === 'fade-in' || drag.mode === 'fade-out') {
      const r = drag.volRect;
      const frac = drag.mode === 'fade-in' ? (e.clientX - r.left) / r.width : (r.right - e.clientX) / r.width;
      const other = drag.mode === 'fade-in' ? clip.fadeOut : clip.fadeIn;
      let f = State.clamp(frac * clip.duration, 0, Math.max(0, clip.duration - other));
      f = f < 0.05 ? 0 : Math.round(f * 100) / 100;
      if (drag.mode === 'fade-in') clip.fadeIn = f; else clip.fadeOut = f;
      rerenderClip(clip);
    }
    showTip(e, tipText(drag.mode, clip, o));
    if (Renderer.playing) return;
    // Kənarı çəkəndə önizləmədə kəsilən yerin kadrı görünsün (narıncı başlıq yerində qalır)
    if (drag.mode === 'trim-l') Renderer.previewAt(clip.start + 0.001);
    else if (drag.mode === 'trim-r') Renderer.previewAt(Math.max(clip.start, clip.start + clip.duration - 1 / (State.project.fps || 30)));
    else Renderer.refresh();
  }

  function onPointerUp(e) {
    if (scrubbing) { scrubbing = false; return; }
    if (marquee) {
      const m = marquee;
      const hits = m.moved ? marqueeHits(e) : [];
      marquee = null;
      if (m.el) m.el.remove();
      if (m.moved) { State.select(hits); suppressCtx = m.button === 2; }
      else if (m.button === 0) { if (!m.additive) State.select([]); Renderer.seek(timeFromEvent(e)); }
      return;
    }
    if (!drag) return;
    hideTip();
    Renderer.endPreview();
    document.body.classList.remove('tl-drag-ew', 'tl-drag-ns');
    const moved = drag.moved, mode = drag.mode;
    const found = State.findClip(drag.id);
    drag = null;
    // Klipə klik (sürükləmədən): narıncı başlıq klik edilən yerə gəlsin
    if (!moved && mode === 'move' && e.button === 0) Renderer.seek(timeFromEvent(e));
    if (moved) {
      if (found) State.sortTrack(found.track);
      for (const t of State.project.tracks) State.sortTrack(t);
      State.emit('structure');
    }
  }

  /* ---- Trek başlıqları ---- */
  function onHeaderClick(e) {
    const btn = e.target.closest('.hbtn');
    const hd = e.target.closest('.track-header');
    if (!hd) return;
    const track = State.findTrack(hd.dataset.trackId);
    if (!track) return;
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'mute') State.mutate(() => { track.muted = !track.muted; });
    else if (act === 'hide') State.mutate(() => { track.hidden = !track.hidden; });
  }
  function removeTrack(track) {
    const doRemove = () => State.mutate(p => { p.tracks = p.tracks.filter(t => t.id !== track.id); State.pruneSelection(); });
    if (track.clips.length) App.confirm('Treki sil', `"${track.name}" trekində ${track.clips.length} klip var. Silinsin?`, doRemove);
    else doRemove();
  }
  function onHeaderContext(e) {
    const hd = e.target.closest('.track-header');
    if (!hd) return;
    e.preventDefault();
    const track = State.findTrack(hd.dataset.trackId);
    if (!track) return;
    trackMenu(track, e.clientX, e.clientY);
  }
  function trackMenu(track, x, y) {
    App.contextMenu(x, y, [
      { label: 'Adını dəyiş', action: () => App.prompt('Trekin adı', track.name, v => State.mutate(() => { track.name = v; })) },
      { label: track.muted ? 'Səsi aç' : 'Səssiz et', action: () => State.mutate(() => { track.muted = !track.muted; }) },
      { label: track.hidden ? 'Göstər' : 'Gizlət', action: () => State.mutate(() => { track.hidden = !track.hidden; }) },
      { sep: true },
      { label: 'Yuxarı köçür', action: () => State.mutate(p => { const i = p.tracks.indexOf(track); if (i > 0) { p.tracks.splice(i, 1); p.tracks.splice(i - 1, 0, track); } }) },
      { label: 'Aşağı köçür', action: () => State.mutate(p => { const i = p.tracks.indexOf(track); if (i < p.tracks.length - 1) { p.tracks.splice(i, 1); p.tracks.splice(i + 1, 0, track); } }) },
      { sep: true },
      { label: 'Treki sil', danger: true, action: () => removeTrack(track) }
    ]);
  }
  /* ---- Sürüklə-burax (kitabxanadan və fayl sistemindən) ---- */
  function onDragOver(e) {
    const types = e.dataTransfer.types;
    if (!types.includes('application/x-ksy-media') && !types.includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    for (const l of tracksEl.children) l.classList.remove('drag-over');
    const lane = e.target.closest('.track-lane');
    lane && lane.classList.add('drag-over');
  }
  function onDragLeave() { for (const l of tracksEl.children) l.classList.remove('drag-over'); }
  async function onDrop(e) {
    e.preventDefault();
    onDragLeave();
    const t = timeFromEvent(e);
    const lane = e.target.closest('.track-lane');
    const trackId = lane ? lane.dataset.trackId : null;
    const mediaId = e.dataTransfer.getData('application/x-ksy-media');
    if (mediaId) { Media.addToTimeline(mediaId, t, trackId); return; }
    if (e.dataTransfer.files && e.dataTransfer.files.length) {
      const before = new Set(State.media.keys());
      await Media.importFiles(await Media.filesFromDrop(e.dataTransfer));
      let at = t;
      for (const id of State.media.keys()) if (!before.has(id)) { Media.addToTimeline(id, at, trackId); at = State.duration(); }
    }
  }

  /* ---- Miqyas / sürüşmə ---- */
  function setZoom(v, anchorClientX = null) {
    const old = pxPerSec;
    v = State.clamp(v, 8, 400);
    if (v === old) return;
    let tAt = null, offset = 0;
    if (anchorClientX != null) {
      const rect = content.getBoundingClientRect();
      tAt = (anchorClientX - rect.left) / old;
      offset = anchorClientX - scroll.getBoundingClientRect().left;
    }
    pxPerSec = v;
    $('tl-zoom').value = v;
    render();
    if (tAt != null) scroll.scrollLeft = Math.max(0, tAt * pxPerSec - offset);
  }
  function onWheel(e) {
    if (e.ctrlKey) {
      e.preventDefault();
      setZoom(pxPerSec * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX);
    } else if (!e.shiftKey && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      scroll.scrollLeft += e.deltaY;
    }
  }
  function zoomToFit() {
    const dur = Math.max(1, State.duration());
    setZoom((scroll.clientWidth - 40) / dur);
  }

  function init() {
    tracksEl.addEventListener('pointerdown', onPointerDown);
    tracksEl.addEventListener('contextmenu', onClipContext);
    ruler.addEventListener('pointerdown', e => { if (e.button === 0) { scrubbing = true; Renderer.seek(timeFromEvent(e)); } });
    playheadEl.querySelector('.playhead-head').addEventListener('pointerdown', e => { if (e.button === 0) { scrubbing = true; e.preventDefault(); } });
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    headersEl.addEventListener('click', onHeaderClick);
    headersEl.addEventListener('contextmenu', onHeaderContext);
    scroll.addEventListener('dragover', onDragOver);
    scroll.addEventListener('dragleave', onDragLeave);
    scroll.addEventListener('drop', onDrop);
    scroll.addEventListener('wheel', onWheel, { passive: false });
    // Ağ xətt siçanı izləyir (seçmir); narıncı başlıq son seçilən yerdə qalır
    scroll.addEventListener('pointermove', e => {
      if (scrubbing) { hoverEl.classList.add('hidden'); return; }
      const x = e.clientX - content.getBoundingClientRect().left;
      if (x < 0) { hoverEl.classList.add('hidden'); return; }
      hoverEl.style.left = x + 'px';
      hoverEl.classList.remove('hidden');
    });
    scroll.addEventListener('pointerleave', () => hoverEl.classList.add('hidden'));
    scroll.addEventListener('scroll', () => { headersEl.style.transform = `translateY(${-scroll.scrollTop}px)`; });
    $('tl-zoom').addEventListener('input', e => setZoom(+e.target.value));
    $('tl-snap').addEventListener('click', () => { snap = !snap; $('tl-snap').classList.toggle('on', snap); });
    new ResizeObserver(() => { if (State.project) render(); }).observe(scroll);
  }

  return { init, render, refreshSelection, updatePlayhead, followPlayhead, setZoom, zoomToFit, get pxPerSec() { return pxPerSec; }, get snap() { return snap; }, setSnap(v) { snap = v; $('tl-snap').classList.toggle('on', snap); } };
})();
