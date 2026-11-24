'use strict';
/* =========================================================
   Garage Log — vehicle service & repair tracker (PWA)
   All data lives on-device in IndexedDB.
   ========================================================= */

/* ---------- Helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const pad = n => String(n).padStart(2, '0');
const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayISO = () => toISO(new Date());
const parseISO = s => { if (!s) return null; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const daysUntil = iso => Math.round((parseISO(iso) - startOfToday()) / 86400000);
const addMonths = (iso, m) => { const d = parseISO(iso) || new Date(); d.setMonth(d.getMonth() + m); return toISO(d); };
const num = v => {
  let s = String(v ?? '').replace(/[\s ]/g, '').replace(/[^\d.,-]/g, '');
  if (s.includes(',') && !s.includes('.')) s = s.replace(',', '.'); else s = s.replace(/,/g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};
const fmtNum = n => Math.round(n).toLocaleString();
const fmtMoney = n => `${S.settings.currency} ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtMoneyShort = n => `${S.settings.currency} ${Math.round(n || 0).toLocaleString()}`;
const fmtDist = n => `${fmtNum(n)} ${S.settings.unit}`;
const fmtDate = iso => iso ? parseISO(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
const fmtMonth = key => { const [y, m] = key.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }); };
const fmtBytes = b => b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`;

/* ---------- Icons ---------- */
const ICONS = {
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  hammer: '<path d="M15 12l-8.5 8.5a2.12 2.12 0 0 1-3-3L12 9"/><path d="M17.64 15L22 10.64"/><path d="M20.91 11.7l-1.25-1.25a2.6 2.6 0 0 1-.76-1.83V7.5L16.6 5.2a5.5 5.5 0 0 0-3.9-1.6H9.5l.9.8a6 6 0 0 1 2 4.5V11l2 2h1.17a2.6 2.6 0 0 1 1.83.76l1.25 1.25"/>',
  cog: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  tyre: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/><path d="M12 3v5.5M12 15.5V21M3 12h5.5M15.5 12H21"/>',
  disc: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/><path d="M16.5 4.2A9 9 0 0 1 21 12"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  badge: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
  doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  dots: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  updown: '<path d="M8 9l4-4 4 4M8 15l4 4 4-4"/>',
  camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  clip: '<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
  gauge: '<path d="M12 14l4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/>',
  trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  car: '<path d="M3 17v-4l2-5.5A2 2 0 0 1 6.9 6h10.2a2 2 0 0 1 1.9 1.5L21 13v4a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1v-1h-11v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M3 13h18"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/>',
  export: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  import: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  phone: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
  ok: '<circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-6"/>',
};
const icon = (name, cls = '') => `<svg viewBox="0 0 24 24" class="${cls}">${ICONS[name] || ''}</svg>`;

/* ---------- Constants ---------- */
const COLORS = { blue: '#0A84FF', orange: '#FF9F0A', purple: '#BF5AF2', teal: '#40C8E0', red: '#FF453A', green: '#30D158', mint: '#63E6BE', yellow: '#FFD60A', indigo: '#5E5CE6', gray: '#8E8E93', pink: '#FF375F' };
const TYPES = {
  service:    { label: 'Service',                 color: 'blue',   icon: 'wrench', ph: 'e.g. Major service' },
  repair:     { label: 'Repair',                  color: 'orange', icon: 'hammer', ph: 'e.g. Replace water pump' },
  parts:      { label: 'Parts Replacement',       color: 'purple', icon: 'cog',    ph: 'e.g. Wiper blades' },
  tyres:      { label: 'Tyres',                   color: 'teal',   icon: 'tyre',   ph: 'e.g. 4 × new tyres' },
  brakes:     { label: 'Brakes',                  color: 'red',    icon: 'disc',   ph: 'e.g. Front pads & discs' },
  battery:    { label: 'Battery',                 color: 'green',  icon: 'bolt',   ph: 'e.g. New battery' },
  inspection: { label: 'Inspection / Roadworthy', color: 'mint',   icon: 'badge',  ph: 'e.g. Roadworthy certificate' },
  licence:    { label: 'Licence Renewal',         color: 'yellow', icon: 'doc',    ph: 'e.g. Licence disc renewal' },
  insurance:  { label: 'Insurance',               color: 'indigo', icon: 'shield', ph: 'e.g. Annual policy' },
  other:      { label: 'Other',                   color: 'gray',   icon: 'dots',   ph: 'Description' },
};
// Types where any later record of the same type replaces the earlier reminder.
const RECURRING = new Set(['service', 'tyres', 'brakes', 'battery', 'inspection', 'licence', 'insurance']);
const DOC_CATS = ['Invoice', 'Receipt', 'Quotation', 'Licence', 'Insurance', 'Roadworthy', 'Warranty', 'Registration', 'Other'];
const ACCENTS = { blue: 'Blue', red: 'Red', green: 'Green', orange: 'Orange', purple: 'Purple', teal: 'Teal', pink: 'Pink', gray: 'Graphite' };
const CURRENCIES = ['R', '$', '€', '£', 'A$', 'C$', '₦', 'KSh', '₹', 'P', 'N$'];

/* ---------- State ---------- */
const S = {
  vehicles: [], records: [], docs: [],
  settings: { unit: 'km', currency: 'R', leadDays: 30, leadDist: 1000, vehicleId: null },
  tab: 'garage', histType: 'all', histQuery: '', docCat: 'all',
};
const curVehicle = () => S.vehicles.find(v => v.id === S.settings.vehicleId) || S.vehicles[0] || null;
const vehicleById = id => S.vehicles.find(v => v.id === id);
const vehicleRecords = id => S.records.filter(r => r.vehicleId === id);
const vehicleOdo = v => v ? Math.max(num(v.odo) || 0, ...vehicleRecords(v.id).map(r => num(r.odo) || 0)) : 0;
const vehicleSubtitle = v => [v.year, v.make, v.model].filter(Boolean).join(' ');
const recTitle = r => r.title || (TYPES[r.type] || TYPES.other).label;
const sortRecords = () => S.records.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.created || 0) - (a.created || 0));
const sortDocs = () => S.docs.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.created || 0) - (a.created || 0));

/* ---------- IndexedDB ---------- */
let db;
const STORES = ['vehicles', 'records', 'docs', 'meta'];
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('garage-log', 1);
    r.onupgradeneeded = () => STORES.forEach(s => { if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s, { keyPath: 'id' }); });
    r.onsuccess = () => { db = r.result; res(); };
    r.onerror = () => rej(r.error);
  });
}
const idb = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const store = (s, mode = 'readonly') => db.transaction(s, mode).objectStore(s);
const DB = {
  all: s => idb(store(s).getAll()),
  put: (s, v) => idb(store(s, 'readwrite').put(v)),
  del: (s, id) => idb(store(s, 'readwrite').delete(id)),
  clear: s => idb(store(s, 'readwrite').clear()),
};
const saveSettings = () => DB.put('meta', { id: 'settings', ...S.settings });

/* ---------- UI primitives ---------- */
let toastTimer;
function toast(msg, ok = true) {
  const t = $('#toast');
  t.innerHTML = (ok ? icon('ok') : '') + esc(msg);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1900);
}

function lockScroll() { document.body.classList.toggle('modal-open', $('#overlay').children.length > 0); }

function openSheet({ title = '', body = '', left = 'Cancel', right = '', onRight, small = false, dismissable = false }) {
  const w = document.createElement('div');
  w.className = 'sheet-wrap';
  w.innerHTML = `<div class="backdrop"></div>
    <div class="sheet ${small ? 'small' : ''}" role="dialog" aria-label="${esc(title)}">
      <div class="grabber"></div>
      <div class="sheet-header">
        <button class="sh-left">${esc(left)}</button>
        <div class="sh-title">${esc(title)}</div>
        <button class="sh-right" ${right ? '' : 'style="visibility:hidden"'}>${esc(right || '·')}</button>
      </div>
      <div class="sheet-body">${body}</div>
    </div>`;
  $('#overlay').appendChild(w);
  lockScroll();
  requestAnimationFrame(() => requestAnimationFrame(() => w.classList.add('open')));
  const close = () => {
    w.classList.remove('open');
    setTimeout(() => { w.remove(); lockScroll(); }, 380);
  };
  $('.sh-left', w).onclick = close;
  if (dismissable) $('.backdrop', w).onclick = close;
  if (right) $('.sh-right', w).onclick = () => onRight && onRight(close);
  return { el: $('.sheet', w), body: $('.sheet-body', w), close };
}

function actionSheet({ title = '', message = '', actions }) {
  return new Promise(resolve => {
    const w = document.createElement('div');
    w.className = 'as-wrap';
    const head = (title || message) ? `<div class="ah">${title ? `<b>${esc(title)}</b>` : ''}${message ? esc(message) : ''}</div>` : '';
    w.innerHTML = `<div class="backdrop"></div><div class="asheet">
      <div class="ag">${head}${actions.map((a, i) => `<button data-i="${i}" class="${a.destructive ? 'destructive' : ''}" ${head && i === 0 ? 'style="border-top:.5px solid var(--sep)"' : ''}>${esc(a.label)}</button>`).join('')}</div>
      <div class="ag"><button class="cancel" data-i="-1">Cancel</button></div></div>`;
    $('#overlay').appendChild(w);
    lockScroll();
    requestAnimationFrame(() => requestAnimationFrame(() => w.classList.add('open')));
    const done = i => {
      w.classList.remove('open');
      setTimeout(() => { w.remove(); lockScroll(); }, 300);
      resolve(i);
      if (i >= 0 && actions[i].handler) setTimeout(actions[i].handler, 120);
    };
    w.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (b) done(+b.dataset.i); else if (e.target.classList.contains('backdrop')) done(-1);
    });
  });
}
const confirmDestructive = (title, message, label) =>
  actionSheet({ title, message, actions: [{ label, destructive: true }] }).then(i => i === 0);

function typeIcon(type, size = 'row-icon') {
  const t = TYPES[type] || TYPES.other;
  return `<div class="${size}" style="background:${COLORS[t.color]}">${icon(t.icon)}</div>`;
}
function selectField(label, name, options, value, attrs = '') {
  return `<div class="field"><label>${esc(label)}</label><select name="${name}" ${attrs}>${options.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>${icon('updown', 'updown')}</div>`;
}
function inputField(label, name, value, { type = 'text', ph = '', mode = '', unit = '', attrs = '' } = {}) {
  return `<div class="field"><label>${esc(label)}</label><input type="${type}" name="${name}" value="${esc(value ?? '')}" placeholder="${esc(ph)}" ${mode ? `inputmode="${mode}"` : ''} ${attrs}>${unit ? `<span class="unit">${esc(unit)}</span>` : ''}</div>`;
}
function pillSelect(action, options, value, accent = false) {
  const cur = options.find(([v]) => String(v) === String(value)) || options[0];
  return `<label class="pill-select ${accent ? 'accent' : ''}">${esc(cur[1])}${icon('down')}<select data-change="${action}">${options.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
}
const typeOptions = () => Object.entries(TYPES).map(([k, t]) => [k, t.label]);
const vehicleOptions = () => S.vehicles.map(v => [v.id, v.name]);

/* ---------- File handling ---------- */
function pickFiles({ camera = false, accept = 'image/*,application/pdf', multiple = false } = {}) {
  return new Promise(res => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = camera ? 'image/*' : accept;
    if (camera) inp.setAttribute('capture', 'environment');
    inp.multiple = multiple;
    inp.style.display = 'none';
    inp.onchange = () => { res([...inp.files]); inp.remove(); };
    document.body.appendChild(inp);
    inp.click();
  });
}
function loadImage(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => res({ img, url });
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Could not read image')); };
    img.src = url;
  });
}
function drawScaled(img, max) {
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * scale);
  c.height = Math.round(img.naturalHeight * scale);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c;
}
async function processFile(file) {
  if (file.type.startsWith('image/')) {
    const { img, url } = await loadImage(file);
    const full = drawScaled(img, 2200);
    const blob = await new Promise(r => full.toBlob(r, 'image/jpeg', 0.84));
    const thumb = drawScaled(img, 360).toDataURL('image/jpeg', 0.7);
    URL.revokeObjectURL(url);
    return { blob, mime: 'image/jpeg', thumb, size: blob.size, name: file.name.replace(/\.[^.]+$/, '') };
  }
  return { blob: file, mime: file.type || 'application/octet-stream', thumb: null, size: file.size, name: file.name.replace(/\.[^.]+$/, '') };
}
async function processFiles(files) {
  if (!files.length) return [];
  toast('Processing…', false);
  const out = [];
  for (const f of files) { try { out.push(await processFile(f)); } catch (e) { toast(e.message, false); } }
  $('#toast').classList.remove('show');
  return out;
}
const blobToDataURL = b => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); });
const dataURLToBlob = async u => (await fetch(u)).blob();
function thumbHTML(d) {
  return d.thumb
    ? `<div class="doc-thumb" style="background-image:url('${d.thumb}')"></div>`
    : `<div class="doc-thumb">${icon('doc')}</div>`;
}

/* ---------- Reminders ---------- */
function getReminders(vehicleId) {
  const v = vehicleById(vehicleId);
  if (!v) return [];
  const odo = vehicleOdo(v);
  const recs = vehicleRecords(vehicleId);
  const same = (a, b) => a.type === b.type && (RECURRING.has(a.type) || recTitle(a).toLowerCase() === recTitle(b).toLowerCase());
  const later = (o, r) => o.date > r.date || (o.date === r.date && (o.created || 0) > (r.created || 0));
  const out = [];
  for (const r of recs) {
    if (!r.nextDate && !num(r.nextOdo)) continue;
    if (recs.some(o => o.id !== r.id && same(o, r) && later(o, r))) continue;
    const days = r.nextDate ? daysUntil(r.nextDate) : null;
    const dist = num(r.nextOdo) != null ? num(r.nextOdo) - odo : null;
    let status = 'ok';
    if ((days != null && days < 0) || (dist != null && dist < 0)) status = 'over';
    else if ((days != null && days <= S.settings.leadDays) || (dist != null && dist <= S.settings.leadDist)) status = 'soon';
    out.push({ r, days, dist, status });
  }
  const rank = { over: 0, soon: 1, ok: 2 };
  return out.sort((a, b) => rank[a.status] - rank[b.status] || (a.days ?? 99999) - (b.days ?? 99999));
}
function daysLabel(d) {
  if (d === 0) return 'Today';
  const a = Math.abs(d);
  if (a < 60) return `${a} day${a === 1 ? '' : 's'}`;
  if (a < 730) return `${Math.round(a / 30.4)} mo`;
  return `${(a / 365).toFixed(1)} yrs`;
}
function reminderBadge({ days, dist, status }) {
  let txt;
  if (status === 'over') {
    txt = (days != null && days < 0) ? `${daysLabel(days)} overdue` : `${fmtNum(-dist)} ${S.settings.unit} over`;
  } else {
    const dTxt = days != null ? (days === 0 ? 'Today' : `in ${daysLabel(days)}`) : null;
    const kTxt = dist != null ? `${fmtNum(dist)} ${S.settings.unit}` : null;
    // Show whichever comes first (approx 1 day ≈ 50 km for comparison is unreliable — prefer the one flagged)
    if (dTxt && kTxt) txt = (days <= S.settings.leadDays || dist > S.settings.leadDist) ? dTxt : kTxt;
    else txt = dTxt || kTxt;
  }
  return `<span class="badge ${status}">${esc(txt)}</span>`;
}

/* =========================================================
   Views
   ========================================================= */
function navbar(title, right = '') {
  return `<header class="navbar"><div class="nav-title">${esc(title)}</div><div class="nav-right">${right}</div></header>`;
}
const addBtn = (action = 'add-menu') => `<button class="icon-btn" data-action="${action}" aria-label="Add">${icon('plus')}</button>`;

function vehicleSwitcher() {
  if (S.vehicles.length < 2) return '';
  const cur = curVehicle();
  if (S.vehicles.length > 4) return `<div class="toolbar">${pillSelect('vehicle', vehicleOptions(), cur.id, true)}</div>`;
  return `<div class="segmented">${S.vehicles.map(v => `<button data-action="pick-vehicle" data-id="${v.id}" class="${v.id === cur.id ? 'on' : ''}">${esc(v.name)}</button>`).join('')}</div>`;
}

function noVehicles(title) {
  return {
    title, action: '',
    body: `<div class="empty"><div class="e-icon">${icon('car')}</div><h3>Add your first vehicle</h3>
      <p>Track services, repairs, parts and invoices for each vehicle you own.</p>
      <button class="btn inline" data-action="add-vehicle">${icon('plus')}Add Vehicle</button></div>`,
  };
}

function recordRow(r, showVehicle = false) {
  const nDocs = S.docs.filter(d => d.recordId === r.id).length;
  const sub = [fmtDate(r.date), num(r.odo) ? fmtDist(num(r.odo)) : '', showVehicle ? vehicleById(r.vehicleId)?.name : r.workshop].filter(Boolean).map(esc).join(' · ');
  return `<button class="row tap has-icon" data-action="open-record" data-id="${r.id}">
    ${typeIcon(r.type)}
    <div class="row-main"><div class="row-title">${esc(recTitle(r))}</div><div class="row-sub">${sub}${nDocs ? ` · ${icon('clip')}${nDocs}` : ''}</div></div>
    ${num(r.cost) ? `<div class="row-value sm">${fmtMoneyShort(num(r.cost))}</div>` : ''}
    ${icon('chev', 'chev')}</button>`;
}

function viewGarage() {
  if (!S.vehicles.length) return noVehicles('Garage');
  const v = curVehicle();
  const recs = vehicleRecords(v.id);
  const odo = vehicleOdo(v);
  const year = String(new Date().getFullYear());
  const spend = recs.filter(r => (r.date || '').startsWith(year)).reduce((s, r) => s + (num(r.cost) || 0), 0);
  const lastSvc = recs.find(r => r.type === 'service');
  const reminders = getReminders(v.id);
  const accent = COLORS[v.accent] || COLORS.blue;
  const odoDate = v.odoDate || recs.find(r => num(r.odo))?.date;

  const quick = [
    ['new-record', 'service', 'wrench', 'Service', COLORS.blue],
    ['new-record', 'repair', 'hammer', 'Repair', COLORS.orange],
    ['new-record', 'parts', 'cog', 'Parts', COLORS.purple],
    ['scan', '', 'camera', 'Scan', COLORS.green],
  ].map(([a, t, ic, l, c]) => `<button data-action="${a}" data-type="${t}"><span class="qi" style="background:${c}2b;color:${c}">${icon(ic)}</span>${l}</button>`).join('');

  const remHTML = reminders.length
    ? `<div class="group">${reminders.slice(0, 6).map(x => {
        const bits = [x.r.nextDate ? `Due ${fmtDate(x.r.nextDate)}` : '', num(x.r.nextOdo) ? `at ${fmtDist(num(x.r.nextOdo))}` : ''].filter(Boolean).join(' or ');
        return `<button class="row tap has-icon" data-action="reminder" data-id="${x.r.id}">${typeIcon(x.r.type)}
          <div class="row-main"><div class="row-title">${esc(recTitle(x.r))}</div><div class="row-sub">${esc(bits)}</div></div>${reminderBadge(x)}</button>`;
      }).join('')}</div>`
    : `<div class="empty sm">Nothing due. Add a “Next Due” date or ${esc(S.settings.unit)} when you log a service and it'll appear here.</div>`;

  const recentHTML = recs.length
    ? `<div class="group">${recs.slice(0, 5).map(r => recordRow(r)).join('')}</div>`
    : `<div class="empty sm">No records yet. Tap <b>+</b> to log your first service or repair.</div>`;

  return {
    title: 'Garage',
    action: addBtn(),
    body: `${vehicleSwitcher()}
    <div class="hero" style="--accent:${accent}">
      <div class="hero-top">
        <div style="min-width:0"><div class="hero-sub">${esc(vehicleSubtitle(v) || 'Vehicle')}</div><div class="hero-name">${esc(v.name)}</div></div>
        ${v.reg ? `<div class="plate">${esc(v.reg.toUpperCase())}</div>` : ''}
      </div>
      <div class="odo">
        <div><div class="odo-label">Odometer</div><div class="odo-val">${fmtNum(odo)}<span>${esc(S.settings.unit)}</span></div>
        ${odoDate ? `<div class="odo-date">Updated ${fmtDate(odoDate)}</div>` : ''}</div>
        <button class="pill-btn" data-action="odo">Update</button>
      </div>
      <div class="hero-stats">
        <div><b>${fmtMoneyShort(spend)}</b><span>Spent ${year}</span></div>
        <div><b>${recs.length}</b><span>Records</span></div>
        <div><b>${lastSvc ? esc(fmtDate(lastSvc.date)) : '—'}</b><span>Last service</span></div>
      </div>
    </div>
    <div class="quick">${quick}</div>
    <div class="section-title">Upcoming</div>${remHTML}
    <div class="section-title">Recent Activity ${recs.length > 5 ? '<button data-action="tab" data-tab="history">See All</button>' : ''}</div>${recentHTML}`,
  };
}

function historyList() {
  const v = curVehicle();
  let recs = vehicleRecords(v.id);
  if (S.histType !== 'all') recs = recs.filter(r => r.type === S.histType);
  const q = S.histQuery.trim().toLowerCase();
  if (q) recs = recs.filter(r => [recTitle(r), r.workshop, r.notes, TYPES[r.type]?.label, ...(r.parts || []).flatMap(p => [p.name, p.partNo])].join(' ').toLowerCase().includes(q));
  if (!recs.length) return `<div class="empty sm">${q || S.histType !== 'all' ? 'No matching records.' : 'No records yet for this vehicle.'}</div>`;
  const total = recs.reduce((s, r) => s + (num(r.cost) || 0), 0);
  const groups = {};
  recs.forEach(r => (groups[(r.date || '0000-00').slice(0, 7)] ||= []).push(r));
  return `<div class="summary"><span>${recs.length} record${recs.length === 1 ? '' : 's'}</span><span>Total ${fmtMoney(total)}</span></div>` +
    Object.entries(groups).map(([k, rs]) => `<div class="section-h" style="margin-top:18px">${esc(fmtMonth(k))}</div><div class="group">${rs.map(r => recordRow(r)).join('')}</div>`).join('');
}

function viewHistory() {
  if (!S.vehicles.length) return noVehicles('History');
  return {
    title: 'History',
    action: addBtn(),
    body: `${vehicleSwitcher()}
      <div class="toolbar">
        ${pillSelect('hist-type', [['all', 'All Types'], ...typeOptions()], S.histType)}
        <label class="search">${icon('search')}<input type="search" placeholder="Search parts, workshop, notes" value="${esc(S.histQuery)}" data-input="hist-search"></label>
      </div>
      <div id="hist-list">${historyList()}</div>`,
  };
}

function viewDocs() {
  if (!S.vehicles.length) return noVehicles('Documents');
  const v = curVehicle();
  let docs = S.docs.filter(d => d.vehicleId === v.id);
  if (S.docCat !== 'all') docs = docs.filter(d => d.category === S.docCat);
  const grid = docs.length
    ? `<div class="doc-grid">${docs.map(d => `<button class="doc-tile" data-action="open-doc" data-id="${d.id}">${thumbHTML(d)}<div class="doc-name">${esc(d.name)}</div><div class="doc-meta">${esc(d.category)} · ${esc(fmtDate(d.date))}</div></button>`).join('')}</div>`
    : `<div class="empty"><div class="e-icon">${icon('doc')}</div><h3>No documents</h3><p>Scan invoices, receipts, licence discs and insurance papers to keep them with your records.</p>
       <button class="btn inline" data-action="scan">${icon('camera')}Scan Document</button></div>`;
  return {
    title: 'Documents',
    action: addBtn('scan'),
    body: `${vehicleSwitcher()}<div class="toolbar">${pillSelect('doc-cat', [['all', 'All Documents'], ...DOC_CATS.map(c => [c, c])], S.docCat)}</div>${grid}`,
  };
}

function viewSettings() {
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const vRows = S.vehicles.map(v => `<button class="row tap" data-action="edit-vehicle" data-id="${v.id}">
      <span class="dot" style="background:${COLORS[v.accent] || COLORS.blue}"></span>
      <div class="row-main"><div class="row-title">${esc(v.name)}</div><div class="row-sub">${esc([vehicleSubtitle(v), v.reg?.toUpperCase()].filter(Boolean).join(' · ') || 'No details')}</div></div>
      ${icon('chev', 'chev')}</button>`).join('');
  return {
    title: 'Settings',
    action: '',
    body: `
    <div class="section-h" style="margin-top:4px">Vehicles</div>
    <div class="group">${vRows}<button class="row tap link" data-action="add-vehicle">${icon('plus')}Add Vehicle</button></div>

    <div class="section-h">Preferences</div>
    <div class="group">
      ${selectField('Distance', 'unit', [['km', 'Kilometres (km)'], ['mi', 'Miles (mi)']], S.settings.unit, 'data-setting="unit"')}
      ${selectField('Currency', 'currency', CURRENCIES.map(c => [c, c]), S.settings.currency, 'data-setting="currency"')}
      ${selectField('Due soon (time)', 'leadDays', [[14, '2 weeks before'], [30, '1 month before'], [60, '2 months before'], [90, '3 months before']], S.settings.leadDays, 'data-setting="leadDays"')}
      ${selectField('Due soon (distance)', 'leadDist', [500, 1000, 2000, 3000, 5000].map(n => [n, `${fmtNum(n)} ${S.settings.unit} before`]), S.settings.leadDist, 'data-setting="leadDist"')}
    </div>

    <div class="section-h">Backup</div>
    <div class="group">
      <button class="row tap link" data-action="export">${icon('export')}Export Backup</button>
      <button class="row tap link" data-action="import">${icon('import')}Restore from Backup</button>
      <div class="row"><div class="row-main">Storage used</div><div class="row-value" id="storage">…</div></div>
    </div>
    <div class="section-f">Everything is stored privately on this device. Export a backup regularly and keep it in iCloud Drive or Files.</div>

    ${standalone ? '' : `<div class="section-h">Install</div>
    <div class="group"><div class="row has-icon"><div class="row-icon" style="background:${COLORS.blue}">${icon('phone')}</div>
      <div class="row-main"><div class="row-title">Add to Home Screen</div><div class="row-sub" style="white-space:normal">In Safari tap Share ${icon('share')} then “Add to Home Screen”.</div></div></div></div>`}

    <div class="section-h">&nbsp;</div>
    <div class="group"><button class="row tap danger" data-action="erase">Erase All Data</button></div>
    <div class="footer-note">Garage Log · v1.0<br>${S.vehicles.length} vehicles · ${S.records.length} records · ${S.docs.length} documents</div>`,
  };
}

function render() {
  const view = { garage: viewGarage, history: viewHistory, docs: viewDocs, settings: viewSettings }[S.tab]();
  $('#view').innerHTML = navbar(view.title, view.action) + `<h1 class="large-title">${esc(view.title)}</h1>` + view.body;
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === S.tab));
  onScroll();
  if (S.tab === 'settings' && navigator.storage?.estimate) {
    navigator.storage.estimate().then(e => { const el = $('#storage'); if (el) el.textContent = fmtBytes(e.usage || 0); });
  }
}
function onScroll() { document.body.classList.toggle('scrolled', window.scrollY > 32); }
window.addEventListener('scroll', onScroll, { passive: true });

/* =========================================================
   Vehicle form
   ========================================================= */
function openVehicleForm(v = null) {
  const isNew = !v;
  const d = v || { accent: Object.keys(ACCENTS)[S.vehicles.length % 4] };
  const yearNow = new Date().getFullYear();
  const body = `<form autocomplete="off">
    <div class="group">
      ${inputField('Name', 'name', d.name, { ph: 'e.g. My Hilux' })}
      ${selectField('Colour tag', 'accent', Object.entries(ACCENTS), d.accent)}
    </div>
    <div class="section-h">Details</div>
    <div class="group">
      ${inputField('Make', 'make', d.make, { ph: 'Toyota' })}
      ${inputField('Model', 'model', d.model, { ph: 'Hilux 2.8 GD-6' })}
      ${selectField('Year', 'year', [['', '—'], ...Array.from({ length: 60 }, (_, i) => [yearNow + 1 - i, yearNow + 1 - i])], d.year || '')}
      ${inputField('Registration', 'reg', d.reg, { ph: 'ABC 123 GP', attrs: 'autocapitalize="characters"' })}
      ${inputField('VIN', 'vin', d.vin, { ph: 'Optional', attrs: 'autocapitalize="characters"' })}
      ${inputField('Engine no.', 'engine', d.engine, { ph: 'Optional', attrs: 'autocapitalize="characters"' })}
      ${inputField('Colour', 'colour', d.colour, { ph: 'Optional' })}
    </div>
    <div class="section-h">Ownership</div>
    <div class="group">
      ${inputField('Odometer', 'odo', d.odo, { mode: 'numeric', ph: '0', unit: S.settings.unit })}
      ${inputField('Purchased', 'purchaseDate', d.purchaseDate, { type: 'date' })}
      ${inputField('Price paid', 'purchasePrice', d.purchasePrice, { mode: 'decimal', ph: 'Optional' })}
    </div>
    <div class="section-h">Notes</div>
    <div class="group"><div class="field"><textarea name="notes" placeholder="Tyre sizes, oil spec, key codes…">${esc(d.notes || '')}</textarea></div></div>
    ${isNew ? '' : '<button type="button" class="btn danger" data-act="delete">Delete Vehicle</button>'}
  </form>`;
  const sh = openSheet({
    title: isNew ? 'New Vehicle' : 'Edit Vehicle', body, right: isNew ? 'Add' : 'Save',
    onRight: async close => {
      const f = Object.fromEntries(new FormData($('form', sh.body)));
      if (!f.name.trim()) { toast('Please give the vehicle a name', false); $('[name=name]', sh.body).focus(); return; }
      const rec = { ...(v || { id: uid(), created: Date.now() }), ...f, name: f.name.trim(), odo: num(f.odo) ?? '' };
      if (!v || num(v.odo) !== rec.odo) rec.odoDate = todayISO();
      await DB.put('vehicles', rec);
      if (isNew) { S.vehicles.push(rec); S.settings.vehicleId = rec.id; saveSettings(); }
      else Object.assign(v, rec);
      close(); render(); toast(isNew ? 'Vehicle added' : 'Saved');
    },
  });
  sh.body.addEventListener('click', async e => {
    if (!e.target.closest('[data-act="delete"]')) return;
    const n = vehicleRecords(v.id).length;
    if (!await confirmDestructive(`Delete ${v.name}?`, `This permanently removes the vehicle, its ${n} record${n === 1 ? '' : 's'} and all its documents.`, 'Delete Vehicle')) return;
    for (const r of vehicleRecords(v.id)) await DB.del('records', r.id);
    for (const d of S.docs.filter(d => d.vehicleId === v.id)) await DB.del('docs', d.id);
    await DB.del('vehicles', v.id);
    S.records = S.records.filter(r => r.vehicleId !== v.id);
    S.docs = S.docs.filter(d => d.vehicleId !== v.id);
    S.vehicles = S.vehicles.filter(x => x.id !== v.id);
    if (S.settings.vehicleId === v.id) { S.settings.vehicleId = S.vehicles[0]?.id || null; saveSettings(); }
    sh.close(); render(); toast('Vehicle deleted');
  });
}

/* =========================================================
   Odometer
   ========================================================= */
function openOdoSheet() {
  const v = curVehicle();
  const sh = openSheet({
    title: 'Update Odometer', small: true, dismissable: true, right: 'Save',
    body: `<div class="group" style="margin-top:8px">${inputField('Reading', 'odo', '', { mode: 'numeric', ph: fmtNum(vehicleOdo(v)), unit: S.settings.unit, attrs: 'autofocus' })}</div>
      <div class="section-f">Current: ${fmtDist(vehicleOdo(v))}. Readings from records are used automatically if they're higher.</div>`,
    onRight: async close => {
      const n = num($('[name=odo]', sh.body).value);
      if (n == null) { toast('Enter a reading', false); return; }
      v.odo = n; v.odoDate = todayISO();
      await DB.put('vehicles', v);
      close(); render(); toast('Odometer updated');
    },
  });
  setTimeout(() => $('[name=odo]', sh.body)?.focus(), 450);
}

/* =========================================================
   Record form
   ========================================================= */
function partRowHTML(p = {}) {
  return `<div class="part-row"><button type="button" class="minus" data-act="rm-part" aria-label="Remove">−</button>
    <div class="part-fields">
      <input class="p-name" placeholder="Part / item (e.g. Oil filter)" value="${esc(p.name || '')}">
      <div class="part-sub">
        <input class="p-no" placeholder="Part no." value="${esc(p.partNo || '')}">
        <input class="p-qty" placeholder="Qty" inputmode="decimal" value="${esc(p.qty ?? '')}">
        <input class="p-cost" placeholder="Cost" inputmode="decimal" value="${esc(p.cost ?? '')}">
      </div></div></div>`;
}

function openRecordForm(existing = null, preset = {}) {
  const isNew = !existing;
  const v0 = curVehicle();
  const r = existing ? JSON.parse(JSON.stringify(existing)) : {
    id: uid(), created: Date.now(), vehicleId: preset.vehicleId || v0.id, type: preset.type || 'service', title: preset.title || '',
    date: todayISO(), odo: '', cost: '', workshop: preset.workshop || '', parts: [], notes: '', nextDate: '', nextOdo: '',
  };
  const existingDocs = S.docs.filter(d => d.recordId === r.id);
  const removedDocs = new Set();
  const pending = [];
  const workshops = [...new Set(S.records.map(x => x.workshop).filter(Boolean))];

  const body = `<form autocomplete="off">
    <div class="group">
      ${S.vehicles.length > 1 ? selectField('Vehicle', 'vehicleId', vehicleOptions(), r.vehicleId) : ''}
      ${selectField('Type', 'type', typeOptions(), r.type)}
      ${inputField('Title', 'title', r.title, { ph: TYPES[r.type].ph })}
    </div>
    <div class="section-h">Details</div>
    <div class="group">
      ${inputField('Date', 'date', r.date, { type: 'date' })}
      ${inputField('Odometer', 'odo', r.odo, { mode: 'numeric', ph: fmtNum(vehicleOdo(vehicleById(r.vehicleId))), unit: S.settings.unit })}
      ${inputField('Total cost', 'cost', r.cost, { mode: 'decimal', ph: '0.00', unit: S.settings.currency })}
      ${inputField('Workshop', 'workshop', r.workshop, { ph: 'Dealer, mechanic or shop', attrs: 'list="dl-ws"' })}
    </div>
    <datalist id="dl-ws">${workshops.map(w => `<option value="${esc(w)}">`).join('')}</datalist>

    <div class="section-h">Parts &amp; Labour</div>
    <div class="group" id="parts">${(r.parts || []).map(partRowHTML).join('')}<button type="button" class="row tap link" data-act="add-part">${icon('plus')}Add Part or Labour</button></div>
    <div class="section-f" id="parts-sum"></div>

    <div class="section-h">Next Due</div>
    <div class="group">
      ${selectField('Remind in', 'repeatTime', [['', 'Choose…'], [3, '3 months'], [6, '6 months'], [12, '1 year'], [24, '2 years'], [36, '3 years']], '')}
      ${selectField('Or after', 'repeatDist', [['', 'Choose…'], ...[5000, 7500, 10000, 15000, 20000, 30000, 50000].map(n => [n, `${fmtNum(n)} ${S.settings.unit}`])], '')}
      ${inputField('Next date', 'nextDate', r.nextDate, { type: 'date' })}
      ${inputField('Next odometer', 'nextOdo', r.nextOdo, { mode: 'numeric', ph: 'Optional', unit: S.settings.unit })}
    </div>
    <div class="section-f">A reminder appears on the Garage screen as this comes due.</div>

    <div class="section-h">Notes</div>
    <div class="group"><div class="field"><textarea name="notes" placeholder="What was done, warranty info, advice from the mechanic…">${esc(r.notes || '')}</textarea></div></div>

    <div class="section-h">Invoices &amp; Documents</div>
    <div class="group">
      <div class="attach-grid" id="att"></div>
      <button type="button" class="row tap link" data-act="att-camera">${icon('camera')}Scan with Camera</button>
      <button type="button" class="row tap link" data-act="att-file">${icon('clip')}Choose Photo or PDF</button>
    </div>
    ${isNew ? '' : '<button type="button" class="btn danger" data-act="delete">Delete Record</button>'}
  </form>`;

  const sh = openSheet({ title: isNew ? 'New Record' : 'Edit Record', body, right: isNew ? 'Add' : 'Save', onRight: save });
  const form = $('form', sh.body);
  const F = name => form.elements[name];

  const readParts = () => $$('.part-row', form).map(row => ({
    name: $('.p-name', row).value.trim(), partNo: $('.p-no', row).value.trim(),
    qty: num($('.p-qty', row).value), cost: num($('.p-cost', row).value),
  })).filter(p => p.name || p.partNo || p.cost);
  const partsTotal = () => readParts().reduce((s, p) => s + (p.cost || 0), 0);
  const updateSum = () => {
    const t = partsTotal();
    $('#parts-sum', sh.body).textContent = t ? `Parts total ${fmtMoney(t)}${F('cost').value ? '' : ' — used as total cost if left blank.'}` : '';
    F('cost').placeholder = t ? t.toFixed(2) : '0.00';
  };
  const renderAtt = () => {
    const items = [
      ...existingDocs.filter(d => !removedDocs.has(d.id)).map(d => ({ key: 'e:' + d.id, d })),
      ...pending.map((p, i) => ({ key: 'p:' + i, d: p })),
    ];
    $('#att', sh.body).innerHTML = items.map(({ key, d }) => `<div class="att">${thumbHTML(d)}<button type="button" class="x" data-act="rm-att" data-key="${key}">${icon('x')}</button></div>`).join('');
  };
  renderAtt(); updateSum();

  form.addEventListener('input', e => { if (e.target.closest('.part-row') || e.target.name === 'cost') updateSum(); });
  form.addEventListener('change', e => {
    const n = e.target.name;
    if (n === 'type') F('title').placeholder = TYPES[e.target.value].ph;
    if (n === 'vehicleId') F('odo').placeholder = fmtNum(vehicleOdo(vehicleById(e.target.value)));
    if (n === 'repeatTime' && e.target.value) F('nextDate').value = addMonths(F('date').value || todayISO(), +e.target.value);
    if (n === 'repeatDist' && e.target.value) {
      const base = num(F('odo').value) ?? vehicleOdo(vehicleById(F('vehicleId')?.value || r.vehicleId));
      F('nextOdo').value = base + +e.target.value;
    }
  });
  sh.body.addEventListener('click', async e => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    if (act === 'add-part') { el.insertAdjacentHTML('beforebegin', partRowHTML()); el.previousElementSibling.querySelector('.p-name').focus(); }
    if (act === 'rm-part') { el.closest('.part-row').remove(); updateSum(); }
    if (act === 'att-camera' || act === 'att-file') {
      const files = await pickFiles({ camera: act === 'att-camera', multiple: act === 'att-file' });
      pending.push(...await processFiles(files)); renderAtt();
    }
    if (act === 'rm-att') {
      const [k, id] = el.dataset.key.split(':');
      if (k === 'e') removedDocs.add(id); else pending.splice(+id, 1);
      renderAtt();
    }
    if (act === 'delete') {
      const n = existingDocs.length;
      if (!await confirmDestructive('Delete this record?', n ? `Its ${n} attached document${n === 1 ? '' : 's'} will also be deleted.` : 'This cannot be undone.', 'Delete Record')) return;
      await deleteRecord(r.id);
      sh.close(); render(); toast('Record deleted');
    }
  });

  async function save(close) {
    const f = Object.fromEntries(new FormData(form));
    if (!f.date) { toast('Please choose a date', false); return; }
    const parts = readParts();
    const cost = num(f.cost) ?? (parts.length ? partsTotal() || '' : '');
    const out = {
      ...r, vehicleId: f.vehicleId || r.vehicleId, type: f.type, title: f.title.trim(), date: f.date,
      odo: num(f.odo) ?? '', cost, workshop: f.workshop.trim(), parts, notes: f.notes.trim(),
      nextDate: f.nextDate || '', nextOdo: num(f.nextOdo) ?? '', updated: Date.now(),
    };
    await DB.put('records', out);
    const i = S.records.findIndex(x => x.id === out.id);
    if (i >= 0) S.records[i] = out; else S.records.push(out);
    for (const id of removedDocs) { await DB.del('docs', id); S.docs = S.docs.filter(d => d.id !== id); }
    for (const d of existingDocs) if (!removedDocs.has(d.id) && d.vehicleId !== out.vehicleId) { d.vehicleId = out.vehicleId; await DB.put('docs', d); }
    for (const [i2, p] of pending.entries()) {
      const doc = {
        id: uid(), created: Date.now() + i2, vehicleId: out.vehicleId, recordId: out.id,
        name: `${recTitle(out)} – Invoice${pending.length > 1 ? ` ${i2 + 1}` : ''}`, category: 'Invoice', date: out.date,
        mime: p.mime, blob: p.blob, thumb: p.thumb, size: p.size,
      };
      await DB.put('docs', doc); S.docs.push(doc);
    }
    sortRecords(); sortDocs();
    close(); render(); toast(isNew ? 'Record added' : 'Saved');
  }
}

async function deleteRecord(id) {
  for (const d of S.docs.filter(d => d.recordId === id)) await DB.del('docs', d.id);
  await DB.del('records', id);
  S.docs = S.docs.filter(d => d.recordId !== id);
  S.records = S.records.filter(r => r.id !== id);
}

/* =========================================================
   Record detail
   ========================================================= */
function openRecordDetail(id) {
  const r = S.records.find(x => x.id === id);
  if (!r) return;
  const t = TYPES[r.type] || TYPES.other;
  const v = vehicleById(r.vehicleId);
  const docs = S.docs.filter(d => d.recordId === r.id);
  const info = [
    ['Vehicle', v?.name], ['Date', fmtDate(r.date)], ['Odometer', num(r.odo) ? fmtDist(num(r.odo)) : ''],
    ['Workshop', r.workshop], ['Total cost', num(r.cost) ? fmtMoney(num(r.cost)) : ''],
  ].filter(([, val]) => val);
  const parts = r.parts || [];
  const body = `
    <div class="detail-head">${typeIcon(r.type, 'big-icon')}<h2>${esc(recTitle(r))}</h2><p>${esc(t.label)}</p></div>
    <div class="group" style="margin-top:18px">${info.map(([k, val]) => `<div class="row"><div class="row-main">${esc(k)}</div><div class="row-value">${esc(val)}</div></div>`).join('')}</div>
    ${parts.length ? `<div class="section-h">Parts &amp; Labour</div><div class="group">${parts.map(p => `<div class="row"><div class="row-main"><div class="row-title">${esc(p.name || p.partNo)}</div>${(p.partNo && p.name) || p.qty ? `<div class="row-sub">${esc([p.name && p.partNo ? `#${p.partNo}` : '', p.qty ? `Qty ${p.qty}` : ''].filter(Boolean).join(' · '))}</div>` : ''}</div>${p.cost ? `<div class="row-value sm">${fmtMoney(p.cost)}</div>` : ''}</div>`).join('')}</div>` : ''}
    ${r.nextDate || num(r.nextOdo) ? `<div class="section-h">Next Due</div><div class="group">
        ${r.nextDate ? `<div class="row"><div class="row-main">Date</div><div class="row-value">${esc(fmtDate(r.nextDate))}</div></div>` : ''}
        ${num(r.nextOdo) ? `<div class="row"><div class="row-main">Odometer</div><div class="row-value">${esc(fmtDist(num(r.nextOdo)))}</div></div>` : ''}</div>` : ''}
    ${r.notes ? `<div class="section-h">Notes</div><div class="group"><div class="notes">${esc(r.notes)}</div></div>` : ''}
    ${docs.length ? `<div class="section-h">Documents</div><div class="group"><div class="attach-grid">${docs.map(d => `<button class="doc-tile" data-action="open-doc" data-id="${d.id}">${thumbHTML(d)}</button>`).join('')}</div></div>` : ''}
    <button class="btn tinted" data-act="again">${icon('plus')}Log Again</button>`;
  const sh = openSheet({ title: '', body, left: 'Close', right: 'Edit', dismissable: true, onRight: close => { close(); setTimeout(() => openRecordForm(r), 200); } });
  sh.body.addEventListener('click', e => {
    if (e.target.closest('[data-act="again"]')) {
      sh.close();
      setTimeout(() => openRecordForm(null, { vehicleId: r.vehicleId, type: r.type, title: r.title, workshop: r.workshop }), 200);
    }
  });
}

/* =========================================================
   Documents
   ========================================================= */
function recordOptionsFor(vehicleId) {
  return [['', 'None'], ...vehicleRecords(vehicleId).map(r => [r.id, `${fmtDate(r.date)} · ${recTitle(r)}`])];
}

function openDocForm({ doc = null, files = [] }) {
  const isNew = !doc;
  const d = doc || { vehicleId: curVehicle().id, recordId: '', name: '', category: 'Invoice', date: todayISO() };
  const previews = isNew ? files : [doc];
  const body = `<form autocomplete="off">
    <div class="attach-grid" style="padding:8px 0 4px">${previews.map(p => `<div class="att">${thumbHTML(p)}</div>`).join('')}</div>
    <div class="group">
      ${inputField('Name', 'name', d.name, { ph: isNew ? (files[0]?.name || 'Invoice') : '' })}
      ${selectField('Category', 'category', DOC_CATS.map(c => [c, c]), d.category)}
      ${inputField('Date', 'date', d.date, { type: 'date' })}
    </div>
    <div class="section-h">Link to</div>
    <div class="group">
      ${S.vehicles.length > 1 ? selectField('Vehicle', 'vehicleId', vehicleOptions(), d.vehicleId) : ''}
      ${selectField('Record', 'recordId', recordOptionsFor(d.vehicleId), d.recordId || '')}
    </div>
    <div class="section-f">Linking a document to a service or repair keeps the invoice with that record.</div>
  </form>`;
  const sh = openSheet({
    title: isNew ? (files.length > 1 ? `${files.length} Documents` : 'New Document') : 'Document Details', body, right: 'Save',
    onRight: async close => {
      const f = Object.fromEntries(new FormData($('form', sh.body)));
      const vehicleId = f.vehicleId || d.vehicleId;
      if (isNew) {
        const base = f.name.trim() || files[0]?.name || f.category;
        for (const [i, p] of files.entries()) {
          const nd = { id: uid(), created: Date.now() + i, vehicleId, recordId: f.recordId || null, name: files.length > 1 ? `${base} ${i + 1}` : base, category: f.category, date: f.date || todayISO(), mime: p.mime, blob: p.blob, thumb: p.thumb, size: p.size };
          await DB.put('docs', nd); S.docs.push(nd);
        }
      } else {
        Object.assign(doc, { name: f.name.trim() || doc.name, category: f.category, date: f.date || doc.date, vehicleId, recordId: f.recordId || null });
        await DB.put('docs', doc);
      }
      sortDocs(); close(); render(); toast('Saved');
    },
  });
  const vSel = $('[name=vehicleId]', sh.body);
  if (vSel) vSel.addEventListener('change', () => {
    $('[name=recordId]', sh.body).innerHTML = recordOptionsFor(vSel.value).map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('');
  });
}

async function scanFlow(source) {
  if (!S.vehicles.length) return openVehicleForm();
  if (!source) {
    return actionSheet({
      title: 'Add Document', actions: [
        { label: 'Scan with Camera', handler: () => scanFlow('camera') },
        { label: 'Choose Photo or PDF', handler: () => scanFlow('file') },
      ],
    });
  }
  const files = await processFiles(await pickFiles({ camera: source === 'camera', multiple: source === 'file' }));
  if (files.length) openDocForm({ files });
}

function openViewer(id) {
  const d = S.docs.find(x => x.id === id);
  if (!d) return;
  const url = URL.createObjectURL(d.blob);
  const rec = d.recordId && S.records.find(r => r.id === d.recordId);
  const isImg = (d.mime || '').startsWith('image/');
  const w = document.createElement('div');
  w.className = 'viewer-wrap';
  w.innerHTML = `
    <div class="v-top"><button data-v="close">Done</button>
      <div class="v-title"><div>${esc(d.name)}</div><small>${esc(d.category)} · ${esc(fmtDate(d.date))}${d.size ? ` · ${fmtBytes(d.size)}` : ''}</small></div>
      <button data-v="share" aria-label="Share">${icon('share')}</button></div>
    <div class="v-body">${isImg ? `<img src="${url}" alt="${esc(d.name)}">` : `<div class="pdf-card">${icon('doc')}<div>${esc(d.name)}</div><a class="btn inline" href="${url}" target="_blank" rel="noopener">Open Document</a></div>`}</div>
    <div class="v-bottom">${rec ? `<button data-v="rec" class="v-link">${icon('clip')}${esc(recTitle(rec))}</button>` : '<span></span>'}
      <div class="v-actions"><button data-v="edit">Details</button><button data-v="del" class="red" aria-label="Delete">${icon('trash')}</button></div></div>`;
  $('#overlay').appendChild(w);
  lockScroll();
  requestAnimationFrame(() => w.classList.add('open'));
  const close = () => { w.classList.remove('open'); setTimeout(() => { w.remove(); URL.revokeObjectURL(url); lockScroll(); }, 250); };
  w.addEventListener('click', async e => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    const a = b.dataset.v;
    if (a === 'close') close();
    if (a === 'share') {
      const ext = isImg ? 'jpg' : (d.mime.split('/')[1] || 'bin');
      const file = new File([d.blob], `${d.name}.${ext}`, { type: d.mime });
      if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: d.name }); } catch { /* cancelled */ } }
      else { const a2 = document.createElement('a'); a2.href = url; a2.download = file.name; a2.click(); }
    }
    if (a === 'edit') { close(); setTimeout(() => openDocForm({ doc: d }), 200); }
    if (a === 'rec') { close(); $$('.sheet-wrap').forEach(s => s.remove()); setTimeout(() => openRecordDetail(rec.id), 200); }
    if (a === 'del') {
      if (!await confirmDestructive('Delete this document?', 'This cannot be undone.', 'Delete Document')) return;
      await DB.del('docs', d.id);
      S.docs = S.docs.filter(x => x.id !== d.id);
      close(); render(); toast('Document deleted');
    }
  });
}

/* =========================================================
   Reminders menu, add menu
   ========================================================= */
function reminderMenu(id) {
  const r = S.records.find(x => x.id === id);
  actionSheet({
    title: recTitle(r),
    message: [r.nextDate ? `Due ${fmtDate(r.nextDate)}` : '', num(r.nextOdo) ? `at ${fmtDist(num(r.nextOdo))}` : ''].filter(Boolean).join(' or '),
    actions: [
      { label: 'Mark as Done…', handler: () => openRecordForm(null, { vehicleId: r.vehicleId, type: r.type, title: r.title, workshop: r.workshop }) },
      { label: 'View Last Record', handler: () => openRecordDetail(r.id) },
      { label: 'Clear Reminder', destructive: true, handler: async () => { r.nextDate = ''; r.nextOdo = ''; await DB.put('records', r); render(); toast('Reminder cleared'); } },
    ],
  });
}

function addMenu() {
  if (!S.vehicles.length) return openVehicleForm();
  const v = curVehicle();
  const t = type => () => openRecordForm(null, { type });
  actionSheet({
    title: v.name, actions: [
      { label: 'Log Service', handler: t('service') },
      { label: 'Log Repair', handler: t('repair') },
      { label: 'Log Parts Replacement', handler: t('parts') },
      { label: 'Other Record…', handler: t('other') },
      { label: 'Scan Invoice / Document', handler: () => scanFlow() },
      { label: 'Update Odometer', handler: openOdoSheet },
    ],
  });
}

/* =========================================================
   Backup
   ========================================================= */
async function exportBackup() {
  toast('Preparing backup…', false);
  const docs = [];
  for (const d of S.docs) docs.push({ ...d, blob: await blobToDataURL(d.blob) });
  const data = { app: 'garage-log', version: 1, exported: new Date().toISOString(), settings: S.settings, vehicles: S.vehicles, records: S.records, docs };
  const name = `garage-log-backup-${todayISO()}.json`;
  const file = new File([JSON.stringify(data)], name, { type: 'application/json' });
  $('#toast').classList.remove('show');
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Garage Log Backup' }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast('Backup saved');
}

async function importBackup() {
  const [file] = await pickFiles({ accept: 'application/json,.json' });
  if (!file) return;
  let data;
  try { data = JSON.parse(await file.text()); } catch { return toast('Not a valid backup file', false); }
  if (data.app !== 'garage-log') return toast('Not a Garage Log backup', false);
  const ok = await confirmDestructive('Restore backup?', `Replaces everything on this device with ${data.vehicles.length} vehicles, ${data.records.length} records and ${data.docs.length} documents from ${fmtDate(data.exported.slice(0, 10))}.`, 'Replace & Restore');
  if (!ok) return;
  toast('Restoring…', false);
  for (const s of STORES) await DB.clear(s);
  for (const v of data.vehicles) await DB.put('vehicles', v);
  for (const r of data.records) await DB.put('records', r);
  const docs = [];
  for (const d of data.docs) { const nd = { ...d, blob: await dataURLToBlob(d.blob) }; await DB.put('docs', nd); docs.push(nd); }
  Object.assign(S.settings, data.settings || {});
  await saveSettings();
  S.vehicles = data.vehicles; S.records = data.records; S.docs = docs;
  sortRecords(); sortDocs(); render(); toast('Backup restored');
}

async function eraseAll() {
  if (!await confirmDestructive('Erase all data?', 'Every vehicle, record and document on this device will be permanently deleted. Export a backup first if you might need it.', 'Erase Everything')) return;
  for (const s of STORES) await DB.clear(s);
  S.vehicles = []; S.records = []; S.docs = []; S.settings.vehicleId = null;
  render(); toast('All data erased');
}

/* =========================================================
   Event wiring
   ========================================================= */
const ACTIONS = {
  'tab': el => { S.tab = el.dataset.tab; window.scrollTo(0, 0); render(); },
  'pick-vehicle': el => { S.settings.vehicleId = el.dataset.id; saveSettings(); render(); },
  'add-menu': addMenu,
  'new-record': el => openRecordForm(null, { type: el.dataset.type }),
  'open-record': el => openRecordDetail(el.dataset.id),
  'reminder': el => reminderMenu(el.dataset.id),
  'odo': openOdoSheet,
  'scan': () => scanFlow(),
  'open-doc': el => openViewer(el.dataset.id),
  'add-vehicle': () => openVehicleForm(),
  'edit-vehicle': el => openVehicleForm(vehicleById(el.dataset.id)),
  'export': exportBackup,
  'import': importBackup,
  'erase': eraseAll,
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (el && ACTIONS[el.dataset.action]) ACTIONS[el.dataset.action](el, e);
});
document.addEventListener('change', e => {
  const el = e.target;
  const c = el.dataset.change;
  if (c === 'hist-type') { S.histType = el.value; render(); }
  if (c === 'doc-cat') { S.docCat = el.value; render(); }
  if (c === 'vehicle') { S.settings.vehicleId = el.value; saveSettings(); render(); }
  if (el.dataset.setting) {
    const k = el.dataset.setting;
    S.settings[k] = ['leadDays', 'leadDist'].includes(k) ? +el.value : el.value;
    saveSettings(); render();
  }
});
document.addEventListener('input', e => {
  if (e.target.dataset.input === 'hist-search') { S.histQuery = e.target.value; $('#hist-list').innerHTML = historyList(); }
});

/* =========================================================
   Boot
   ========================================================= */
(async function boot() {
  try {
    await openDB();
    const [vehicles, records, docs, meta] = await Promise.all(STORES.map(s => DB.all(s)));
    S.vehicles = vehicles.sort((a, b) => (a.created || 0) - (b.created || 0));
    S.records = records; S.docs = docs;
    const st = meta.find(m => m.id === 'settings');
    if (st) { delete st.id; Object.assign(S.settings, st); }
    sortRecords(); sortDocs();
  } catch (e) {
    console.error(e);
    $('#view').innerHTML = `<div class="empty"><h3>Storage unavailable</h3><p>${esc(e.message)}</p></div>`;
    return;
  }
  render();
  navigator.storage?.persist?.();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
