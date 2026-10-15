/* ===== Kəsyapışdır — Xüsusiyyətlər paneli: Video / Səs / Sürət / Animasiya / Tənzimlə ===== */
const Inspector = (() => {
  const root = document.getElementById('inspector');
  let editing = false;
  let tab = {}, sub = {};   // klip tipinə görə yadda saxlanan nişanlar

  const ICON = n => `<svg class="ic"><use href="#i-${n}"/></svg>`;
  const FONTS = ['"Segoe UI", Arial, sans-serif', 'Arial', 'Impact', 'Georgia', '"Times New Roman"', 'Verdana', 'Tahoma',
    '"Trebuchet MS"', '"Comic Sans MS"', '"Courier New"', '"Lucida Console"', 'Cambria', '"Brush Script MT"', '"Segoe Script"', 'Bahnschrift'];
  const FONT_NAMES = ['Segoe UI', 'Arial', 'Impact', 'Georgia', 'Times New Roman', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Comic Sans MS',
    'Courier New', 'Lucida Console', 'Cambria', 'Brush Script', 'Segoe Script', 'Bahnschrift'];
  const FILTER_PRESETS = [
    { name: 'Normal', f: {} },
    { name: 'Canlı', f: { saturate: 145, contrast: 110 } },
    { name: 'İsti', f: { sepia: 25, saturate: 125, brightness: 105 } },
    { name: 'Soyuq', f: { hue: 18, saturate: 110, contrast: 105, brightness: 102 } },
    { name: 'Qara-ağ', f: { grayscale: 100, contrast: 115 } },
    { name: 'Vintaj', f: { sepia: 55, contrast: 90, brightness: 96, saturate: 80 } },
    { name: 'Dramatik', f: { contrast: 140, saturate: 80, brightness: 88 } },
    { name: 'Solğun', f: { contrast: 82, brightness: 110, saturate: 70 } },
    { name: 'Yumşaq', f: { blur: 1.5, brightness: 105, saturate: 95 } },
    { name: 'Neon', f: { saturate: 200, hue: 300, contrast: 120 } },
    { name: 'Gün batımı', f: { sepia: 35, saturate: 160, hue: 345, contrast: 105 } },
    { name: 'Kino', f: { contrast: 118, saturate: 85, brightness: 94, sepia: 10 } }
  ];
  const TEXT_PRESETS = [
    { name: 'Başlıq', t: { bold: true, size: 96, color: '#ffffff', stroke: '#000000', strokeWidth: 6, shadow: true } },
    { name: 'Altyazı', t: { bold: false, size: 56, color: '#ffffff', bg: 'rgba(0,0,0,0.6)', strokeWidth: 0, shadow: false } },
    { name: 'Neon', t: { bold: true, size: 84, color: '#39ff14', stroke: '#0a5d00', strokeWidth: 3, shadow: true, font: 'Impact' } },
    { name: 'Etiket', t: { bold: true, size: 60, color: '#ffffff', bg: '#ff2d55', strokeWidth: 0, shadow: false } },
    { name: 'Sarı', t: { bold: true, size: 84, color: '#ffe14d', stroke: '#000000', strokeWidth: 5, shadow: true, font: 'Impact' } },
    { name: 'Zərif', t: { bold: false, italic: true, size: 72, color: '#fff5e6', strokeWidth: 0, shadow: true, font: 'Georgia' } },
    { name: 'Yazı maşını', t: { bold: false, size: 60, color: '#e6e6e6', bg: 'rgba(20,20,20,0.85)', font: '"Courier New"', strokeWidth: 0, shadow: false } },
    { name: 'Mavi kontur', t: { bold: true, size: 84, color: '#ffffff', stroke: '#1e5bff', strokeWidth: 8, shadow: false, font: 'Arial' } }
  ];
  const ANIMS = [['none', 'Yoxdur'], ['fade', 'Solma'], ['slide-left', 'Soldan'], ['slide-right', 'Sağdan'], ['slide-up', 'Yuxarıdan'], ['slide-down', 'Aşağıdan'], ['zoom-in', 'Böyümə'], ['zoom-out', 'Kiçilmə'], ['spin', 'Fırlanma'], ['bounce', 'Sıçrayış']];
  const ANIMS_OUT = [['none', 'Yoxdur'], ['fade', 'Solma'], ['slide-left', 'Sola'], ['slide-right', 'Sağa'], ['slide-up', 'Yuxarı'], ['slide-down', 'Aşağı'], ['zoom-in', 'Kiçilmə'], ['zoom-out', 'Böyümə'], ['spin', 'Fırlanma'], ['bounce', 'Sıçrayış']];
  const MASKS = [['none', 'Yoxdur'], ['rect', 'Düzbucaqlı'], ['circle', 'Dairə'], ['linear', 'Xətti'], ['heart', 'Ürək'], ['star', 'Ulduz']];
  const BLENDS = [['source-over', 'Normal'], ['multiply', 'Vurma'], ['screen', 'Ekran'], ['overlay', 'Üst-üstə'], ['lighten', 'Açıqlaşdır'], ['darken', 'Tündləşdir'], ['difference', 'Fərq'], ['hard-light', 'Sərt işıq'], ['soft-light', 'Yumşaq işıq']];

  /* ---- Köməkçilər ---- */
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const round = (v, d = 2) => Math.round(v * Math.pow(10, d)) / Math.pow(10, d);
  function beginEdit() { if (!editing) { State.pushHistory(); editing = true; } }
  function liveEmit() { State.emit('light', 'inspector'); }
  function commitEmit() { editing = false; State.emit('structure', 'inspector'); }
  function mut(fn) { beginEdit(); fn(); commitEmit(); }

  /* Bölmə: başlıq (checkbox + ad + sıfırla) + gövdə */
  function section(parent, title, { enabled = null, onEnable = null, onReset = null, open = true, cls = '' } = {}) {
    const d = h('details', 'sec ' + cls); d.open = open;
    const sum = h('summary', 'sec-head');
    if (enabled !== null) {
      const cb = h('input'); cb.type = 'checkbox'; cb.className = 'sec-check'; cb.checked = !!enabled;
      cb.addEventListener('click', e => e.stopPropagation());
      cb.addEventListener('change', () => onEnable && onEnable(cb.checked));
      sum.appendChild(cb);
    }
    sum.appendChild(h('span', 'sec-title', esc(title)));
    sum.appendChild(h('span', 'sec-caret', ICON('chevron')));
    if (onReset) {
      const rb = h('button', 'sec-reset', ICON('rotate')); rb.title = 'Sıfırla';
      rb.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); onReset(); });
      sum.appendChild(rb);
    }
    d.appendChild(sum);
    const body = h('div', 'sec-body');
    d.appendChild(body);
    parent.appendChild(d);
    return body;
  }
  /* Sürgü + rəqəm sahəsi (etiket yuxarıda) */
  function slider(parent, label, get, set, min, max, step = 1, { def = null, unit = '', fmt = v => round(v) } = {}) {
    const row = h('div', 'prow');
    row.appendChild(h('div', 'plabel', esc(label)));
    const ctrl = h('div', 'pctrl');
    const r = h('input'); r.type = 'range'; r.min = min; r.max = max; r.step = step; r.value = get();
    const n = h('input'); n.type = 'number'; n.min = min; n.max = max; n.step = step; n.value = fmt(get());
    if (unit) { const u = h('span', 'punit', unit); ctrl.appendChild(r); ctrl.appendChild(n); ctrl.appendChild(u); }
    else { ctrl.appendChild(r); ctrl.appendChild(n); }
    r.addEventListener('input', () => { beginEdit(); set(+r.value); n.value = fmt(+r.value); liveEmit(); });
    r.addEventListener('change', commitEmit);
    n.addEventListener('change', () => { beginEdit(); const v = State.clamp(+n.value || 0, min, max); set(v); r.value = v; n.value = fmt(v); commitEmit(); });
    if (def !== null) r.addEventListener('dblclick', () => { beginEdit(); set(def); r.value = def; n.value = fmt(def); commitEmit(); });
    row.appendChild(ctrl);
    parent.appendChild(row);
    return r;
  }
  function numberInline(parent, label, get, set, min, max, step = 0.01, unit = '') {
    const row = h('div', 'prow inline');
    row.appendChild(h('div', 'plabel', esc(label)));
    const n = h('input'); n.type = 'number'; n.min = min; n.max = max; n.step = step; n.value = round(get());
    n.addEventListener('change', () => { beginEdit(); set(State.clamp(+n.value || 0, min, max)); n.value = round(get()); commitEmit(); });
    const ctrl = h('div', 'pctrl'); ctrl.appendChild(n); if (unit) ctrl.appendChild(h('span', 'punit', unit));
    row.appendChild(ctrl); parent.appendChild(row);
    return n;
  }
  function selectRow(parent, label, options, get, set) {
    const row = h('div', 'prow inline');
    row.appendChild(h('div', 'plabel', esc(label)));
    const s = h('select');
    for (const [v, name] of options) { const o = h('option', null, esc(name)); o.value = v; s.appendChild(o); }
    s.value = get();
    s.addEventListener('change', () => { beginEdit(); set(s.value); commitEmit(); });
    const ctrl = h('div', 'pctrl'); ctrl.appendChild(s);
    row.appendChild(ctrl); parent.appendChild(row);
    return s;
  }
  function colorRow(parent, label, get, set, { allowNone = false, extra = null } = {}) {
    const row = h('div', 'prow inline');
    row.appendChild(h('div', 'plabel', esc(label)));
    const ctrl = h('div', 'pctrl');
    const c = h('input'); c.type = 'color';
    const cur = get();
    c.value = /^#[0-9a-f]{6}$/i.test(cur) ? cur : '#ffffff';
    c.addEventListener('input', () => { beginEdit(); set(c.value); liveEmit(); });
    c.addEventListener('change', commitEmit);
    ctrl.appendChild(c);
    if (allowNone) { const b = h('button', 'abtn' + (!cur ? ' on' : ''), 'Yoxdur'); b.addEventListener('click', () => mut(() => set(''))); ctrl.appendChild(b); }
    if (extra) ctrl.appendChild(extra);
    row.appendChild(ctrl); parent.appendChild(row);
  }
  function toggleRow(parent, label, get, set) {
    const row = h('div', 'prow inline');
    row.appendChild(h('div', 'plabel', esc(label)));
    const sw = h('label', 'switch'); const cb = h('input'); cb.type = 'checkbox'; cb.checked = !!get();
    sw.appendChild(cb); sw.appendChild(h('span'));
    cb.addEventListener('change', () => mut(() => set(cb.checked)));
    const ctrl = h('div', 'pctrl'); ctrl.appendChild(sw);
    row.appendChild(ctrl); parent.appendChild(row);
  }
  function buttons(parent, items, cls = 'pgrid') {
    const row = h('div', cls);
    for (const it of items) {
      const b = h('button', 'abtn' + (it.on ? ' on' : ''), it.icon ? ICON(it.icon) + (it.label ? `<span>${esc(it.label)}</span>` : '') : esc(it.label));
      if (it.title) b.title = it.title;
      b.addEventListener('click', it.onClick);
      row.appendChild(b);
    }
    parent.appendChild(row);
    return row;
  }
  function tabsBar(parent, items, current, onPick, cls = 'insp-tabs') {
    const bar = h('div', cls);
    for (const [id, name] of items) {
      const b = h('button', (cls === 'insp-tabs' ? 'ptab' : 'stab') + (id === current ? ' active' : ''), esc(name));
      b.addEventListener('click', () => onPick(id));
      bar.appendChild(b);
    }
    parent.appendChild(bar);
  }
  const dbOf = v => (v <= 0 ? -60 : Math.max(-60, 20 * Math.log10(v)));
  const volOf = db => (db <= -60 ? 0 : Math.pow(10, db / 20));

  /* ==================== LAYİHƏ ==================== */
  function renderProject() {
    const p = State.project;
    root.appendChild(h('div', 'insp-title', `${ICON('settings')}<span>Layihə parametrləri</span>`));
    const b = section(root, 'Əsas');
    const row = h('div', 'prow inline'); row.appendChild(h('div', 'plabel', 'Ad'));
    const name = h('input'); name.value = p.name; name.className = 'ptext';
    name.addEventListener('change', () => State.mutate(() => { p.name = name.value.trim() || 'Adsız layihə'; }));
    name.addEventListener('keydown', e => e.stopPropagation());
    const ctrl = h('div', 'pctrl'); ctrl.appendChild(name); row.appendChild(ctrl); b.appendChild(row);
    selectRow(b, 'Nisbət', Object.keys(State.RATIOS).map(r => [r, `${r}  (${State.RATIOS[r][0]}×${State.RATIOS[r][1]})`]), () => p.ratio, v => { p.ratio = v; p.width = State.RATIOS[v][0]; p.height = State.RATIOS[v][1]; });
    selectRow(b, 'Kadr sürəti', [['24', '24 fps'], ['25', '25 fps'], ['30', '30 fps'], ['60', '60 fps']], () => String(p.fps), v => { p.fps = +v; });
    const bg = section(root, 'Arxa fon');
    colorRow(bg, 'Rəng', () => p.bg, v => { p.bg = v; });
    toggleRow(bg, 'Bulanıq fon', () => p.bgBlur, v => { p.bgBlur = v; });
    bg.appendChild(h('p', 'hint', 'Videonun ölçüsü layihəyə uyğun gəlmədikdə boş sahələr həmin kadrın bulanıq versiyası ilə dolur.'));
    const cv = section(root, 'Qapaq (üz şəkli)');
    cv.appendChild(h('p', 'hint', p.cover ? 'Qapaq təyin edilib. İxracda videonun ilk kadrı kimi qoyulur.' : 'Qapaq seçilməyib.'));
    buttons(cv, [{ icon: 'edit', label: p.cover ? 'Qapağı dəyiş' : 'Qapaq seç', onClick: () => Cover.show() }], 'btn-row');
    const info = section(root, 'Statistika', { open: false });
    const clips = p.tracks.reduce((n, t) => n + t.clips.length, 0);
    info.appendChild(h('p', 'hint', `Treklər: ${p.tracks.length}<br>Kliplər: ${clips}<br>Müddət: ${Media.fmtTime(State.duration(), true)}<br>Media faylları: ${State.media.size}`));
    const help = section(root, 'Qısayollar', { open: false, cls: 'sec-help' });
    help.appendChild(h('p', 'hint', [
      'Boşluq — oxut/dayandır', 'Ctrl+B — böl', 'Q / W — başlıqdan sol/sağ tərəfi kəs', 'Delete — sil',
      'Ctrl+C / Ctrl+X / Ctrl+V — kopyala / kəs / yapışdır', 'Ctrl+D — dublikat', 'Ctrl+A — hamısını seç',
      'Ctrl+Z / Ctrl+Y — geri / irəli', 'Ctrl+N — yeni layihə', 'Ctrl+S — yadda saxla', 'Ctrl+O — layihə aç', 'Ctrl+E — ixrac',
      'Ctrl+I — media əlavə et', 'Ctrl+T — mətn əlavə et', '← / → — bir kadr, Shift ilə 1 saniyə', 'Home / End — başa / sona',
      'Ctrl + təkər — miqyas', 'F — zaman xəttini sığdır', 'Sağ klik — klip və trek menyusu'
    ].map(esc).join('<br>')));
  }

  /* ==================== KLİP ==================== */
  function renderClip(clip) {
    const m = State.media.get(clip.mediaId);
    const p = State.project;
    const typeName = { video: 'Video', image: 'Şəkil', audio: 'Audio', text: 'Mətn' }[clip.type];
    const title = h('div', 'insp-title');
    title.innerHTML = `${ICON(clip.type === 'text' ? 'type' : clip.type === 'audio' ? 'music' : clip.type === 'image' ? 'image' : 'film')}<span class="ttl">${esc(clip.type === 'text' ? clip.text.content.split('\n')[0] : (m ? m.name : 'Media tapılmadı'))}</span><span class="badge">${typeName}</span>`;
    root.appendChild(title);

    const tabs = clip.type === 'text' ? [['main', 'Mətn'], ['anim', 'Animasiya']]
      : clip.type === 'audio' ? [['audio', 'Səs'], ['speed', 'Sürət']]
        : clip.type === 'image' ? [['main', 'Şəkil'], ['anim', 'Animasiya'], ['adjust', 'Tənzimlə']]
          : [['main', 'Video'], ['audio', 'Səs'], ['speed', 'Sürət'], ['anim', 'Animasiya'], ['adjust', 'Tənzimlə']];
    if (!tab[clip.type] || !tabs.some(t => t[0] === tab[clip.type])) tab[clip.type] = tabs[0][0];
    const cur = tab[clip.type];
    tabsBar(root, tabs, cur, id => { tab[clip.type] = id; render(); });
    const body = h('div', 'insp-body'); root.appendChild(body);

    if (cur === 'main' && clip.type === 'text') renderTextTab(body, clip);
    else if (cur === 'main') renderVideoTab(body, clip, m, p);
    else if (cur === 'audio') renderAudioTab(body, clip, m);
    else if (cur === 'speed') renderSpeedTab(body, clip);
    else if (cur === 'anim') renderAnimTab(body, clip);
    else if (cur === 'adjust') renderAdjustTab(body, clip);

    // Vaxt (hər nişanda aşağıda)
    const tm = section(body, 'Vaxt', { open: false });
    numberInline(tm, 'Başlama', () => clip.start, v => {
      const { track } = State.findClip(clip.id);
      if (!State.collides(track, v, clip.duration, clip.id)) clip.start = v; State.sortTrack(track);
    }, 0, 36000, 0.01, 's');
    numberInline(tm, 'Müddət', () => clip.duration, v => {
      const { track } = State.findClip(clip.id);
      let max = State.maxDuration(clip);
      for (const c of track.clips) if (c.id !== clip.id && c.start >= clip.start + clip.duration - 1e-6) max = Math.min(max, c.start - clip.start);
      clip.duration = State.clamp(v, State.MIN_CLIP, max);
    }, State.MIN_CLIP, 36000, 0.01, 's');
    if (clip.type === 'video' || clip.type === 'audio') numberInline(tm, 'Mənbə başı', () => clip.in, v => {
      const maxIn = clip.srcDuration ? Math.max(0, clip.srcDuration - clip.duration * clip.speed) : 36000;
      clip.in = State.clamp(v, 0, maxIn);
    }, 0, 36000, 0.01, 's');
    buttons(body, [
      { icon: 'split', label: 'Böl', onClick: () => App.splitAtPlayhead() },
      { icon: 'duplicate', label: 'Dublikat', onClick: () => App.duplicateSelected() },
      { icon: 'trash', label: 'Sil', onClick: () => App.deleteSelected() }
    ], 'btn-row bottom');
  }

  /* ---- Video / Şəkil: Əsas | Arxa fon | Maska | Rötuş ---- */
  function renderVideoTab(body, clip, m, p) {
    const subs = [['basic', 'Əsas'], ['bg', 'Arxa fonu sil'], ['mask', 'Maska'], ['retouch', 'Rötuş']];
    if (!sub.video) sub.video = 'basic';
    tabsBar(body, subs, sub.video, id => { sub.video = id; render(); }, 'insp-sub');
    if (sub.video === 'basic') {
      const tr = section(body, 'Transformasiya', { onReset: () => mut(() => Object.assign(clip, { scale: 1, scaleY: 1, x: 0, y: 0, rotation: 0, flipH: false })) });
      slider(tr, 'Ölçü', () => clip.scale * 100, v => { clip.scale = v / 100; if (clip.lockScale) clip.scaleY = clip.scale; }, 5, 500, 1, { def: 100, unit: '%' });
      toggleRow(tr, 'Sabit nisbət', () => clip.lockScale, v => { clip.lockScale = v; if (v) clip.scaleY = clip.scale; });
      if (!clip.lockScale) slider(tr, 'Hündürlük', () => clip.scaleY * 100, v => { clip.scaleY = v / 100; }, 5, 500, 1, { def: 100, unit: '%' });
      const pos = h('div', 'prow'); pos.appendChild(h('div', 'plabel', 'Mövqe'));
      const pc = h('div', 'pctrl xy');
      const mk = (lab, get, set, lim) => { const w = h('label', 'xy-field', `<span>${lab}</span>`); const n = h('input'); n.type = 'number'; n.step = 1; n.value = Math.round(get()); n.addEventListener('change', () => mut(() => set(State.clamp(+n.value || 0, -lim, lim)))); w.appendChild(n); pc.appendChild(w); };
      mk('X', () => clip.x, v => { clip.x = v; }, p.width);
      mk('Y', () => clip.y, v => { clip.y = v; }, p.height);
      pos.appendChild(pc); tr.appendChild(pos);
      slider(tr, 'Fırlat', () => clip.rotation, v => { clip.rotation = v; }, -180, 180, 1, { def: 0, unit: '°' });
      // düzləndirmə
      const align = (hx, vy) => mut(() => {
        if (!m) return;
        const [dw, dh] = Renderer.fitSize(m.width || 16, m.height || 9, p.width, p.height, clip.fit);
        const sw = dw * clip.scale, sh = dh * (clip.lockScale ? clip.scale : clip.scaleY);
        if (hx != null) clip.x = hx === 0 ? -(p.width - sw) / 2 : hx === 1 ? 0 : (p.width - sw) / 2;
        if (vy != null) clip.y = vy === 0 ? -(p.height - sh) / 2 : vy === 1 ? 0 : (p.height - sh) / 2;
      });
      buttons(tr, [
        { icon: 'al-left', title: 'Sola', onClick: () => align(0, null) }, { icon: 'al-hcenter', title: 'Üfüqi mərkəz', onClick: () => align(1, null) }, { icon: 'al-right', title: 'Sağa', onClick: () => align(2, null) },
        { icon: 'al-top', title: 'Yuxarı', onClick: () => align(null, 0) }, { icon: 'al-vcenter', title: 'Şaquli mərkəz', onClick: () => align(null, 1) }, { icon: 'al-bottom', title: 'Aşağı', onClick: () => align(null, 2) }
      ], 'pgrid align');
      selectRow(tr, 'Yerləşdirmə', [['contain', 'Sığdır'], ['cover', 'Doldur']], () => clip.fit, v => { clip.fit = v; });
      toggleRow(tr, 'Üfüqi çevir', () => clip.flipH, v => { clip.flipH = v; });

      const bl = section(body, 'Qarışdırma', { onReset: () => mut(() => { clip.opacity = 1; clip.blend = 'source-over'; }) });
      slider(bl, 'Şəffaflıq', () => clip.opacity * 100, v => { clip.opacity = v / 100; }, 0, 100, 1, { def: 100, unit: '%' });
      selectRow(bl, 'Rejim', BLENDS, () => clip.blend, v => { clip.blend = v; });
      renderTransitionSection(body, clip);
    } else if (sub.video === 'bg') {
      const ch = clip.chroma;
      const s = section(body, 'Xroma açarı', { enabled: ch.enabled, onEnable: v => mut(() => { ch.enabled = v; }), onReset: () => mut(() => Object.assign(ch, { enabled: false, color: '#00ff00', tolerance: 30, softness: 10 })) });
      s.appendChild(h('p', 'hint', 'Yaşıl və ya mavi fonda çəkilmiş videoda seçilən rəng şəffaf olur. Rəngi önizləmədən pipetlə götürə bilərsiniz.'));
      const pick = h('button', 'abtn', ICON('cursor') + '<span>Pipet</span>');
      pick.addEventListener('click', () => App.pickColor(hex => mut(() => { ch.color = hex; ch.enabled = true; })));
      colorRow(s, 'Rəng', () => ch.color, v => { ch.color = v; }, { extra: pick });
      slider(s, 'Həssaslıq', () => ch.tolerance, v => { ch.tolerance = v; }, 0, 100, 1, { def: 30 });
      slider(s, 'Kənar yumşaqlığı', () => ch.softness, v => { ch.softness = v; }, 0, 100, 1, { def: 10 });
    } else if (sub.video === 'mask') {
      const mk = clip.mask;
      const s = section(body, 'Maska', { onReset: () => mut(() => Object.assign(mk, { type: 'none', size: 50, feather: 0, invert: false, x: 0, y: 0 })) });
      buttons(s, MASKS.map(([id, name]) => ({ label: name, on: mk.type === id, onClick: () => mut(() => { mk.type = id; }) })));
      if (mk.type !== 'none') {
        slider(s, 'Ölçü', () => mk.size, v => { mk.size = v; }, 1, 150, 1, { def: 50, unit: '%' });
        slider(s, 'Kənar yumşaqlığı', () => mk.feather, v => { mk.feather = v; }, 0, 100, 1, { def: 0 });
        slider(s, 'Mövqe X', () => mk.x, v => { mk.x = v; }, -p.width / 2, p.width / 2, 1, { def: 0 });
        slider(s, 'Mövqe Y', () => mk.y, v => { mk.y = v; }, -p.height / 2, p.height / 2, 1, { def: 0 });
        toggleRow(s, 'Tərs çevir', () => mk.invert, v => { mk.invert = v; });
      }
    } else if (sub.video === 'retouch') {
      const r = clip.retouch;
      const s = section(body, 'Dəri', { enabled: r.enabled, onEnable: v => mut(() => { r.enabled = v; }), onReset: () => mut(() => Object.assign(r, { enabled: false, smooth: 0, whiten: 0, clarity: 0, warmth: 0 })) });
      slider(s, 'Pürüzsüzləşdir', () => r.smooth, v => { r.smooth = v; }, 0, 100, 1, { def: 0 });
      slider(s, 'Ağartma', () => r.whiten, v => { r.whiten = v; }, 0, 100, 1, { def: 0 });
      slider(s, 'Aydınlıq', () => r.clarity, v => { r.clarity = v; }, 0, 100, 1, { def: 0 });
      slider(s, 'İstilik', () => r.warmth, v => { r.warmth = v; }, -100, 100, 1, { def: 0 });
      s.appendChild(h('p', 'hint', 'Rötuş bütün kadra tətbiq olunur: yumşaltma dəri qüsurlarını azaldır, ağartma və istilik rəng tonunu dəyişir.'));
    }
  }

  function renderTransitionSection(body, clip) {
    const next = State.nextAdjacent(clip);
    if (!next && !clip.transition) return;
    const s = section(body, 'Keçid (növbəti klipə)', { onReset: () => mut(() => { clip.transition = null; }) });
    if (!next) { s.appendChild(h('p', 'hint', 'Növbəti qonşu klip yoxdur, keçid göstərilmir.')); return; }
    const opts = [['none', 'Yoxdur'], ...Transitions.LIST.map(t => [t.id, t.name])];
    selectRow(s, 'Növ', opts, () => (clip.transition ? clip.transition.type : 'none'), v => { clip.transition = v === 'none' ? null : { type: v, duration: clip.transition ? clip.transition.duration : 1 }; });
    if (clip.transition) slider(s, 'Müddət', () => clip.transition.duration, v => { clip.transition.duration = v; }, 0.2, Math.max(0.2, Math.min(5, next.duration, clip.duration)), 0.1, { def: 1, unit: 's', fmt: v => round(v, 1) });
  }

  /* ---- Səs ---- */
  function renderAudioTab(body, clip, m) {
    const s = section(body, 'Əsas', { onReset: () => mut(() => { clip.volume = 1; clip.fadeIn = 0; clip.fadeOut = 0; }) });
    slider(s, 'Səs səviyyəsi', () => dbOf(clip.volume), v => { clip.volume = volOf(v); }, -60, 12, 0.5, { def: 0, unit: 'dB', fmt: v => round(v, 1) });
    const half = Math.max(0.1, clip.duration / 2);
    slider(s, 'Aydınlanma', () => clip.fadeIn, v => { clip.fadeIn = Math.min(v, half); }, 0, Math.min(10, half), 0.1, { def: 0, unit: 's', fmt: v => round(v, 1) });
    slider(s, 'Qaralma', () => clip.fadeOut, v => { clip.fadeOut = Math.min(v, half); }, 0, Math.min(10, half), 0.1, { def: 0, unit: 's', fmt: v => round(v, 1) });
    const audioBtns = [{ icon: clip.volume === 0 ? 'volume' : 'mute', label: clip.volume === 0 ? 'Səsi aç' : 'Səssiz et', onClick: () => mut(() => { clip.volume = clip.volume === 0 ? 1 : 0; }) }];
    if (clip.type === 'video' && m && m.type === 'video' && !clip.audioDetached) audioBtns.push({ icon: 'music', label: 'Səsi ayır', title: 'Səsi ayrıca audio klipə çıxar (video səssiz qalır)', onClick: () => App.detachAudio() });
    buttons(s, audioBtns, 'btn-row');
    const n = section(body, 'Səsi normallaşdır', { enabled: clip.normalize, onEnable: v => mut(() => { clip.normalize = v; }) });
    n.appendChild(h('p', 'hint', m && m.peakMax ? `Klipin səsi standart səviyyəyə qaldırılır (pik: ${round(dbOf(m.peakMax), 1)} dB → -1 dB).` : 'Səs analizi hələ hazır deyil və ya klipdə səs yoxdur.'));
    const t = section(body, 'Ton', { open: false });
    toggleRow(t, 'Sürət dəyişəndə tonu saxla', () => clip.preservesPitch !== false, v => { clip.preservesPitch = v; });
  }

  /* ---- Sürət ---- */
  function renderSpeedTab(body, clip) {
    const applySpeed = ns => {
      const { track } = State.findClip(clip.id);
      let nd = clip.duration * clip.speed / ns, max = Infinity;
      for (const c of track.clips) if (c.id !== clip.id && c.start >= clip.start + clip.duration - 1e-6) max = Math.min(max, c.start - clip.start);
      clip.speed = round(ns, 2);
      clip.duration = State.clamp(nd, State.MIN_CLIP, Math.min(max, State.maxDuration(clip)));
    };
    const s = section(body, 'Sürət', { onReset: () => mut(() => applySpeed(1)) });
    slider(s, 'Sürət', () => Math.log10(clip.speed), v => applySpeed(Math.pow(10, v)), -1, 1, 0.01, { def: 0, unit: '×', fmt: v => round(Math.pow(10, v), 2) });
    buttons(s, [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4].map(v => ({ label: `${v}×`, on: clip.speed === v, onClick: () => mut(() => applySpeed(v)) })));
    s.appendChild(h('p', 'hint', `Yeni müddət: ${Media.fmtTime(clip.duration, true)}. Sürət artanda klip qısalır, azalanda uzanır.`));
    if (clip.type === 'video' || clip.type === 'audio') toggleRow(s, 'Tonu saxla', () => clip.preservesPitch !== false, v => { clip.preservesPitch = v; });
  }

  /* ---- Animasiya ---- */
  function renderAnimTab(body, clip) {
    const a = clip.anim;
    const half = Math.max(0.1, clip.duration / 2);
    const sIn = section(body, 'Giriş', { onReset: () => mut(() => { a.in = { type: 'none', duration: 0.5 }; }) });
    buttons(sIn, ANIMS.map(([id, name]) => ({ label: name, on: a.in.type === id, onClick: () => mut(() => { a.in.type = id; }) })));
    if (a.in.type !== 'none') slider(sIn, 'Müddət', () => a.in.duration, v => { a.in.duration = Math.min(v, half); }, 0.1, Math.min(5, half), 0.1, { def: 0.5, unit: 's', fmt: v => round(v, 1) });
    const sOut = section(body, 'Çıxış', { onReset: () => mut(() => { a.out = { type: 'none', duration: 0.5 }; }) });
    buttons(sOut, ANIMS_OUT.map(([id, name]) => ({ label: name, on: a.out.type === id, onClick: () => mut(() => { a.out.type = id; }) })));
    if (a.out.type !== 'none') slider(sOut, 'Müddət', () => a.out.duration, v => { a.out.duration = Math.min(v, half); }, 0.1, Math.min(5, half), 0.1, { def: 0.5, unit: 's', fmt: v => round(v, 1) });
    if (clip.type !== 'audio') {
      const f = section(body, 'Solma (şəffaflıq + səs)', { open: false, onReset: () => mut(() => { clip.fadeIn = 0; clip.fadeOut = 0; }) });
      slider(f, 'Görünmə', () => clip.fadeIn, v => { clip.fadeIn = Math.min(v, half); }, 0, Math.min(5, half), 0.1, { def: 0, unit: 's', fmt: v => round(v, 1) });
      slider(f, 'Yoxolma', () => clip.fadeOut, v => { clip.fadeOut = Math.min(v, half); }, 0, Math.min(5, half), 0.1, { def: 0, unit: 's', fmt: v => round(v, 1) });
    }
    if (clip.type !== 'text') renderTransitionSection(body, clip);
  }

  /* ---- Tənzimlə ---- */
  function renderAdjustTab(body, clip) {
    const f = clip.filters;
    const s = section(body, 'Rəng', { onReset: () => mut(() => { clip.filters = State.defaultFilters(); clip.temperature = 0; clip.vignette = 0; }) });
    slider(s, 'Parlaqlıq', () => f.brightness - 100, v => { f.brightness = 100 + v; }, -100, 100, 1, { def: 0 });
    slider(s, 'Kontrast', () => f.contrast - 100, v => { f.contrast = 100 + v; }, -100, 100, 1, { def: 0 });
    slider(s, 'Doyğunluq', () => f.saturate - 100, v => { f.saturate = 100 + v; }, -100, 200, 1, { def: 0 });
    slider(s, 'Temperatur', () => clip.temperature, v => { clip.temperature = v; }, -100, 100, 1, { def: 0 });
    slider(s, 'Rəng çaları', () => f.hue, v => { f.hue = v; }, 0, 360, 1, { def: 0, unit: '°' });
    slider(s, 'Boz', () => f.grayscale, v => { f.grayscale = v; }, 0, 100, 1, { def: 0 });
    slider(s, 'Sepia', () => f.sepia, v => { f.sepia = v; }, 0, 100, 1, { def: 0 });
    slider(s, 'Bulanıqlıq', () => f.blur, v => { f.blur = v; }, 0, 40, 0.5, { def: 0, unit: 'px' });
    slider(s, 'Vinyet', () => clip.vignette, v => { clip.vignette = v; }, 0, 100, 1, { def: 0 });
    const pr = section(body, 'Hazır filtrlər', { open: false });
    buttons(pr, FILTER_PRESETS.map(p => ({ label: p.name, onClick: () => mut(() => { clip.filters = Object.assign(State.defaultFilters(), p.f); }) })));
  }

  /* ---- Mətn ---- */
  function renderTextTab(body, clip) {
    const tx = clip.text;
    const s = section(body, 'Mətn');
    const ta = h('textarea', 'text-content'); ta.value = tx.content; ta.placeholder = 'Mətni daxil edin';
    ta.addEventListener('input', () => { beginEdit(); tx.content = ta.value; liveEmit(); });
    ta.addEventListener('change', commitEmit);
    ta.addEventListener('keydown', e => e.stopPropagation());
    s.appendChild(ta);
    selectRow(s, 'Şrift', FONTS.map((f, i) => [f, FONT_NAMES[i]]), () => (FONTS.includes(tx.font) ? tx.font : FONTS[0]), v => { tx.font = v; });
    slider(s, 'Ölçü', () => tx.size, v => { tx.size = v; }, 12, 400, 1, { def: 72 });
    buttons(s, [
      { label: 'B', title: 'Qalın', on: tx.bold, onClick: () => mut(() => { tx.bold = !tx.bold; }) },
      { label: 'I', title: 'Kursiv', on: tx.italic, onClick: () => mut(() => { tx.italic = !tx.italic; }) },
      { label: 'Kölgə', on: tx.shadow, onClick: () => mut(() => { tx.shadow = !tx.shadow; }) },
      { label: 'Sol', on: tx.align === 'left', onClick: () => mut(() => { tx.align = 'left'; }) },
      { label: 'Mərkəz', on: tx.align === 'center', onClick: () => mut(() => { tx.align = 'center'; }) },
      { label: 'Sağ', on: tx.align === 'right', onClick: () => mut(() => { tx.align = 'right'; }) }
    ]);
    colorRow(s, 'Rəng', () => tx.color, v => { tx.color = v; });
    colorRow(s, 'Fon', () => tx.bg, v => { tx.bg = v; }, { allowNone: true });
    colorRow(s, 'Kontur', () => tx.stroke, v => { tx.stroke = v; });
    slider(s, 'Kontur qalınlığı', () => tx.strokeWidth, v => { tx.strokeWidth = v; }, 0, 30, 1, { def: 0 });
    slider(s, 'Hərf aralığı', () => tx.letterSpacing || 0, v => { tx.letterSpacing = v; }, -10, 60, 1, { def: 0 });
    const ps = section(body, 'Hazır üslublar', { open: false });
    buttons(ps, TEXT_PRESETS.map(p => ({ label: p.name, onClick: () => mut(() => Object.assign(tx, { bg: '', italic: false, font: FONTS[0] }, p.t)) })));
    const tr = section(body, 'Transformasiya', { onReset: () => mut(() => Object.assign(clip, { scale: 1, x: 0, y: 0, rotation: 0, opacity: 1 })) });
    slider(tr, 'Ölçü', () => clip.scale * 100, v => { clip.scale = v / 100; clip.scaleY = clip.scale; }, 5, 500, 1, { def: 100, unit: '%' });
    slider(tr, 'Mövqe X', () => clip.x, v => { clip.x = v; }, -State.project.width / 2, State.project.width / 2, 1, { def: 0 });
    slider(tr, 'Mövqe Y', () => clip.y, v => { clip.y = v; }, -State.project.height / 2, State.project.height / 2, 1, { def: 0 });
    slider(tr, 'Fırlat', () => clip.rotation, v => { clip.rotation = v; }, -180, 180, 1, { def: 0, unit: '°' });
    slider(tr, 'Şəffaflıq', () => clip.opacity * 100, v => { clip.opacity = v / 100; }, 0, 100, 1, { def: 100, unit: '%' });
  }

  function renderMulti(clips) {
    root.appendChild(h('div', 'insp-title', `${ICON('layers')}<span class="ttl">${clips.length} klip seçilib</span>`));
    const b = h('div', 'insp-body');
    buttons(b, [
      { icon: 'trash', label: 'Hamısını sil', onClick: () => App.deleteSelected() },
      { icon: 'duplicate', label: 'Dublikat', onClick: () => App.duplicateSelected() },
      { icon: 'transition', label: 'Keçid əlavə et', onClick: () => App.showPage('transitions') }
    ], 'btn-row');
    b.appendChild(h('p', 'hint', 'Seçilmiş klipləri birlikdə sürükləyə bilərsiniz. Xüsusiyyətləri dəyişmək üçün bir klip seçin.'));
    root.appendChild(b);
  }

  function render() {
    root.innerHTML = '';
    editing = false;
    if (!State.project) return;
    const clips = State.selectedClips();
    if (clips.length === 0) renderProject();
    else if (clips.length === 1) renderClip(clips[0]);
    else renderMulti(clips);
  }

  return { render, FILTER_PRESETS, TEXT_PRESETS, FONTS, get editing() { return editing; } };
})();
