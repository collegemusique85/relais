/* Relais — données de démonstration ENTIÈREMENT FICTIVES.
   Horaires calqués sur ceux de l'établissement ; noms, classes et emplois du temps inventés.
   Dans la vraie version, ce fichier est remplacé par l'import de l'emploi du temps. */
'use strict';
const R = (window.R = window.R || {});

/* ---------- Grille horaire ---------- */
R.SLOTS = ['M1', 'M2', 'M3', 'M4', 'S1', 'S2', 'S3', 'S4'];
R.DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
R.DAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'];
const BASE_TIMES = {
  M1: ['08:30', '09:25'], M2: ['09:25', '10:20'], M3: ['10:40', '11:35'], M4: ['11:35', '12:30'],
  S1: ['13:45', '14:40'], S2: ['14:40', '15:35'], S3: ['15:50', '16:45'], S4: ['16:45', '17:40'],
};
/* Lundi : pas de M1, cours de 50 min le matin. Mercredi : matin seulement.
   Vendredi : trois cours de 50 min l'après-midi, fin à 16h15. */
R.daySlots = (d) =>
  d === 0 ? ['M2', 'M3', 'M4', 'S1', 'S2', 'S3', 'S4']
  : d === 2 ? ['M1', 'M2', 'M3', 'M4']
  : d === 4 ? ['M1', 'M2', 'M3', 'M4', 'S1', 'S2', 'S3']
  : R.SLOTS.slice();
R.slotTime = (d, s) => {
  if (d === 0 && s === 'M2') return ['10:00', '10:50'];
  if (d === 0 && s === 'M3') return ['10:50', '11:40'];
  if (d === 0 && s === 'M4') return ['11:40', '12:30'];
  if (d === 4 && s === 'S1') return ['13:45', '14:35'];
  if (d === 4 && s === 'S2') return ['14:35', '15:25'];
  if (d === 4 && s === 'S3') return ['15:25', '16:15'];
  return BASE_TIMES[s];
};
R.toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

/* ---------- Calendrier (fictif) ---------- */
R.WEEK_FIRST = 45;           // semaine affichée au démarrage
R.WEEK_LAST = 51;            // jusqu'aux prochaines vacances
R.PAST_WEEKS = [36, 37, 38, 39, 40, 41, 42];
R.weekMonday = (w) => new Date(2026, 10, 2 + (w - 45) * 7);
R.dayDate = (w, d) => { const x = R.weekMonday(w); x.setDate(x.getDate() + d); return x; };
R.parity = (w) => (w % 2 ? 'impaire' : 'paire');
R.fmtDate = (w, d) => R.dayDate(w, d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
/* Horloge de démonstration : mardi de la semaine 45, 10h05 */
R.NOW = { week: 45, day: 1, min: 10 * 60 + 5 };

/* ---------- Disciplines ---------- */
R.SUBJECTS = {
  FR: 'Français', MA: 'Mathématiques', HG: 'Histoire-géographie', ANG: 'Anglais', ESP: 'Espagnol',
  SVT: 'SVT', PC: 'Physique-chimie', SCI: 'Sciences', TEC: 'Technologie', ART: 'Arts plastiques',
  MUS: 'Éducation musicale', EPS: 'EPS',
};
R.SUBJ_SHORT = { HG: 'Hist.-géo', PC: 'Phys.-chimie', MUS: 'Musique', ART: 'Arts plast.', MA: 'Maths', TEC: 'Techno' };
const PLAN6 = { FR: 5, MA: 4, HG: 3, ANG: 4, SCI: 2, SVT: 1, TEC: 1, ART: 1, MUS: 1, EPS: 4 };
const PLAN = { FR: 4, MA: 4, HG: 3, ANG: 3, ESP: 2, SVT: 2, PC: 2, TEC: 1, ART: 1, MUS: 1, EPS: 3 };
const STAFF = { FR: 6, MA: 6, HG: 4, ANG: 5, ESP: 2, SVT: 3, PC: 3, TEC: 2, ART: 2, MUS: 2, EPS: 5 };
const staffKey = (s) => (s === 'SCI' ? 'PC' : s);

R.CLASSES = [];
[['6', 7], ['5', 7], ['4', 6], ['3', 7]].forEach(([lv, n]) => {
  for (let i = 1; i <= n; i++) R.CLASSES.push(lv + '0' + i);
});
R.level = (c) => c[0];
R.LEVELS = [['6', '6e'], ['5', '5e'], ['4', '4e'], ['3', '3e']];

/* ---------- Personnes (fictives) ---------- */
const SURNAMES = ['Arnaud', 'Barbier', 'Besson', 'Blanchard', 'Bonnet', 'Brunet', 'Carré', 'Charpentier',
  'Colin', 'Collet', 'Deschamps', 'Fabre', 'Faure', 'Fleury', 'Garnier', 'Gautier', 'Germain', 'Giraud',
  'Hamon', 'Hervé', 'Joly', 'Lacroix', 'Lambert', 'Lebrun', 'Leclerc', 'Lefèvre', 'Lemaire', 'Marchand',
  'Masson', 'Meunier', 'Michaud', 'Nicolas', 'Olivier', 'Perrin', 'Picard', 'Poulain', 'Renaud', 'Rolland',
  'Tessier', 'Vidal', 'Weber', 'Huet'];
R.VIE_SCOLAIRE = [{ id: 'vs1', name: 'Mme Ollivier' }, { id: 'vs2', name: 'M. Tanguy' }];
R.DIRECTION = { id: 'dir', name: 'Mme Prévost' };

R.ETUDES = [
  { id: 'Pascal 2', cap: 3, levels: null },
  { id: 'Foyer 6/5', cap: 2, levels: ['6', '5'] },
  { id: 'Foyer 4/3', cap: 2, levels: ['4', '3'] },
  { id: 'CDI', cap: 1, levels: null },
];
R.SPECIAL_ROOMS = ['K501 (informatique)', 'K502 (informatique)', 'Amphithéâtre', 'Polyvalente', 'H410 (labo)'];

/* ---------- Générateur pseudo-aléatoire reproductible ---------- */
function rngFrom(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
R.rngFrom = rngFrom;

function buildTeachers(rng) {
  const names = SURNAMES.slice();
  for (let i = names.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [names[i], names[j]] = [names[j], names[i]]; }
  const teachers = [];
  let n = 0;
  const roomPools = { MUS: ['H301', 'H302'], PC: ['H404', 'H405', 'H406'], SVT: ['H401', 'H402', 'H403'],
    ART: ['H202', 'H203'], TEC: ['K405', 'K406'] };
  let generic = 0;
  const genericRoom = () => { const blk = ['K1', 'K3', 'H1', 'K2']; const r = blk[generic % 4] + String(1 + Math.floor(generic / 4)).padStart(2, '0'); generic++; return r; };
  Object.entries(STAFF).forEach(([subj, count]) => {
    for (let i = 0; i < count; i++) {
      const civ = rng() < 0.62 ? 'Mme' : 'M.';
      const id = 't' + (++n);
      const room = subj === 'EPS' ? 'Gymnase' : roomPools[subj] ? roomPools[subj][i] : genericRoom();
      teachers.push({ id, civ, last: names[n - 1], name: civ + ' ' + names[n - 1], subj, room, classes: [] });
    }
  });
  return teachers;
}

function assignTeachers(teachers) {
  const units = {};
  R.CLASSES.forEach((c) => {
    const plan = R.level(c) === '6' ? PLAN6 : PLAN;
    Object.entries(plan).forEach(([subj, h]) => {
      const k = staffKey(subj);
      (units[k] = units[k] || []).push({ cls: c, subj, h });
    });
  });
  const assign = {}; // cls|subj -> teacherId
  Object.entries(units).forEach(([k, list]) => {
    const pool = teachers.filter((t) => t.subj === k);
    const total = list.reduce((a, u) => a + u.h, 0);
    const target = total / pool.length;
    let acc = 0, idx = 0;
    list.forEach((u) => {
      if (acc >= target * (idx + 1) - 0.01 && idx < pool.length - 1) idx++;
      const t = pool[idx];
      assign[u.cls + '|' + u.subj] = t.id;
      if (!t.classes.includes(u.cls)) t.classes.push(u.cls);
      acc += u.h;
    });
  });
  return assign;
}

function trySchedule(teachers, assign, seed) {
  const rng = rngFrom(seed);
  const slots = [];
  for (let d = 0; d < 5; d++) R.daySlots(d).forEach((s) => slots.push([d, s]));
  const units = [];
  R.CLASSES.forEach((c) => {
    const plan = R.level(c) === '6' ? PLAN6 : PLAN;
    Object.entries(plan).forEach(([subj, h]) => { for (let i = 0; i < h; i++) units.push({ cls: c, subj, teacher: assign[c + '|' + subj] }); });
  });
  const load = {};
  units.forEach((u) => (load[u.teacher] = (load[u.teacher] || 0) + 1));
  units.forEach((u) => (u.k = load[u.teacher] + rng()));
  units.sort((a, b) => b.k - a.k);
  const cg = {}, tg = {}, perDay = {};
  const lessons = [];
  for (const u of units) {
    let pick = null;
    for (const cap of [1, 2, 3]) {
      const cand = slots.filter(([d, s]) => {
        const kc = u.cls + d + s, kt = u.teacher + d + s;
        if (cg[kc] || tg[kt]) return false;
        const lim = u.subj === 'EPS' ? Math.max(cap, 2) : cap;
        return (perDay[u.cls + u.subj + d] || 0) < lim;
      });
      if (cand.length) {
        const weights = cand.map(([d, s]) => (s === 'S4' ? 0.35 : 1) * (d === 2 ? 1.2 : 1));
        let r = rng() * weights.reduce((a, b) => a + b, 0);
        for (let i = 0; i < cand.length; i++) { r -= weights[i]; if (r <= 0) { pick = cand[i]; break; } }
        pick = pick || cand[cand.length - 1];
        break;
      }
    }
    if (!pick) return null;
    const [d, s] = pick;
    cg[u.cls + d + s] = true; tg[u.teacher + d + s] = true;
    perDay[u.cls + u.subj + d] = (perDay[u.cls + u.subj + d] || 0) + 1;
    lessons.push({ cls: u.cls, subj: u.subj, teacher: u.teacher, day: d, slot: s });
  }
  return lessons;
}

R.buildSchool = function () {
  const rng = rngFrom(20261102);
  const teachers = buildTeachers(rng);
  const assign = assignTeachers(teachers);
  let lessons = null;
  for (let seed = 1; seed < 400 && !lessons; seed++) lessons = trySchedule(teachers, assign, seed * 7919);
  if (!lessons) throw new Error('Emploi du temps de démonstration impossible à générer');
  const tById = Object.fromEntries(teachers.map((t) => [t.id, t]));
  lessons.forEach((l, i) => { l.id = 'L' + i; l.room = tById[l.teacher].room; });
  // Professeurs principaux : un enseignant par classe, jamais deux classes
  const pp = {};
  const used = new Set();
  R.CLASSES.forEach((c) => {
    const counts = {};
    lessons.filter((l) => l.cls === c && l.subj !== 'EPS').forEach((l) => (counts[l.teacher] = (counts[l.teacher] || 0) + 1));
    const order = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([t]) => t);
    const t = order.find((x) => !used.has(x)) || order[0];
    used.add(t); pp[c] = t;
  });
  return { teachers, tById, lessons, pp };
};
