/* ===== Kəsyapışdır — keçidlər (iki kadr arasında kanvas keçidləri) ===== */
const Transitions = (() => {
  const CATS = [
    { id: 'all', name: 'Hamısı' },
    { id: 'basic', name: 'Əsas' },
    { id: 'motion', name: 'Hərəkət' },
    { id: 'wipe', name: 'Silmə' },
    { id: 'fx', name: 'Effektlər' }
  ];
  const LIST = [
    { id: 'dissolve', name: 'Çarpaz solma', cat: 'basic' },
    { id: 'fade-black', name: 'Qaralma', cat: 'basic' },
    { id: 'fade-white', name: 'Ağarma', cat: 'basic' },
    { id: 'flash', name: 'Parıltı', cat: 'basic' },
    { id: 'push-left', name: 'İtələmə sola', cat: 'motion' },
    { id: 'push-right', name: 'İtələmə sağa', cat: 'motion' },
    { id: 'push-up', name: 'İtələmə yuxarı', cat: 'motion' },
    { id: 'push-down', name: 'İtələmə aşağı', cat: 'motion' },
    { id: 'slide-left', name: 'Sürüşmə sola', cat: 'motion' },
    { id: 'slide-right', name: 'Sürüşmə sağa', cat: 'motion' },
    { id: 'slide-up', name: 'Sürüşmə yuxarı', cat: 'motion' },
    { id: 'slide-down', name: 'Sürüşmə aşağı', cat: 'motion' },
    { id: 'wipe-right', name: 'Silmə sağa', cat: 'wipe' },
    { id: 'wipe-left', name: 'Silmə sola', cat: 'wipe' },
    { id: 'wipe-down', name: 'Silmə aşağı', cat: 'wipe' },
    { id: 'wipe-up', name: 'Silmə yuxarı', cat: 'wipe' },
    { id: 'circle', name: 'Dairə', cat: 'wipe' },
    { id: 'diagonal', name: 'Diaqonal', cat: 'wipe' },
    { id: 'clock', name: 'Saat', cat: 'wipe' },
    { id: 'blinds', name: 'Jalüz', cat: 'wipe' },
    { id: 'stripes', name: 'Zolaqlar', cat: 'wipe' },
    { id: 'checker', name: 'Dama', cat: 'wipe' },
    { id: 'zoom-in', name: 'Böyütmə', cat: 'fx' },
    { id: 'zoom-out', name: 'Kiçiltmə', cat: 'fx' },
    { id: 'blur', name: 'Bulanıq', cat: 'fx' },
    { id: 'spin', name: 'Fırlanma', cat: 'fx' },
    { id: 'twist', name: 'Burğu', cat: 'fx' },
    { id: 'squeeze', name: 'Sıxılma', cat: 'fx' }
  ];
  const byId = id => LIST.find(t => t.id === id);
  const ease = p => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);

  function drawT(ctx, img, W, H, { scale = 1, rot = 0, alpha = 1, dx = 0, dy = 0, filter = 'none' } = {}) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.filter = filter;
    ctx.translate(W / 2 + dx, H / 2 + dy);
    ctx.rotate(rot);
    ctx.scale(scale, scale);
    ctx.drawImage(img, -W / 2, -H / 2, W, H);
    ctx.restore();
  }
  function clipped(ctx, pathFn, img, W, H) {
    ctx.save();
    ctx.beginPath();
    pathFn();
    ctx.clip();
    ctx.drawImage(img, 0, 0, W, H);
    ctx.restore();
  }

  /* a, b — W×H ölçülü kanvaslar; p — 0..1 */
  function draw(ctx, type, a, b, p, W, H) {
    const e = ease(Math.max(0, Math.min(1, p)));
    const PI = Math.PI;
    switch (type) {
      case 'dissolve':
        ctx.drawImage(a, 0, 0, W, H); drawT(ctx, b, W, H, { alpha: e }); break;
      case 'fade-black':
        if (e < 0.5) drawT(ctx, a, W, H, { alpha: 1 - e * 2 }); else drawT(ctx, b, W, H, { alpha: (e - 0.5) * 2 }); break;
      case 'fade-white':
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
        if (e < 0.5) drawT(ctx, a, W, H, { alpha: 1 - e * 2 }); else drawT(ctx, b, W, H, { alpha: (e - 0.5) * 2 }); break;
      case 'flash':
        ctx.drawImage(p < 0.5 ? a : b, 0, 0, W, H);
        ctx.fillStyle = `rgba(255,255,255,${Math.sin(p * PI)})`; ctx.fillRect(0, 0, W, H); break;
      case 'push-left': ctx.drawImage(a, -W * e, 0, W, H); ctx.drawImage(b, W * (1 - e), 0, W, H); break;
      case 'push-right': ctx.drawImage(a, W * e, 0, W, H); ctx.drawImage(b, -W * (1 - e), 0, W, H); break;
      case 'push-up': ctx.drawImage(a, 0, -H * e, W, H); ctx.drawImage(b, 0, H * (1 - e), W, H); break;
      case 'push-down': ctx.drawImage(a, 0, H * e, W, H); ctx.drawImage(b, 0, -H * (1 - e), W, H); break;
      case 'slide-left': ctx.drawImage(a, 0, 0, W, H); ctx.drawImage(b, W * (1 - e), 0, W, H); break;
      case 'slide-right': ctx.drawImage(a, 0, 0, W, H); ctx.drawImage(b, -W * (1 - e), 0, W, H); break;
      case 'slide-up': ctx.drawImage(a, 0, 0, W, H); ctx.drawImage(b, 0, H * (1 - e), W, H); break;
      case 'slide-down': ctx.drawImage(a, 0, 0, W, H); ctx.drawImage(b, 0, -H * (1 - e), W, H); break;
      case 'wipe-right': ctx.drawImage(a, 0, 0, W, H); clipped(ctx, () => ctx.rect(0, 0, W * e, H), b, W, H); break;
      case 'wipe-left': ctx.drawImage(a, 0, 0, W, H); clipped(ctx, () => ctx.rect(W * (1 - e), 0, W * e, H), b, W, H); break;
      case 'wipe-down': ctx.drawImage(a, 0, 0, W, H); clipped(ctx, () => ctx.rect(0, 0, W, H * e), b, W, H); break;
      case 'wipe-up': ctx.drawImage(a, 0, 0, W, H); clipped(ctx, () => ctx.rect(0, H * (1 - e), W, H * e), b, W, H); break;
      case 'circle':
        ctx.drawImage(a, 0, 0, W, H);
        clipped(ctx, () => ctx.arc(W / 2, H / 2, e * Math.hypot(W, H) / 2, 0, PI * 2), b, W, H); break;
      case 'diagonal':
        ctx.drawImage(a, 0, 0, W, H);
        clipped(ctx, () => { const d = (W + H) * e; ctx.moveTo(0, 0); ctx.lineTo(d, 0); ctx.lineTo(0, d); ctx.closePath(); }, b, W, H); break;
      case 'clock':
        ctx.drawImage(a, 0, 0, W, H);
        clipped(ctx, () => { ctx.moveTo(W / 2, H / 2); ctx.arc(W / 2, H / 2, Math.hypot(W, H), -PI / 2, -PI / 2 + PI * 2 * e); ctx.closePath(); }, b, W, H); break;
      case 'blinds':
        ctx.drawImage(a, 0, 0, W, H);
        clipped(ctx, () => { const n = 10; for (let i = 0; i < n; i++) ctx.rect(0, i * H / n, W, H / n * e); }, b, W, H); break;
      case 'stripes':
        ctx.drawImage(a, 0, 0, W, H);
        clipped(ctx, () => { const n = 12; for (let i = 0; i < n; i++) { if (i % 2) ctx.rect(i * W / n, H * (1 - e), W / n, H * e); else ctx.rect(i * W / n, 0, W / n, H * e); } }, b, W, H); break;
      case 'checker':
        ctx.drawImage(a, 0, 0, W, H);
        clipped(ctx, () => {
          const nx = 8, ny = 5;
          for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
            const th = (i + j) / (nx + ny - 2) * 0.8;
            if (e > th) ctx.rect(i * W / nx, j * H / ny, W / nx + 1, H / ny + 1);
          }
        }, b, W, H); break;
      case 'zoom-in':
        drawT(ctx, b, W, H); drawT(ctx, a, W, H, { scale: 1 + e * 1.2, alpha: 1 - e }); break;
      case 'zoom-out':
        drawT(ctx, a, W, H); drawT(ctx, b, W, H, { scale: 1.6 - e * 0.6, alpha: e }); break;
      case 'blur': {
        const px = Math.round(W / 40);
        if (e < 0.5) drawT(ctx, a, W, H, { filter: `blur(${e * 2 * px}px)` });
        else drawT(ctx, b, W, H, { filter: `blur(${(1 - e) * 2 * px}px)` });
        break;
      }
      case 'spin':
        drawT(ctx, a, W, H); drawT(ctx, b, W, H, { rot: (1 - e) * PI, scale: Math.max(0.01, e), alpha: e }); break;
      case 'twist':
        drawT(ctx, a, W, H, { rot: e * PI / 2, scale: Math.max(0.01, 1 - e), alpha: 1 - e });
        drawT(ctx, b, W, H, { rot: -(1 - e) * PI / 2, scale: Math.max(0.01, e), alpha: e }); break;
      case 'squeeze':
        ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(Math.max(0.001, 1 - e), 1); ctx.drawImage(a, -W / 2, -H / 2, W, H); ctx.restore();
        ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(Math.max(0.001, e), 1); ctx.drawImage(b, -W / 2, -H / 2, W, H); ctx.restore();
        break;
      default:
        ctx.drawImage(a, 0, 0, W, H); drawT(ctx, b, W, H, { alpha: e });
    }
  }

  /* Panel üçün nümunə kadrlar */
  let sampleA = null, sampleB = null;
  function samples(w, h) {
    if (sampleA && sampleA.width === w) return [sampleA, sampleB];
    const mk = (c1, c2, shape) => {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d');
      const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, c1); gr.addColorStop(1, c2);
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,.85)';
      if (shape === 'circle') { g.beginPath(); g.arc(w * 0.5, h * 0.5, h * 0.28, 0, Math.PI * 2); g.fill(); }
      else { g.fillRect(w * 0.32, h * 0.22, w * 0.36, h * 0.56); }
      return c;
    };
    sampleA = mk('#ff8a5c', '#ff3d81', 'circle');
    sampleB = mk('#22c6d8', '#3b5bff', 'rect');
    return [sampleA, sampleB];
  }
  function preview(canvas, type, phase) {
    const w = canvas.width, h = canvas.height;
    const [a, b] = samples(w, h);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.filter = 'none';
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    // 0..0.25 — A, 0.25..0.75 — keçid, 0.75..1 — B
    let p = (phase - 0.25) / 0.5;
    if (phase < 0.25) p = 0; else if (phase > 0.75) p = 1;
    draw(ctx, type, a, b, p, w, h);
  }

  return { CATS, LIST, byId, draw, preview, ease };
})();
