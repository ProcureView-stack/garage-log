'use strict';
/* =========================================================
   Garage Log — vehicle service, repair & trip tracker (PWA)
   All data lives on-device in IndexedDB.
   ========================================================= */
const APP_VERSION = '1.3.0';
const WHATS_NEW = [
  ['camera', 'Vehicle photos', 'Add photos of each vehicle: take one or choose several from your library. Tap the camera on the Garage card, or add them under Settings → your vehicle.'],
  ['star', 'Cover photo', 'Your chosen photo now sits at the top of the Garage card. Tap it to see all photos and pick a different cover. Photos are kept out of Documents and included in backups.'],
  ['bell', 'Reminders fixed', 'A reminder now stays in Upcoming until a later record actually covers it (done around or after the due date or km). Logging an unrelated service in between no longer hides it. Any reminder can also be set to “Show in Upcoming anyway”.'],
  ['gauge', 'Back-fill in any order', 'Old records never change your current odometer. Tap Update on the odometer to see every reading by date; any that don’t fit (an earlier date with a higher reading) are marked ⚠ so you can fix them.'],
  ['car', 'Odometer today vs at purchase', 'Vehicle details now keep “Odometer today” and “Odometer at purchase” separate, with the purchase reading dated on your purchase date.'],
  ['plus', 'Save & Add Another', 'Enter history faster: the next record opens with the same vehicle, type, workshop and date.'],
  ['bell', 'No more reminder pop-ups', 'A “next due” on an older record is quietly kept as history. Only your newest record of each type drives Upcoming.'],
  ['route', 'Past trips', 'Picking a past start date marks the trip completed and stops using today’s odometer.'],
];

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
const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);
const addMonths = (iso, m) => { const d = parseISO(iso) || new Date(); d.setMonth(d.getMonth() + m); return toISO(d); };
const num = v => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let s = String(v ?? '').replace(/[\s ]/g, '').replace(/[^\d.,-]/g, '');
  if (s.includes(',') && !s.includes('.')) s = s.replace(',', '.'); else s = s.replace(/,/g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};
const sum = (arr, f) => arr.reduce((s, x) => s + (f(x) || 0), 0);
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
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
  star: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>',
  clip: '<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
  gauge: '<path d="M12 14l4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/>',
  trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  car: '<path d="M3 17v-4l2-5.5A2 2 0 0 1 6.9 6h10.2a2 2 0 0 1 1.9 1.5L21 13v4a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1v-1h-11v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M3 13h18"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/>',
  export: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  import: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  phone: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
  ok: '<circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-6"/>',
  refresh: '<path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
  chart: '<path d="M18 20V10M12 20V4M6 20v-6"/>',
  route: '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
  flag: '<path d="M4 22V4M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1"/>',
  fuel: '<path d="M3 22V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v17M2 22h13M3 10h11"/><path d="M14 13h2a2 2 0 0 1 2 2v3a1.5 1.5 0 0 0 3 0V9l-3-3"/>',
  toll: '<path d="M5 21V7M2 21h6M5 10l16-4v4L5 14"/><path d="M10 9v3M15 8v3"/>',
  food: '<path d="M3 2v7a3 3 0 0 0 3 3v10M9 2v7a3 3 0 0 1-3 3M6 2v6"/><path d="M18 22V2c-2.5 0-4 2.5-4 7v4h4"/>',
  cup: '<path d="M17 8h1a4 4 0 0 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z"/><path d="M6 2v3M10 2v3M14 2v3"/>',
  bed: '<path d="M2 4v16M2 13h20v7M22 13a4 4 0 0 0-4-4h-8v4"/><circle cx="6" cy="10" r="2"/>',
  parking: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>',
  coins: '<circle cx="9" cy="9" r="6"/><path d="M18.1 10.4A6 6 0 1 1 10.4 18.1"/>',
  ticket: '<path d="M2 9V6a1 1 0 0 1 1-1h18a1 1 0 0 1 1 1v3a3 3 0 0 0 0 6v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-3a3 3 0 0 0 0-6z"/><path d="M13 5v2M13 11v2M13 17v2"/>',
  drop: '<path d="M12 2.7l5.7 5.7a8 8 0 1 1-11.3 0z"/>',
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
const EXP = {
  fuel:    { label: 'Fuel',               short: 'Fuel',   color: 'orange', icon: 'fuel',    ph: 'e.g. Engen Harrismith' },
  toll:    { label: 'Toll Gates',         short: 'Toll',   color: 'yellow', icon: 'toll',    ph: 'e.g. Wilge Plaza' },
  food:    { label: 'Food & Snacks',      short: 'Food',   color: 'pink',   icon: 'food',    ph: 'e.g. Wimpy, padkos' },
  drinks:  { label: 'Drinks',             short: 'Drinks', color: 'teal',   icon: 'cup',     ph: 'e.g. Coffee, cold drinks' },
  accom:   { label: 'Accommodation',      short: 'Stay',   color: 'indigo', icon: 'bed',     ph: 'e.g. Guest house' },
  parking: { label: 'Parking',            short: 'Parking',color: 'blue',   icon: 'parking', ph: 'e.g. Airport parking' },
  tips:    { label: 'Tips & Car Guards',  short: 'Tips',   color: 'green',  icon: 'coins',   ph: 'e.g. Petrol attendant' },
  fees:    { label: 'Entry & Park Fees',  short: 'Fees',   color: 'mint',   icon: 'ticket',  ph: 'e.g. Kruger gate fee' },
  carcare: { label: 'Car Wash & Top-ups', short: 'Car',    color: 'purple', icon: 'drop',    ph: 'e.g. Oil, water, wash' },
  other:   { label: 'Other',              short: 'Other',  color: 'gray',   icon: 'dots',    ph: 'Description' },
};
const PURPOSES = ['Leisure', 'Business', 'Family', 'Commute', 'Other'];
const PERIODS = { year: 'This Year', '12m': 'Last 12 Months', all: 'All Time' };
const DOC_CATS = ['Invoice', 'Receipt', 'Quotation', 'Licence', 'Insurance', 'Roadworthy', 'Warranty', 'Registration', 'Other'];
const ACCENTS = { blue: 'Blue', red: 'Red', green: 'Green', orange: 'Orange', purple: 'Purple', teal: 'Teal', pink: 'Pink', gray: 'Graphite' };
const CURRENCIES = ['R', '$', '€', '£', 'A$', 'C$', '₦', 'KSh', '₹', 'P', 'N$'];

/* ---------- State ---------- */
const S = {
  vehicles: [], records: [], docs: [], trips: [],
  settings: { unit: 'km', currency: 'R', leadDays: 30, leadDist: 1000, vehicleId: null, spendPeriod: 'year', seenVersion: null },
  tab: 'garage', histType: 'all', histQuery: '', docCat: 'all', tripYear: 'all', tripPurpose: 'all',
};
const curVehicle = () => S.vehicles.find(v => v.id === S.settings.vehicleId) || S.vehicles[0] || null;
const vehicleById = id => S.vehicles.find(v => v.id === id);
const vehicleRecords = id => S.records.filter(r => r.vehicleId === id);
const vehicleTrips = id => S.trips.filter(t => t.vehicleId === id);
const vehicleSubtitle = v => [v.year, v.make, v.model].filter(Boolean).join(' ');
const recTitle = r => r.title || (TYPES[r.type] || TYPES.other).label;
const byDateDesc = (da, db) => (a, b) => (db(b) || '').localeCompare(da(a) || '') || (b.created || 0) - (a.created || 0);
const sortRecords = () => S.records.sort(byDateDesc(r => r.date, r => r.date));
const sortDocs = () => S.docs.sort(byDateDesc(d => d.date, d => d.date));
const sortTrips = () => S.trips.sort(byDateDesc(t => t.startDate, t => t.startDate));

/* Odometer: every dated reading (records, trips, manual updates, purchase) on one timeline.
   The most recent date wins (ties → highest), so back-filled history never overrides today. */
function odoReadings(vid) {
  const v = vehicleById(vid);
  const out = [];
  if (v) {
    if (num(v.odo)) out.push({ odo: num(v.odo), date: v.odoDate || '', src: 'vehicle', id: v.id, label: 'Odometer update' });
    if (num(v.purchaseOdo) && v.purchaseDate) out.push({ odo: num(v.purchaseOdo), date: v.purchaseDate, src: 'vehicle', id: v.id, label: 'At purchase' });
  }
  for (const r of vehicleRecords(vid)) if (num(r.odo)) out.push({ odo: num(r.odo), date: r.date || '', src: 'record', id: r.id, label: recTitle(r) });
  for (const t of vehicleTrips(vid)) {
    if (num(t.odoStart)) out.push({ odo: num(t.odoStart), date: t.startDate || '', src: 'trip', id: t.id, label: `${tripName(t)} (start)` });
    if (num(t.odoEnd)) out.push({ odo: num(t.odoEnd), date: t.endDate || t.startDate || '', src: 'trip', id: t.id, label: `${tripName(t)} (end)` });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || b.odo - a.odo);
}
function vehicleOdoInfo(v) {
  if (!v) return { odo: 0, date: '' };
  return odoReadings(v.id)[0] || { odo: 0, date: '' };
}
const vehicleOdo = v => vehicleOdoInfo(v).odo;
/** Readings that don't fit date order (an earlier date with a higher reading than a later date). */
function odoConflicts(readings) {
  const bad = new Set();
  readings.forEach((a, i) => readings.forEach((b, j) => {
    if (a.date && b.date && a.date < b.date && a.odo > b.odo) { bad.add(i); bad.add(j); }
  }));
  return bad;
}
/** Live check for a reading being entered: returns a warning string, or ''. */
function checkReading(vid, date, odo, excludeId) {
  if (!date || odo == null || !vid) return '';
  const rs = odoReadings(vid).filter(r => r.id !== excludeId && r.date);
  const higherBefore = rs.filter(r => r.date < date && r.odo > odo).sort((a, b) => b.odo - a.odo)[0];
  if (higherBefore) return `Check this reading: ${fmtDist(higherBefore.odo)} was already recorded earlier, on ${fmtDate(higherBefore.date)} (${higherBefore.label}).`;
  const lowerAfter = rs.filter(r => r.date > date && r.odo < odo).sort((a, b) => a.odo - b.odo)[0];
  if (lowerAfter) return `Check this reading: a later date, ${fmtDate(lowerAfter.date)} (${lowerAfter.label}), has a lower reading of ${fmtDist(lowerAfter.odo)}.`;
  return '';
}

/* Trips */
const tripDist = t => (num(t.odoEnd) != null && num(t.odoStart) != null) ? Math.max(0, num(t.odoEnd) - num(t.odoStart)) : null;
const tripTotal = t => sum(t.expenses || [], e => num(e.amount));
const tripLitres = t => sum((t.expenses || []).filter(e => e.cat === 'fuel'), e => num(e.litres));
const tripName = t => t.name || [t.from, t.to].filter(Boolean).join(' → ') || 'Trip';
const tripDays = t => t.endDate && t.startDate ? daysBetween(t.startDate, t.endDate) + 1 : 1;
const activeTrips = vid => vehicleTrips(vid).filter(t => !t.completed);

/* Spending */
function periodStart(p) {
  if (p === 'year') return `${new Date().getFullYear()}-01-01`;
  if (p === '12m') { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return toISO(d); }
  return '';
}
const periodShort = p => p === 'year' ? String(new Date().getFullYear()) : p === '12m' ? '12 mo' : 'all time';
function spendItems(vid, p) {
  const from = periodStart(p);
  const items = [];
  for (const r of vehicleRecords(vid)) if ((r.date || '') >= from && num(r.cost)) items.push({ group: 'maint', key: r.type, amt: num(r.cost) });
  for (const t of vehicleTrips(vid)) for (const e of t.expenses || []) {
    if ((e.date || t.startDate || '') >= from && num(e.amount)) items.push({ group: 'trip', key: e.cat, amt: num(e.amount) });
  }
  return items;
}

/* ---------- IndexedDB ---------- */
let db;
const STORES = ['vehicles', 'records', 'docs', 'trips', 'meta'];
function openDB() {
  return new Promise((res, rej) => {
    // v2 adds the "trips" store. Upgrades only ever ADD stores — existing data is never touched.
    const r = indexedDB.open('garage-log', 2);
    r.onupgradeneeded = () => STORES.forEach(s => { if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s, { keyPath: 'id' }); });
    r.onsuccess = () => { db = r.result; db.onversionchange = () => { db.close(); location.reload(); }; res(); };
    r.onerror = () => rej(r.error);
    r.onblocked = () => toast('Close other Garage Log windows to finish updating', false);
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
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
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

function actionSheet({ title = '', message = '', actions = [], cancelLabel = 'Cancel' }) {
  return new Promise(resolve => {
    const w = document.createElement('div');
    w.className = 'as-wrap';
    const head = (title || message) ? `<div class="ah">${title ? `<b>${esc(title)}</b>` : ''}${message ? esc(message) : ''}</div>` : '';
    w.innerHTML = `<div class="backdrop"></div><div class="asheet">
      <div class="ag">${head}${actions.map((a, i) => `<button data-i="${i}" class="${a.destructive ? 'destructive' : ''}">${esc(a.label)}</button>`).join('')}</div>
      <div class="ag"><button class="cancel" data-i="-1">${esc(cancelLabel)}</button></div></div>`;
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
function expIcon(cat, size = 'row-icon') {
  const c = EXP[cat] || EXP.other;
  return `<div class="${size}" style="background:${COLORS[c.color]}">${icon(c.icon)}</div>`;
}
const optionsHTML = (options, value) => options.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(l)}</option>`).join('');
function selectField(label, name, options, value, attrs = '') {
  return `<div class="field"><label>${esc(label)}</label><select name="${name}" ${attrs}>${optionsHTML(options, value)}</select>${icon('updown', 'updown')}</div>`;
}
function inputField(label, name, value, { type = 'text', ph = '', mode = '', unit = '', attrs = '' } = {}) {
  return `<div class="field"><label>${esc(label)}</label><input type="${type}" name="${name}" value="${esc(value ?? '')}" placeholder="${esc(ph)}" ${mode ? `inputmode="${mode}"` : ''} ${attrs}>${unit ? `<span class="unit">${esc(unit)}</span>` : ''}</div>`;
}
function pillSelect(action, options, value, accent = false) {
  const cur = options.find(([v]) => String(v) === String(value)) || options[0];
  return `<label class="pill-select ${accent ? 'accent' : ''}">${esc(cur[1])}${icon('down')}<select data-change="${action}">${optionsHTML(options, value)}</select></label>`;
}
const typeOptions = () => Object.entries(TYPES).map(([k, t]) => [k, t.label]);
const expOptions = () => Object.entries(EXP).map(([k, c]) => [k, c.label]);
const vehicleOptions = () => S.vehicles.map(v => [v.id, v.name]);
const attachRows = `<button type="button" class="row tap link" data-act="att-camera">${icon('camera')}Scan with Camera</button>
      <button type="button" class="row tap link" data-act="att-file">${icon('clip')}Choose Photo or PDF</button>`;

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
/* Shared attachment handling for record / trip / expense forms. */
function attachments(sheetBody, existingDocs, { imagesOnly = false } = {}) {
  const removed = new Set();
  const pending = [];
  const paint = () => {
    const items = [
      ...existingDocs.filter(d => !removed.has(d.id)).map(d => ({ key: 'e:' + d.id, d })),
      ...pending.map((p, i) => ({ key: 'p:' + i, d: p })),
    ];
    $('.attach-grid', sheetBody).innerHTML = items.map(({ key, d }) => `<div class="att">${thumbHTML(d)}<button type="button" class="x" data-act="rm-att" data-key="${key}">${icon('x')}</button></div>`).join('');
  };
  paint();
  sheetBody.addEventListener('click', async e => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    if (act === 'att-camera' || act === 'att-file') {
      const files = await pickFiles({ camera: act === 'att-camera', multiple: act === 'att-file', accept: imagesOnly ? 'image/*' : undefined });
      pending.push(...(await processFiles(files)).filter(p => !imagesOnly || p.mime.startsWith('image/'))); paint();
    }
    if (act === 'rm-att') {
      const [k, id] = el.dataset.key.split(':');
      if (k === 'e') removed.add(id); else pending.splice(+id, 1);
      paint();
    }
  });
  return {
    async commit({ vehicleId, recordId = null, tripId = null, baseName, category, date, extra = {} }) {
      for (const id of removed) { await DB.del('docs', id); S.docs = S.docs.filter(d => d.id !== id); }
      for (const d of existingDocs) if (!removed.has(d.id) && d.vehicleId !== vehicleId) { d.vehicleId = vehicleId; await DB.put('docs', d); }
      for (const [i, p] of pending.entries()) {
        const doc = {
          id: uid(), created: Date.now() + i, vehicleId, recordId, tripId,
          name: `${baseName}${pending.length > 1 ? ` ${i + 1}` : ''}`, category, date,
          mime: p.mime, blob: p.blob, thumb: p.thumb, size: p.size, ...extra,
        };
        await DB.put('docs', doc); S.docs.push(doc);
      }
      sortDocs();
    },
  };
}

/* ---------- Vehicle photos ----------
   Stored in the docs store with kind:'photo' so backup, restore and vehicle delete handle them,
   but kept out of the Documents tab. vehicle.coverId picks the Garage card photo. */
const isPhoto = d => d.kind === 'photo';
const vehiclePhotos = vid => S.docs.filter(d => d.vehicleId === vid && isPhoto(d)).sort((a, b) => (b.created || 0) - (a.created || 0));
const coverPhoto = v => { const ps = vehiclePhotos(v.id); return ps.find(p => p.id === v.coverId) || ps[ps.length - 1] || null; };
const photoURLs = new Map();
function photoURL(d) {
  if (!photoURLs.has(d.id)) photoURLs.set(d.id, URL.createObjectURL(d.blob));
  return photoURLs.get(d.id);
}
function newPhotoDoc(v, p, i = 0) {
  return { id: uid(), created: Date.now() + i, vehicleId: v.id, recordId: null, tripId: null, kind: 'photo', name: `${v.name} photo`, category: 'Photo', date: todayISO(), mime: p.mime, blob: p.blob, thumb: p.thumb, size: p.size };
}
async function setCover(v, id) {
  v.coverId = id;
  await DB.put('vehicles', v);
}
async function addVehiclePhotos(v, source) {
  const files = await pickFiles({ camera: source === 'camera', multiple: source !== 'camera', accept: 'image/*' });
  const ps = (await processFiles(files)).filter(p => p.mime.startsWith('image/'));
  if (!ps.length) return 0;
  const hadCover = !!coverPhoto(v);
  const added = ps.map((p, i) => newPhotoDoc(v, p, i));
  for (const d of added) { await DB.put('docs', d); S.docs.push(d); }
  sortDocs();
  if (!hadCover) await setCover(v, added[0].id);
  return added.length;
}
function openPhotos(vid = curVehicle().id) {
  const v = vehicleById(vid);
  const sh = openSheet({ title: 'Photos', left: 'Done', dismissable: true });
  const paint = () => {
    const ps = vehiclePhotos(v.id);
    const cover = coverPhoto(v);
    sh.body.innerHTML = `
      <div class="group" style="margin-top:14px">
        <button class="row tap link" data-act="take">${icon('camera')}Take Photo</button>
        <button class="row tap link" data-act="choose">${icon('image')}Choose from Library</button>
      </div>
      ${ps.length ? `<div class="section-h">${esc(v.name)} · ${ps.length} photo${ps.length === 1 ? '' : 's'}</div>
      <div class="photo-grid">${ps.map(p => `<button class="photo-tile" data-act="view" data-id="${p.id}" style="background-image:url('${p.thumb || photoURL(p)}')">${cover?.id === p.id ? '<span class="cover-tag">Cover</span>' : ''}</button>`).join('')}</div>
      <div class="section-f">Tap a photo to view it, share it or make it the cover on the Garage card.</div>`
      : `<div class="empty sm" style="margin-top:14px">No photos yet. Add a few of ${esc(v.name)}: the outside, the interior, the odometer, any damage.</div>`}`;
  };
  paint();
  sh.body.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const a = el.dataset.act;
    if (a === 'take' || a === 'choose') {
      addVehiclePhotos(v, a === 'take' ? 'camera' : 'file').then(n => { if (n) { paint(); render(); toast(n === 1 ? 'Photo added' : `${n} photos added`); } });
    }
    if (a === 'view') openViewer(el.dataset.id, paint);
  });
}

/* ---------- Reminders ---------- */
const sameKind = (a, b) => a.type === b.type && (RECURRING.has(a.type) || recTitle(a).toLowerCase() === recTitle(b).toLowerCase());
const isLater = (o, r) => (o.date || '') > (r.date || '') || (o.date === r.date && (o.created || 0) > (r.created || 0));
const hasReminder = r => !!r.nextDate || num(r.nextOdo) != null;
const sameTitleOrBlank = (a, b) => !a.title || !b.title || a.title.trim().toLowerCase() === b.title.trim().toLowerCase();
/** Did newer record `o` take care of `r`'s reminder? Only if it was done around/after the due date or distance. */
function fulfils(o, r) {
  if (r.nextDate && o.date) {
    const interval = r.date ? Math.max(0, daysBetween(r.date, r.nextDate)) : 0;
    const win = Math.max(S.settings.leadDays, 30, Math.round(interval * 0.2));
    if (daysBetween(o.date, r.nextDate) <= win) return true;
  }
  if (num(r.nextOdo) != null && num(o.odo)) {
    const interval = num(r.odo) ? Math.max(0, num(r.nextOdo) - num(r.odo)) : 0;
    const win = Math.max(S.settings.leadDist, 1000, Math.round(interval * 0.2));
    if (num(o.odo) >= num(r.nextOdo) - win) return true;
  }
  return false;
}
/**
 * Is this record's reminder still live?
 *  - pinned by you → always active
 *  - a newer record of the same kind was done around/after the due point → done
 *  - a newer record of the same kind (same or blank title) sets its own next due → replaced
 *  - otherwise active (an unrelated newer record never hides it)
 */
function reminderStatus(r) {
  if (!hasReminder(r)) return { active: false };
  if (r.reminderPinned) return { active: true, pinned: true };
  const newer = vehicleRecords(r.vehicleId).filter(o => o.id !== r.id && sameKind(o, r) && isLater(o, r))
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const done = newer.find(o => fulfils(o, r));
  if (done) return { active: false, why: 'done', by: done };
  const repl = newer.filter(o => hasReminder(o) && sameTitleOrBlank(o, r)).pop();
  if (repl) return { active: false, why: 'replaced', by: repl };
  return { active: true };
}
const reminderStatusText = st => st.why === 'done'
  ? `Done — your ${TYPES[st.by.type].label.toLowerCase()} on ${fmtDate(st.by.date)}${num(st.by.odo) ? ` at ${fmtDist(num(st.by.odo))}` : ''} took care of it.`
  : `Replaced — your newer “${recTitle(st.by)}” (${fmtDate(st.by.date)}) has its own next due.`;
/** Reminders not shown because a newer record covers them, but whose due point is still ahead. */
function hiddenUpcoming(vehicleId) {
  const odo = vehicleOdo(vehicleById(vehicleId));
  return vehicleRecords(vehicleId).filter(r => {
    if (!hasReminder(r) || reminderStatus(r).active) return false;
    return (r.nextDate && r.nextDate >= todayISO()) || (num(r.nextOdo) != null && num(r.nextOdo) > odo);
  });
}
function getReminders(vehicleId) {
  const v = vehicleById(vehicleId);
  if (!v) return [];
  const odo = vehicleOdo(v);
  const out = [];
  for (const r of vehicleRecords(vehicleId)) {
    if (!reminderStatus(r).active) continue;
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
      <p>Track services, repairs, parts, trips and invoices for each vehicle you own.</p>
      <button class="btn inline" data-action="add-vehicle">${icon('plus')}Add Vehicle</button></div>`,
  };
}

function recordRow(r) {
  const nDocs = S.docs.filter(d => d.recordId === r.id).length;
  const sub = [fmtDate(r.date), num(r.odo) ? fmtDist(num(r.odo)) : '', r.workshop].filter(Boolean).map(esc).join(' · ');
  return `<button class="row tap has-icon" data-action="open-record" data-id="${r.id}">
    ${typeIcon(r.type)}
    <div class="row-main"><div class="row-title">${esc(recTitle(r))}</div><div class="row-sub">${sub}${nDocs ? ` · ${icon('clip')}${nDocs}` : ''}</div></div>
    ${num(r.cost) ? `<div class="row-value sm">${fmtMoneyShort(num(r.cost))}</div>` : ''}
    ${icon('chev', 'chev')}</button>`;
}

function tripRow(t) {
  const d = tripDist(t);
  const days = tripDays(t);
  const sub = [fmtDate(t.startDate), days > 1 ? `${days} days` : '', d != null ? fmtDist(d) : '', t.purpose].filter(Boolean).map(esc).join(' · ');
  return `<button class="row tap has-icon" data-action="open-trip" data-id="${t.id}">
    <div class="row-icon" style="background:${t.completed ? COLORS.blue : COLORS.green}">${icon('route')}</div>
    <div class="row-main"><div class="row-title">${esc(tripName(t))}${t.completed ? '' : ' <span class="live-tag">Live</span>'}</div><div class="row-sub">${sub}</div></div>
    <div class="row-value sm">${fmtMoneyShort(tripTotal(t))}</div>${icon('chev', 'chev')}</button>`;
}

function activeTripCard(t) {
  const chips = ['fuel', 'toll', 'food', 'drinks'].map(c => `<button class="chip" data-action="trip-exp" data-id="${t.id}" data-cat="${c}">${icon(EXP[c].icon)}${EXP[c].short}</button>`).join('');
  return `<div class="trip-card">
    <button class="tc-top" data-action="open-trip" data-id="${t.id}">
      <div style="min-width:0"><div class="tc-label"><span class="live-dot"></span>Trip in progress</div>
        <div class="tc-name">${esc(tripName(t))}</div>
        <div class="tc-sub">Started ${esc(fmtDate(t.startDate))}${num(t.odoStart) ? ` at ${fmtDist(num(t.odoStart))}` : ''}</div></div>
      <div class="tc-total">${fmtMoneyShort(tripTotal(t))}<span>${(t.expenses || []).length} expenses</span></div>
    </button>
    <div class="chips">${chips}<button class="chip" data-action="trip-exp" data-id="${t.id}" data-cat="other">${icon('plus')}More</button></div>
    <button class="btn" data-action="end-trip" data-id="${t.id}">${icon('flag')}End Trip</button>
  </div>`;
}

function viewGarage() {
  if (!S.vehicles.length) return noVehicles('Garage');
  const v = curVehicle();
  const recs = vehicleRecords(v.id);
  const { odo, date: odoDate } = vehicleOdoInfo(v);
  const period = S.settings.spendPeriod;
  const spend = sum(spendItems(v.id, period), i => i.amt);
  const lastSvc = recs.find(r => r.type === 'service');
  const reminders = getReminders(v.id);
  const accent = COLORS[v.accent] || COLORS.blue;
  const live = activeTrips(v.id);
  const cover = coverPhoto(v);
  const nPhotos = vehiclePhotos(v.id).length;

  const quick = [
    ['new-record', 'service', 'wrench', 'Service', COLORS.blue],
    ['new-record', 'repair', 'hammer', 'Repair', COLORS.orange],
    ['trip-quick', '', 'route', 'Trip', COLORS.green],
    ['scan', '', 'camera', 'Scan', COLORS.purple],
  ].map(([a, t, ic, l, c]) => `<button data-action="${a}" data-type="${t}"><span class="qi" style="background:${c}2b;color:${c}">${icon(ic)}</span>${l}</button>`).join('');

  const remHTML = reminders.length
    ? `<div class="group">${reminders.map(x => {
        const bits = [x.r.nextDate ? `Due ${fmtDate(x.r.nextDate)}` : '', num(x.r.nextOdo) != null ? `at ${fmtDist(num(x.r.nextOdo))}` : ''].filter(Boolean).join(' or ');
        return `<button class="row tap has-icon" data-action="reminder" data-id="${x.r.id}">${typeIcon(x.r.type)}
          <div class="row-main"><div class="row-title">${esc(recTitle(x.r))}</div><div class="row-sub">${esc(bits)}</div></div>${reminderBadge(x)}</button>`;
      }).join('')}</div>`
    : `<div class="empty sm">Nothing due. Add a “Next Due” date or ${esc(S.settings.unit)} to a record and it'll appear here.</div>`;
  const hidden = hiddenUpcoming(v.id);
  const hiddenHTML = hidden.length
    ? `<button class="hidden-link" data-action="hidden-reminders">${hidden.length} reminder${hidden.length === 1 ? '' : 's'} kept as history · see why ${icon('chev')}</button>` : '';

  const recentHTML = recs.length
    ? `<div class="group">${recs.slice(0, 5).map(r => recordRow(r)).join('')}</div>`
    : `<div class="empty sm">No records yet. Tap <b>+</b> to log your first service or repair.</div>`;

  return {
    title: 'Garage',
    action: addBtn(),
    body: `${vehicleSwitcher()}
    <div class="hero" style="--accent:${accent}">
      ${cover ? `<button class="hero-photo" data-action="photos" aria-label="Photos" style="background-image:url('${photoURL(cover)}')"><span class="photo-count">${icon('image')}${nPhotos}</span></button>` : ''}
      <div class="hero-top">
        <div style="min-width:0"><div class="hero-sub">${esc(vehicleSubtitle(v) || 'Vehicle')}</div><div class="hero-name">${esc(v.name)}</div></div>
        <div class="hero-badges">${v.reg ? `<div class="plate">${esc(v.reg.toUpperCase())}</div>` : ''}
        ${cover ? '' : `<button class="hero-cam" data-action="photos" aria-label="Add a photo">${icon('camera')}</button>`}</div>
      </div>
      <div class="odo">
        <div><div class="odo-label">Odometer</div><div class="odo-val">${fmtNum(odo)}<span>${esc(S.settings.unit)}</span></div>
        ${odoConflicts(odoReadings(v.id)).size ? `<button class="odo-warn" data-action="odo">⚠ Check readings</button>` : odoDate ? `<div class="odo-date">Reading from ${fmtDate(odoDate)}</div>` : ''}</div>
        <button class="pill-btn" data-action="odo">Update</button>
      </div>
      <div class="hero-stats">
        <button data-action="spending"><b>${fmtMoneyShort(spend)}</b><span>Spent ${esc(periodShort(period))} ${icon('down')}</span></button>
        <button data-action="tab" data-tab="history"><b>${recs.length}</b><span>Records</span></button>
        <div><b>${lastSvc ? esc(fmtDate(lastSvc.date)) : '—'}</b><span>Last service</span></div>
      </div>
    </div>
    ${live.map(activeTripCard).join('')}
    <div class="quick">${quick}</div>
    <div class="section-title">Upcoming ${reminders.length ? `<span class="count">${reminders.length}</span>` : ''}</div>${remHTML}${hiddenHTML}
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
  const total = sum(recs, r => num(r.cost));
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

function filteredTrips() {
  let trips = vehicleTrips(curVehicle().id);
  if (S.tripYear !== 'all') trips = trips.filter(t => (t.startDate || '').startsWith(S.tripYear));
  if (S.tripPurpose !== 'all') trips = trips.filter(t => t.purpose === S.tripPurpose);
  return trips;
}

function viewTrips() {
  if (!S.vehicles.length) return noVehicles('Trips');
  const v = curVehicle();
  const all = vehicleTrips(v.id);
  const live = all.filter(t => !t.completed);
  const years = [...new Set(all.map(t => (t.startDate || '').slice(0, 4)).filter(Boolean))].sort().reverse();
  if (S.tripYear !== 'all' && !years.includes(S.tripYear)) S.tripYear = 'all';
  const trips = filteredTrips();
  const done = trips.filter(t => t.completed);
  const km = sum(trips, tripDist);
  const spent = sum(trips, tripTotal);

  if (!all.length) {
    return {
      title: 'Trips', action: addBtn('new-trip'),
      body: `${vehicleSwitcher()}<div class="empty"><div class="e-icon">${icon('route')}</div><h3>No trips yet</h3>
        <p>Start a trip before you leave, then log fuel, tolls, food and drinks along the way. End it with your odometer reading to get distance and cost per ${esc(S.settings.unit)}.</p>
        <button class="btn inline" data-action="new-trip">${icon('plus')}Start a Trip</button></div>`,
    };
  }
  const groups = {};
  done.forEach(t => (groups[(t.startDate || '0000-00').slice(0, 7)] ||= []).push(t));
  return {
    title: 'Trips',
    action: addBtn('new-trip'),
    body: `${vehicleSwitcher()}
      ${live.map(activeTripCard).join('')}
      <div class="toolbar">
        ${pillSelect('trip-year', [['all', 'All Years'], ...years.map(y => [y, y])], S.tripYear)}
        ${pillSelect('trip-purpose', [['all', 'All Purposes'], ...PURPOSES.map(p => [p, p])], S.tripPurpose)}
      </div>
      <div class="stat-grid">
        <div><b>${trips.length}</b><span>Trips</span></div>
        <div><b>${fmtNum(km)}</b><span>${esc(S.settings.unit)} driven</span></div>
        <div><b>${fmtMoneyShort(spent)}</b><span>Spent</span></div>
      </div>
      ${done.length ? Object.entries(groups).map(([k, ts]) => `<div class="section-h" style="margin-top:18px">${esc(fmtMonth(k))}</div><div class="group">${ts.map(tripRow).join('')}</div>`).join('')
        : `<div class="empty sm" style="margin-top:16px">No completed trips${S.tripYear !== 'all' || S.tripPurpose !== 'all' ? ' match these filters' : ' yet'}.</div>`}
      <div class="group" style="margin-top:24px"><button class="row tap link" data-action="export-trips">${icon('export')}Export Trip Logbook (CSV)</button></div>
      <div class="section-f">Exports the trips shown above. Business trips can be used for a SARS travel logbook.</div>`,
  };
}

function viewDocs() {
  if (!S.vehicles.length) return noVehicles('Documents');
  const v = curVehicle();
  let docs = S.docs.filter(d => d.vehicleId === v.id && !isPhoto(d));
  if (S.docCat !== 'all') docs = docs.filter(d => d.category === S.docCat);
  const grid = docs.length
    ? `<div class="doc-grid">${docs.map(d => `<button class="doc-tile" data-action="open-doc" data-id="${d.id}">${thumbHTML(d)}<div class="doc-name">${esc(d.name)}</div><div class="doc-meta">${esc(d.category)} · ${esc(fmtDate(d.date))}</div></button>`).join('')}</div>`
    : `<div class="empty"><div class="e-icon">${icon('doc')}</div><h3>No documents</h3><p>Scan invoices, receipts, licence discs and insurance papers to keep them with your records and trips.</p>
       <button class="btn inline" data-action="scan">${icon('camera')}Scan Document</button></div>`;
  return {
    title: 'Documents',
    action: addBtn('scan'),
    body: `${vehicleSwitcher()}<div class="toolbar">${pillSelect('doc-cat', [['all', 'All Documents'], ...DOC_CATS.map(c => [c, c])], S.docCat)}</div>${grid}`,
  };
}

function viewSettings() {
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const vRows = S.vehicles.map(v => { const c = coverPhoto(v); return `<button class="row tap" data-action="edit-vehicle" data-id="${v.id}">
      ${c ? `<span class="v-avatar" style="background-image:url('${c.thumb || photoURL(c)}');border-color:${COLORS[v.accent] || COLORS.blue}"></span>` : `<span class="dot" style="background:${COLORS[v.accent] || COLORS.blue}"></span>`}
      <div class="row-main"><div class="row-title">${esc(v.name)}</div><div class="row-sub">${esc([vehicleSubtitle(v), v.reg?.toUpperCase()].filter(Boolean).join(' · ') || 'No details')}</div></div>
      ${icon('chev', 'chev')}</button>`; }).join('');
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
      ${selectField('Spent period', 'spendPeriod', Object.entries(PERIODS), S.settings.spendPeriod, 'data-setting="spendPeriod"')}
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

    <div class="section-h">App</div>
    <div class="group">
      <div class="row"><div class="row-main">Version</div><div class="row-value">${APP_VERSION}</div></div>
      <button class="row tap link" data-action="check-update">${icon('refresh')}Check for Updates</button>
      <button class="row tap link" data-action="whats-new">${icon('bell')}What's New</button>
    </div>

    ${standalone ? '' : `<div class="section-h">Install</div>
    <div class="group"><div class="row has-icon"><div class="row-icon" style="background:${COLORS.blue}">${icon('phone')}</div>
      <div class="row-main"><div class="row-title">Add to Home Screen</div><div class="row-sub" style="white-space:normal">In Safari tap Share ${icon('share')} then “Add to Home Screen”.</div></div></div></div>`}

    <div class="section-h">&nbsp;</div>
    <div class="group"><button class="row tap danger" data-action="erase">Erase All Data</button></div>
    <div class="footer-note">Garage Log · v${APP_VERSION}<br>${S.vehicles.length} vehicles · ${S.records.length} records · ${S.trips.length} trips · ${S.docs.filter(d => !isPhoto(d)).length} documents · ${S.docs.filter(isPhoto).length} photos</div>`,
  };
}

function render() {
  const view = { garage: viewGarage, history: viewHistory, trips: viewTrips, docs: viewDocs, settings: viewSettings }[S.tab]();
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
   Spending breakdown
   ========================================================= */
function openSpendingSheet() {
  const v = curVehicle();
  const sh = openSheet({ title: 'Spending', left: 'Done', dismissable: true });
  const paint = () => {
    const p = S.settings.spendPeriod;
    const items = spendItems(v.id, p);
    const total = sum(items, i => i.amt);
    const section = (group, title, meta) => {
      const m = {};
      items.filter(i => i.group === group).forEach(i => { m[i.key] = (m[i.key] || 0) + i.amt; });
      const rows = Object.entries(m).sort((a, b) => b[1] - a[1]);
      const gTotal = sum(rows, r => r[1]);
      if (!rows.length) return `<div class="section-h">${esc(title)}</div><div class="empty sm">Nothing in this period.</div>`;
      return `<div class="section-h">${esc(title)} · ${fmtMoneyShort(gTotal)}</div><div class="group">${rows.map(([k, amt]) => {
        const c = meta[k] || meta.other;
        return `<div class="row has-icon"><div class="row-icon" style="background:${COLORS[c.color]}">${icon(c.icon)}</div>
          <div class="row-main"><div class="row-title">${esc(c.label)}</div><div class="bar"><i style="width:${Math.max(2, amt / gTotal * 100).toFixed(1)}%;background:${COLORS[c.color]}"></i></div></div>
          <div class="row-value sm">${fmtMoneyShort(amt)}</div></div>`;
      }).join('')}</div>`;
    };
    sh.body.innerHTML = `<div class="toolbar" style="justify-content:center;margin-top:10px">${pillSelect('spend-period', Object.entries(PERIODS), p, true)}</div>
      <div class="big-total"><div>${fmtMoney(total)}</div><span>${esc(v.name)} · ${esc(PERIODS[p])}</span></div>
      ${section('maint', 'Maintenance & Repairs', TYPES)}
      ${section('trip', 'Trips', EXP)}
      <div class="section-f">Counted by the date of each record and trip expense.</div>`;
  };
  paint();
  sh.body.addEventListener('change', e => {
    if (e.target.dataset.change !== 'spend-period') return;
    e.stopPropagation();
    S.settings.spendPeriod = e.target.value; saveSettings(); paint(); render();
  });
}

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
    <div class="section-h">Photos</div>
    <div class="group"><div class="attach-grid"></div>
      <button type="button" class="row tap link" data-act="att-camera">${icon('camera')}Take Photo</button>
      <button type="button" class="row tap link" data-act="att-file">${icon('image')}Choose from Library</button></div>
    <div class="section-f">The first photo becomes the cover on the Garage card. To change it, tap the photo on the Garage card.</div>
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
    <div class="section-h">Current odometer</div>
    <div class="group">
      ${inputField('Odometer today', 'odo', isNew ? '' : (vehicleOdo(v) || ''), { mode: 'numeric', ph: 'Optional', unit: S.settings.unit })}
    </div>
    <div class="section-f">Today's reading only. Leave it empty to use your latest record or trip. An old reading, like the one from when you bought the car, goes under Purchase below.</div>
    <div class="section-h">Purchase</div>
    <div class="group">
      ${inputField('Purchased', 'purchaseDate', d.purchaseDate, { type: 'date' })}
      ${inputField('Odometer at purchase', 'purchaseOdo', d.purchaseOdo, { mode: 'numeric', ph: 'Optional', unit: S.settings.unit })}
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
      const newOdo = num(f.odo);
      const rec = { ...(v || { id: uid(), created: Date.now() }), ...f, name: f.name.trim(), purchaseOdo: num(f.purchaseOdo) ?? '' };
      // Only a changed "Odometer today" becomes a new reading dated today.
      if (newOdo == null) { rec.odo = ''; rec.odoDate = ''; } // cleared: drop the manual reading, records/trips decide
      else if (isNew || newOdo !== vehicleOdo(v)) { rec.odo = newOdo; rec.odoDate = todayISO(); }
      else { rec.odo = v.odo; rec.odoDate = v.odoDate; }
      await att.commit({ vehicleId: rec.id, baseName: `${rec.name} photo`, category: 'Photo', date: todayISO(), extra: { kind: 'photo' } });
      rec.coverId = coverPhoto(rec)?.id || '';
      await DB.put('vehicles', rec);
      if (isNew) { S.vehicles.push(rec); S.settings.vehicleId = rec.id; saveSettings(); }
      else Object.assign(v, rec);
      close(); render(); toast(isNew ? 'Vehicle added' : 'Saved');
    },
  });
  const att = attachments(sh.body, isNew ? [] : vehiclePhotos(v.id), { imagesOnly: true });
  sh.body.addEventListener('click', async e => {
    if (!e.target.closest('[data-act="delete"]')) return;
    const n = vehicleRecords(v.id).length, nt = vehicleTrips(v.id).length;
    if (!await confirmDestructive(`Delete ${v.name}?`, `This permanently removes the vehicle, its ${n} record${n === 1 ? '' : 's'}, ${nt} trip${nt === 1 ? '' : 's'} and all its documents.`, 'Delete Vehicle')) return;
    for (const r of vehicleRecords(v.id)) await DB.del('records', r.id);
    for (const t of vehicleTrips(v.id)) await DB.del('trips', t.id);
    for (const d of S.docs.filter(d => d.vehicleId === v.id)) await DB.del('docs', d.id);
    await DB.del('vehicles', v.id);
    S.records = S.records.filter(r => r.vehicleId !== v.id);
    S.trips = S.trips.filter(t => t.vehicleId !== v.id);
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
  const cur = vehicleOdoInfo(v);
  const readings = odoReadings(v.id);
  const bad = odoConflicts(readings);
  const shown = readings.slice(0, 60);
  const sh = openSheet({
    title: 'Odometer', dismissable: true, right: 'Save',
    body: `<div class="big-total"><div>${fmtDist(cur.odo)}</div><span>${cur.date ? `Latest reading · ${esc(fmtDate(cur.date))} · ${esc(cur.label)}` : 'No readings yet'}</span></div>
      <div class="section-h">Today's reading</div>
      <div class="group">${inputField('Odometer now', 'odo', '', { mode: 'numeric', ph: fmtNum(cur.odo), unit: S.settings.unit })}</div>
      <div class="section-f" id="odo-now-hint">The reading with the latest date is always the current odometer, so back-filling old records never changes it.</div>
      ${bad.size ? `<div class="notice">${icon('gauge')}<div><b>${bad.size} reading${bad.size === 1 ? '' : 's'} out of order</b>An earlier date has a higher reading than a later date. Tap a reading marked ⚠ to fix its date or odometer.</div></div>` : ''}
      ${readings.length ? `<div class="section-h">All readings · newest first</div>
      <div class="group">${shown.map((r, i) => `<button class="row tap" data-act="reading" data-src="${r.src}" data-id="${esc(r.id)}">
          <div class="row-main"><div class="row-title">${bad.has(i) ? '<span class="warn">⚠ </span>' : ''}${esc(r.label)}</div><div class="row-sub">${esc(fmtDate(r.date) || 'No date')}</div></div>
          <div class="row-value sm ${bad.has(i) ? 'warn' : ''}">${fmtDist(r.odo)}</div>${icon('chev', 'chev')}</button>`).join('')}</div>
      ${readings.length > shown.length ? `<div class="section-f">Showing the newest ${shown.length} of ${readings.length} readings.</div>` : ''}` : ''}`,
    onRight: async close => {
      const n = num($('[name=odo]', sh.body).value);
      if (n == null) { close(); return; }
      v.odo = n; v.odoDate = todayISO();
      await DB.put('vehicles', v);
      close(); render(); toast('Odometer updated');
    },
  });
  $('[name=odo]', sh.body).addEventListener('input', e => {
    const w = checkReading(v.id, todayISO(), num(e.target.value), null);
    $('#odo-now-hint', sh.body).innerHTML = w ? `<span class="warn">${esc(w)}</span>` : 'The reading with the latest date is always the current odometer, so back-filling old records never changes it.';
  });
  sh.body.addEventListener('click', e => {
    const el = e.target.closest('[data-act="reading"]');
    if (!el) return;
    const { src, id } = el.dataset;
    sh.close();
    setTimeout(() => src === 'record' ? openRecordDetail(id) : src === 'trip' ? openTripDetail(id) : openVehicleForm(vehicleById(id)), 250);
  });
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
    date: preset.date || todayISO(), odo: '', cost: '', workshop: preset.workshop || '', parts: [], notes: '', nextDate: '', nextOdo: '',
  };
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
      ${inputField('Odometer', 'odo', r.odo, { mode: 'numeric', ph: 'Reading on this date', unit: S.settings.unit })}
      ${inputField('Total cost', 'cost', r.cost, { mode: 'decimal', ph: '0.00', unit: S.settings.currency })}
      ${inputField('Workshop', 'workshop', r.workshop, { ph: 'Dealer, mechanic or shop', attrs: 'list="dl-ws"' })}
    </div>
    <div class="section-f" id="odo-hint"></div>
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
      <div class="field" id="pin-field" hidden><label>Show in Upcoming anyway</label><input type="checkbox" class="switch" name="reminderPinned" ${r.reminderPinned ? 'checked' : ''}></div>
    </div>
    <div class="section-f" id="due-hint"></div>

    <div class="section-h">Notes</div>
    <div class="group"><div class="field"><textarea name="notes" placeholder="What was done, warranty info, advice from the mechanic…">${esc(r.notes || '')}</textarea></div></div>

    <div class="section-h">Invoices &amp; Documents</div>
    <div class="group"><div class="attach-grid"></div>${attachRows}</div>
    ${isNew ? `<button type="button" class="btn tinted" data-act="save-another">${icon('plus')}Save &amp; Add Another</button>
      <div class="section-f" style="text-align:center">Handy for back-filling: the next record keeps this vehicle, type, workshop and date.</div>`
      : '<button type="button" class="btn danger" data-act="delete">Delete Record</button>'}
  </form>`;

  const sh = openSheet({ title: isNew ? 'New Record' : 'Edit Record', body, right: isNew ? 'Add' : 'Save', onRight: close => save(close, false) });
  const form = $('form', sh.body);
  const F = name => form.elements[name];
  const att = attachments(sh.body, S.docs.filter(d => d.recordId === r.id));

  const readParts = () => $$('.part-row', form).map(row => ({
    name: $('.p-name', row).value.trim(), partNo: $('.p-no', row).value.trim(),
    qty: num($('.p-qty', row).value), cost: num($('.p-cost', row).value),
  })).filter(p => p.name || p.partNo || p.cost);
  const partsTotal = () => sum(readParts(), p => p.cost);
  const updateSum = () => {
    const t = partsTotal();
    $('#parts-sum', sh.body).textContent = t ? `Parts total ${fmtMoney(t)}${F('cost').value ? '' : ' — used as total cost if left blank.'}` : '';
    F('cost').placeholder = t ? t.toFixed(2) : '0.00';
  };
  const draft = () => ({
    ...r, vehicleId: F('vehicleId')?.value || r.vehicleId, type: F('type').value, title: F('title').value.trim(), date: F('date').value,
    odo: num(F('odo').value) ?? '', nextDate: F('nextDate').value, nextOdo: num(F('nextOdo').value) ?? '', reminderPinned: false,
  });
  const updateHint = () => {
    const d = draft();
    const hint = $('#due-hint', sh.body);
    if (!hasReminder(d)) { hint.textContent = 'Set a next date or odometer and it shows in Upcoming on the Garage screen.'; $('#pin-field', sh.body).hidden = !F('reminderPinned').checked; return; }
    const st = reminderStatus(d);
    $('#pin-field', sh.body).hidden = st.active && !F('reminderPinned').checked;
    hint.innerHTML = st.active
      ? '<span style="color:var(--green)">✓ This will show in Upcoming.</span>'
      : F('reminderPinned').checked ? '<span style="color:var(--green)">✓ Pinned: this will show in Upcoming.</span>'
      : `Kept as history, not shown in Upcoming. ${esc(reminderStatusText(st))} Switch on “Show in Upcoming anyway” if that's not right.`;
  };
  const updateOdoHint = () => {
    const w = checkReading(draft().vehicleId, F('date').value, num(F('odo').value), r.id);
    $('#odo-hint', sh.body).innerHTML = w ? `<span class="warn">${esc(w)}</span>` : '';
  };
  updateSum(); updateHint(); updateOdoHint();

  form.addEventListener('input', e => {
    if (e.target.closest('.part-row') || e.target.name === 'cost') updateSum();
    if (['title', 'odo', 'nextDate', 'nextOdo'].includes(e.target.name)) updateHint();
    if (e.target.name === 'odo') updateOdoHint();
  });
  form.addEventListener('change', e => {
    const n = e.target.name;
    if (n === 'type') F('title').placeholder = TYPES[e.target.value].ph;
    if (n === 'repeatTime' && e.target.value) F('nextDate').value = addMonths(F('date').value || todayISO(), +e.target.value);
    if (n === 'repeatDist' && e.target.value) {
      // Count from this record's own reading; only fall back to the current odometer for a record dated today.
      let base = num(F('odo').value);
      if (base == null && F('date').value === todayISO()) base = vehicleOdo(vehicleById(F('vehicleId')?.value || r.vehicleId));
      if (base == null) { toast('Enter the odometer for this record first', false); e.target.value = ''; F('odo').focus(); return; }
      F('nextOdo').value = base + +e.target.value;
    }
    if (['type', 'vehicleId', 'date', 'title', 'nextDate', 'nextOdo', 'repeatTime', 'repeatDist', 'reminderPinned'].includes(n)) updateHint();
    if (['vehicleId', 'date'].includes(n)) updateOdoHint();
  });
  sh.body.addEventListener('click', async e => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    if (act === 'add-part') { el.insertAdjacentHTML('beforebegin', partRowHTML()); el.previousElementSibling.querySelector('.p-name').focus(); }
    if (act === 'rm-part') { el.closest('.part-row').remove(); updateSum(); }
    if (act === 'save-another') save(sh.close, true);
    if (act === 'delete') {
      const n = S.docs.filter(d => d.recordId === r.id).length;
      if (!await confirmDestructive('Delete this record?', n ? `Its ${n} attached document${n === 1 ? '' : 's'} will also be deleted.` : 'This cannot be undone.', 'Delete Record')) return;
      await deleteRecord(r.id);
      sh.close(); render(); toast('Record deleted');
    }
  });

  async function save(close, another) {
    const f = Object.fromEntries(new FormData(form));
    if (!f.date) { toast('Please choose a date', false); return; }
    const parts = readParts();
    const cost = num(f.cost) ?? (parts.length ? partsTotal() || '' : '');
    const out = {
      ...r, vehicleId: f.vehicleId || r.vehicleId, type: f.type, title: f.title.trim(), date: f.date,
      odo: num(f.odo) ?? '', cost, workshop: f.workshop.trim(), parts, notes: f.notes.trim(),
      nextDate: f.nextDate || '', nextOdo: num(f.nextOdo) ?? '', updated: Date.now(),
    };
    out.reminderPinned = !!f.reminderPinned && hasReminder(out);
    await DB.put('records', out);
    const i = S.records.findIndex(x => x.id === out.id);
    if (i >= 0) S.records[i] = out; else S.records.push(out);
    await att.commit({ vehicleId: out.vehicleId, recordId: out.id, baseName: `${recTitle(out)} – Invoice`, category: 'Invoice', date: out.date });
    sortRecords();
    close(); render();
    const shows = hasReminder(out) && reminderStatus(out).active;
    toast(`${isNew ? `Added · ${fmtDate(out.date)}` : 'Saved'}${shows ? ' · in Upcoming' : ''}`);
    if (another) setTimeout(() => openRecordForm(null, { vehicleId: out.vehicleId, type: out.type, workshop: out.workshop, date: out.date }), 420);
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
  const st = reminderStatus(r);
  const info = [
    ['Vehicle', v?.name], ['Date', fmtDate(r.date)], ['Odometer', num(r.odo) ? fmtDist(num(r.odo)) : ''],
    ['Workshop', r.workshop], ['Total cost', num(r.cost) ? fmtMoney(num(r.cost)) : ''],
  ].filter(([, val]) => val);
  const parts = r.parts || [];
  const body = `
    <div class="detail-head">${typeIcon(r.type, 'big-icon')}<h2>${esc(recTitle(r))}</h2><p>${esc(t.label)}</p></div>
    <div class="group" style="margin-top:18px">${info.map(([k, val]) => `<div class="row"><div class="row-main">${esc(k)}</div><div class="row-value">${esc(val)}</div></div>`).join('')}</div>
    ${parts.length ? `<div class="section-h">Parts &amp; Labour</div><div class="group">${parts.map(p => `<div class="row"><div class="row-main"><div class="row-title">${esc(p.name || p.partNo)}</div>${(p.partNo && p.name) || p.qty ? `<div class="row-sub">${esc([p.name && p.partNo ? `#${p.partNo}` : '', p.qty ? `Qty ${p.qty}` : ''].filter(Boolean).join(' · '))}</div>` : ''}</div>${p.cost ? `<div class="row-value sm">${fmtMoney(p.cost)}</div>` : ''}</div>`).join('')}</div>` : ''}
    ${hasReminder(r) ? `<div class="section-h">Next Due</div><div class="group">
        ${r.nextDate ? `<div class="row"><div class="row-main">Date</div><div class="row-value">${esc(fmtDate(r.nextDate))}</div></div>` : ''}
        ${num(r.nextOdo) != null ? `<div class="row"><div class="row-main">Odometer</div><div class="row-value">${esc(fmtDist(num(r.nextOdo)))}</div></div>` : ''}
        <div class="row"><div class="row-main">In Upcoming</div><div class="row-value">${st.active ? `<span style="color:var(--green)">${st.pinned ? 'Yes · pinned' : 'Yes'}</span>` : 'No · history'}</div></div></div>
        ${st.active ? '' : `<div class="section-f">${esc(reminderStatusText(st))}</div>`}
        ${st.pinned ? `<button class="btn tinted" style="margin-top:12px" data-act="unpin">Stop Pinning (back to automatic)</button>`
          : !st.active ? `<button class="btn tinted" style="margin-top:12px" data-act="pin">${icon('bell')}Show in Upcoming Anyway</button>` : ''}` : ''}
    ${r.notes ? `<div class="section-h">Notes</div><div class="group"><div class="notes">${esc(r.notes)}</div></div>` : ''}
    ${docs.length ? `<div class="section-h">Documents</div><div class="group"><div class="attach-grid">${docs.map(d => `<button class="doc-tile" data-action="open-doc" data-id="${d.id}">${thumbHTML(d)}</button>`).join('')}</div></div>` : ''}
    <button class="btn tinted" data-act="again">${icon('plus')}Log Again</button>`;
  const sh = openSheet({ title: '', body, left: 'Close', right: 'Edit', dismissable: true, onRight: close => { close(); setTimeout(() => openRecordForm(r), 200); } });
  sh.body.addEventListener('click', async e => {
    if (e.target.closest('[data-act="again"]')) {
      sh.close();
      setTimeout(() => openRecordForm(null, { vehicleId: r.vehicleId, type: r.type, title: r.title, workshop: r.workshop }), 200);
    }
    const pin = e.target.closest('[data-act="pin"],[data-act="unpin"]');
    if (pin) {
      r.reminderPinned = pin.dataset.act === 'pin';
      await DB.put('records', r);
      sh.close(); render(); toast(r.reminderPinned ? 'Now showing in Upcoming' : 'Back to automatic');
    }
  });
}

/* =========================================================
   Trips
   ========================================================= */
function expenseRowHTML(e = {}) {
  const cat = e.cat || 'fuel';
  return `<div class="part-row exp-row" data-id="${esc(e.id || uid())}" data-date="${esc(e.date || '')}"><button type="button" class="minus" data-act="rm-exp" aria-label="Remove">−</button>
    <div class="part-fields">
      <div class="exp-line"><select class="e-cat">${optionsHTML(expOptions(), cat)}</select><input class="e-amt" inputmode="decimal" placeholder="Amount" value="${esc(e.amount ?? '')}"></div>
      <div class="exp-line"><input class="e-desc" placeholder="Where / what" value="${esc(e.desc || '')}"><input class="e-l" inputmode="decimal" placeholder="Litres" value="${esc(e.litres ?? '')}" ${cat === 'fuel' ? '' : 'hidden'}></div>
    </div></div>`;
}

function newTrip(preset = {}) {
  const v = curVehicle();
  return {
    id: uid(), created: Date.now(), vehicleId: v.id, name: '', purpose: 'Leisure', from: '', to: '',
    startDate: todayISO(), endDate: '', odoStart: vehicleOdo(v) || '', odoEnd: '', completed: false, expenses: [], notes: '', ...preset,
  };
}

function openTripForm(existing = null) {
  const isNew = !existing;
  const t = existing ? JSON.parse(JSON.stringify(existing)) : newTrip();
  const places = [...new Set(S.trips.flatMap(x => [x.from, x.to]).filter(Boolean))];
  const body = `<form autocomplete="off">
    <div class="group">
      ${S.vehicles.length > 1 ? selectField('Vehicle', 'vehicleId', vehicleOptions(), t.vehicleId) : ''}
      ${inputField('Trip name', 'name', t.name, { ph: 'e.g. Joburg to Durban' })}
      ${selectField('Purpose', 'purpose', PURPOSES.map(p => [p, p]), t.purpose)}
    </div>
    <div class="section-h">Route</div>
    <div class="group">
      ${inputField('From', 'from', t.from, { ph: 'e.g. Johannesburg', attrs: 'list="dl-places"' })}
      ${inputField('To', 'to', t.to, { ph: 'e.g. Durban', attrs: 'list="dl-places"' })}
    </div>
    <datalist id="dl-places">${places.map(p => `<option value="${esc(p)}">`).join('')}</datalist>
    <div class="section-h">Dates &amp; Odometer</div>
    <div class="group">
      ${inputField('Start date', 'startDate', t.startDate, { type: 'date' })}
      ${inputField('End date', 'endDate', t.endDate, { type: 'date' })}
      ${inputField('Odometer start', 'odoStart', t.odoStart, { mode: 'numeric', ph: '0', unit: S.settings.unit })}
      ${inputField('Odometer end', 'odoEnd', t.odoEnd, { mode: 'numeric', ph: 'When you get back', unit: S.settings.unit })}
      <div class="field"><label>Trip completed</label><input type="checkbox" class="switch" name="completed" ${t.completed ? 'checked' : ''}></div>
    </div>
    <div class="section-f" id="trip-dist"></div>

    <div class="section-h">Expenses</div>
    <div class="group" id="exps">${(t.expenses || []).map(expenseRowHTML).join('')}<button type="button" class="row tap link" data-act="add-exp">${icon('plus')}Add Expense</button></div>
    <div class="section-f" id="exp-sum"></div>

    <div class="section-h">Notes</div>
    <div class="group"><div class="field"><textarea name="notes" placeholder="Passengers, route, stops, road conditions…">${esc(t.notes || '')}</textarea></div></div>

    <div class="section-h">Receipts</div>
    <div class="group"><div class="attach-grid"></div>${attachRows}</div>
    ${isNew ? '' : '<button type="button" class="btn danger" data-act="delete">Delete Trip</button>'}
  </form>`;

  const sh = openSheet({ title: isNew ? 'New Trip' : 'Edit Trip', body, right: isNew ? 'Start' : 'Save', onRight: save });
  const form = $('form', sh.body);
  const F = n => form.elements[n];
  const att = attachments(sh.body, S.docs.filter(d => d.tripId === t.id));

  const readExpenses = () => $$('.exp-row', form).map(row => ({
    id: row.dataset.id, date: row.dataset.date || '',
    cat: $('.e-cat', row).value, amount: num($('.e-amt', row).value), desc: $('.e-desc', row).value.trim(),
    litres: $('.e-cat', row).value === 'fuel' ? num($('.e-l', row).value) : null,
  })).filter(e => e.amount != null || e.desc);
  let prefill = isNew ? String(t.odoStart) : null;
  const refresh = () => {
    const a = num(F('odoStart').value), b = num(F('odoEnd').value);
    const vid = F('vehicleId')?.value || t.vehicleId;
    const warn = checkReading(vid, F('startDate').value, a, t.id) || checkReading(vid, F('endDate').value || F('startDate').value, b, t.id);
    $('#trip-dist', sh.body).innerHTML = [
      a != null && b != null ? (b >= a ? `Distance ${fmtDist(b - a)}` : '<span class="warn">End odometer is lower than start.</span>') : '',
      warn ? `<span class="warn">${esc(warn)}</span>` : '',
    ].filter(Boolean).join('<br>');
    const ex = readExpenses();
    $('#exp-sum', sh.body).textContent = ex.length ? `${ex.length} expense${ex.length === 1 ? '' : 's'} · Total ${fmtMoney(sum(ex, e => e.amount))}` : '';
    sh.el.querySelector('.sh-right').textContent = isNew ? (F('completed').checked ? 'Add' : 'Start') : 'Save';
  };
  refresh();

  form.addEventListener('input', e => {
    if (e.target.name === 'odoEnd' && num(e.target.value) != null) F('completed').checked = true;
    refresh();
  });
  form.addEventListener('change', e => {
    if (e.target.classList.contains('e-cat')) $('.e-l', e.target.closest('.exp-row')).hidden = e.target.value !== 'fuel';
    const past = F('startDate').value && F('startDate').value < todayISO();
    if (e.target.name === 'vehicleId' && isNew) {
      const was = F('odoStart').value === prefill;
      prefill = String(vehicleOdo(vehicleById(e.target.value)) || '');
      if (was && !past) F('odoStart').value = prefill;
    }
    if (e.target.name === 'startDate' && isNew) {
      // A past trip: it's already finished, and today's odometer doesn't apply to it.
      if (past) {
        F('completed').checked = true;
        if (F('odoStart').value === prefill) F('odoStart').value = '';
        F('odoStart').placeholder = 'Reading at start';
        $$('.exp-row', form).forEach(row => { row.dataset.date = F('startDate').value; });
      } else if (!F('odoStart').value) F('odoStart').value = prefill;
    }
    refresh();
  });
  sh.body.addEventListener('click', async e => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    if (el.dataset.act === 'add-exp') { el.insertAdjacentHTML('beforebegin', expenseRowHTML({ date: F('completed').checked ? F('startDate').value : todayISO() })); el.previousElementSibling.querySelector('.e-amt').focus(); }
    if (el.dataset.act === 'rm-exp') { el.closest('.exp-row').remove(); refresh(); }
    if (el.dataset.act === 'delete') {
      const n = S.docs.filter(d => d.tripId === t.id).length;
      if (!await confirmDestructive('Delete this trip?', `All its expenses${n ? ` and ${n} receipt${n === 1 ? '' : 's'}` : ''} will be deleted.`, 'Delete Trip')) return;
      await deleteTrip(t.id);
      sh.close(); $$('.sheet-wrap').forEach(s => s.remove()); lockScroll(); render(); toast('Trip deleted');
    }
  });

  async function save(close) {
    const f = Object.fromEntries(new FormData(form));
    if (!f.startDate) { toast('Please choose a start date', false); return; }
    const odoStart = num(f.odoStart), odoEnd = num(f.odoEnd);
    if (odoStart != null && odoEnd != null && odoEnd < odoStart) { toast('End odometer is lower than start', false); return; }
    if (f.endDate && f.endDate < f.startDate) { toast('End date is before start date', false); return; }
    const completed = !!f.completed;
    const endDate = f.endDate || (completed ? f.startDate : '');
    // Keep every expense inside the trip's dates (so spending periods count it in the right year).
    const fitDate = d => (!d || d < f.startDate || (endDate && d > endDate)) ? f.startDate : d;
    const out = {
      ...t, vehicleId: f.vehicleId || t.vehicleId, name: f.name.trim(), purpose: f.purpose, from: f.from.trim(), to: f.to.trim(),
      startDate: f.startDate, endDate, odoStart: odoStart ?? '', odoEnd: odoEnd ?? '',
      completed, expenses: readExpenses().map(e => ({ ...e, date: fitDate(e.date) })), notes: f.notes.trim(), updated: Date.now(),
    };
    await saveTrip(out);
    await att.commit({ vehicleId: out.vehicleId, tripId: out.id, baseName: `${tripName(out)} – Receipt`, category: 'Receipt', date: out.startDate });
    close(); render(); toast(isNew ? (completed ? 'Trip added' : 'Trip started — drive safe') : 'Saved');
  }
}

async function saveTrip(t) {
  await DB.put('trips', t);
  const i = S.trips.findIndex(x => x.id === t.id);
  if (i >= 0) S.trips[i] = t; else S.trips.push(t);
  sortTrips();
}
async function deleteTrip(id) {
  for (const d of S.docs.filter(d => d.tripId === id)) await DB.del('docs', d.id);
  await DB.del('trips', id);
  S.docs = S.docs.filter(d => d.tripId !== id);
  S.trips = S.trips.filter(t => t.id !== id);
}

function openExpenseSheet(tripId, expId = null, cat = 'fuel', onSaved) {
  const trip = S.trips.find(x => x.id === tripId);
  const exp = expId ? trip.expenses.find(e => e.id === expId) : null;
  const isNew = !exp;
  const e = exp ? { ...exp } : { id: uid(), cat, amount: '', desc: '', litres: '', date: trip.completed ? trip.startDate : todayISO() };
  const descsFor = c => [...new Set(S.trips.flatMap(x => x.expenses || []).filter(x => x.cat === c && x.desc).map(x => x.desc))];
  const body = `<form autocomplete="off">
    <div class="group">
      ${selectField('Category', 'cat', expOptions(), e.cat)}
      ${inputField('Amount', 'amount', e.amount, { mode: 'decimal', ph: '0.00', unit: S.settings.currency })}
      ${inputField('Where / what', 'desc', e.desc, { ph: EXP[e.cat].ph, attrs: 'list="dl-desc"' })}
      <div class="field" id="litres-field" ${e.cat === 'fuel' ? '' : 'hidden'}><label>Litres</label><input name="litres" inputmode="decimal" placeholder="Optional" value="${esc(e.litres ?? '')}"><span class="unit">L</span></div>
      ${inputField('Date', 'date', e.date, { type: 'date' })}
    </div>
    <datalist id="dl-desc">${descsFor(e.cat).map(d => `<option value="${esc(d)}">`).join('')}</datalist>
    <div class="section-f" id="ppl"></div>
    <div class="section-h">Receipt</div>
    <div class="group"><div class="attach-grid"></div>${attachRows}</div>
    ${isNew ? '' : '<button type="button" class="btn danger" data-act="del-exp">Delete Expense</button>'}
  </form>`;
  const sh = openSheet({ title: isNew ? 'Add Expense' : 'Edit Expense', body, right: isNew ? 'Add' : 'Save', onRight: save });
  const form = $('form', sh.body);
  const F = n => form.elements[n];
  const att = attachments(sh.body, S.docs.filter(d => d.tripId === trip.id && d.expenseId === e.id));
  const ppl = () => {
    const a = num(F('amount').value), l = num(F('litres').value);
    $('#ppl', sh.body).textContent = F('cat').value === 'fuel' && a && l ? `${fmtMoney(a / l)} per litre` : '';
  };
  form.addEventListener('input', ppl);
  form.addEventListener('change', ev => {
    if (ev.target.name !== 'cat') return;
    const c = ev.target.value;
    $('#litres-field', sh.body).hidden = c !== 'fuel';
    F('desc').placeholder = EXP[c].ph;
    $('#dl-desc', sh.body).innerHTML = descsFor(c).map(d => `<option value="${esc(d)}">`).join('');
    ppl();
  });
  sh.body.addEventListener('click', async ev => {
    if (!ev.target.closest('[data-act="del-exp"]')) return;
    if (!await confirmDestructive('Delete this expense?', '', 'Delete Expense')) return;
    trip.expenses = trip.expenses.filter(x => x.id !== e.id);
    for (const d of S.docs.filter(d => d.expenseId === e.id)) { await DB.del('docs', d.id); }
    S.docs = S.docs.filter(d => d.expenseId !== e.id);
    await saveTrip(trip);
    sh.close(); render(); onSaved?.(); toast('Expense deleted');
  });
  setTimeout(() => { if (isNew) F('amount').focus(); }, 450);

  async function save(close) {
    const f = Object.fromEntries(new FormData(form));
    const amount = num(f.amount);
    if (amount == null) { toast('Enter an amount', false); F('amount').focus(); return; }
    const out = { ...e, cat: f.cat, amount, desc: f.desc.trim(), litres: f.cat === 'fuel' ? num(f.litres) : null, date: f.date || todayISO() };
    trip.expenses = trip.expenses || [];
    const i = trip.expenses.findIndex(x => x.id === out.id);
    if (i >= 0) trip.expenses[i] = out; else trip.expenses.push(out);
    trip.updated = Date.now();
    await saveTrip(trip);
    await att.commit({ vehicleId: trip.vehicleId, tripId: trip.id, baseName: `${EXP[out.cat].label}${out.desc ? ` – ${out.desc}` : ''}`, category: 'Receipt', date: out.date, extra: { expenseId: out.id } });
    close(); render(); onSaved?.(); toast(`${EXP[out.cat].short} ${fmtMoneyShort(amount)} added`);
  }
}

function openEndTripSheet(tripId, onSaved) {
  const t = S.trips.find(x => x.id === tripId);
  const sh = openSheet({
    title: 'End Trip', small: true, dismissable: true, right: 'Done',
    body: `<div class="group" style="margin-top:8px">
        ${inputField('End date', 'endDate', todayISO(), { type: 'date' })}
        ${inputField('Odometer', 'odoEnd', '', { mode: 'numeric', ph: num(t.odoStart) ? `Started at ${fmtNum(num(t.odoStart))}` : 'Reading now', unit: S.settings.unit })}
      </div><div class="section-f" id="end-dist">Enter the odometer reading to work out the distance.</div>`,
    onRight: async close => {
      const odoEnd = num($('[name=odoEnd]', sh.body).value);
      const endDate = $('[name=endDate]', sh.body).value || todayISO();
      if (odoEnd != null && num(t.odoStart) != null && odoEnd < num(t.odoStart)) { toast('Lower than the start reading', false); return; }
      Object.assign(t, { endDate, odoEnd: odoEnd ?? '', completed: true, updated: Date.now() });
      await saveTrip(t);
      close(); render(); onSaved?.();
      const d = tripDist(t);
      toast(d != null ? `Trip done · ${fmtDist(d)} · ${fmtMoneyShort(tripTotal(t))}` : 'Trip completed');
    },
  });
  $('[name=odoEnd]', sh.body).addEventListener('input', ev => {
    const n = num(ev.target.value), s = num(t.odoStart);
    const w = checkReading(t.vehicleId, $('[name=endDate]', sh.body).value, n, t.id);
    $('#end-dist', sh.body).innerHTML = (n != null && s != null ? (n >= s ? `Distance ${fmtDist(n - s)}` : '<span class="warn">Lower than the start reading</span>') : 'Enter the odometer reading to work out the distance.')
      + (w ? `<br><span class="warn">${esc(w)}</span>` : '');
  });
  setTimeout(() => $('[name=odoEnd]', sh.body)?.focus(), 450);
}

function openTripDetail(id) {
  const sh = openSheet({
    title: '', left: 'Close', right: 'Edit', dismissable: true,
    onRight: close => { const t = S.trips.find(x => x.id === id); close(); setTimeout(() => openTripForm(t), 200); },
  });
  const paint = () => {
    const t = S.trips.find(x => x.id === id);
    if (!t) { sh.close(); return; }
    const dist = tripDist(t);
    const total = tripTotal(t);
    const litres = tripLitres(t);
    const fuelCost = sum((t.expenses || []).filter(e => e.cat === 'fuel' && num(e.litres)), e => num(e.amount));
    const v = vehicleById(t.vehicleId);
    const docs = S.docs.filter(d => d.tripId === t.id);
    const exps = [...(t.expenses || [])].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const cats = {};
    exps.forEach(e => { cats[e.cat] = (cats[e.cat] || 0) + (num(e.amount) || 0); });
    const catRows = Object.entries(cats).sort((a, b) => b[1] - a[1]);
    const unit = S.settings.unit;
    const consumption = litres && dist ? (unit === 'km' ? `${(litres / dist * 100).toFixed(1)} L/100km` : `${(dist / litres).toFixed(1)} mi/L`) : '—';
    const days = tripDays(t);

    sh.body.innerHTML = `
      <div class="detail-head"><div class="big-icon" style="background:${t.completed ? COLORS.blue : COLORS.green}">${icon('route')}</div>
        <h2>${esc(tripName(t))}</h2>
        <p>${esc([t.from && t.to && t.name ? `${t.from} → ${t.to}` : '', fmtDate(t.startDate) + (t.endDate && t.endDate !== t.startDate ? ` – ${fmtDate(t.endDate)}` : ''), days > 1 ? `${days} days` : ''].filter(Boolean).join(' · '))}</p>
        <p>${esc([v?.name, t.purpose].filter(Boolean).join(' · '))}${t.completed ? '' : ' · <span class="live-tag">In progress</span>'}</p></div>
      <div class="stat-grid" style="margin-top:16px">
        <div><b>${dist != null ? fmtNum(dist) : '—'}</b><span>${esc(unit)}</span></div>
        <div><b>${fmtMoneyShort(total)}</b><span>Total spent</span></div>
        <div><b>${dist && total ? `${esc(S.settings.currency)} ${(total / dist).toFixed(2)}` : '—'}</b><span>Per ${esc(unit)}</span></div>
      </div>
      ${litres ? `<div class="stat-grid" style="margin-top:8px">
        <div><b>${litres.toFixed(1)} L</b><span>Fuel</span></div>
        <div><b>${consumption}</b><span>Consumption ≈</span></div>
        <div><b>${fuelCost ? `${esc(S.settings.currency)} ${(fuelCost / litres).toFixed(2)}` : '—'}</b><span>Avg per litre</span></div>
      </div>` : ''}
      ${t.completed ? '' : `<div class="chips" style="margin-top:16px">${['fuel', 'toll', 'food', 'drinks', 'accom', 'other'].map(c => `<button class="chip" data-act="exp-add" data-cat="${c}">${icon(EXP[c].icon)}${EXP[c].short}</button>`).join('')}</div>
        <button class="btn" style="margin-top:12px" data-act="end">${icon('flag')}End Trip</button>`}
      ${catRows.length ? `<div class="section-h">Breakdown</div><div class="group">${catRows.map(([c, amt]) => `<div class="row has-icon">${expIcon(c)}
          <div class="row-main"><div class="row-title">${esc(EXP[c]?.label || c)}</div><div class="bar"><i style="width:${Math.max(2, amt / total * 100).toFixed(1)}%;background:${COLORS[(EXP[c] || EXP.other).color]}"></i></div></div>
          <div class="row-value sm">${fmtMoneyShort(amt)}</div></div>`).join('')}</div>` : ''}
      <div class="section-h">Expenses</div>
      <div class="group">${exps.map(e => `<button class="row tap has-icon" data-act="exp-edit" data-id="${e.id}">${expIcon(e.cat)}
          <div class="row-main"><div class="row-title">${esc(e.desc || EXP[e.cat]?.label)}</div><div class="row-sub">${esc([fmtDate(e.date), e.desc ? EXP[e.cat]?.label : '', num(e.litres) ? `${num(e.litres)} L` : ''].filter(Boolean).join(' · '))}${S.docs.some(d => d.expenseId === e.id) ? ` · ${icon('clip')}` : ''}</div></div>
          <div class="row-value sm">${fmtMoney(num(e.amount))}</div>${icon('chev', 'chev')}</button>`).join('')}
        <button class="row tap link" data-act="exp-add" data-cat="fuel">${icon('plus')}Add Expense</button></div>
      ${num(t.odoStart) || num(t.odoEnd) ? `<div class="section-h">Odometer</div><div class="group">
        <div class="row"><div class="row-main">Start</div><div class="row-value">${num(t.odoStart) ? fmtDist(num(t.odoStart)) : '—'}</div></div>
        <div class="row"><div class="row-main">End</div><div class="row-value">${num(t.odoEnd) ? fmtDist(num(t.odoEnd)) : '—'}</div></div></div>` : ''}
      ${t.notes ? `<div class="section-h">Notes</div><div class="group"><div class="notes">${esc(t.notes)}</div></div>` : ''}
      ${docs.length ? `<div class="section-h">Receipts</div><div class="group"><div class="attach-grid">${docs.map(d => `<button class="doc-tile" data-action="open-doc" data-id="${d.id}">${thumbHTML(d)}</button>`).join('')}</div></div>` : ''}`;
  };
  paint();
  sh.body.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    if (el.dataset.act === 'exp-add') openExpenseSheet(id, null, el.dataset.cat, paint);
    if (el.dataset.act === 'exp-edit') openExpenseSheet(id, el.dataset.id, null, paint);
    if (el.dataset.act === 'end') openEndTripSheet(id, paint);
  });
}

function tripQuick() {
  if (!S.vehicles.length) return openVehicleForm();
  const live = activeTrips(curVehicle().id);
  if (live.length) openTripDetail(live[0].id); else openTripForm();
}

async function exportTripsCSV() {
  const v = curVehicle();
  const trips = filteredTrips().slice().reverse();
  if (!trips.length) return toast('No trips to export', false);
  const q = s => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const catSum = (t, c) => sum((t.expenses || []).filter(e => e.cat === c), e => num(e.amount));
  const head = ['Start date', 'End date', 'Vehicle', 'Registration', 'Trip', 'Purpose', 'From', 'To', `Odometer start (${S.settings.unit})`, `Odometer end (${S.settings.unit})`, `Distance (${S.settings.unit})`,
    'Fuel litres', ...Object.values(EXP).map(c => c.label), 'Total', 'Notes'];
  const rows = trips.map(t => [t.startDate, t.endDate, v.name, v.reg, tripName(t), t.purpose, t.from, t.to, num(t.odoStart) ?? '', num(t.odoEnd) ?? '', tripDist(t) ?? '',
    tripLitres(t) || '', ...Object.keys(EXP).map(c => catSum(t, c) ? catSum(t, c).toFixed(2) : ''), tripTotal(t).toFixed(2), t.notes]);
  const csv = '﻿' + [head, ...rows].map(r => r.map(q).join(',')).join('\r\n');
  const name = `trip-logbook-${v.name.replace(/\W+/g, '-').toLowerCase()}-${todayISO()}.csv`;
  await shareOrDownload(new File([csv], name, { type: 'text/csv' }), 'Trip Logbook');
}

async function shareOrDownload(file, title) {
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a'); a.href = url; a.download = file.name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast('Saved');
}

/* =========================================================
   Documents
   ========================================================= */
function linkSelectField(vehicleId, value) {
  const recs = vehicleRecords(vehicleId), trips = vehicleTrips(vehicleId);
  return `<div class="field"><label>Link to</label><select name="link">
    <option value="">Nothing</option>
    ${recs.length ? `<optgroup label="Service & Repairs">${recs.map(r => `<option value="r:${r.id}" ${value === 'r:' + r.id ? 'selected' : ''}>${esc(fmtDate(r.date))} · ${esc(recTitle(r))}</option>`).join('')}</optgroup>` : ''}
    ${trips.length ? `<optgroup label="Trips">${trips.map(t => `<option value="t:${t.id}" ${value === 't:' + t.id ? 'selected' : ''}>${esc(fmtDate(t.startDate))} · ${esc(tripName(t))}</option>`).join('')}</optgroup>` : ''}
  </select>${icon('updown', 'updown')}</div>`;
}

function openDocForm({ doc = null, files = [] }) {
  const isNew = !doc;
  const d = doc || { vehicleId: curVehicle().id, recordId: '', tripId: '', name: '', category: 'Invoice', date: todayISO() };
  const link = d.recordId ? 'r:' + d.recordId : d.tripId ? 't:' + d.tripId : '';
  const previews = isNew ? files : [doc];
  const body = `<form autocomplete="off">
    <div class="attach-grid" style="padding:8px 0 4px">${previews.map(p => `<div class="att">${thumbHTML(p)}</div>`).join('')}</div>
    <div class="group">
      ${inputField('Name', 'name', d.name, { ph: isNew ? (files[0]?.name || 'Invoice') : '' })}
      ${selectField('Category', 'category', DOC_CATS.map(c => [c, c]), d.category)}
      ${inputField('Date', 'date', d.date, { type: 'date' })}
    </div>
    <div class="section-h">Link</div>
    <div class="group" id="link-group">
      ${S.vehicles.length > 1 ? selectField('Vehicle', 'vehicleId', vehicleOptions(), d.vehicleId) : ''}
      ${linkSelectField(d.vehicleId, link)}
    </div>
    <div class="section-f">Linking keeps the invoice or receipt with that service, repair or trip.</div>
  </form>`;
  const sh = openSheet({
    title: isNew ? (files.length > 1 ? `${files.length} Documents` : 'New Document') : 'Document Details', body, right: 'Save',
    onRight: async close => {
      const f = Object.fromEntries(new FormData($('form', sh.body)));
      const vehicleId = f.vehicleId || d.vehicleId;
      const recordId = f.link?.startsWith('r:') ? f.link.slice(2) : null;
      const tripId = f.link?.startsWith('t:') ? f.link.slice(2) : null;
      if (isNew) {
        const base = f.name.trim() || files[0]?.name || f.category;
        for (const [i, p] of files.entries()) {
          const nd = { id: uid(), created: Date.now() + i, vehicleId, recordId, tripId, name: files.length > 1 ? `${base} ${i + 1}` : base, category: f.category, date: f.date || todayISO(), mime: p.mime, blob: p.blob, thumb: p.thumb, size: p.size };
          await DB.put('docs', nd); S.docs.push(nd);
        }
      } else {
        if (tripId !== doc.tripId) delete doc.expenseId;
        Object.assign(doc, { name: f.name.trim() || doc.name, category: f.category, date: f.date || doc.date, vehicleId, recordId, tripId });
        await DB.put('docs', doc);
      }
      sortDocs(); close(); render(); toast('Saved');
    },
  });
  const vSel = $('[name=vehicleId]', sh.body);
  if (vSel) vSel.addEventListener('change', () => {
    $('[name=link]', sh.body).closest('.field').outerHTML = linkSelectField(vSel.value, '');
  });
  // Scanning an old invoice: linking it to a record or trip takes that date unless you've picked one yourself.
  let dateTouched = !isNew;
  sh.body.addEventListener('change', e => {
    if (e.target.name === 'date') dateTouched = true;
    if (e.target.name !== 'link' || dateTouched) return;
    const [k, id] = e.target.value.split(':');
    const date = k === 'r' ? S.records.find(r => r.id === id)?.date : k === 't' ? S.trips.find(t => t.id === id)?.startDate : null;
    if (date) $('[name=date]', sh.body).value = date;
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

function openViewer(id, onChange) {
  const d = S.docs.find(x => x.id === id);
  if (!d) return;
  const photo = isPhoto(d);
  const pv = photo && vehicleById(d.vehicleId);
  const isCover = () => pv && coverPhoto(pv)?.id === d.id;
  const coverBtn = () => isCover() ? `<span class="v-link muted">${icon('star')}Cover photo</span>` : `<button data-v="cover" class="v-link">${icon('star')}Set as Cover</button>`;
  const url = URL.createObjectURL(d.blob);
  const rec = d.recordId && S.records.find(r => r.id === d.recordId);
  const trip = d.tripId && S.trips.find(t => t.id === d.tripId);
  const isImg = (d.mime || '').startsWith('image/');
  const w = document.createElement('div');
  w.className = 'viewer-wrap';
  w.innerHTML = `
    <div class="v-top"><button data-v="close">Done</button>
      <div class="v-title"><div>${esc(photo && pv ? pv.name : d.name)}</div><small>${esc(photo ? 'Photo' : d.category)} · ${esc(fmtDate(d.date))}${d.size ? ` · ${fmtBytes(d.size)}` : ''}</small></div>
      <button data-v="share" aria-label="Share">${icon('share')}</button></div>
    <div class="v-body">${isImg ? `<img src="${url}" alt="${esc(d.name)}">` : `<div class="pdf-card">${icon('doc')}<div>${esc(d.name)}</div><a class="btn inline" href="${url}" target="_blank" rel="noopener">Open Document</a></div>`}</div>
    <div class="v-bottom">${photo ? `<span class="v-cover">${coverBtn()}</span>` : rec ? `<button data-v="rec" class="v-link">${icon('clip')}${esc(recTitle(rec))}</button>` : trip ? `<button data-v="trip" class="v-link">${icon('route')}${esc(tripName(trip))}</button>` : '<span></span>'}
      <div class="v-actions">${photo ? '' : '<button data-v="edit">Details</button>'}<button data-v="del" class="red" aria-label="Delete">${icon('trash')}</button></div></div>`;
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
      await shareOrDownload(new File([d.blob], `${d.name}.${ext}`, { type: d.mime }), d.name);
    }
    if (a === 'edit') { close(); setTimeout(() => openDocForm({ doc: d }), 200); }
    if (a === 'rec' || a === 'trip') {
      close(); $$('.sheet-wrap').forEach(s => s.remove());
      setTimeout(() => a === 'rec' ? openRecordDetail(rec.id) : openTripDetail(trip.id), 200);
    }
    if (a === 'cover') {
      await setCover(pv, d.id);
      $('.v-cover', w).innerHTML = coverBtn();
      render(); onChange?.(); toast('Cover photo set');
    }
    if (a === 'del') {
      const what = photo ? 'Photo' : 'Document';
      if (!await confirmDestructive(`Delete this ${what.toLowerCase()}?`, 'This cannot be undone.', `Delete ${what}`)) return;
      await DB.del('docs', d.id);
      S.docs = S.docs.filter(x => x.id !== d.id);
      if (photoURLs.has(d.id)) { URL.revokeObjectURL(photoURLs.get(d.id)); photoURLs.delete(d.id); }
      if (pv && pv.coverId === d.id) await setCover(pv, coverPhoto(pv)?.id || '');
      close(); render(); onChange?.(); toast(`${what} deleted`);
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
    message: [r.nextDate ? `Due ${fmtDate(r.nextDate)}` : '', num(r.nextOdo) != null ? `at ${fmtDist(num(r.nextOdo))}` : ''].filter(Boolean).join(' or '),
    actions: [
      { label: 'Mark as Done…', handler: () => openRecordForm(null, { vehicleId: r.vehicleId, type: r.type, title: r.title, workshop: r.workshop }) },
      { label: 'View Last Record', handler: () => openRecordDetail(r.id) },
      { label: 'Clear Reminder', destructive: true, handler: async () => { r.nextDate = ''; r.nextOdo = ''; r.reminderPinned = false; await DB.put('records', r); render(); toast('Reminder cleared'); } },
    ],
  });
}

function openHiddenReminders() {
  const v = curVehicle();
  const list = hiddenUpcoming(v.id);
  const sh = openSheet({
    title: 'Kept as History', left: 'Done', dismissable: true,
    body: `<div class="section-f" style="margin-top:10px;padding:0 4px">These reminders aren't due yet, but a newer record of the same kind already covers them, so they're left out of Upcoming. Tap one and choose “Show in Upcoming Anyway” if it should still be shown.</div>
      <div class="group" style="margin-top:14px">${list.map(r => {
        const st = reminderStatus(r);
        const bits = [r.nextDate ? `Due ${fmtDate(r.nextDate)}` : '', num(r.nextOdo) != null ? `at ${fmtDist(num(r.nextOdo))}` : ''].filter(Boolean).join(' or ');
        return `<button class="row tap has-icon" data-act="open" data-id="${r.id}">${typeIcon(r.type)}
          <div class="row-main"><div class="row-title">${esc(recTitle(r))} · ${esc(fmtDate(r.date))}</div><div class="row-sub">${esc(bits)}</div>
          <div class="row-sub" style="white-space:normal">${esc(reminderStatusText(st))}</div></div>${icon('chev', 'chev')}</button>`;
      }).join('')}</div>`,
  });
  sh.body.addEventListener('click', e => {
    const el = e.target.closest('[data-act="open"]');
    if (el) { sh.close(); setTimeout(() => openRecordDetail(el.dataset.id), 250); }
  });
}

function addMenu() {
  if (!S.vehicles.length) return openVehicleForm();
  const v = curVehicle();
  const t = type => () => openRecordForm(null, { type });
  const live = activeTrips(v.id)[0];
  actionSheet({
    title: v.name, actions: [
      { label: 'Log Service', handler: t('service') },
      { label: 'Log Repair', handler: t('repair') },
      { label: 'Log Parts Replacement', handler: t('parts') },
      { label: 'Other Record…', handler: t('other') },
      live ? { label: 'Add Trip Expense', handler: () => openExpenseSheet(live.id, null, 'fuel') } : { label: 'Start a Trip', handler: () => openTripForm() },
      { label: 'Scan Invoice / Document', handler: () => scanFlow() },
      { label: 'Vehicle Photos', handler: () => openPhotos(v.id) },
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
  const data = { app: 'garage-log', version: 2, appVersion: APP_VERSION, exported: new Date().toISOString(), settings: S.settings, vehicles: S.vehicles, records: S.records, trips: S.trips, docs };
  const name = `garage-log-backup-${todayISO()}.json`;
  $('#toast').classList.remove('show');
  await shareOrDownload(new File([JSON.stringify(data)], name, { type: 'application/json' }), 'Garage Log Backup');
}

async function importBackup() {
  const [file] = await pickFiles({ accept: 'application/json,.json' });
  if (!file) return;
  let data;
  try { data = JSON.parse(await file.text()); } catch { return toast('Not a valid backup file', false); }
  if (data.app !== 'garage-log') return toast('Not a Garage Log backup', false);
  const trips = data.trips || [];
  const ok = await confirmDestructive('Restore backup?', `Replaces everything on this device with ${data.vehicles.length} vehicles, ${data.records.length} records, ${trips.length} trips and ${data.docs.length} documents from ${fmtDate(data.exported.slice(0, 10))}.`, 'Replace & Restore');
  if (!ok) return;
  toast('Restoring…', false);
  for (const s of STORES) await DB.clear(s);
  for (const v of data.vehicles) await DB.put('vehicles', v);
  for (const r of data.records) await DB.put('records', r);
  for (const t of trips) await DB.put('trips', t);
  const docs = [];
  for (const d of data.docs) { const nd = { ...d, blob: await dataURLToBlob(d.blob) }; await DB.put('docs', nd); docs.push(nd); }
  Object.assign(S.settings, data.settings || {}, { seenVersion: APP_VERSION });
  await saveSettings();
  S.vehicles = data.vehicles; S.records = data.records; S.trips = trips; S.docs = docs;
  sortRecords(); sortDocs(); sortTrips(); render(); toast('Backup restored');
}

async function eraseAll() {
  if (!await confirmDestructive('Erase all data?', 'Every vehicle, record, trip and document on this device will be permanently deleted. Export a backup first if you might need it.', 'Erase Everything')) return;
  for (const s of STORES) await DB.clear(s);
  S.vehicles = []; S.records = []; S.docs = []; S.trips = []; S.settings.vehicleId = null;
  render(); toast('All data erased');
}

/* =========================================================
   Updates
   ========================================================= */
function openWhatsNew() {
  openSheet({
    title: `What's New in ${APP_VERSION}`, left: 'Done', dismissable: true,
    body: `<div class="whats-new">${WHATS_NEW.map(([ic, t, d]) => `<div class="wn-item"><div class="wn-icon">${icon(ic)}</div><div><b>${esc(t)}</b><p>${esc(d)}</p></div></div>`).join('')}</div>
      <div class="section-f" style="text-align:center">Your existing vehicles, records and documents were kept as they were.</div>`,
  });
}

function showUpdateBanner(ver) {
  if ($('#update-banner')) return;
  const b = document.createElement('button');
  b.id = 'update-banner';
  b.innerHTML = `${icon('refresh')}<span>Update ${esc(ver)} ready — tap to install</span>`;
  b.onclick = async () => {
    b.querySelector('span').textContent = 'Updating…';
    try { const reg = await navigator.serviceWorker?.getRegistration(); await reg?.update(); } catch { /* ignore */ }
    location.reload();
  };
  document.body.appendChild(b);
}

async function checkForUpdate(manual = false) {
  try {
    const res = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error();
    const { version } = await res.json();
    if (version && version !== APP_VERSION) { showUpdateBanner(version); if (manual) toast(`Version ${version} is available`, false); return; }
    if (manual) toast(`You're on the latest version (${APP_VERSION})`);
  } catch {
    if (manual) toast('Offline — could not check for updates', false);
  }
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
  'hidden-reminders': openHiddenReminders,
  'odo': openOdoSheet,
  'spending': openSpendingSheet,
  'scan': () => scanFlow(),
  'open-doc': el => openViewer(el.dataset.id),
  'photos': () => openPhotos(),
  'add-vehicle': () => openVehicleForm(),
  'edit-vehicle': el => openVehicleForm(vehicleById(el.dataset.id)),
  'new-trip': () => openTripForm(),
  'trip-quick': tripQuick,
  'open-trip': el => openTripDetail(el.dataset.id),
  'trip-exp': el => openExpenseSheet(el.dataset.id, null, el.dataset.cat),
  'end-trip': el => openEndTripSheet(el.dataset.id),
  'export-trips': exportTripsCSV,
  'export': exportBackup,
  'import': importBackup,
  'erase': eraseAll,
  'check-update': () => checkForUpdate(true),
  'whats-new': openWhatsNew,
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
  if (c === 'trip-year') { S.tripYear = el.value; render(); }
  if (c === 'trip-purpose') { S.tripPurpose = el.value; render(); }
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
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkForUpdate(); });

/* =========================================================
   Boot
   ========================================================= */
(async function boot() {
  try {
    await openDB();
    const [vehicles, records, docs, trips, meta] = await Promise.all(STORES.map(s => DB.all(s)));
    S.vehicles = vehicles.sort((a, b) => (a.created || 0) - (b.created || 0));
    S.records = records; S.docs = docs; S.trips = trips;
    const st = meta.find(m => m.id === 'settings');
    if (st) { delete st.id; Object.assign(S.settings, st); }
    sortRecords(); sortDocs(); sortTrips();
  } catch (e) {
    console.error(e);
    $('#view').innerHTML = `<div class="empty"><h3>Storage unavailable</h3><p>${esc(e.message)}</p></div>`;
    return;
  }
  render();
  if (S.settings.seenVersion !== APP_VERSION) {
    const hadData = S.vehicles.length > 0;
    S.settings.seenVersion = APP_VERSION;
    saveSettings();
    if (hadData) setTimeout(openWhatsNew, 600);
  }
  navigator.storage?.persist?.();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
  checkForUpdate();
})();
