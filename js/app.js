/* MetroTube — xem clip YouTube gọn nhẹ, phong cách Metro */
'use strict';

/* ================= tiện ích ================= */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Biến URL trong văn bản thành liên kết; link YouTube mở ngay trong app
function linkify(text) {
  return esc(text).replace(/https?:\/\/[^\s<]+/g, url => {
    const m = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/))([\w-]{11})/.exec(url);
    if (m) return `<a href="#/watch/${m[1]}">${url}</a>`;
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
  });
}

const store = {
  get(k, d = null) { try { const v = localStorage.getItem('mt.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('mt.' + k, JSON.stringify(v)); } catch { /* bộ nhớ đầy hoặc bị chặn */ } },
  del(k) { try { localStorage.removeItem('mt.' + k); } catch { /* bỏ qua */ } },
};

const nf = new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 });
const fmtNum = n => (n == null || n === '' ? '' : nf.format(+n));

function ago(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  const units = [[31536000, 'năm'], [2592000, 'tháng'], [604800, 'tuần'], [86400, 'ngày'], [3600, 'giờ'], [60, 'phút']];
  for (const [n, label] of units) if (s >= n) return `${Math.floor(s / n)} ${label} trước`;
  return 'vừa xong';
}

function dur(iso) {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || '');
  if (!m) return '';
  const h = (+m[1] || 0) * 24 + (+m[2] || 0), mm = +m[3] || 0, ss = +m[4] || 0;
  if (!h && !mm && !ss) return '';
  const p = n => String(n).padStart(2, '0');
  return h ? `${h}:${p(mm)}:${p(ss)}` : `${mm}:${p(ss)}`;
}

const thumbOf = t => t?.medium?.url || t?.high?.url || t?.default?.url || '';
const uploadsOf = channelId => 'UU' + channelId.slice(2);

// Chạy song song có giới hạn
async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const k = i++; try { out[k] = await fn(items[k]); } catch { out[k] = null; } }
  });
  await Promise.all(workers);
  return out;
}

function toast(text, ms = 2600) {
  const t = $('#toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), ms);
}

const ICON = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 12H5m6-6-6 6 6 6"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg>',
  open: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 4h6v6m0-6-9 9M18 14v6H4V6h6"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
  play: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="5" y="10" width="38" height="28"/><path d="M20 17v14l12-7z" fill="currentColor"/></svg>',
  people: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="18" cy="17" r="7"/><path d="M5 40c1-8 6-12 13-12s12 4 13 12"/><circle cx="34" cy="15" r="5"/><path d="M33 25c6 0 9.5 3.5 10.5 10"/></svg>',
  user: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="24" cy="17" r="8"/><path d="M8 42c1.5-9 7.5-14 16-14s14.5 5 16 14"/></svg>',
  gear: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="24" cy="24" r="6"/><path d="M24 4v6m0 28v6M4 24h6m28 0h6M9.9 9.9l4.2 4.2m19.8 19.8 4.2 4.2M9.9 38.1l4.2-4.2m19.8-19.8 4.2-4.2"/></svg>',
  bigsearch: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="21" cy="21" r="12"/><path d="m30 30 12 12"/></svg>',
};

const progress = () => '<div class="prog" aria-label="Đang tải"><i></i><i></i><i></i><i></i><i></i></div>';

/* ================= giao diện sáng/tối + cỡ chữ ================= */
const FONT_SCALE = { sm: 0.88, md: 1, lg: 1.15 };
function applyTheme() {
  const root = document.documentElement;
  root.dataset.theme = store.get('theme', 'dark');
  root.style.setProperty('--s', FONT_SCALE[store.get('fontSize', 'md')] || 1);
}
applyTheme();

/* ================= hiệu ứng nghiêng (tilt) kiểu Windows Phone ================= */
// Ấn vào phần tử .tilt: nó nghiêng 3D về phía điểm chạm; ấn giữa thì lún xuống.
let tilted = null, tiltStart = null;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

function releaseTilt() {
  if (!tilted) return;
  tilted.style.transition = 'transform .32s cubic-bezier(.2, 1.5, .4, 1)';
  tilted.style.transform = '';
  tilted = null;
}

document.addEventListener('pointerdown', e => {
  const t = e.target.closest('.tilt');
  if (!t || e.button > 0 || reducedMotion.matches) return;
  const r = t.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width - 0.5;   // -0.5 … 0.5
  const y = (e.clientY - r.top) / r.height - 0.5;
  // phần tử càng rộng thì góc càng nhỏ, để mép không văng quá xa
  const maxY = Math.min(16, 3000 / r.width), maxX = Math.min(16, 3000 / r.height);
  const near = Math.hypot(x, y) < 0.18;
  const depth = near ? 0.94 : 0.98;
  tilted = t;
  tiltStart = { x: e.clientX, y: e.clientY };
  t.style.transition = 'transform .12s ease-out';
  t.style.transform = `perspective(700px) rotateX(${(-y * 2 * maxX).toFixed(2)}deg) rotateY(${(x * 2 * maxY).toFixed(2)}deg) scale(${depth})`;
});
document.addEventListener('pointermove', e => {
  if (tilted && Math.hypot(e.clientX - tiltStart.x, e.clientY - tiltStart.y) > 12) releaseTilt(); // đang cuộn
}, { passive: true });
['pointerup', 'pointercancel', 'dragstart'].forEach(ev => document.addEventListener(ev, releaseTilt));
window.addEventListener('blur', releaseTilt);

/* ================= danh sách bay vào lần lượt ================= */
// Mỗi lần có mục mới được chèn (tải trang, chuyển pivot, "tải thêm"), các mục bay vào so le nhau.
const FLY = '.vi, .ch, .cm, .letter';
new MutationObserver(muts => {
  if (reducedMotion.matches) return;
  let flyIndex = 0; // mỗi đợt chèn (một lần gọi observer) đếm so le lại từ đầu
  for (const m of muts) for (const n of m.addedNodes) {
    if (n.nodeType !== 1) continue;
    for (const it of n.matches(FLY) ? [n] : $$(FLY, n)) {
      if (it.classList.contains('fly')) continue; // đã gặp qua phần tử cha trong cùng đợt
      it.style.animationDelay = Math.min(flyIndex++, 12) * 45 + 'ms'; // mục thứ 13 trở đi không chờ thêm
      it.classList.add('fly');
      // bay xong thì gỡ class: tâm xoay ở mép trái của .fly sẽ làm lệch hiệu ứng nghiêng
      const done = e => { if (e.target === it) { it.classList.remove('fly'); it.style.animationDelay = ''; it.removeEventListener('animationend', done); } };
      it.addEventListener('animationend', done);
    }
  }
}).observe(document.getElementById('view'), { childList: true, subtree: true });

/* ================= đăng nhập (Google Identity Services) ================= */
const SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';

class AuthError extends Error {}

function waitGIS() {
  return new Promise((resolve, reject) => {
    let n = 0;
    (function check() {
      if (window.google?.accounts?.oauth2) return resolve();
      if (++n > 100) return reject(new Error('Không tải được Google Sign-In. Kiểm tra kết nối mạng.'));
      setTimeout(check, 100);
    })();
  });
}

const auth = {
  get token() {
    const t = store.get('token');
    return t && t.exp > Date.now() + 30000 ? t.value : null;
  },
  get signedIn() { return !!this.token; },
  get expired() { return !this.token && !!store.get('consented'); },

  async signIn() {
    const clientId = store.get('clientId');
    if (!clientId) { location.hash = '#/settings'; throw new Error('Bạn cần nhập Google OAuth Client ID trước.'); }
    await waitGIS();
    await new Promise((resolve, reject) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPE,
        callback: r => {
          if (r.error) return reject(new Error(r.error_description || r.error));
          store.set('token', { value: r.access_token, exp: Date.now() + r.expires_in * 1000 });
          store.set('consented', true);
          resolve();
        },
        error_callback: e => reject(new Error(e.type === 'popup_closed' ? 'Bạn đã đóng cửa sổ đăng nhập.' : (e.message || 'Không mở được cửa sổ đăng nhập.'))),
      });
      client.requestAccessToken({ prompt: store.get('consented') ? '' : 'consent' });
    });
    loadMe(true).catch(() => {});
  },

  signOut() {
    const t = store.get('token');
    if (t && window.google?.accounts?.oauth2) google.accounts.oauth2.revoke(t.value, () => {});
    ['token', 'consented', 'me', 'feed', 'subs'].forEach(k => store.del(k));
  },
};

/* ================= YouTube Data API ================= */
const API = 'https://www.googleapis.com/youtube/v3/';
const ERR = {
  quotaExceeded: 'Đã hết hạn mức API hôm nay. Thử lại vào ngày mai.',
  commentsDisabled: 'Clip này đã tắt bình luận.',
  accessNotConfigured: 'Chưa bật YouTube Data API v3 trong Google Cloud.',
  SERVICE_DISABLED: 'Chưa bật YouTube Data API v3 trong Google Cloud.',
  videoNotFound: 'Không tìm thấy clip.',
  playlistNotFound: 'Kênh chưa có clip nào.',
  insufficientPermissions: 'Tài khoản chưa cấp quyền xem YouTube. Đăng nhập lại.',
};

async function api(path, params = {}) {
  const token = auth.token;
  if (!token) throw new AuthError(store.get('consented') ? 'Phiên đăng nhập đã hết hạn.' : 'Bạn cần đăng nhập.');
  let res;
  try {
    res = await fetch(API + path + '?' + new URLSearchParams(params), { headers: { Authorization: 'Bearer ' + token } });
  } catch {
    throw new Error('Không có kết nối mạng.');
  }
  if (res.status === 401) { store.del('token'); throw new AuthError('Phiên đăng nhập đã hết hạn.'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const reason = data.error?.errors?.[0]?.reason || data.error?.status;
    const e = new Error(ERR[reason] || data.error?.message || 'Lỗi ' + res.status);
    e.reason = reason;
    throw e;
  }
  return data;
}

const videoCache = new Map(); // id -> video, để trang xem hiện tiêu đề ngay

function mapPlaylistItem(it) {
  const s = it.snippet;
  return {
    id: s.resourceId?.videoId,
    title: s.title,
    channelId: s.videoOwnerChannelId || s.channelId,
    channelTitle: s.videoOwnerChannelTitle || s.channelTitle,
    publishedAt: it.contentDetails?.videoPublishedAt || s.publishedAt,
    thumb: thumbOf(s.thumbnails),
  };
}
const isPlayable = v => v.id && v.thumb && !/^(Private|Deleted) video$/.test(v.title);

// Bổ sung thời lượng + lượt xem (videos.list: 1 đơn vị / 50 clip)
async function enrich(videos) {
  for (let i = 0; i < videos.length; i += 50) {
    const chunk = videos.slice(i, i + 50);
    const data = await api('videos', { part: 'contentDetails,statistics,snippet', id: chunk.map(v => v.id).join(','), maxResults: 50 });
    const byId = new Map(data.items.map(x => [x.id, x]));
    for (const v of chunk) {
      const x = byId.get(v.id);
      if (!x) continue;
      v.duration = x.contentDetails?.duration;
      v.views = x.statistics?.viewCount;
      v.live = x.snippet?.liveBroadcastContent;
    }
  }
  videos.forEach(v => videoCache.set(v.id, v));
  return videos;
}

async function loadMe(force = false) {
  const cached = store.get('me');
  if (cached && !force) return cached;
  const data = await api('channels', { part: 'snippet', mine: true });
  const c = data.items?.[0];
  const me = c ? { id: c.id, title: c.snippet.title, thumb: c.snippet.thumbnails?.high?.url || thumbOf(c.snippet.thumbnails) } : { title: 'Tài khoản Google' };
  store.set('me', me);
  return me;
}

async function loadSubs(force = false) {
  const cached = store.get('subs');
  if (cached && !force && Date.now() - cached.ts < 6 * 3600e3) return cached.items;
  const items = [];
  let pageToken = '';
  for (let page = 0; page < 10; page++) {
    const data = await api('subscriptions', { part: 'snippet', mine: true, maxResults: 50, order: 'alphabetical', ...(pageToken && { pageToken }) });
    for (const s of data.items) items.push({ id: s.snippet.resourceId.channelId, title: s.snippet.title, thumb: thumbOf(s.snippet.thumbnails) });
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  store.set('subs', { ts: Date.now(), items });
  return items;
}

// Feed "mới nhất": vài clip gần nhất của mỗi kênh, gộp và xếp theo thời gian
let feedPromise = null;
function loadFeed(force = false) {
  const cached = store.get('feed');
  if (cached && !force && Date.now() - cached.ts < 15 * 60e3) {
    cached.items.forEach(v => videoCache.set(v.id, v));
    return Promise.resolve(cached.items);
  }
  if (feedPromise) return feedPromise;
  feedPromise = (async () => {
    const subs = await loadSubs(force);
    const lists = await pool(subs, 8, ch =>
      api('playlistItems', { part: 'snippet,contentDetails', playlistId: uploadsOf(ch.id), maxResults: 4 }));
    const seen = new Set();
    let items = lists.flatMap(l => (l?.items || []).map(mapPlaylistItem)).filter(v => isPlayable(v) && !seen.has(v.id) && seen.add(v.id));
    items.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    items = await enrich(items.slice(0, 80));
    items = items.filter(v => v.live !== 'upcoming');
    store.set('feed', { ts: Date.now(), items });
    return items;
  })().finally(() => { feedPromise = null; });
  return feedPromise;
}

async function loadUploads(channelId, pageToken = '') {
  const data = await api('playlistItems', { part: 'snippet,contentDetails', playlistId: uploadsOf(channelId), maxResults: 20, ...(pageToken && { pageToken }) });
  const items = await enrich(data.items.map(mapPlaylistItem).filter(isPlayable));
  return { items, next: data.nextPageToken };
}

async function searchVideos(q, pageToken = '') {
  const data = await api('search', { part: 'snippet', type: 'video', q, maxResults: 20, ...(pageToken && { pageToken }) });
  const items = data.items.map(it => ({
    id: it.id.videoId, title: decodeHtml(it.snippet.title), channelId: it.snippet.channelId,
    channelTitle: it.snippet.channelTitle, publishedAt: it.snippet.publishedAt, thumb: thumbOf(it.snippet.thumbnails),
  })).filter(v => v.id);
  return { items: await enrich(items), next: data.nextPageToken };
}

// search.list trả tiêu đề đã mã hoá HTML (&#39; ...)
function decodeHtml(s) { const t = document.createElement('textarea'); t.innerHTML = s; return t.value; }

/* ================= khối giao diện dùng chung ================= */
function videoItem(v) {
  let badge = dur(v.duration);
  let cls = '';
  if (v.live === 'live') { badge = 'TRỰC TIẾP'; cls = ' live'; }
  const meta = [ago(v.publishedAt), v.views && `${fmtNum(v.views)} lượt xem`].filter(Boolean).join(' · ');
  return `<a class="vi tilt" href="#/watch/${esc(v.id)}">
    <div class="vi-th"><img loading="lazy" src="${esc(v.thumb)}" alt="">${badge ? `<span class="vi-d${cls}">${esc(badge)}</span>` : ''}</div>
    <div class="vi-tx"><div class="vi-t">${esc(v.title)}</div><div class="vi-c">${esc(v.channelTitle || '')}</div><div class="vi-m">${esc(meta)}</div></div>
  </a>`;
}

function backButton() {
  return `<button class="round" data-back aria-label="Quay lại">${ICON.back}</button>`;
}

// Hiện tiến trình, chạy fn(); nếu lỗi thì hiện thông báo + nút thử lại / đăng nhập
async function load(box, fn) {
  box.innerHTML = progress();
  try {
    await fn();
  } catch (e) {
    const isAuth = e instanceof AuthError;
    box.innerHTML = `<div class="msg">${esc(e.message)}<br>
      <button class="btn">${isAuth ? 'đăng nhập' : 'thử lại'}</button></div>`;
    $('button', box).onclick = async () => {
      if (isAuth) {
        try { await auth.signIn(); } catch (err) { toast(err.message); return; }
      }
      load(box, fn);
    };
  }
}

// Danh sách clip có nút "tải thêm"
function pagedList(box, fetchPage, opts = {}) {
  let next = '';
  const list = el(`<div class="list${opts.grid ? ' grid' : ''}"></div>`);
  const more = el('<div class="more"></div>');
  async function page() {
    const { items, next: n } = await fetchPage(next);
    next = n;
    const shown = opts.filter ? items.filter(opts.filter) : items;
    list.insertAdjacentHTML('beforeend', shown.map(videoItem).join(''));
    if (!list.children.length) list.innerHTML = `<div class="msg">${opts.empty || 'Không có clip nào.'}</div>`;
    more.innerHTML = next ? '<button class="btn">tải thêm</button>' : '';
    if (next) $('button', more).onclick = () => load(more, page);
  }
  return load(box, async () => { await page(); box.replaceChildren(list, more); });
}

/* Pivot: tiêu đề nhỏ + các header lớn trượt ngang */
function pivot(root, tabs, activeKey, onChange) {
  const head = el(`<nav class="pv-h" role="tablist">${tabs.map(t =>
    `<button role="tab" data-k="${t.key}">${esc(t.label)}</button>`).join('')}</nav>`);
  const body = el('<div class="pv-b"></div>');
  const panels = new Map(tabs.map(t => [t.key, el('<div class="pv-p" role="tabpanel" hidden></div>')]));
  panels.forEach(p => body.append(p));
  root.append(head, body);

  let current = null;
  const idx = k => tabs.findIndex(t => t.key === k);
  function show(k) {
    if (k === current) return;
    const dir = current == null || idx(k) > idx(current) ? 'in-l' : 'in-r';
    current = k;
    $$('button', head).forEach(b => { const on = b.dataset.k === k; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    $(`[data-k="${k}"]`, head).scrollIntoView({ block: 'nearest', inline: 'start', behavior: 'smooth' });
    panels.forEach((p, key) => { p.hidden = key !== k; p.classList.remove('in-l', 'in-r'); });
    const p = panels.get(k);
    void p.offsetWidth;
    p.classList.add(dir);
    if (!p.dataset.done) { p.dataset.done = 1; tabs[idx(k)].render(p); }
    onChange?.(k);
  }
  head.onclick = e => { const b = e.target.closest('button'); if (b) show(b.dataset.k); };

  // vuốt ngang để chuyển pivot
  let sx = 0, sy = 0;
  body.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  body.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const i = (idx(current) + (dx < 0 ? 1 : -1) + tabs.length) % tabs.length;
    show(tabs[i].key);
  }, { passive: true });

  show(activeKey || tabs[0].key);
  return { show, panel: k => panels.get(k) };
}

function appbar(buttons) {
  const bar = el(`<div class="appbar">${buttons.map((b, i) =>
    `<button data-i="${i}" aria-label="${esc(b.label)}"><span class="round">${b.icon}</span>${esc(b.label)}</button>`).join('')}</div>`);
  bar.onclick = e => { const b = e.target.closest('button'); if (b) buttons[+b.dataset.i].run(); };
  return bar;
}

/* ================= các trang ================= */
let timers = [];
const every = (fn, ms) => timers.push(setInterval(fn, ms));

/* ----- Start ----- */
function startPage() {
  const me = store.get('me');
  const page = el(`<section class="page start">
    <div class="app-name">MetroTube</div>
    ${auth.expired ? '<button class="banner" data-relogin>Phiên đăng nhập đã hết hạn <span>đăng nhập lại ›</span></button>' : ''}
    <div class="tiles">
      <a class="tile wide tilt" href="#/subs" aria-label="Đăng ký" data-lt="subs"><span class="lbl">đăng ký</span></a>
      <a class="tile tilt" href="#/search" aria-label="Tìm kiếm" data-lt="search"><span class="lbl">tìm kiếm</span></a>
      <a class="tile alt tilt" href="#/subs/channels" aria-label="Kênh" data-lt="channels"><span class="lbl">kênh</span></a>
      <a class="tile alt tilt" href="#/account" aria-label="Tài khoản" data-lt="account">
        <span class="lbl">${esc(me?.title && auth.signedIn ? me.title : 'tài khoản')}</span></a>
      <a class="tile tilt" href="#/settings"><span class="ico">${ICON.gear}</span><span class="lbl">cài đặt</span></a>
    </div>
  </section>`);
  $$('.tile', page).forEach((t, i) => (t.style.animationDelay = i * 45 + 'ms'));
  const relogin = $('[data-relogin]', page);
  if (relogin) relogin.onclick = () => auth.signIn().then(route).catch(e => toast(e.message));

  const tile = k => $(`[data-lt="${k}"]`, page);
  subsTile(tile('subs'));
  searchTile(tile('search'));
  channelsTile(tile('channels'));
  accountTile(tile('account'), me);

  // làm mới feed ngầm để tile có ảnh
  if (auth.signedIn) loadFeed().catch(() => {});
  return page;
}

/* Live tile: đổi mặt định kỳ, kiểu 'flip' (lật quanh trục ngang) hoặc 'peek' (trượt lên).
   faces() trả về danh sách HTML các mặt; gọi lại mỗi lần đổi nên luôn lấy dữ liệu mới nhất. */
function liveTile(host, faces, { mode = 'flip', every: ms = 5000, delay = 0, first } = {}) {
  const box = el('<div class="lt"></div>');
  host.prepend(box);
  let i = 0, n = 0, busy = false;
  let cur = el(`<div class="lt-face">${first ?? (faces()[0] || '')}</div>`);
  box.append(cur);

  const tick = () => {
    const list = faces();
    if (busy || document.hidden) return;
    if (list.length < 2) { cur.innerHTML = list[0] || ''; return; }
    i = (i + 1) % list.length;
    const next = el(`<div class="lt-face">${list[i]}</div>`);
    const kind = typeof mode === 'function' ? mode(n++) : mode;
    const old = cur;
    cur = next;
    busy = true;
    const done = () => { old.remove(); busy = false; };

    const go = () => {
      if (reducedMotion.matches) { box.append(next); done(); return; }
      if (kind === 'peek') {
        box.append(next);
        const o = { duration: 750, easing: 'cubic-bezier(.45, 0, .2, 1)', fill: 'forwards' };
        old.animate([{ transform: 'none' }, { transform: 'translateY(-100%)' }], o);
        next.animate([{ transform: 'translateY(100%)' }, { transform: 'none' }], o).onfinish = done;
      } else {
        next.style.visibility = 'hidden';
        box.append(next);
        old.animate([{ transform: 'perspective(700px) rotateX(0)' }, { transform: 'perspective(700px) rotateX(90deg)' }],
          { duration: 240, easing: 'ease-in', fill: 'forwards' }).onfinish = () => {
          next.style.visibility = '';
          next.animate([{ transform: 'perspective(700px) rotateX(-90deg)' }, { transform: 'none' }],
            { duration: 380, easing: 'cubic-bezier(.1, .9, .2, 1)' }).onfinish = done;
        };
      }
    };
    // chờ ảnh tải xong mới đổi, để không lật ra một mặt trống
    const img = $('img', next);
    if (img && !img.complete) { img.onload = img.onerror = go; } else go();
  };
  timers.push(setTimeout(() => every(tick, ms), delay));
  return box;
}

// Đăng ký: mặt thương hiệu xen kẽ thumbnail clip mới; lần lượt trượt lên rồi lật
function subsTile(host) {
  const brand = () => {
    const feed = store.get('feed')?.items || [];
    const fresh = feed.filter(v => Date.now() - new Date(v.publishedAt) < 864e5).length;
    return `<span class="ico">${ICON.play}</span>
      ${!auth.signedIn ? '<span class="note">đăng nhập để xem clip mới</span>' : ''}
      ${fresh ? `<span class="cnt">${fresh}</span>` : ''}`;
  };
  const thumb = v => `<img class="full" src="${esc(v.thumb)}" alt=""><span class="shade"></span><span class="ttl">${esc(v.title)}</span>`;
  liveTile(host, () => {
    const feed = (store.get('feed')?.items || []).slice(0, 8);
    const out = [brand()];
    feed.forEach((v, k) => { out.push(thumb(v)); if (k % 2 && k < feed.length - 1) out.push(brand()); });
    return out;
  }, { mode: n => (n % 2 ? 'flip' : 'peek'), every: 4500, delay: 600 });
}

// Tìm kiếm: lật ra các từ khoá gần đây
function searchTile(host) {
  liveTile(host, () => [
    `<span class="ico">${ICON.bigsearch}</span>`,
    ...store.get('recentQ', []).slice(0, 3).map(q => `<span class="lt-cap">gần đây</span><span class="lt-text">${esc(q)}</span>`),
  ], { mode: 'flip', every: 6000, delay: 1800 });
}

// Kênh: lưới 3×3 avatar, từng ô tự lật ngẫu nhiên như tile People của WP
function channelsTile(host) {
  const subs = (store.get('subs')?.items || []).filter(c => c.thumb);
  if (subs.length < 4) { host.insertAdjacentHTML('afterbegin', `<span class="ico">${ICON.people}</span>`); return; }
  const grid = el('<div class="mosaic"></div>');
  host.prepend(grid);
  const pick = () => subs[Math.floor(Math.random() * subs.length)];
  for (let k = 0; k < 9; k++) {
    const cell = el('<div class="cell"></div>');
    grid.append(cell);
    const img = c => `<img class="full" src="${esc(c.thumb)}" alt="">`;
    liveTile(cell, () => [img(pick()), img(pick())], { first: img(subs[k % subs.length]), mode: 'flip', every: 3500 + Math.random() * 6000, delay: 800 + Math.random() * 4000 });
  }
}

// Tài khoản: avatar, rồi trượt lên số kênh đã đăng ký
function accountTile(host, me) {
  if (!auth.signedIn || !me?.thumb) { host.insertAdjacentHTML('afterbegin', `<span class="ico">${ICON.user}</span>`); return; }
  liveTile(host, () => {
    const count = store.get('subs')?.items?.length;
    return [
      `<img class="full" src="${esc(me.thumb)}" alt=""><span class="shade"></span>`,
      ...(count ? [`<span class="lt-big">${count}</span><span class="lt-text" style="top:auto;bottom:34px">kênh đã đăng ký</span>`] : []),
    ];
  }, { mode: 'peek', every: 7000, delay: 3000 });
}

/* ----- Đăng ký: pivot mới nhất / kênh ----- */
function subsPage(tab) {
  const page = el(`<section class="page"><div class="pg-top">${backButton()}<span class="app-name">Đăng ký</span></div></section>`);
  let latestPanel;
  const renderLatest = (p, force) => {
    latestPanel = p;
    return load(p, async () => {
      const items = await loadFeed(force);
      p.innerHTML = items.length
        ? `<div class="list grid">${items.map(videoItem).join('')}</div>`
        : '<div class="msg">Các kênh bạn đăng ký chưa có clip mới.</div>';
    });
  };
  const renderChannels = (p, force) => load(p, async () => {
    const subs = await loadSubs(force);
    if (!subs.length) { p.innerHTML = '<div class="msg">Bạn chưa đăng ký kênh nào.</div>'; return; }
    let last = '';
    p.innerHTML = '<div class="list">' + subs.map(c => {
      const letter = (c.title[0] || '#').toLocaleLowerCase('vi');
      const head = letter !== last ? `<div class="letter">${esc((last = letter))}</div>` : '';
      return `${head}<a class="ch tilt" href="#/channel/${esc(c.id)}"><img loading="lazy" src="${esc(c.thumb)}" alt=""><span class="nm">${esc(c.title)}</span></a>`;
    }).join('') + '</div>';
  });

  const pv = pivot(page, [
    { key: 'latest', label: 'mới nhất', render: p => renderLatest(p) },
    { key: 'channels', label: 'kênh', render: p => renderChannels(p) },
  ], tab === 'channels' ? 'channels' : 'latest', k => history.replaceState(history.state, '', k === 'channels' ? '#/subs/channels' : '#/subs'));

  page.append(appbar([
    { label: 'làm mới', icon: ICON.refresh, run: () => { renderLatest(pv.panel('latest'), true); pv.panel('channels').dataset.done = ''; pv.show('latest'); } },
    { label: 'tìm kiếm', icon: ICON.search, run: () => (location.hash = '#/search') },
  ]));
  return page;
}

/* ----- Tìm kiếm ----- */
function searchPage() {
  const page = el(`<section class="page">
    <div class="pg-top">${backButton()}<span class="app-name">MetroTube</span></div>
    <h1 class="pg-title">tìm kiếm</h1>
    <form class="search-row" role="search">
      <input class="field" type="search" name="q" placeholder="tên clip, kênh, chủ đề" autocomplete="off" enterkeyhint="search" aria-label="Từ khoá">
      <button class="btn acc" type="submit" aria-label="Tìm">${ICON.search.replace('<svg', '<svg width="18" height="18"')}</button>
    </form>
    <div class="results"></div>
  </section>`);
  const form = $('form', page), input = $('input', page), box = $('.results', page);
  const last = sessionStorage.getItem('mt.q');

  const run = q => {
    sessionStorage.setItem('mt.q', q);
    store.set('recentQ', [q, ...store.get('recentQ', []).filter(x => x !== q)].slice(0, 5));
    pagedList(box, next => searchVideos(q, next), { grid: true, empty: 'Không tìm thấy clip nào.' });
  };
  form.onsubmit = e => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) { input.focus(); return; }
    input.blur();
    run(q);
  };
  if (last) { input.value = last; run(last); }
  else {
    box.innerHTML = '<p class="hint">Kết quả chỉ gồm clip, không có đề xuất.</p>';
    setTimeout(() => input.focus(), 350);
  }
  return page;
}

/* ----- Xem clip ----- */
function watchPage(id) {
  const v = videoCache.get(id);
  const origin = encodeURIComponent(location.origin);
  const page = el(`<section class="page watch">
    <div class="player"><iframe src="https://www.youtube.com/embed/${esc(id)}?autoplay=1&rel=0&playsinline=1&origin=${origin}"
      title="${esc(v?.title || 'Trình phát YouTube')}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen; web-share"
      referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>
  </section>`);

  let video = null; // dữ liệu đầy đủ từ videos.list
  const getVideo = async () => {
    if (video) return video;
    const data = await api('videos', { part: 'snippet,statistics,contentDetails', id });
    if (!data.items?.length) throw new Error(ERR.videoNotFound);
    return (video = data.items[0]);
  };

  pivot(page, [
    { key: 'info', label: 'thông tin', render: p => {
      // tiêu đề hiện ngay từ bộ nhớ đệm (cũng là đích đến của hiệu ứng continuum)
      p.innerHTML = `<h1 class="v-title">${esc(v?.title || '')}</h1><div></div>`;
      const h1 = p.firstElementChild, box = p.lastElementChild;
      load(box, async () => {
      const x = await getVideo();
      const s = x.snippet;
      document.title = s.title + ' · MetroTube';
      let ch = null;
      try { ch = (await api('channels', { part: 'snippet,statistics', id: s.channelId })).items?.[0]; } catch { /* không bắt buộc */ }
      h1.textContent = s.title;
      box.innerHTML = `
        <a class="v-ch tilt" href="#/channel/${esc(s.channelId)}">
          ${ch ? `<img src="${esc(thumbOf(ch.snippet.thumbnails))}" alt="">` : ''}
          <div><div class="nm">${esc(s.channelTitle)} ›</div>
          ${ch?.statistics?.subscriberCount ? `<div class="sb">${fmtNum(ch.statistics.subscriberCount)} người đăng ký</div>` : ''}</div>
        </a>
        <div class="v-stats">${[x.statistics?.viewCount && fmtNum(x.statistics.viewCount) + ' lượt xem',
          x.statistics?.likeCount && fmtNum(x.statistics.likeCount) + ' lượt thích', ago(s.publishedAt)].filter(Boolean).join(' · ')}</div>
        <div class="v-desc">${linkify(s.description || 'Không có mô tả.')}</div>`;
      const desc = $('.v-desc', box);
      if (desc.scrollHeight > 160) {
        desc.classList.add('clamp');
        const more = el('<button class="link-btn">xem thêm</button>');
        more.onclick = () => { const c = desc.classList.toggle('clamp'); more.textContent = c ? 'xem thêm' : 'thu gọn'; };
        desc.after(more);
      }
      });
    } },
    { key: 'comments', label: 'bình luận', render: p => {
      let next = '';
      const list = el('<div></div>'), more = el('<div class="more"></div>');
      const page = async () => {
        const data = await api('commentThreads', { part: 'snippet', videoId: id, maxResults: 20, order: 'relevance', textFormat: 'plainText', ...(next && { pageToken: next }) });
        next = data.nextPageToken;
        list.insertAdjacentHTML('beforeend', data.items.map(t => {
          const c = t.snippet.topLevelComment.snippet;
          const meta = [c.likeCount && `${fmtNum(c.likeCount)} lượt thích`, t.snippet.totalReplyCount && `${t.snippet.totalReplyCount} trả lời`].filter(Boolean).join(' · ');
          return `<div class="cm"><img loading="lazy" src="${esc(c.authorProfileImageUrl)}" alt="" referrerpolicy="no-referrer">
            <div><div class="cm-a">${esc(c.authorDisplayName)}<span>${ago(c.publishedAt)}</span></div>
            <div class="cm-tx">${linkify(c.textDisplay)}</div>${meta ? `<div class="cm-m">${meta}</div>` : ''}</div></div>`;
        }).join(''));
        if (!list.children.length) list.innerHTML = '<div class="msg">Chưa có bình luận.</div>';
        more.innerHTML = next ? '<button class="btn">tải thêm</button>' : '';
        if (next) $('button', more).onclick = () => load(more, page);
      };
      load(p, async () => { await page(); p.replaceChildren(list, more); });
    } },
    { key: 'related', label: 'đề xuất', render: async p => {
      const chId = v?.channelId || (await getVideo().catch(() => null))?.snippet?.channelId;
      if (!chId) { p.innerHTML = '<div class="msg">Không tải được đề xuất.</div>'; return; }
      pagedList(p, next => loadUploads(chId, next), { filter: x => x.id !== id, empty: 'Kênh không có clip khác.' });
    } },
  ], 'info');

  page.append(appbar([
    { label: 'quay lại', icon: ICON.back, run: goBack },
    { label: 'mở YouTube', icon: ICON.open, run: () => window.open(`https://www.youtube.com/watch?v=${id}`, '_blank', 'noopener') },
    { label: 'chép link', icon: ICON.link, run: async () => {
      try { await navigator.clipboard.writeText(`https://youtu.be/${id}`); toast('Đã chép liên kết'); }
      catch { toast('Không chép được liên kết'); }
    } },
  ]));
  return page;
}

/* ----- Kênh ----- */
function channelPage(id) {
  const sub = (store.get('subs')?.items || []).find(c => c.id === id);
  const page = el(`<section class="page"><div class="pg-top">${backButton()}<span class="app-name ch-name">${esc(sub?.title || 'Kênh')}</span></div></section>`);
  let info = null;
  const getInfo = async () => info || (info = (await api('channels', { part: 'snippet,statistics', id })).items?.[0]);
  getInfo().then(c => { if (c) { $('.ch-name', page).textContent = c.snippet.title; document.title = c.snippet.title + ' · MetroTube'; } }).catch(() => {});

  pivot(page, [
    { key: 'videos', label: 'clip', render: p => pagedList(p, next => loadUploads(id, next), { grid: true, empty: 'Kênh chưa có clip nào.' }) },
    { key: 'about', label: 'giới thiệu', render: p => load(p, async () => {
      const c = await getInfo();
      if (!c) throw new Error('Không tìm thấy kênh.');
      const st = c.statistics || {};
      p.innerHTML = `<div class="ch" style="margin-bottom:14px"><img src="${esc(thumbOf(c.snippet.thumbnails))}" alt=""><span class="nm">${esc(c.snippet.title)}</span></div>
        <div class="v-stats">${[st.subscriberCount && fmtNum(st.subscriberCount) + ' người đăng ký', st.videoCount && fmtNum(st.videoCount) + ' clip',
          st.viewCount && fmtNum(st.viewCount) + ' lượt xem'].filter(Boolean).join(' · ')}</div>
        <div class="v-desc">${linkify(c.snippet.description || 'Kênh chưa có mô tả.')}</div>`;
    }) },
  ], 'videos');

  page.append(appbar([{ label: 'mở YouTube', icon: ICON.open, run: () => window.open(`https://www.youtube.com/channel/${id}`, '_blank', 'noopener') }]));
  return page;
}

/* ----- Tài khoản ----- */
function accountPage() {
  const page = el(`<section class="page">
    <div class="pg-top">${backButton()}<span class="app-name">MetroTube</span></div>
    <h1 class="pg-title">tài khoản</h1><div class="body"></div></section>`);
  const body = $('.body', page);

  if (!store.get('clientId')) {
    body.innerHTML = `<div class="section"><p>Để đăng nhập, bạn cần tạo Google OAuth Client ID (miễn phí, khoảng 5 phút).</p>
      <a class="btn acc" href="#/settings" style="display:inline-block">mở hướng dẫn</a></div>`;
  } else if (!auth.signedIn) {
    body.innerHTML = `<div class="section"><p>${auth.expired ? 'Phiên đăng nhập đã hết hạn (Google cấp phiên 1 giờ).' : 'Đăng nhập để xem clip từ các kênh bạn đăng ký.'}</p>
      <button class="btn acc" data-in>đăng nhập bằng Google</button>
      <p class="hint" style="margin-top:14px">MetroTube chỉ xin quyền đọc. App không đăng, thích hay bình luận thay bạn.</p></div>`;
    $('[data-in]', body).onclick = () => auth.signIn().then(() => { toast('Đã đăng nhập'); route(); }).catch(e => toast(e.message));
  } else {
    load(body, async () => {
      const me = await loadMe();
      const subs = store.get('subs')?.items;
      body.innerHTML = `<div class="section">
        <div class="ch" style="margin-bottom:18px">${me.thumb ? `<img src="${esc(me.thumb)}" alt="">` : '<span class="ph"></span>'}<span class="nm" style="font-size:calc(32px * var(--s))">${esc(me.title)}</span></div>
        ${subs ? `<p class="hint">${subs.length} kênh đã đăng ký</p>` : ''}
        <button class="btn" data-out>đăng xuất</button></div>`;
      $('[data-out]', body).onclick = () => { auth.signOut(); toast('Đã đăng xuất'); location.hash = '#/'; };
    });
  }
  return page;
}

/* ----- Cài đặt + hướng dẫn tạo Client ID ----- */
function settingsPage() {
  const origin = location.origin;
  const theme = store.get('theme', 'dark');
  const page = el(`<section class="page">
    <div class="pg-top">${backButton()}<span class="app-name">MetroTube</span></div>
    <h1 class="pg-title">cài đặt</h1>

    <div class="section">
      <h3>giao diện</h3>
      <div class="radio-row" data-theme-row>
        ${[['dark', 'tối'], ['light', 'sáng'], ['system', 'theo hệ thống']].map(([k, l]) =>
          `<button class="btn${k === theme ? ' on' : ''}" data-t="${k}">${l}</button>`).join('')}
      </div>
    </div>

    <div class="section">
      <h3>cỡ chữ</h3>
      <div class="radio-row" data-font-row>
        ${[['sm', 'nhỏ'], ['md', 'vừa'], ['lg', 'lớn']].map(([k, l]) =>
          `<button class="btn${k === store.get('fontSize', 'md') ? ' on' : ''}" data-f="${k}">${l}</button>`).join('')}
      </div>
    </div>

    <div class="section">
      <h3>Google OAuth Client ID</h3>
      <form class="search-row" data-cid>
        <input class="field" name="cid" placeholder="123456789-abc.apps.googleusercontent.com" autocomplete="off" spellcheck="false" aria-label="Client ID">
        <button class="btn acc" type="submit">lưu</button>
      </form>
      <div class="hint" data-cid-msg></div>
    </div>

    <div class="section">
      <h3>cách tạo Client ID</h3>
      <ol class="steps">
        <li>Mở <a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noopener" style="color:var(--acc)">Google Cloud Console</a> và tạo project mới, ví dụ <code>MetroTube</code>.</li>
        <li>Vào <b>APIs &amp; Services → Library</b>, tìm <b>YouTube Data API v3</b> rồi bấm <b>Enable</b>.</li>
        <li>Vào <b>Google Auth Platform → Branding</b> (OAuth consent screen), chọn <b>External</b>, điền tên app và email của bạn.</li>
        <li>Ở mục <b>Audience</b>, thêm Gmail của bạn vào <b>Test users</b>. App ở chế độ Testing là đủ dùng cá nhân.</li>
        <li>Vào <b>Clients → Create client</b>, chọn loại <b>Web application</b>.</li>
        <li>Ở <b>Authorized JavaScript origins</b>, thêm đúng địa chỉ này:<br><span class="code">${esc(origin)}</span></li>
        <li>Bấm <b>Create</b>, sao chép <b>Client ID</b> rồi dán vào ô ở trên.</li>
      </ol>
      <p class="hint">Nếu Google báo "app chưa được xác minh", bấm <b>Continue</b>. Đó là app của chính bạn.</p>
    </div>

    <div class="section">
      <h3>dữ liệu</h3>
      <p class="hint">Hạn mức miễn phí của YouTube API là 10.000 đơn vị mỗi ngày. Mỗi lần làm mới feed tốn khoảng 1 đơn vị cho mỗi kênh, mỗi lần tìm kiếm tốn 100 đơn vị.</p>
      <button class="btn" data-clear>xoá bộ nhớ đệm</button>
    </div>
  </section>`);

  const form = $('[data-cid]', page), input = form.cid, msg = $('[data-cid-msg]', page);
  input.value = store.get('clientId', '');
  form.onsubmit = e => {
    e.preventDefault();
    const v = input.value.trim();
    if (v && !/^[\w-]+\.apps\.googleusercontent\.com$/.test(v)) { msg.textContent = 'Client ID phải có dạng ….apps.googleusercontent.com'; return; }
    if (v !== store.get('clientId', '')) auth.signOut();
    v ? store.set('clientId', v) : store.del('clientId');
    msg.textContent = '';
    toast(v ? 'Đã lưu Client ID' : 'Đã xoá Client ID');
    if (v) location.hash = '#/account';
  };
  input.oninput = () => (msg.textContent = '');

  $('[data-theme-row]', page).onclick = e => {
    const b = e.target.closest('button');
    if (!b) return;
    store.set('theme', b.dataset.t);
    applyTheme();
    $$('button', e.currentTarget).forEach(x => x.classList.toggle('on', x === b));
  };
  $('[data-font-row]', page).onclick = e => {
    const b = e.target.closest('button');
    if (!b) return;
    store.set('fontSize', b.dataset.f);
    applyTheme();
    $$('button', e.currentTarget).forEach(x => x.classList.toggle('on', x === b));
  };
  $('[data-clear]', page).onclick = () => { ['feed', 'subs', 'me'].forEach(k => store.del(k)); sessionStorage.clear(); toast('Đã xoá bộ nhớ đệm'); };
  return page;
}

/* ================= điều hướng ================= */
const routes = [
  [/^$/, startPage],
  [/^subs(?:\/(channels))?$/, subsPage],
  [/^search$/, searchPage],
  [/^watch\/([\w-]{6,})$/, watchPage],
  [/^channel\/([\w-]+)$/, channelPage],
  [/^account$/, accountPage],
  [/^settings$/, settingsPage],
];

// Đánh số độ sâu cho mỗi mục lịch sử để nút quay lại biết còn trang trước trong app hay không
let depth = 0;
function route() {
  const path = location.hash.replace(/^#\/?/, '');
  if (history.state?.d == null) history.replaceState({ d: depth === 0 && !$('#view').firstElementChild ? 0 : depth + 1 }, '');
  depth = history.state.d;
  timers.forEach(clearInterval);
  timers = [];
  document.title = 'MetroTube';
  const view = $('#view');
  for (const [re, fn] of routes) {
    const m = re.exec(path);
    if (!m) continue;
    const page = fn(...m.slice(1));
    // app bar nằm ngoài trang: transform/perspective của hiệu ứng chuyển trang làm hỏng position: fixed
    const bar = $('.appbar', page);
    $('#bar').replaceChildren(...(bar ? [bar] : []));
    view.replaceChildren(page);
    window.scrollTo(0, 0);
    if (continuum) continuumIn(page);
    return;
  }
  location.replace('#/');
}

/* ================= continuum: mở clip từ danh sách ================= */
// Tiêu đề clip được "nhấc" ra khỏi danh sách, các mục khác lật đi,
// rồi tiêu đề bay tới vị trí tiêu đề lớn trên trang xem.
let continuum = null;

function continuumOut(a) {
  const page = $('#view .page');
  const t = $('.vi-t', a);
  const r = t.getBoundingClientRect();
  const clone = t.cloneNode(true);
  clone.classList.add('cont-fly');
  Object.assign(clone.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px' });
  document.body.append(clone);
  t.style.visibility = 'hidden';
  continuum = { clone, rect: r, size: parseFloat(getComputedStyle(t).fontSize) };

  releaseTilt();
  a.classList.add('cont-src');
  page.classList.add('cont-leaving');
  $$('.vi:not(.cont-src)', page).forEach((x, i) => (x.style.animationDelay = Math.min(i, 8) * 18 + 'ms'));
  clone.animate([{ transform: 'none' }, { transform: 'translate(-4px, 8px)' }], { duration: 220, easing: 'ease-in', fill: 'forwards' });
  setTimeout(() => (location.hash = a.getAttribute('href')), 230);
}

function continuumIn(page) {
  const c = continuum;
  continuum = null;
  const target = $('.v-title', page);
  if (!target || !target.textContent) { c.clone.remove(); return; }

  page.classList.add('cont-in');
  target.closest('.pv-p')?.classList.remove('in-l', 'in-r');
  target.style.opacity = 0;
  const to = target.getBoundingClientRect();
  const k = parseFloat(getComputedStyle(target).fontSize) / c.size;
  const dx = to.left - c.rect.left, dy = to.top - c.rect.top;

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    target.style.transition = 'opacity .18s';
    target.style.opacity = '';
    c.clone.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: 'forwards' });
    setTimeout(() => c.clone.remove(), 200);
  };
  c.clone.animate([
    { transform: 'translate(-4px, 8px)' },
    { transform: `translate(${dx}px, ${dy}px) scale(${k})` },
  ], { duration: 480, easing: 'cubic-bezier(.1, .9, .2, 1)', fill: 'forwards' }).finished.then(finish, finish);
  setTimeout(finish, 900); // phòng khi animation bị trình duyệt tạm dừng
}

function goBack() {
  if (history.state?.d > 0) history.back();
  else location.replace('#/');
}

// rời trang với hiệu ứng turnstile
document.addEventListener('click', e => {
  if (e.target.closest('[data-back]')) { e.preventDefault(); goBack(); return; }
  const a = e.target.closest('a[href^="#/"]');
  if (!a || e.ctrlKey || e.metaKey || e.shiftKey) return;
  e.preventDefault();
  const cur = $('#view .page');
  if (!cur || reducedMotion.matches) { location.hash = a.getAttribute('href'); return; }
  if (a.classList.contains('vi') && !continuum) { continuumOut(a); return; }
  cur.classList.add('leaving');
  setTimeout(() => (location.hash = a.getAttribute('href')), 140);
});

window.addEventListener('hashchange', route);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && history.state?.d > 0 && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) history.back();
});

route();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
