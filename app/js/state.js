/* ===== Kəsyapışdır — layihə vəziyyəti, tarixçə (geri/irəli), seçim ===== */
const State = (() => {
  const RATIOS = {
    '16:9': [1920, 1080], '9:16': [1080, 1920], '1:1': [1080, 1080],
    '4:3': [1440, 1080], '21:9': [2520, 1080]
  };
  const IMAGE_DEFAULT_DURATION = 5;
  const TEXT_DEFAULT_DURATION = 4;
  const MIN_CLIP = 0.1;

  let project = null;
  const media = new Map();           // mediaId -> media obyekti
  let undoStack = [], redoStack = [];
  let selection = [];                // seçilmiş klip id-ləri
  let playhead = 0;
  const listeners = [];
  let dirty = false;

  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function defaultFilters() {
    return { brightness: 100, contrast: 100, saturate: 100, grayscale: 0, sepia: 0, blur: 0, hue: 0 };
  }

  function makeTrack(type, name) {
    return { id: uid(), type, name, hidden: false, muted: false, clips: [] };
  }

  function newProject(ratio = '16:9') {
    const [w, h] = RATIOS[ratio] || RATIOS['16:9'];
    project = {
      version: 1,
      name: 'Adsız layihə',
      ratio, width: w, height: h, fps: 30,
      bg: '#000000', bgBlur: false, cover: null,
      tracks: [
        makeTrack('text', 'Mətn 1'),
        makeTrack('video', 'Video 2'),
        makeTrack('video', 'Əsas video'),
        makeTrack('audio', 'Audio 1')
      ]
    };
    undoStack = []; redoStack = []; selection = []; playhead = 0; dirty = false;
    emit('project');
  }

  function setRatio(ratio) {
    const [w, h] = RATIOS[ratio] || RATIOS['16:9'];
    pushHistory();
    project.ratio = ratio; project.width = w; project.height = h;
    emit('project');
  }

  function makeClip(type, trackId, start, opts = {}) {
    const clip = {
      id: uid(), type, trackId,
      start, duration: opts.duration || (type === 'image' ? IMAGE_DEFAULT_DURATION : TEXT_DEFAULT_DURATION),
      in: 0, speed: 1, volume: 1, opacity: 1,
      x: 0, y: 0, scale: 1, rotation: 0, fit: 'contain', flipH: false,
      fadeIn: 0, fadeOut: 0,
      filters: defaultFilters(),
      mediaId: opts.mediaId || null,
      srcDuration: opts.srcDuration || null,
      text: null
    };
    normalizeClip(clip);
    if (type === 'text') {
      clip.text = Object.assign({
        content: 'Mətn', font: '"Segoe UI", Arial, sans-serif', size: 72, color: '#ffffff',
        bg: '', bold: true, italic: false, align: 'center',
        stroke: '#000000', strokeWidth: 0, shadow: true, letterSpacing: 0
      }, opts.text || {});
    }
    return clip;
  }

  /* Köhnə layihələrdə və yeni kliplərdə çatışmayan sahələri doldur */
  function normalizeClip(c) {
    if (!c.filters) c.filters = defaultFilters(); else c.filters = Object.assign(defaultFilters(), c.filters);
    if (c.fadeIn == null) c.fadeIn = 0;
    if (c.fadeOut == null) c.fadeOut = 0;
    if (c.transition === undefined) c.transition = null;
    if (!c.anim) c.anim = { in: { type: 'none', duration: 0.5 }, out: { type: 'none', duration: 0.5 } };
    if (!c.blend) c.blend = 'source-over';
    if (c.lockScale == null) c.lockScale = true;
    if (c.scaleY == null) c.scaleY = c.scale;
    if (!c.mask) c.mask = { type: 'none', size: 50, feather: 0, invert: false, x: 0, y: 0 };
    if (!c.chroma) c.chroma = { enabled: false, color: '#00ff00', tolerance: 30, softness: 10 };
    if (!c.retouch) c.retouch = { enabled: false, smooth: 0, whiten: 0, clarity: 0, warmth: 0 };
    if (c.vignette == null) c.vignette = 0;
    if (c.temperature == null) c.temperature = 0;
    if (c.preservesPitch == null) c.preservesPitch = true;
    if (c.normalize == null) c.normalize = false;
    return c;
  }

  /* ---- Tarixçə ---- */
  function snapshot() { return JSON.stringify(project); }
  function pushHistory() {
    undoStack.push(snapshot());
    if (undoStack.length > 120) undoStack.shift();
    redoStack = [];
    dirty = true;
  }
  function undo() {
    if (!undoStack.length) return false;
    redoStack.push(snapshot());
    project = JSON.parse(undoStack.pop());
    pruneSelection();
    emit('structure');
    return true;
  }
  function redo() {
    if (!redoStack.length) return false;
    undoStack.push(snapshot());
    project = JSON.parse(redoStack.pop());
    pruneSelection();
    emit('structure');
    return true;
  }
  function mutate(fn, reason = 'structure') {
    pushHistory();
    fn(project);
    emit(reason);
  }

  /* ---- Dinləyicilər ---- */
  function on(fn) { listeners.push(fn); }
  function emit(reason = 'structure', source = null) {
    for (const fn of listeners) fn(reason, source);
  }

  /* ---- Sorğular ---- */
  function duration() {
    let d = 0;
    if (!project) return 0;
    for (const t of project.tracks) for (const c of t.clips) d = Math.max(d, c.start + c.duration);
    return d;
  }
  function findClip(id) {
    for (const t of project.tracks) { const c = t.clips.find(c => c.id === id); if (c) return { clip: c, track: t }; }
    return null;
  }
  function findTrack(id) { return project.tracks.find(t => t.id === id); }
  function trackAccepts(track, clipType) {
    if (clipType === 'audio') return track.type === 'audio';
    if (clipType === 'text') return track.type === 'text' || track.type === 'video';
    return track.type === 'video';
  }
  function collides(track, start, dur, ignoreId) {
    const end = start + dur;
    return track.clips.some(c => c.id !== ignoreId && start < c.start + c.duration - 1e-6 && end > c.start + 1e-6);
  }
  /* Trekdə verilmiş vaxtdan sonra boş yer tap */
  function findFreeStart(track, start, dur, ignoreId) {
    let s = Math.max(0, start);
    const sorted = [...track.clips].filter(c => c.id !== ignoreId).sort((a, b) => a.start - b.start);
    for (let guard = 0; guard < 500; guard++) {
      const hit = sorted.find(c => s < c.start + c.duration - 1e-6 && s + dur > c.start + 1e-6);
      if (!hit) return s;
      s = hit.start + hit.duration;
    }
    return s;
  }
  function sortTrack(track) { track.clips.sort((a, b) => a.start - b.start); }
  /* Eyni trekdə bilavasitə ardınca gələn klip (keçid üçün) */
  function nextAdjacent(clip) {
    const f = findClip(clip.id);
    if (!f) return null;
    const end = clip.start + clip.duration;
    return f.track.clips.find(c => c.id !== clip.id && Math.abs(c.start - end) < 0.02) || null;
  }
  function prevAdjacent(clip) {
    const f = findClip(clip.id);
    if (!f) return null;
    return f.track.clips.find(c => c.id !== clip.id && Math.abs(c.start + c.duration - clip.start) < 0.02) || null;
  }

  /* ---- Klip əməliyyatları ---- */
  function addClip(clip, trackId) {
    const track = findTrack(trackId);
    if (!track) return null;
    clip.trackId = trackId;
    clip.start = findFreeStart(track, clip.start, clip.duration);
    track.clips.push(clip);
    sortTrack(track);
    return clip;
  }
  /* Media üçün uyğun trek seç: boş olan ilk trek, yoxdursa yenisini yarat */
  function pickTrackFor(clipType, start, dur) {
    const candidates = project.tracks.filter(t => trackAccepts(t, clipType));
    // Əsas video treki aşağıdan birinci — klipləri əvvəlcə ora qoyuruq
    const ordered = clipType === 'text' ? candidates : [...candidates].reverse();
    for (const t of ordered) if (!collides(t, start, dur)) return t;
    // boş yer yoxdur: yeni trek
    const type = clipType === 'audio' ? 'audio' : clipType === 'text' ? 'text' : 'video';
    const count = project.tracks.filter(t => t.type === type).length + 1;
    const names = { audio: 'Audio', text: 'Mətn', video: 'Video' };
    const tr = makeTrack(type, `${names[type]} ${count}`);
    if (type === 'audio') project.tracks.push(tr); else project.tracks.unshift(tr);
    return tr;
  }
  function removeClips(ids) {
    for (const t of project.tracks) t.clips = t.clips.filter(c => !ids.includes(c.id));
    selection = selection.filter(id => !ids.includes(id));
  }
  function splitClip(clip, at) {
    if (at <= clip.start + MIN_CLIP || at >= clip.start + clip.duration - MIN_CLIP) return null;
    const { track } = findClip(clip.id);
    const right = JSON.parse(JSON.stringify(clip));
    right.id = uid();
    const leftDur = at - clip.start;
    right.start = at;
    right.duration = clip.duration - leftDur;
    right.in = clip.in + leftDur * clip.speed;
    right.fadeIn = 0;
    right.anim.in = { type: 'none', duration: 0.5 };
    clip.duration = leftDur;
    clip.fadeOut = 0;
    clip.transition = null;
    clip.anim.out = { type: 'none', duration: 0.5 };
    track.clips.push(right);
    sortTrack(track);
    return right;
  }
  function duplicateClip(clip) {
    const { track } = findClip(clip.id);
    const copy = JSON.parse(JSON.stringify(clip));
    copy.id = uid();
    copy.transition = null;
    copy.start = findFreeStart(track, clip.start + clip.duration, clip.duration);
    track.clips.push(copy);
    sortTrack(track);
    return copy;
  }
  function maxDuration(clip) {
    if (clip.type === 'image' || clip.type === 'text') return Infinity;
    if (!clip.srcDuration) return Infinity;
    return Math.max(MIN_CLIP, (clip.srcDuration - clip.in) / clip.speed);
  }

  /* ---- Seçim ---- */
  function select(ids, additive = false) {
    selection = additive ? [...new Set([...selection, ...ids])] : [...ids];
    emit('selection');
  }
  function pruneSelection() { selection = selection.filter(id => findClip(id)); }
  function selectedClips() { return selection.map(id => findClip(id)?.clip).filter(Boolean); }

  /* ---- Yadda saxla / yüklə ---- */
  function serialize() {
    return JSON.stringify({
      app: 'Kəsyapışdır', version: 1,
      project,
      playhead,
      media: [...media.values()].map(m => ({
        id: m.id, name: m.name, type: m.type, size: m.size, duration: m.duration,
        width: m.width, height: m.height, path: m.path || null
      }))
    }, null, 1);
  }
  function load(data) {
    project = data.project;
    // köhnə sahələri tamamla
    for (const t of project.tracks) for (const c of t.clips) normalizeClip(c);
    if (project.cover === undefined) project.cover = null;
    playhead = data.playhead || 0;
    undoStack = []; redoStack = []; selection = []; dirty = false;
    emit('project');
  }

  return {
    RATIOS, MIN_CLIP, IMAGE_DEFAULT_DURATION, TEXT_DEFAULT_DURATION,
    uid, clamp, defaultFilters, normalizeClip, nextAdjacent, prevAdjacent,
    get project() { return project; },
    get media() { return media; },
    get selection() { return selection; },
    get playhead() { return playhead; }, set playhead(v) { playhead = v; },
    get dirty() { return dirty; }, set dirty(v) { dirty = v; },
    get canUndo() { return undoStack.length > 0; }, get canRedo() { return redoStack.length > 0; },
    newProject, setRatio, makeTrack, makeClip,
    pushHistory, undo, redo, mutate, on, emit,
    duration, findClip, findTrack, trackAccepts, collides, findFreeStart, sortTrack,
    addClip, pickTrackFor, removeClips, splitClip, duplicateClip, maxDuration,
    select, pruneSelection, selectedClips,
    serialize, load
  };
})();
