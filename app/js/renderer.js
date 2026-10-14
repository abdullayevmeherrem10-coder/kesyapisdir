/* ===== Kəsyapışdır — kanvas kompozitoru: kliplər, keçidlər, maska, xroma, animasiya, səs qrafı ===== */
const Renderer = (() => {
  const canvas = document.getElementById('preview');
  const ctx = canvas.getContext('2d');
  const elements = new Map(); // clipId -> { el, type, mediaId, gain, src }
  let audioCtx = null, master = null, monitorGain = null, streamDest = null, analyserL = null, analyserR = null, splitter = null;
  let playing = false, startWall = 0, startT = 0, rafId = 0;
  let exporting = false;
  const hooks = { onTime: null, onEnded: null, onPlayState: null, onDraw: null };
  const layers = {}; // ehtiyat kanvaslar

  /* ---- Səs ---- */
  function ensureAudio() {
    if (!audioCtx) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        master = audioCtx.createGain();
        monitorGain = audioCtx.createGain();
        master.connect(monitorGain);
        monitorGain.connect(audioCtx.destination);
        splitter = audioCtx.createChannelSplitter(2);
        analyserL = audioCtx.createAnalyser(); analyserR = audioCtx.createAnalyser();
        analyserL.fftSize = 1024; analyserR.fftSize = 1024;
        master.connect(splitter);
        splitter.connect(analyserL, 0); splitter.connect(analyserR, 1);
      } catch (e) { console.warn('AudioContext yaradılmadı', e); return; }
    }
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    for (const e of elements.values()) if (e.type !== 'image' && !e.gain) attachAudio(e);
  }
  function attachAudio(e) {
    if (!audioCtx) return;
    try {
      e.src = audioCtx.createMediaElementSource(e.el);
      e.gain = audioCtx.createGain();
      e.src.connect(e.gain);
      e.gain.connect(master);
    } catch (err) { console.warn('Səs qoşulmadı', err); }
  }
  function getAudioStream() {
    ensureAudio();
    if (!audioCtx) return null;
    if (!streamDest) { streamDest = audioCtx.createMediaStreamDestination(); master.connect(streamDest); }
    return streamDest.stream;
  }
  let monitorOn = true;
  function setMonitor(on) { monitorOn = on; if (monitorGain) monitorGain.gain.value = on ? 1 : 0; }
  const buf = new Float32Array(1024);
  function levelOf(an) {
    if (!an) return -60;
    an.getFloatTimeDomainData(buf);
    let peak = 0;
    for (let i = 0; i < buf.length; i++) { const v = buf[i] < 0 ? -buf[i] : buf[i]; if (v > peak) peak = v; }
    return peak > 0 ? Math.max(-60, 20 * Math.log10(peak)) : -60;
  }
  function getLevels() { return [levelOf(analyserL), levelOf(analyserR)]; }

  /* ---- Media elementləri ---- */
  function destroyEl(e) {
    try {
      if (e.el.pause) { e.el.pause(); e.el.removeAttribute('src'); e.el.load(); }
      if (e.src) e.src.disconnect();
      if (e.gain) e.gain.disconnect();
    } catch { /* boş */ }
  }
  function getElement(clip) {
    let e = elements.get(clip.id);
    if (e && e.mediaId === clip.mediaId) return e;
    if (e) { destroyEl(e); elements.delete(clip.id); }
    const m = State.media.get(clip.mediaId);
    if (!m) return null;
    if (m.type === 'image') {
      const img = new Image();
      img.onload = () => { if (!playing) draw(State.playhead); };
      img.src = m.url;
      e = { el: img, type: 'image', mediaId: m.id };
    } else {
      const el = document.createElement(m.type === 'audio' ? 'audio' : 'video');
      el.preload = 'auto';
      el.playsInline = true;
      el.src = m.url;
      el.addEventListener('seeked', () => { if (!playing) draw(State.playhead); });
      el.addEventListener('loadeddata', () => { if (!playing) draw(State.playhead); });
      e = { el, type: m.type, mediaId: m.id, gain: null, src: null };
      if (audioCtx) attachAudio(e);
    }
    elements.set(clip.id, e);
    return e;
  }
  function cleanupElements() {
    const ids = new Set();
    for (const t of State.project.tracks) for (const c of t.clips) ids.add(c.id);
    for (const [id, e] of elements) if (!ids.has(id)) { destroyEl(e); elements.delete(id); }
  }

  /* ---- Köməkçilər ---- */
  const clamp01 = v => Math.max(0, Math.min(1, v));
  function fadeFactor(clip, t, extended = false) {
    const local = t - clip.start;
    let f = 1;
    if (clip.fadeIn > 0 && local < clip.fadeIn) f = Math.min(f, local / clip.fadeIn);
    if (!extended) {
      const rem = clip.duration - local;
      if (clip.fadeOut > 0 && rem < clip.fadeOut) f = Math.min(f, rem / clip.fadeOut);
    }
    return clamp01(f);
  }
  /* Keçid müddəti: bu klipdən növbəti qonşu klipə */
  function transitionOf(clip) {
    if (!clip.transition || clip.type === 'audio') return null;
    const next = State.nextAdjacent(clip);
    if (!next) return null;
    const d = Math.min(clip.transition.duration, next.duration, 5);
    return { next, d, type: clip.transition.type };
  }
  function filterString(clip) {
    const f = clip.filters || {};
    const r = clip.retouch && clip.retouch.enabled ? clip.retouch : null;
    let b = f.brightness ?? 100, c = f.contrast ?? 100, s = f.saturate ?? 100;
    if (r) { b += r.whiten * 0.25; s -= r.whiten * 0.3; c += r.clarity * 0.5; }
    const parts = [];
    if (b !== 100) parts.push(`brightness(${b}%)`);
    if (c !== 100) parts.push(`contrast(${c}%)`);
    if (s !== 100) parts.push(`saturate(${Math.max(0, s)}%)`);
    if (f.grayscale) parts.push(`grayscale(${f.grayscale}%)`);
    if (f.sepia) parts.push(`sepia(${f.sepia}%)`);
    if (f.blur) parts.push(`blur(${f.blur}px)`);
    if (f.hue) parts.push(`hue-rotate(${f.hue}deg)`);
    return parts.length ? parts.join(' ') : 'none';
  }
  const inRange = (clip, t) => t >= clip.start && t < clip.start + clip.duration;
  function layer(name, W, H) {
    let c = layers[name];
    if (!c) { c = document.createElement('canvas'); layers[name] = c; }
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    return c;
  }

  /* ---- Media sinxronizasiyası ---- */
  function syncMedia(t, isPlaying) {
    const p = State.project;
    if (!p) return;
    for (const track of p.tracks) {
      for (const clip of track.clips) {
        if (clip.type === 'text') continue;
        const e = getElement(clip);
        if (!e || e.type === 'image') continue;
        const el = e.el;
        const tr = transitionOf(clip);
        const end = clip.start + clip.duration + (tr ? tr.d : 0);
        if (t >= clip.start && t < end) {
          const extended = t >= clip.start + clip.duration;
          let target = clip.in + (t - clip.start) * clip.speed;
          if (clip.srcDuration) target = Math.min(target, clip.srcDuration - 0.05);
          const m = State.media.get(clip.mediaId);
          const norm = clip.normalize && m && m.peakMax ? Math.min(4, 0.9 / m.peakMax) : 1;
          const vol = (track.muted ? 0 : 1) * clip.volume * norm * fadeFactor(clip, t, extended) * (extended ? 0.0001 : 1);
          if (e.gain) e.gain.gain.value = vol; else el.volume = clamp01(vol);
          el.muted = false;
          if ('preservesPitch' in el) el.preservesPitch = clip.preservesPitch !== false;
          if (isPlaying) {
            const rate = State.clamp(clip.speed, 0.0625, 16);
            if (el.playbackRate !== rate) el.playbackRate = rate;
            if (Math.abs(el.currentTime - target) > 0.3) el.currentTime = target;
            if (el.paused) el.play().catch(() => {});
          } else {
            if (!el.paused) el.pause();
            if (Math.abs(el.currentTime - target) > 0.04) el.currentTime = target;
          }
        } else {
          if (!el.paused) el.pause();
          const until = clip.start - t;
          if (until > 0 && until < 3 && Math.abs(el.currentTime - clip.in) > 0.05) el.currentTime = clip.in;
        }
      }
    }
  }

  /* ---- Animasiya (giriş/çıxış) ---- */
  const easeOut = p => 1 - Math.pow(1 - p, 3);
  function animState(clip, t, W, H, extended) {
    const st = { alpha: 1, dx: 0, dy: 0, sc: 1, rot: 0 };
    const a = clip.anim;
    if (!a) return st;
    const local = t - clip.start;
    const apply = (type, q) => {
      switch (type) {
        case 'fade': st.alpha *= 1 - q; break;
        case 'slide-left': st.dx -= W * q; break;
        case 'slide-right': st.dx += W * q; break;
        case 'slide-up': st.dy -= H * q; break;
        case 'slide-down': st.dy += H * q; break;
        case 'zoom-in': st.sc *= 1 - 0.9 * q; st.alpha *= 1 - q * 0.5; break;
        case 'zoom-out': st.sc *= 1 + 1.2 * q; st.alpha *= 1 - q; break;
        case 'spin': st.rot += 360 * q; st.sc *= 1 - q; st.alpha *= 1 - q; break;
        case 'bounce': st.dy -= H * 0.3 * Math.sin(q * Math.PI); st.sc *= 1 - 0.3 * q; break;
        default: break;
      }
    };
    if (a.in && a.in.type !== 'none' && a.in.duration > 0 && local < a.in.duration) apply(a.in.type, 1 - easeOut(local / a.in.duration));
    if (!extended && a.out && a.out.type !== 'none' && a.out.duration > 0) {
      const rem = clip.duration - local;
      if (rem < a.out.duration) apply(a.out.type, 1 - easeOut(rem / a.out.duration));
    }
    return st;
  }

  /* ---- Mətn ---- */
  function drawText(c, clip) {
    const tx = clip.text;
    const size = tx.size;
    c.font = `${tx.italic ? 'italic ' : ''}${tx.bold ? 'bold ' : ''}${size}px ${tx.font}`;
    c.textBaseline = 'middle';
    c.textAlign = tx.align;
    if ('letterSpacing' in c) c.letterSpacing = `${tx.letterSpacing || 0}px`;
    const lines = String(tx.content || '').split('\n');
    const lh = size * 1.25;
    const total = lh * lines.length;
    let maxW = 0;
    for (const l of lines) maxW = Math.max(maxW, c.measureText(l).width);
    const pad = size * 0.3;
    if (tx.bg) {
      c.fillStyle = tx.bg;
      const x = -maxW / 2 - pad, y = -total / 2 - pad / 2, w = maxW + pad * 2, h = total + pad, r = size * 0.2;
      c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); c.fill();
    }
    const x = tx.align === 'left' ? -maxW / 2 : tx.align === 'right' ? maxW / 2 : 0;
    if (tx.shadow) { c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = size * 0.12; c.shadowOffsetY = size * 0.05; }
    lines.forEach((line, i) => {
      const y = -total / 2 + lh * (i + 0.5);
      if (tx.strokeWidth > 0) { c.lineJoin = 'round'; c.lineWidth = tx.strokeWidth; c.strokeStyle = tx.stroke; c.strokeText(line, x, y); }
      c.fillStyle = tx.color;
      c.fillText(line, x, y);
    });
    c.shadowColor = 'transparent'; c.shadowBlur = 0; c.shadowOffsetY = 0;
  }

  function fitSize(sw, sh, W, H, fit) {
    const sr = sw / sh, cr = W / H;
    const widthLimited = (sr > cr) !== (fit === 'cover');
    return widthLimited ? [W, W / sr] : [H * sr, H];
  }
  function hexToRgb(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  /* İş kanvası: media + rötuş + xroma açarı + temperatur + maska (kadr koordinatlarında, mərkəzləşmiş) */
  function prepareWork(clip, el, sw, sh, W, H) {
    const work = layer('work', W, H);
    const w = work.getContext('2d');
    w.setTransform(1, 0, 0, 1, 0, 0);
    w.globalCompositeOperation = 'source-over';
    w.globalAlpha = 1;
    w.clearRect(0, 0, W, H);
    const [dw, dh] = fitSize(sw, sh, W, H, clip.fit);
    const x = (W - dw) / 2, y = (H - dh) / 2;
    w.filter = filterString(clip);
    try { w.drawImage(el, x, y, dw, dh); } catch { return null; }
    w.filter = 'none';
    const r = clip.retouch;
    if (r && r.enabled && r.smooth > 0) {
      // yumşaq dəri: bulanıq surəti üstündən şəffaf çək
      w.save();
      w.globalAlpha = r.smooth / 100 * 0.85;
      w.filter = `blur(${(2 + r.smooth / 100 * 6) * (W / 1920)}px)`;
      w.globalCompositeOperation = 'source-atop';
      w.drawImage(work, 0, 0);
      w.restore();
    }
    const warm = (r && r.enabled ? r.warmth : 0) + (clip.temperature || 0);
    if (warm) {
      w.save();
      w.globalCompositeOperation = 'source-atop';
      w.globalAlpha = Math.min(1, Math.abs(warm) / 100) * 0.35;
      w.fillStyle = warm > 0 ? 'rgb(255,150,40)' : 'rgb(40,130,255)';
      w.fillRect(x, y, dw, dh);
      w.restore();
    }
    const ch = clip.chroma;
    if (ch && ch.enabled) {
      const img = w.getImageData(Math.floor(x), Math.floor(y), Math.ceil(dw), Math.ceil(dh));
      const d = img.data;
      const [kr, kg, kb] = hexToRgb(ch.color);
      const tol = ch.tolerance / 100 * 255 * 1.2, soft = Math.max(1, ch.softness / 100 * 120);
      for (let i = 0; i < d.length; i += 4) {
        const dr = d[i] - kr, dg = d[i + 1] - kg, db = d[i + 2] - kb;
        const dist = Math.sqrt(dr * dr + dg * dg + db * db);
        if (dist < tol) d[i + 3] = 0;
        else if (dist < tol + soft) d[i + 3] = Math.round(d[i + 3] * (dist - tol) / soft);
      }
      w.putImageData(img, Math.floor(x), Math.floor(y));
    }
    const mk = clip.mask;
    if (mk && mk.type !== 'none') {
      const m = layer('mask', W, H);
      const mc = m.getContext('2d');
      mc.setTransform(1, 0, 0, 1, 0, 0);
      mc.clearRect(0, 0, W, H);
      const feather = (mk.feather / 100) * Math.min(W, H) * 0.25;
      mc.filter = feather > 0 ? `blur(${feather}px)` : 'none';
      mc.fillStyle = '#000';
      const cx = W / 2 + (mk.x || 0), cy = H / 2 + (mk.y || 0);
      const s = mk.size / 100;
      mc.beginPath();
      if (mk.type === 'circle') mc.arc(cx, cy, s * Math.min(W, H) * 0.6 + 1, 0, Math.PI * 2);
      else if (mk.type === 'rect') mc.rect(cx - W * s * 0.5, cy - H * s * 0.5, W * s, H * s);
      else if (mk.type === 'linear') mc.rect(-W, -H, W * 3, H + cy);
      else if (mk.type === 'heart') {
        const r = s * Math.min(W, H) * 0.35;
        mc.moveTo(cx, cy + r * 0.9);
        mc.bezierCurveTo(cx - r * 1.5, cy - r * 0.2, cx - r * 0.9, cy - r * 1.3, cx, cy - r * 0.5);
        mc.bezierCurveTo(cx + r * 0.9, cy - r * 1.3, cx + r * 1.5, cy - r * 0.2, cx, cy + r * 0.9);
      } else if (mk.type === 'star') {
        const R = s * Math.min(W, H) * 0.6, r = R * 0.45;
        for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const rr = i % 2 ? r : R; mc.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
      }
      mc.closePath(); mc.fill();
      mc.filter = 'none';
      w.globalCompositeOperation = mk.invert ? 'destination-out' : 'destination-in';
      w.drawImage(m, 0, 0);
      w.globalCompositeOperation = 'source-over';
    }
    return work;
  }

  /* Klipi verilmiş kontekstə (W×H) çək */
  function drawClipTo(c, clip, t, W, H, extended = false) {
    const st = animState(clip, t, W, H, extended);
    const alpha = clip.opacity * fadeFactor(clip, t, extended) * st.alpha;
    if (alpha <= 0) return;
    c.save();
    c.globalAlpha = alpha;
    c.globalCompositeOperation = clip.blend || 'source-over';
    c.translate(W / 2 + clip.x + st.dx, H / 2 + clip.y + st.dy);
    c.rotate((clip.rotation + st.rot) * Math.PI / 180);
    const sy = clip.lockScale === false ? clip.scaleY : clip.scale;
    c.scale(clip.scale * st.sc * (clip.flipH ? -1 : 1), sy * st.sc);
    if (clip.type === 'text') {
      c.filter = 'none';
      drawText(c, clip);
    } else {
      const e = getElement(clip);
      const el = e && e.el;
      const sw = el && (el.videoWidth || el.naturalWidth), sh = el && (el.videoHeight || el.naturalHeight);
      if (sw && sh) {
        const needWork = (clip.chroma && clip.chroma.enabled) || (clip.mask && clip.mask.type !== 'none') ||
          (clip.retouch && clip.retouch.enabled && (clip.retouch.smooth > 0 || clip.retouch.warmth)) || clip.temperature;
        if (needWork) {
          const work = prepareWork(clip, el, sw, sh, W, H);
          c.filter = 'none';
          if (work) c.drawImage(work, -W / 2, -H / 2);
        } else {
          c.filter = filterString(clip);
          const [dw, dh] = fitSize(sw, sh, W, H, clip.fit);
          try { c.drawImage(el, -dw / 2, -dh / 2, dw, dh); } catch { /* kadr hazır deyil */ }
        }
      } else if (!e) {
        c.filter = 'none';
        c.fillStyle = '#3a2a2a'; c.fillRect(-W / 2, -H / 2, W, H);
        c.fillStyle = '#fff'; c.font = `${H / 18}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText('Media tapılmadı', 0, 0);
      }
    }
    c.restore();
    if (clip.vignette > 0 && clip.type !== 'text') {
      c.save();
      const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) / 2);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${clip.vignette / 100})`);
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      c.restore();
    }
  }

  function drawBlurBackground(clip, t, W, H) {
    const e = getElement(clip);
    const el = e && e.el;
    const sw = el && (el.videoWidth || el.naturalWidth), sh = el && (el.videoHeight || el.naturalHeight);
    if (!sw || !sh) return;
    ctx.save();
    ctx.filter = `blur(${Math.round(W / 40)}px) brightness(70%)`;
    const [dw, dh] = fitSize(sw, sh, W, H, 'cover');
    ctx.translate(W / 2, H / 2);
    try { ctx.drawImage(el, -dw / 2 * 1.1, -dh / 2 * 1.1, dw * 1.1, dh * 1.1); } catch { /* boş */ }
    ctx.restore();
  }

  /* Tam kadr */
  function renderFrame(c, t, W, H) {
    const p = State.project;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.filter = 'none';
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = p.bg || '#000';
    c.fillRect(0, 0, W, H);
    let first = true;
    for (let i = p.tracks.length - 1; i >= 0; i--) {
      const track = p.tracks[i];
      if (track.hidden || track.type === 'audio') continue;
      const clips = track.clips;
      for (let k = 0; k < clips.length; k++) {
        const clip = clips[k];
        if (!inRange(clip, t)) continue;
        if (first && p.bgBlur && clip.type !== 'text' && c === ctx) drawBlurBackground(clip, t, W, H);
        first = false;
        const prev = k > 0 ? clips[k - 1] : null;
        const tr = prev ? transitionOf(prev) : null;
        if (tr && tr.next === clip && t < clip.start + tr.d) {
          const A = layer('A', W, H), B = layer('B', W, H);
          const ca = A.getContext('2d'), cb = B.getContext('2d');
          ca.setTransform(1, 0, 0, 1, 0, 0); cb.setTransform(1, 0, 0, 1, 0, 0);
          ca.globalCompositeOperation = 'source-over'; cb.globalCompositeOperation = 'source-over';
          ca.clearRect(0, 0, W, H); cb.clearRect(0, 0, W, H);
          drawClipTo(ca, prev, t, W, H, true);
          drawClipTo(cb, clip, t, W, H, false);
          c.save();
          Transitions.draw(c, tr.type, A, B, (t - clip.start) / tr.d, W, H);
          c.restore();
        } else {
          drawClipTo(c, clip, t, W, H, false);
        }
      }
    }
  }

  function draw(t) {
    const p = State.project;
    if (!p) return;
    const W = p.width, H = p.height;
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    renderFrame(ctx, t, W, H);
    hooks.onDraw && hooks.onDraw(t);
  }
  /* Başqa kanvasa kadr çək (qapaq, kadr şəkli) */
  function renderTo(target, t) {
    const p = State.project;
    target.width = p.width; target.height = p.height;
    renderFrame(target.getContext('2d'), t, p.width, p.height);
  }

  /* ---- Oynatma ---- */
  function loop() {
    if (!playing) return;
    const dur = State.duration();
    let t = startT + (performance.now() - startWall) / 1000;
    if (t >= dur) {
      State.playhead = dur;
      syncMedia(dur, false);
      draw(dur);
      hooks.onTime && hooks.onTime(dur);
      playing = false;
      hooks.onPlayState && hooks.onPlayState(false);
      hooks.onEnded && hooks.onEnded();
      return;
    }
    State.playhead = t;
    syncMedia(t, true);
    draw(t);
    hooks.onTime && hooks.onTime(t);
    rafId = requestAnimationFrame(loop);
  }
  function play() {
    if (playing) return;
    ensureAudio();
    if (State.duration() <= 0) return;
    if (State.playhead >= State.duration() - 0.01) State.playhead = 0;
    playing = true;
    startWall = performance.now();
    startT = State.playhead;
    hooks.onPlayState && hooks.onPlayState(true);
    loop();
  }
  function pause() {
    if (!playing) return;
    playing = false;
    cancelAnimationFrame(rafId);
    syncMedia(State.playhead, false);
    draw(State.playhead);
    hooks.onPlayState && hooks.onPlayState(false);
  }
  function toggle() { playing ? pause() : play(); }
  function seek(t) {
    t = State.clamp(t, 0, Math.max(0, State.duration()));
    State.playhead = t;
    if (playing) { startWall = performance.now(); startT = t; }
    else { syncMedia(t, false); draw(t); }
    hooks.onTime && hooks.onTime(t);
  }
  function refresh() {
    cleanupElements();
    if (!playing) { syncMedia(State.playhead, false); draw(State.playhead); }
  }

  return {
    canvas, hooks,
    ensureAudio, getAudioStream, setMonitor, getLevels, get monitorOn() { return monitorOn; },
    play, pause, toggle, seek, refresh, draw, renderTo, fitSize,
    get playing() { return playing; },
    get exporting() { return exporting; }, set exporting(v) { exporting = v; },
    filterString, fadeFactor, transitionOf
  };
})();
