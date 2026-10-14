/* ===== Kəsyapışdır — qapaq (üz şəkli) ===== */
const Cover = (() => {
  const $ = id => document.getElementById(id);
  let pending = null;   // dialoqda hazırlanan, hələ təsdiqlənməmiş qapaq (dataURL)
  let open = false;
  const off = document.createElement('canvas');

  function show() {
    const p = State.project;
    if (!p) return;
    Renderer.pause();
    open = true;
    pending = p.cover ? p.cover.dataUrl : null;
    const slider = $('cover-time');
    slider.max = Math.max(0.01, State.duration());
    slider.value = p.cover && p.cover.time != null ? p.cover.time : State.playhead;
    $('cover-time-label').textContent = Media.fmtTime(+slider.value, true);
    const c = $('cover-canvas');
    const r = p.width / p.height;
    c.width = 640; c.height = Math.round(640 / r);
    if (pending) drawDataUrl(pending); else $('cover-empty').classList.remove('hidden');
    $('dlg-cover').classList.remove('hidden');
  }
  function hide() { open = false; $('dlg-cover').classList.add('hidden'); }

  function drawDataUrl(url) {
    const img = new Image();
    img.onload = () => { const c = $('cover-canvas'); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); $('cover-empty').classList.add('hidden'); };
    img.src = url;
  }
  /* Zaman xəttindən kadr götür */
  function captureFrame(t) {
    Renderer.renderTo(off, t);
    pending = off.toDataURL('image/jpeg', 0.92);
    const c = $('cover-canvas');
    c.getContext('2d').drawImage(off, 0, 0, c.width, c.height);
    $('cover-empty').classList.add('hidden');
  }
  function frameAt(t) {
    // videoların kadrı hazır olsun deyə əvvəl oynatma başlığını aparırıq, sonra kadrı çəkirik
    Renderer.seek(t);
    setTimeout(() => { if (open) captureFrame(t); }, 250);
  }
  function fromImage(file) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const p = State.project;
      off.width = p.width; off.height = p.height;
      const g = off.getContext('2d');
      g.fillStyle = '#000'; g.fillRect(0, 0, p.width, p.height);
      const [dw, dh] = Renderer.fitSize(img.naturalWidth, img.naturalHeight, p.width, p.height, 'cover');
      g.drawImage(img, (p.width - dw) / 2, (p.height - dh) / 2, dw, dh);
      pending = off.toDataURL('image/jpeg', 0.92);
      drawDataUrl(pending);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }
  function apply() {
    State.mutate(p => { p.cover = pending ? { dataUrl: pending, time: +$('cover-time').value } : null; });
    hide();
    App.toast(pending ? 'Qapaq təyin edildi' : 'Qapaq silindi');
  }
  function savePng() {
    const url = pending || (State.project.cover && State.project.cover.dataUrl);
    if (!url) { App.toast('Əvvəlcə qapaq seçin', true); return; }
    const img = new Image();
    img.onload = () => {
      off.width = img.naturalWidth; off.height = img.naturalHeight;
      off.getContext('2d').drawImage(img, 0, 0);
      App.download(off.toDataURL('image/png'), `${State.project.name || 'qapaq'} - qapaq.png`);
    };
    img.src = url;
  }
  function updateButton() {
    const b = $('btn-cover');
    const cov = State.project && State.project.cover;
    b.classList.toggle('has-cover', !!cov);
    b.style.backgroundImage = cov ? `url(${cov.dataUrl})` : '';
  }
  /* İxrac üçün qapaq şəkli (Image) */
  function image() {
    const cov = State.project && State.project.cover;
    if (!cov) return Promise.resolve(null);
    return new Promise(res => { const img = new Image(); img.onload = () => res(img); img.onerror = () => res(null); img.src = cov.dataUrl; });
  }

  function init() {
    $('btn-cover').addEventListener('click', show);
    $('cover-close').addEventListener('click', hide);
    $('cover-apply').addEventListener('click', apply);
    $('cover-remove').addEventListener('click', () => { pending = null; const c = $('cover-canvas'); c.getContext('2d').clearRect(0, 0, c.width, c.height); $('cover-empty').classList.remove('hidden'); });
    $('cover-use-playhead').addEventListener('click', () => { $('cover-time').value = State.playhead; $('cover-time-label').textContent = Media.fmtTime(State.playhead, true); captureFrame(State.playhead); });
    $('cover-time').addEventListener('input', e => { const t = +e.target.value; $('cover-time-label').textContent = Media.fmtTime(t, true); frameAt(t); });
    $('cover-upload').addEventListener('click', () => $('file-cover').click());
    $('file-cover').addEventListener('change', e => { if (e.target.files[0]) fromImage(e.target.files[0]); e.target.value = ''; });
    $('cover-save-png').addEventListener('click', savePng);
  }
  return { init, show, hide, updateButton, image, savePng };
})();
