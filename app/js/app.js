/* ===== Kəsyapışdır — tətbiq: menyular, panellər, qısayollar, dialoqlar, yadda saxla/yüklə ===== */
const App = (() => {
  const $ = id => document.getElementById(id);
  const ICON = n => `<svg class="ic"><use href="#i-${n}"/></svg>`;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const STICKERS = ['😀', '😂', '😍', '😎', '🤩', '😢', '😡', '🥳', '🤔', '😱', '👍', '👎', '👏', '🙏', '💪', '🔥', '❤️', '💔', '✨', '⭐',
    '🎉', '🎊', '🎁', '🎵', '🎶', '📌', '✅', '❌', '⚠️', '💡', '💯', '🏆', '🥇', '⚽', '🏀', '🚀', '✈️', '🚗', '🏠', '🌍',
    '☀️', '🌙', '⛅', '🌈', '🍕', '🍔', '☕', '🍰', '🐱', '🐶', '🦁', '🐸', '🇦🇿', '👉', '👈', '👆', '👇', '🫶', '🤝', '👀'];
  const BACKGROUNDS = [
    ['Qara', '#000000'], ['Ağ', '#ffffff'], ['Boz', '#2b2b2b'], ['Mavi', '#1e5eff'], ['Qırmızı', '#e5243b'], ['Yaşıl', '#1faa59'],
    ['Gün batımı', 'linear-gradient(135deg,#ff7a59,#ff3d81)'], ['Okean', 'linear-gradient(135deg,#22c6d8,#3b5bff)'],
    ['Meşə', 'linear-gradient(135deg,#0f9b58,#1b3a2b)'], ['Bənövşə', 'linear-gradient(135deg,#7b2ff7,#f107a3)'],
    ['Qızıl', 'linear-gradient(135deg,#f6d365,#fda085)'], ['Gecə', 'linear-gradient(180deg,#0f2027,#203a43,#2c5364)'],
    ['Nanə', 'linear-gradient(135deg,#a8ff78,#78ffd6)'], ['Alov', 'linear-gradient(135deg,#f12711,#f5af19)'],
    ['Buz', 'linear-gradient(135deg,#e0eafc,#cfdef3)'], ['Neon', 'linear-gradient(135deg,#00f260,#0575e6)']
  ];
  let toastTimer = null, confirmCb = null, promptCb = null, missingList = [];
  let clipboard = [];
  let openMenuName = null;
  let currentPage = 'import';
  let transAnim = 0;
  let pickCb = null;

  /* ---------- Bildirişlər və dialoqlar ---------- */
  function toast(msg, isError = false) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.toggle('error', isError);
    t.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('hidden'), isError ? 4500 : 2500);
  }
  function confirm(title, text, onYes) {
    $('confirm-title').textContent = title;
    $('confirm-text').textContent = text;
    confirmCb = onYes;
    $('dlg-confirm').classList.remove('hidden');
  }
  function prompt(title, value, onOk) {
    $('prompt-title').textContent = title;
    const inp = $('prompt-input');
    inp.value = value || '';
    promptCb = onOk;
    $('dlg-prompt').classList.remove('hidden');
    setTimeout(() => { inp.focus(); inp.select(); }, 30);
  }
  function download(url, name) {
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
  }
  function contextMenu(x, y, items) {
    closeMenus();
    const menu = document.createElement('div');
    menu.className = 'ctx-menu';
    for (const it of items) {
      if (it.sep) { menu.appendChild(Object.assign(document.createElement('div'), { className: 'dd-sep' })); continue; }
      const b = document.createElement('button');
      b.className = 'dd-item' + (it.danger ? ' danger' : '');
      b.innerHTML = `<span>${esc(it.label)}</span>${it.shortcut ? `<span class="dd-shortcut">${esc(it.shortcut)}</span>` : ''}`;
      b.addEventListener('click', () => { menu.remove(); it.action && it.action(); });
      menu.appendChild(b);
    }
    document.body.appendChild(menu);
    const r = menu.getBoundingClientRect();
    menu.style.left = Math.min(x, window.innerWidth - r.width - 6) + 'px';
    menu.style.top = Math.min(y, window.innerHeight - r.height - 6) + 'px';
    setTimeout(() => document.addEventListener('pointerdown', e => { if (!menu.contains(e.target)) menu.remove(); }, { once: true }), 0);
  }

  /* ---------- Menyu zolağı ---------- */
  function menuItems(name) {
    const p = State.project;
    const sel = State.selection.length > 0;
    switch (name) {
      case 'file': return [
        { label: 'Yeni layihə', shortcut: 'Ctrl+N', action: newProject },
        { label: 'Layihə aç…', shortcut: 'Ctrl+O', action: () => $('file-project').click() },
        { label: 'Yadda saxla', shortcut: 'Ctrl+S', action: saveProject },
        { label: 'Son layihəni bərpa et', action: restoreAutosave, disabled: !localStorage.getItem('ksy-autosave') },
        { sep: true },
        { label: 'Media əlavə et…', shortcut: 'Ctrl+I', action: () => $('file-import').click() },
        { label: 'Kamera yazısı…', action: () => Recorder.open('camera') },
        { label: 'Ekran yazısı…', action: () => Recorder.open('screen') },
        { label: 'Səs yazısı…', action: () => Recorder.open('mic') },
        { sep: true },
        { label: 'Çıxış', action: () => window.close() }
      ];
      case 'edit': return [
        { label: 'Geri al', shortcut: 'Ctrl+Z', action: () => State.undo(), disabled: !State.canUndo },
        { label: 'İrəli al', shortcut: 'Ctrl+Y', action: () => State.redo(), disabled: !State.canRedo },
        { sep: true },
        { label: 'Kəs', shortcut: 'Ctrl+X', action: cutSelected, disabled: !sel },
        { label: 'Kopyala', shortcut: 'Ctrl+C', action: copySelected, disabled: !sel },
        { label: 'Yapışdır', shortcut: 'Ctrl+V', action: pasteClipboard, disabled: !clipboard.length },
        { label: 'Dublikat', shortcut: 'Ctrl+D', action: duplicateSelected, disabled: !sel },
        { label: 'Sil', shortcut: 'Delete', action: deleteSelected, disabled: !sel },
        { sep: true },
        { label: 'Böl', shortcut: 'Ctrl+B', action: splitAtPlayhead },
        { label: 'Solunu kəs', shortcut: 'Q', action: () => trimAtPlayhead('left') },
        { label: 'Sağını kəs', shortcut: 'W', action: () => trimAtPlayhead('right') },
        { label: 'Hamısını seç', shortcut: 'Ctrl+A', action: selectAll }
      ];
      case 'play': return [
        { label: Renderer.playing ? 'Dayandır' : 'Oynat', shortcut: 'Boşluq', action: () => Renderer.toggle() },
        { label: 'Başa', shortcut: 'Home', action: () => Renderer.seek(0) },
        { label: 'Sona', shortcut: 'End', action: () => Renderer.seek(State.duration()) },
        { label: 'Bir kadr geri', shortcut: '←', action: () => Renderer.seek(State.playhead - 1 / p.fps) },
        { label: 'Bir kadr irəli', shortcut: '→', action: () => Renderer.seek(State.playhead + 1 / p.fps) },
        { sep: true },
        { label: 'Önizləmə səsi', checked: Renderer.monitorOn, action: toggleMonitor },
        { label: 'Tam ekran', action: fullscreen },
        { label: 'Zaman xəttini sığdır', shortcut: 'F', action: () => Timeline.zoomToFit() }
      ];
      case 'settings': return [
        { header: 'Nisbət' },
        ...Object.keys(State.RATIOS).map(r => ({ label: `${r}  (${State.RATIOS[r][0]}×${State.RATIOS[r][1]})`, checked: p.ratio === r, action: () => State.setRatio(r) })),
        { sep: true },
        { header: 'Kadr sürəti' },
        ...[24, 25, 30, 60].map(f => ({ label: `${f} fps`, checked: p.fps === f, action: () => State.mutate(pr => { pr.fps = f; }) })),
        { sep: true },
        { label: 'Bulanıq fon', checked: p.bgBlur, action: () => State.mutate(pr => { pr.bgBlur = !pr.bgBlur; }) },
        { label: 'Maqnit (yapışma)', checked: Timeline.snap, action: () => Timeline.setSnap(!Timeline.snap) },
        { sep: true },
        { label: 'Layihə parametrləri…', action: () => { State.select([]); showPage('props'); } }
      ];
      case 'export': return [
        { label: 'Video kimi ixrac et…', shortcut: 'Ctrl+E', action: () => Exporter.open() },
        { sep: true },
        { label: 'Qapaq (üz şəkli)…', action: () => Cover.show() },
        { label: 'Qapağı PNG kimi saxla', action: () => Cover.savePng(), disabled: !p.cover },
        { label: 'Cari kadrı PNG kimi saxla', action: saveFramePng }
      ];
      case 'help': return [
        { label: 'Qısayollar', action: () => { State.select([]); showPage('props'); setTimeout(() => { const d = document.querySelector('#inspector .sec-help'); if (d) { d.open = true; d.scrollIntoView(); } }, 50); } },
        { label: 'Haqqında', action: () => $('dlg-about').classList.remove('hidden') }
      ];
    }
    return [];
  }
  function openMenu(name) {
    const dd = $('dropdown');
    closeMenus();
    const btn = document.querySelector(`.menu-item[data-menu="${name}"]`);
    btn.classList.add('open');
    openMenuName = name;
    dd.innerHTML = '';
    for (const it of menuItems(name)) {
      if (it.sep) { dd.appendChild(Object.assign(document.createElement('div'), { className: 'dd-sep' })); continue; }
      if (it.header) { dd.appendChild(Object.assign(document.createElement('div'), { className: 'dd-header', textContent: it.header })); continue; }
      const b = document.createElement('button');
      b.className = 'dd-item' + (it.checked ? ' checked' : '');
      b.disabled = !!it.disabled;
      b.innerHTML = `<span class="dd-check">${it.checked ? ICON('check') : ''}</span><span>${esc(it.label)}</span>${it.shortcut ? `<span class="dd-shortcut">${esc(it.shortcut)}</span>` : ''}`;
      b.addEventListener('click', () => { closeMenus(); it.action && it.action(); });
      dd.appendChild(b);
    }
    const r = btn.getBoundingClientRect();
    dd.style.left = r.left + 'px';
    dd.style.top = r.bottom + 'px';
    dd.classList.remove('hidden');
  }
  function closeMenus() {
    $('dropdown').classList.add('hidden');
    for (const b of document.querySelectorAll('.menu-item.open')) b.classList.remove('open');
    openMenuName = null;
  }

  /* ---------- Səhifələr ---------- */
  function showPage(name) {
    currentPage = name;
    for (const b of $('rail').children) b.classList.toggle('active', b.dataset.page === name);
    for (const pg of document.querySelectorAll('.content > .page')) pg.classList.toggle('active', pg.id === 'page-' + name);
    if (name === 'transitions') startTransitionPreviews(); else stopTransitionPreviews();
    if (name === 'props') Inspector.render();
  }
  function initSubtabs() {
    for (const bar of document.querySelectorAll('.subtabs')) {
      bar.addEventListener('click', e => {
        const b = e.target.closest('.subtab'); if (!b || !b.dataset.sub) return;
        for (const x of bar.children) x.classList.toggle('active', x === b);
        const page = bar.parentElement;
        for (const sp of page.querySelectorAll('.subpage')) sp.classList.toggle('active', sp.id === 'sub-' + b.dataset.sub);
      });
    }
  }

  /* ---------- Vaxt, status, başlıq ---------- */
  function fmtMs(sec) {
    const base = Media.fmtTime(sec);
    const ms = Math.floor((sec - Math.floor(sec)) * 1000);
    return `${base}<small>.${String(ms).padStart(3, '0')}</small>`;
  }
  function updateTime() {
    const dur = State.duration();
    $('time-display').innerHTML = `${fmtMs(State.playhead)} / ${fmtMs(dur)}`;
    $('seekbar-fill').style.width = (dur > 0 ? State.playhead / dur * 100 : 0) + '%';
    $('status-length').textContent = `Layihə uzunluğu: ${Media.fmtTime(dur)}`;
  }
  function updateTitle() {
    const p = State.project; if (!p) return;
    const t = `Kəsyapışdır – ${p.name}${State.dirty ? ' *' : ''}`;
    $('window-title').textContent = t;
    document.title = t;
  }
  function fitCanvas() {
    const p = State.project; if (!p) return;
    const wrap = $('canvas-wrap');
    const aw = wrap.clientWidth - 24, ah = wrap.clientHeight - 24;
    if (aw <= 0 || ah <= 0) return;
    const r = p.width / p.height;
    let w = aw, h = aw / r;
    if (h > ah) { h = ah; w = ah * r; }
    const c = $('preview');
    c.style.width = Math.floor(w) + 'px';
    c.style.height = Math.floor(h) + 'px';
  }
  function syncProjectUI() {
    const p = State.project; if (!p) return;
    fitCanvas();
    $('ratio-select').value = p.ratio;
    updateTitle();
    Cover.updateButton();
    const sel = State.selectedClips();
    $('status-info').textContent = sel.length === 1 ? (sel[0].type === 'text' ? sel[0].text.content.split('\n')[0] : (State.media.get(sel[0].mediaId) || {}).name || '') : sel.length > 1 ? `${sel.length} klip seçilib` : '';
  }

  /* ---------- Klip əməliyyatları ---------- */
  function clipsAtPlayhead(onlySelected) {
    const t = State.playhead, out = [];
    for (const tr of State.project.tracks) for (const c of tr.clips)
      if (t > c.start + 1e-6 && t < c.start + c.duration - 1e-6 && (!onlySelected || State.selection.includes(c.id))) out.push(c);
    return out;
  }
  function splitAtPlayhead() {
    const targets = State.selection.length ? clipsAtPlayhead(true) : clipsAtPlayhead(false);
    if (!targets.length) { toast('Oynatma başlığı heç bir klipin üzərində deyil', true); return; }
    State.mutate(() => {
      const ids = [];
      for (const c of targets) { const r = State.splitClip(c, State.playhead); if (r) ids.push(r.id); }
      if (ids.length) State.select(ids);
    });
  }
  function trimAtPlayhead(side) {
    const targets = clipsAtPlayhead(State.selection.length > 0);
    if (!targets.length) { toast('Oynatma başlığı seçilmiş klipin üzərində deyil', true); return; }
    const t = State.playhead;
    State.mutate(() => {
      for (const c of targets) {
        if (side === 'left') { const d = t - c.start; if (c.duration - d < State.MIN_CLIP) continue; c.start = t; c.duration -= d; c.in += d * c.speed; }
        else { const nd = t - c.start; if (nd < State.MIN_CLIP) continue; c.duration = nd; }
      }
    });
  }
  function deleteSelected() { if (State.selection.length) State.mutate(() => State.removeClips([...State.selection])); }
  function duplicateSelected() {
    const clips = State.selectedClips(); if (!clips.length) return;
    State.mutate(() => { State.select(clips.map(c => State.duplicateClip(c).id)); });
  }
  function selectAll() { State.select(State.project.tracks.flatMap(t => t.clips.map(c => c.id))); }
  function copySelected() {
    const clips = State.selectedClips();
    if (!clips.length) { toast('Kopyalamaq üçün klip seçin', true); return false; }
    const min = Math.min(...clips.map(c => c.start));
    clipboard = clips.map(c => Object.assign(JSON.parse(JSON.stringify(c)), { rel: c.start - min }));
    toast(`${clips.length} klip kopyalandı`);
    return true;
  }
  function cutSelected() { if (copySelected()) { deleteSelected(); toast('Klip kəsildi (Ctrl+V ilə yapışdırın)'); } }
  function pasteClipboard() {
    if (!clipboard.length) { toast('Mübadilə buferi boşdur', true); return; }
    State.mutate(() => {
      const ids = [];
      for (const src of clipboard) {
        const c = JSON.parse(JSON.stringify(src)); delete c.rel; c.id = State.uid(); c.transition = null;
        c.start = State.playhead + src.rel;
        let track = State.findTrack(src.trackId);
        if (!track || !State.trackAccepts(track, c.type) || State.collides(track, c.start, c.duration)) track = State.pickTrackFor(c.type, c.start, c.duration);
        State.addClip(c, track.id); ids.push(c.id);
      }
      State.select(ids);
    });
    toast(`${clipboard.length} klip yapışdırıldı`);
  }
  function addTextClip(preset = null, content = null, extra = null) {
    State.mutate(() => {
      const text = Object.assign({}, preset ? preset.t : {}, extra || {});
      if (content != null) text.content = content;
      const clip = State.makeClip('text', null, State.playhead, { text });
      const track = State.pickTrackFor('text', State.playhead, clip.duration);
      State.addClip(clip, track.id);
      State.select([clip.id]);
    });
    showPage('props');
  }
  function addTrack(type) {
    State.mutate(p => {
      const names = { video: 'Video', audio: 'Audio', text: 'Mətn' };
      const n = p.tracks.filter(t => t.type === type).length + 1;
      const tr = State.makeTrack(type, `${names[type]} ${n}`);
      if (type === 'audio') p.tracks.push(tr); else p.tracks.unshift(tr);
    });
  }
  /* Keçidi seçilmiş klipə tətbiq et */
  function applyTransition(type) {
    const clips = State.selectedClips().filter(c => c.type !== 'audio');
    if (!clips.length) { toast('Əvvəlcə zaman xəttində klip seçin', true); return; }
    let target = null;
    if (clips.length >= 2) {
      const sorted = [...clips].sort((a, b) => a.start - b.start);
      for (let i = 0; i < sorted.length - 1; i++) if (State.nextAdjacent(sorted[i]) === sorted[i + 1]) { target = sorted[i]; break; }
    } else {
      const c = clips[0];
      if (State.nextAdjacent(c)) target = c; else target = State.prevAdjacent(c);
    }
    if (!target) { toast('Keçid üçün klipin yanında (eyni trekdə) başqa klip olmalıdır', true); return; }
    State.mutate(() => {
      const next = State.nextAdjacent(target);
      const d = Math.min(1, Math.max(0.2, next.duration / 2), target.duration / 2);
      target.transition = type === 'none' ? null : { type, duration: Math.round(d * 10) / 10 };
      State.select([target.id]);
    });
    toast(type === 'none' ? 'Keçid silindi' : `"${Transitions.byId(type).name}" keçidi tətbiq edildi`);
  }
  function saveFramePng() {
    const c = document.createElement('canvas');
    Renderer.renderTo(c, State.playhead);
    download(c.toDataURL('image/png'), `${State.project.name} - kadr ${Media.fmtTime(State.playhead, true).replace(':', '-')}.png`);
  }
  async function freezeFrameToLibrary() {
    const c = document.createElement('canvas');
    Renderer.renderTo(c, State.playhead);
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    await Media.importFiles([new File([blob], `Kadr ${Media.fmtTime(State.playhead, true).replace(':', '-')}.png`, { type: 'image/png' })]);
    showPage('import');
  }
  function toggleMonitor() {
    Renderer.setMonitor(!Renderer.monitorOn);
    $('btn-monitor-mute').innerHTML = ICON(Renderer.monitorOn ? 'volume' : 'mute');
  }
  function fullscreen() {
    const c = $('preview');
    if (document.fullscreenElement) document.exitFullscreen(); else c.requestFullscreen && c.requestFullscreen();
  }
  /* Önizləmədən rəng götür (xroma açarı üçün) */
  function pickColor(cb) {
    pickCb = cb;
    $('preview').classList.add('picking');
    toast('Önizləmədə silinəcək rəngin üzərinə klikləyin');
  }

  /* ---------- Yadda saxla / yüklə ---------- */
  function saveProject() {
    const data = State.serialize();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    download(url, `${(State.project.name || 'layihe').replace(/[\\/:*?"<>|]/g, '_')}.ksy`);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    State.dirty = false;
    try { localStorage.setItem('ksy-autosave', data); } catch { /* yer yoxdur */ }
    updateTitle();
    toast('Layihə yadda saxlanıldı (.ksy)');
  }
  function autosave() {
    if (!State.project || !State.dirty) return;
    try { localStorage.setItem('ksy-autosave', State.serialize()); } catch { /* boş */ }
  }
  function restoreAutosave() {
    try { const d = JSON.parse(localStorage.getItem('ksy-autosave')); if (d) loadProjectData(d); } catch { toast('Ehtiyat nüsxə oxuna bilmədi', true); }
  }
  function newProject() {
    const go = () => { Renderer.pause(); State.newProject('16:9'); showPage('import'); toast('Yeni layihə yaradıldı'); };
    if (State.dirty) confirm('Yeni layihə', 'Yadda saxlanılmamış dəyişikliklər itəcək. Davam edilsin?', go); else go();
  }
  async function openProjectFile(file) {
    let data;
    try { data = JSON.parse(await file.text()); } catch { toast('Layihə faylı oxuna bilmədi', true); return; }
    loadProjectData(data);
  }
  function loadProjectData(data) {
    if (!data || !data.project || !Array.isArray(data.project.tracks)) { toast('Bu Kəsyapışdır layihəsi deyil', true); return; }
    Renderer.pause();
    State.load(data);
    const usedIds = new Set();
    for (const t of State.project.tracks) for (const c of t.clips) if (c.mediaId) usedIds.add(c.mediaId);
    missingList = (data.media || []).filter(m => !State.media.has(m.id) && usedIds.has(m.id));
    if (missingList.length) showMissingDialog(); else toast('Layihə açıldı');
  }
  function showMissingDialog() {
    const ul = $('missing-list');
    ul.innerHTML = '';
    for (const m of missingList) {
      const li = document.createElement('li');
      li.textContent = m.name + (m.path ? `  (${m.path})` : '');
      li.className = State.media.has(m.id) ? 'ok' : '';
      ul.appendChild(li);
    }
    $('dlg-missing').classList.remove('hidden');
  }
  async function relinkFiles(files) {
    let linked = 0;
    for (const f of files) {
      const entry = missingList.find(m => !State.media.has(m.id) && m.name.toLowerCase() === f.name.toLowerCase());
      if (!entry) continue;
      const type = Media.typeOf(f); if (!type) continue;
      const m = { id: entry.id, name: f.name, type, file: f, size: f.size, url: URL.createObjectURL(f), duration: 0, width: 0, height: 0, thumb: null, path: window.ksy?.getPath ? window.ksy.getPath(f) : null };
      try { await Media.probe(m); State.media.set(m.id, m); Media.computePeaks(m); linked++; }
      catch (err) { URL.revokeObjectURL(m.url); toast(`"${f.name}" oxuna bilmədi (${err.message})`, true); }
    }
    Media.renderLibrary();
    State.emit('structure');
    if (missingList.every(m => State.media.has(m.id))) { $('dlg-missing').classList.add('hidden'); toast(`${linked} fayl yenidən bağlandı`); }
    else showMissingDialog();
  }

  /* ---------- Panellər ---------- */
  function buildPanels() {
    // Mətn üslubları
    const tp = $('text-presets');
    for (const p of Inspector.TEXT_PRESETS) {
      const el = document.createElement('div'); el.className = 'preset'; el.title = p.name;
      const t = p.t;
      el.innerHTML = `<span style="font:${t.italic ? 'italic ' : ''}${t.bold ? 'bold ' : ''}20px ${t.font || 'Segoe UI'};color:${t.color};${t.bg ? `background:${t.bg};padding:2px 8px;border-radius:4px;` : ''}${t.strokeWidth ? `-webkit-text-stroke:1px ${t.stroke};` : ''}${t.shadow ? 'text-shadow:0 2px 4px rgba(0,0,0,.7);' : ''}">${p.name}</span>`;
      el.addEventListener('click', () => addTextClip(p, p.name));
      tp.appendChild(el);
    }
    // Stikerlər
    const sg = $('sticker-grid');
    for (const s of STICKERS) {
      const el = document.createElement('div'); el.className = 'sticker'; el.textContent = s;
      el.addEventListener('click', () => addTextClip(null, s, { size: 220, bold: false, strokeWidth: 0, shadow: false, bg: '' }));
      sg.appendChild(el);
    }
    // Filtrlər
    const fg = $('filter-presets');
    for (const p of Inspector.FILTER_PRESETS) {
      const el = document.createElement('div'); el.className = 'filter-card';
      const sw = document.createElement('div'); sw.className = 'swatch'; sw.style.filter = Renderer.filterString({ filters: Object.assign(State.defaultFilters(), p.f) });
      const nm = document.createElement('div'); nm.className = 'fname'; nm.textContent = p.name;
      el.appendChild(sw); el.appendChild(nm);
      el.addEventListener('click', () => {
        const clips = State.selectedClips().filter(c => c.type === 'video' || c.type === 'image');
        if (!clips.length) { toast('Əvvəlcə zaman xəttində video və ya şəkil klipi seçin', true); return; }
        State.mutate(() => { for (const c of clips) c.filters = Object.assign(State.defaultFilters(), p.f); });
        toast(`"${p.name}" filtri tətbiq edildi`);
      });
      fg.appendChild(el);
    }
    // Arxa fonlar
    const bg = $('bg-grid');
    BACKGROUNDS.forEach(([name, css], i) => {
      const el = document.createElement('div'); el.className = 'bg-swatch'; el.title = name;
      el.innerHTML = `<div class="sw" style="background:${css}"></div><div class="fname">${name}</div>`;
      el.addEventListener('click', () => addBackground(name, css, i));
      bg.appendChild(el);
    });
    // Keçidlər
    const cats = $('transition-cats');
    for (const c of Transitions.CATS) {
      const b = document.createElement('button'); b.className = 'cat' + (c.id === 'all' ? ' active' : ''); b.dataset.cat = c.id;
      b.innerHTML = `${esc(c.name)} <b>${c.id === 'all' ? Transitions.LIST.length : Transitions.LIST.filter(t => t.cat === c.id).length}</b>`;
      b.addEventListener('click', () => { for (const x of cats.children) x.classList.toggle('active', x === b); renderTransitionGroups(c.id); });
      cats.appendChild(b);
    }
    renderTransitionGroups('all');
    // Alətlər
    const tools = [
      ['fit', 'Zaman xəttini sığdır', 'Bütün layihəni pəncərəyə sığdırır (F).', () => Timeline.zoomToFit()],
      ['edit', 'Qapaq (üz şəkli)', 'Videonun əvvəlinə qapaq kadrı qoyun.', () => Cover.show()],
      ['image', 'Kadrı şəkil kimi saxla', 'Cari kadrı PNG faylı kimi endirir.', saveFramePng],
      ['film', 'Kadrı dondur', 'Cari kadrı şəkil kimi kitabxanaya əlavə edir.', freezeFrameToLibrary],
      ['rotate', 'Klipi 90° fırlat', 'Seçilmiş klipi saat əqrəbi istiqamətində fırladır.', () => forSelected(c => { c.rotation = ((c.rotation + 90 + 180) % 360) - 180; })],
      ['flip', 'Üfüqi çevir', 'Seçilmiş klipi güzgü kimi çevirir.', () => forSelected(c => { c.flipH = !c.flipH; })],
      ['volume', 'Səsi normallaşdır', 'Seçilmiş klipin səsini standart səviyyəyə qaldırır.', () => forSelected(c => { c.normalize = !c.normalize; }, c => c.type !== 'text' && c.type !== 'image')],
      ['speed', 'Sürəti sıfırla', 'Seçilmiş klipin sürətini 1× edir.', () => forSelected(c => { const nd = c.duration * c.speed; c.speed = 1; c.duration = Math.min(nd, State.maxDuration(c)); })],
      ['sparkle', 'Effektləri sıfırla', 'Filtr, rötuş, maska, xroma və animasiyanı silir.', () => forSelected(c => { c.filters = State.defaultFilters(); c.retouch.enabled = false; c.chroma.enabled = false; c.mask.type = 'none'; c.vignette = 0; c.temperature = 0; c.anim = { in: { type: 'none', duration: 0.5 }, out: { type: 'none', duration: 0.5 } }; })],
      ['save', 'Layihəni yadda saxla', 'Layihəni .ksy faylı kimi saxlayır (Ctrl+S).', saveProject]
    ];
    const tl = $('tool-list');
    for (const [icon, name, desc, fn] of tools) {
      const b = document.createElement('button'); b.className = 'tool-item';
      b.innerHTML = `${ICON(icon)}<div><b>${esc(name)}</b><span>${esc(desc)}</span></div>`;
      b.addEventListener('click', fn);
      tl.appendChild(b);
    }
  }
  function forSelected(fn, filter = () => true) {
    const clips = State.selectedClips().filter(filter);
    if (!clips.length) { toast('Əvvəlcə zaman xəttində klip seçin', true); return; }
    State.mutate(() => clips.forEach(fn));
  }
  async function addBackground(name, css) {
    const p = State.project;
    const c = document.createElement('canvas'); c.width = p.width; c.height = p.height;
    const g = c.getContext('2d');
    if (css.startsWith('linear-gradient')) {
      const m = css.match(/linear-gradient\((\d+)deg,(.*)\)/);
      const deg = +m[1], cols = m[2].split(',');
      const a = (deg - 90) * Math.PI / 180, L = Math.hypot(c.width, c.height) / 2;
      const gr = g.createLinearGradient(c.width / 2 - Math.cos(a) * L, c.height / 2 - Math.sin(a) * L, c.width / 2 + Math.cos(a) * L, c.height / 2 + Math.sin(a) * L);
      cols.forEach((col, k) => gr.addColorStop(k / (cols.length - 1), col.trim()));
      g.fillStyle = gr;
    } else g.fillStyle = css;
    g.fillRect(0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    const before = new Set(State.media.keys());
    await Media.importFiles([new File([blob], `Arxa fon - ${name}.png`, { type: 'image/png' })]);
    for (const id of State.media.keys()) if (!before.has(id)) Media.addToTimeline(id);
  }
  function renderTransitionGroups(cat) {
    const root = $('transition-groups');
    root.innerHTML = '';
    const groups = cat === 'all' ? Transitions.CATS.filter(c => c.id !== 'all') : Transitions.CATS.filter(c => c.id === cat);
    for (const g of groups) {
      const h = document.createElement('h4'); h.className = 'group-title'; h.textContent = g.name; root.appendChild(h);
      const grid = document.createElement('div'); grid.className = 'card-grid';
      for (const t of Transitions.LIST.filter(x => x.cat === g.id)) {
        const card = document.createElement('div'); card.className = 'tcard'; card.title = t.name;
        const cv = document.createElement('canvas'); cv.width = 160; cv.height = 90; cv.dataset.type = t.id;
        const nm = document.createElement('div'); nm.className = 'tname'; nm.textContent = t.name;
        card.appendChild(cv); card.appendChild(nm);
        card.addEventListener('click', () => applyTransition(t.id));
        Transitions.preview(cv, t.id, 0.5);
        grid.appendChild(card);
      }
      root.appendChild(grid);
    }
    const none = document.createElement('button'); none.className = 'btn'; none.style.margin = '12px 0'; none.textContent = 'Seçilmiş klipdən keçidi sil';
    none.addEventListener('click', () => applyTransition('none'));
    root.appendChild(none);
    if (currentPage === 'transitions') startTransitionPreviews();
  }
  function startTransitionPreviews() {
    cancelAnimationFrame(transAnim);
    const step = () => {
      const phase = (performance.now() / 2400) % 1;
      for (const cv of document.querySelectorAll('#transition-groups canvas')) Transitions.preview(cv, cv.dataset.type, phase);
      transAnim = requestAnimationFrame(step);
    };
    step();
  }
  function stopTransitionPreviews() { cancelAnimationFrame(transAnim); transAnim = 0; }

  /* ---------- Panel ölçüləri (sürüklənən xətlər) ---------- */
  function initSplitters() {
    const rootEl = document.documentElement;
    const saved = (() => { try { return JSON.parse(localStorage.getItem('ksy-layout') || '{}'); } catch { return {}; } })();
    const apply = () => {
      if (saved.contentW) rootEl.style.setProperty('--content-w', saved.contentW + 'px'); else rootEl.style.removeProperty('--content-w');
      if (saved.tlH) rootEl.style.setProperty('--tl-h', saved.tlH + 'px'); else rootEl.style.removeProperty('--tl-h');
    };
    const save = () => { try { localStorage.setItem('ksy-layout', JSON.stringify(saved)); } catch { /* boş */ } };
    apply();
    const bind = (el, onMove, onReset) => {
      let active = false;
      el.addEventListener('pointerdown', e => { if (e.button !== 0) return; active = true; el.classList.add('active'); try { el.setPointerCapture(e.pointerId); } catch { /* boş */ } e.preventDefault(); });
      el.addEventListener('pointermove', e => { if (active) onMove(e); });
      const stop = () => { if (!active) return; active = false; el.classList.remove('active'); save(); };
      el.addEventListener('pointerup', stop);
      el.addEventListener('pointercancel', stop);
      el.addEventListener('dblclick', () => { onReset(); apply(); save(); });
    };
    const ws = document.querySelector('.workspace');
    bind($('split-v'), e => {
      const r = ws.getBoundingClientRect();
      const railW = $('rail').getBoundingClientRect().width;
      saved.contentW = Math.round(State.clamp(e.clientX - r.left - railW - 3, 340, r.width - railW - 420));
      rootEl.style.setProperty('--content-w', saved.contentW + 'px');
    }, () => { delete saved.contentW; });
    bind($('split-h'), e => {
      saved.tlH = Math.round(State.clamp(window.innerHeight - e.clientY - 22 - 3, 220, window.innerHeight - 320));
      rootEl.style.setProperty('--tl-h', saved.tlH + 'px');
    }, () => { delete saved.tlH; });
  }

  /* ---------- Səs səviyyəsi göstəricisi ---------- */
  const meterPeak = [-60, -60];
  function meterLoop() {
    const c = $('meter-canvas'), g = c.getContext('2d');
    const levels = Renderer.playing ? Renderer.getLevels() : [-60, -60];
    g.clearRect(0, 0, c.width, c.height);
    const bw = (c.width - 6) / 2;
    levels.forEach((db, i) => {
      meterPeak[i] = Math.max(db, meterPeak[i] - 0.6);
      const h = (1 - Math.max(-60, db) / -60) * c.height;
      const grad = g.createLinearGradient(0, c.height, 0, 0);
      grad.addColorStop(0, '#2fbf71'); grad.addColorStop(0.7, '#2fbf71'); grad.addColorStop(0.85, '#f5c542'); grad.addColorStop(1, '#ff4d4d');
      g.fillStyle = '#242424'; g.fillRect(2 + i * (bw + 2), 0, bw, c.height);
      g.fillStyle = grad; g.fillRect(2 + i * (bw + 2), c.height - h, bw, h);
      const ph = (1 - Math.max(-60, meterPeak[i]) / -60) * c.height;
      g.fillStyle = '#ddd'; g.fillRect(2 + i * (bw + 2), c.height - ph - 1, bw, 2);
    });
    requestAnimationFrame(meterLoop);
  }

  /* ---------- Qısayollar ---------- */
  function onKey(e) {
    const tag = (e.target.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
    const k = e.key.toLowerCase();
    const ctrl = e.ctrlKey || e.metaKey;
    if (k === 'escape') {
      closeMenus();
      if (pickCb) { pickCb = null; $('preview').classList.remove('picking'); }
      for (const m of document.querySelectorAll('.modal:not(.hidden)')) if (m.id !== 'dlg-export' || !Exporter.running) m.classList.add('hidden');
      if (!typing) State.select([]);
      return;
    }
    if (typing && !(ctrl && ['s', 'e', 'o', 'n'].includes(k))) return;
    if (document.querySelector('.modal:not(.hidden)')) return;
    const fps = State.project.fps || 30;
    if (k === ' ') { e.preventDefault(); Renderer.toggle(); }
    else if (ctrl && k === 'z') { e.preventDefault(); if (e.shiftKey) State.redo(); else State.undo(); }
    else if (ctrl && k === 'y') { e.preventDefault(); State.redo(); }
    else if (ctrl && k === 'b') { e.preventDefault(); splitAtPlayhead(); }
    else if (ctrl && k === 'd') { e.preventDefault(); duplicateSelected(); }
    else if (ctrl && k === 'c') { e.preventDefault(); copySelected(); }
    else if (ctrl && k === 'x') { e.preventDefault(); cutSelected(); }
    else if (ctrl && k === 'v') { e.preventDefault(); pasteClipboard(); }
    else if (ctrl && k === 's') { e.preventDefault(); saveProject(); }
    else if (ctrl && k === 'e') { e.preventDefault(); Exporter.open(); }
    else if (ctrl && k === 'o') { e.preventDefault(); $('file-project').click(); }
    else if (ctrl && k === 'n') { e.preventDefault(); newProject(); }
    else if (ctrl && k === 'i') { e.preventDefault(); $('file-import').click(); }
    else if (ctrl && k === 't') { e.preventDefault(); addTextClip(); }
    else if (ctrl && k === 'a') { e.preventDefault(); selectAll(); }
    else if (k === 'delete' || k === 'backspace') { e.preventDefault(); deleteSelected(); }
    else if (k === 'q') trimAtPlayhead('left');
    else if (k === 'w') trimAtPlayhead('right');
    else if (k === 'f') Timeline.zoomToFit();
    else if (k === 'home') { e.preventDefault(); Renderer.seek(0); }
    else if (k === 'end') { e.preventDefault(); Renderer.seek(State.duration()); }
    else if (k === 'arrowleft') { e.preventDefault(); Renderer.seek(State.playhead - (e.shiftKey ? 1 : 1 / fps)); }
    else if (k === 'arrowright') { e.preventDefault(); Renderer.seek(State.playhead + (e.shiftKey ? 1 : 1 / fps)); }
    else if (k === '+' || k === '=') Timeline.setZoom(Timeline.pxPerSec * 1.25);
    else if (k === '-') Timeline.setZoom(Timeline.pxPerSec / 1.25);
  }

  /* ---------- Başlatma ---------- */
  function init() {
    Timeline.init();
    Exporter.init();
    Recorder.init();
    Cover.init();
    buildPanels();
    initSubtabs();
    initSplitters();

    State.on((reason, source) => {
      const insp = $('inspector');
      const st = insp.scrollTop;
      if (reason === 'project') { Timeline.render(); Inspector.render(); Renderer.refresh(); Media.renderLibrary(); }
      else if (reason === 'selection') { Timeline.refreshSelection(); Inspector.render(); if (State.selection.length) showPage('props'); }
      else if (reason === 'light') { Renderer.refresh(); }
      else { Timeline.render(); Inspector.render(); Renderer.refresh(); Media.renderLibrary(); }
      if (reason === 'structure') insp.scrollTop = st;
      syncProjectUI();
      updateTime();
    });

    Renderer.hooks.onTime = () => { Timeline.updatePlayhead(); if (Renderer.playing) Timeline.followPlayhead(); updateTime(); };
    Renderer.hooks.onPlayState = playing => { $('btn-play').innerHTML = ICON(playing ? 'pause' : 'play'); };
    document.addEventListener('pointerdown', () => Renderer.ensureAudio(), { once: true });

    // Menyu zolağı
    for (const b of document.querySelectorAll('.menu-item')) {
      b.addEventListener('click', () => openMenuName === b.dataset.menu ? closeMenus() : openMenu(b.dataset.menu));
      b.addEventListener('pointerenter', () => { if (openMenuName && openMenuName !== b.dataset.menu) openMenu(b.dataset.menu); });
    }
    document.addEventListener('pointerdown', e => { if (openMenuName && !e.target.closest('#dropdown') && !e.target.closest('.menu-item')) closeMenus(); });

    // Sol panel
    $('rail').addEventListener('click', e => { const b = e.target.closest('.rail-item'); if (b) showPage(b.dataset.page); });
    $('btn-import').addEventListener('click', () => $('file-import').click());
    $('files-add').addEventListener('click', () => $('file-import').click());
    $('btn-import-audio').addEventListener('click', () => $('file-import-audio').click());
    $('btn-rec-mic').addEventListener('click', () => Recorder.open('mic'));
    $('tl-record').addEventListener('click', () => Recorder.open('mic'));
    for (const b of document.querySelectorAll('.record-card')) b.addEventListener('click', () => Recorder.open(b.dataset.rec));
    $('btn-add-text').addEventListener('click', () => addTextClip());
    $('files-search').addEventListener('input', e => Media.setFilesFilter(null, e.target.value));
    for (const b of document.querySelectorAll('#sub-import-files .cat')) b.addEventListener('click', () => { for (const x of b.parentElement.children) x.classList.toggle('active', x === b); Media.setFilesFilter(b.dataset.cat, null); });

    // Fayl girişləri
    $('file-import').addEventListener('change', async e => { await Media.importFiles([...e.target.files]); e.target.value = ''; });
    $('file-import-audio').addEventListener('change', async e => { await Media.importFiles([...e.target.files]); e.target.value = ''; });
    $('file-project').addEventListener('change', async e => { if (e.target.files[0]) await openProjectFile(e.target.files[0]); e.target.value = ''; });
    $('file-missing').addEventListener('change', async e => { await relinkFiles([...e.target.files]); e.target.value = ''; });

    // Sürüklə-burax
    const dz = $('drop-zone');
    window.addEventListener('dragover', e => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); });
    window.addEventListener('drop', e => { if (e.dataTransfer.types.includes('Files') && !e.target.closest('#timeline-scroll')) { e.preventDefault(); Media.importFiles([...e.dataTransfer.files]); } });
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('over'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('over'));
    dz.addEventListener('drop', () => dz.classList.remove('over'));

    // Önizləmə
    $('btn-play').addEventListener('click', () => Renderer.toggle());
    $('btn-to-start').addEventListener('click', () => Renderer.seek(0));
    $('btn-to-end').addEventListener('click', () => Renderer.seek(State.duration()));
    $('btn-step-back').addEventListener('click', () => Renderer.seek(State.playhead - 1 / (State.project.fps || 30)));
    $('btn-step-fwd').addEventListener('click', () => Renderer.seek(State.playhead + 1 / (State.project.fps || 30)));
    $('btn-monitor-mute').addEventListener('click', toggleMonitor);
    $('btn-fullscreen').addEventListener('click', fullscreen);
    $('btn-project-settings').addEventListener('click', () => { State.select([]); showPage('props'); });
    $('ratio-select').addEventListener('change', e => State.setRatio(e.target.value));
    const seekFrom = e => { const r = $('seekbar').getBoundingClientRect(); Renderer.seek((e.clientX - r.left) / r.width * State.duration()); };
    let seeking = false;
    $('seekbar').addEventListener('pointerdown', e => { seeking = true; seekFrom(e); });
    window.addEventListener('pointermove', e => { if (seeking) seekFrom(e); });
    window.addEventListener('pointerup', () => { seeking = false; });
    $('preview').addEventListener('click', e => {
      if (!pickCb) return;
      const c = $('preview'), r = c.getBoundingClientRect();
      const x = Math.floor((e.clientX - r.left) / r.width * c.width), y = Math.floor((e.clientY - r.top) / r.height * c.height);
      const d = c.getContext('2d').getImageData(x, y, 1, 1).data;
      const hex = '#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join('');
      const cb = pickCb; pickCb = null; c.classList.remove('picking'); cb(hex);
    });

    // Zaman xətti alətləri
    $('tl-undo').addEventListener('click', () => State.undo());
    $('tl-redo').addEventListener('click', () => State.redo());
    $('tl-split').addEventListener('click', splitAtPlayhead);
    $('tl-delete').addEventListener('click', deleteSelected);
    $('tl-duplicate').addEventListener('click', duplicateSelected);
    $('tl-copy').addEventListener('click', copySelected);
    $('tl-cut').addEventListener('click', cutSelected);
    $('tl-paste').addEventListener('click', pasteClipboard);
    $('tl-trim-left').addEventListener('click', () => trimAtPlayhead('left'));
    $('tl-trim-right').addEventListener('click', () => trimAtPlayhead('right'));
    $('tl-fit').addEventListener('click', () => Timeline.zoomToFit());
    $('tl-zoom-in').addEventListener('click', () => Timeline.setZoom(Timeline.pxPerSec * 1.25));
    $('tl-zoom-out').addEventListener('click', () => Timeline.setZoom(Timeline.pxPerSec / 1.25));
    $('tl-add-track').addEventListener('click', e => {
      const r = e.currentTarget.getBoundingClientRect();
      contextMenu(r.left, r.bottom + 4, [
        { label: 'Video / şəkil treki', action: () => addTrack('video') },
        { label: 'Mətn treki', action: () => addTrack('text') },
        { label: 'Audio treki', action: () => addTrack('audio') }
      ]);
    });
    $('btn-export').addEventListener('click', () => Exporter.open());

    // Dialoqlar
    $('confirm-yes').addEventListener('click', () => { $('dlg-confirm').classList.add('hidden'); const cb = confirmCb; confirmCb = null; cb && cb(); });
    $('confirm-no').addEventListener('click', () => { $('dlg-confirm').classList.add('hidden'); confirmCb = null; });
    $('prompt-yes').addEventListener('click', () => { $('dlg-prompt').classList.add('hidden'); const v = $('prompt-input').value.trim(); const cb = promptCb; promptCb = null; if (v && cb) cb(v); });
    $('prompt-no').addEventListener('click', () => { $('dlg-prompt').classList.add('hidden'); promptCb = null; });
    $('prompt-input').addEventListener('keydown', e => { if (e.key === 'Enter') $('prompt-yes').click(); e.stopPropagation(); });
    $('missing-pick').addEventListener('click', () => $('file-missing').click());
    $('missing-skip').addEventListener('click', () => $('dlg-missing').classList.add('hidden'));
    $('about-close').addEventListener('click', () => $('dlg-about').classList.add('hidden'));

    document.addEventListener('keydown', onKey);
    new ResizeObserver(fitCanvas).observe($('canvas-wrap'));
    setInterval(autosave, 20000);
    window.addEventListener('beforeunload', autosave);
    meterLoop();

    State.newProject('16:9');
    requestAnimationFrame(() => { fitCanvas(); Timeline.render(); Renderer.refresh(); });
  }
  document.addEventListener('DOMContentLoaded', init);

  /* ---------- Test (smoke) qarmaqları ---------- */
  const errors = [];
  window.addEventListener('error', e => errors.push(e.message));
  window.addEventListener('unhandledrejection', e => errors.push(String(e.reason)));
  window.__smokeStart = async () => {
    const c = document.createElement('canvas'); c.width = 640; c.height = 360;
    const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 640, 360); gr.addColorStop(0, '#ff7a59'); gr.addColorStop(1, '#4fb3ff');
    g.fillStyle = gr; g.fillRect(0, 0, 640, 360);
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    await Media.importFiles([new File([blob], 'test-sekil.png', { type: 'image/png' })]);
    const id = [...State.media.keys()][0];
    Media.addToTimeline(id, 0);
    const sr = 22050, n = sr * 3, pcm = new Int16Array(n);
    for (let i = 0; i < n; i++) { const env = (i % sr) < sr / 2 ? 1 : 0.15; pcm[i] = Math.sin(i / sr * 440 * 2 * Math.PI) * 12000 * env; }
    const hdr = new ArrayBuffer(44), dv = new DataView(hdr);
    const str = (o, t) => { for (let i = 0; i < t.length; i++) dv.setUint8(o + i, t.charCodeAt(i)); };
    str(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt '); dv.setUint32(16, 16, true);
    dv.setUint16(20, 1, true); dv.setUint16(22, 1, true); dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true);
    dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); str(36, 'data'); dv.setUint32(40, n * 2, true);
    await Media.importFiles([new File([hdr, pcm.buffer], 'test-ses.wav', { type: 'audio/wav' })]);
    const aid = [...State.media.keys()][1];
    Media.addToTimeline(aid, 0);
    await new Promise(r => setTimeout(r, 800));
    window.__peaks = (State.media.get(aid).peaks || []).length;
    addTextClip(Inspector.TEXT_PRESETS[0], 'Salam, Kəsyapışdır!');
    Media.addToTimeline(id, 5);
    // keçid + maska + animasiya testi
    const main = [...State.project.tracks].reverse().find(t => t.type === 'video');
    State.mutate(() => {
      main.clips[0].transition = { type: 'circle', duration: 1 };
      main.clips[1].mask = { type: 'heart', size: 60, feather: 20, invert: false, x: 0, y: 0 };
      main.clips[1].anim.in = { type: 'zoom-in', duration: 0.5 };
      main.clips[0].retouch = { enabled: true, smooth: 40, whiten: 20, clarity: 10, warmth: 30 };
    });
    // cerceve ile secim testi (sag duyme ile suruklenme)
    const els = document.querySelectorAll('#tracks .clip');
    const r1 = els[0].getBoundingClientRect(), r2 = els[els.length - 1].getBoundingClientRect();
    const ev = (type, target, x, y, button) => target.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, button, buttons: button === 2 ? 2 : 1, pointerId: 1 }));
    ev('pointerdown', document.getElementById('tracks'), r1.left + 4, r1.top + 4, 2);
    ev('pointermove', window, r2.right - 4, r2.bottom - 4, 2);
    ev('pointerup', window, r2.right - 4, r2.bottom - 4, 2);
    window.__marquee = State.selection.length;
    State.select([main.clips[0].id]);
    Renderer.seek(5.4);
    showPage('props');
    await new Promise(r => setTimeout(r, 300));
  };
  window.__smokeExport = async () => {
    State.mutate(p => { p.cover = { dataUrl: Renderer.canvas.toDataURL('image/jpeg', 0.8), time: 0 }; });
    Exporter.open();
    const res = await Exporter.start();
    Exporter.close();
    return res ? `${res.size} bayt, ${res.type}` : 'ixrac alınmadı';
  };
  window.__smokeReport = () => JSON.stringify({
    errors, peaks: window.__peaks, marquee: window.__marquee, duration: State.duration(), tracks: State.project.tracks.map(t => `${t.name}:${t.clips.length}`),
    canvas: `${Renderer.canvas.width}x${Renderer.canvas.height}`, selection: State.selection, media: State.media.size,
    transitions: Transitions.LIST.length, page: currentPage
  }, null, 1);

  return {
    toast, confirm, prompt, contextMenu, download, showPage, pickColor,
    splitAtPlayhead, trimAtPlayhead, deleteSelected, duplicateSelected, copySelected, cutSelected, pasteClipboard,
    addTextClip, addTrack, applyTransition, saveProject, newProject, saveFramePng
  };
})();
