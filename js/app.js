/* Relais — interface (maquette). */
'use strict';
(function () {
  const R = window.R;
  const S = R.school;
  const $root = document.getElementById('app');

  /* ---------- État de l'interface ---------- */
  const UKEY = 'relais-ui-v3';
  let ui = { role: 'vs', me: R.state().me, week: R.NOW.week, tab: 'fil', panel: null, level: '', q: '', todo: false, statClass: null };
  try { Object.assign(ui, JSON.parse(localStorage.getItem(UKEY) || '{}'), { panel: null }); } catch (e) {}
  const saveUi = () => { try { localStorage.setItem(UKEY, JSON.stringify(Object.assign({}, ui, { panel: null }))); } catch (e) {} };
  let toastMsg = null, toastTimer = null;
  const toast = (m) => { toastMsg = m; clearTimeout(toastTimer); toastTimer = setTimeout(() => { toastMsg = null; render(); }, 4200); render(); };

  const TABS = {
    vs: [['fil', 'Le fil'], ['saisir', 'Saisir une absence'], ['relais', 'Relais'], ['tf', 'Temps forts'], ['demandes', 'Demandes'], ['recap', 'Récap'], ['reglages', 'Réglages']],
    prof: [['semaine', 'Ma semaine'], ['relais', 'Relais'], ['echanges', 'Échanges'], ['classe', 'Ma classe'], ['fil', 'Le fil']],
    dir: [['fil', 'Le fil'], ['stats', 'Statistiques']],
    ecran: [],
  };
  const ST = {
    atraiter: 'À traiter', ouvert: 'Relais ouvert', relais: 'Relais', inversion: 'Inversion', etude: 'Étude', self: 'Self',
    sortie: 'Sortie', tempsfort: 'Temps fort', journee: 'Pas de cours', info: 'Info', echange: 'Échange', normal: 'Cours',
  };
  const KIND = { sortie: 'Sortie', tempsfort: 'Temps fort', info: 'Information', journee: 'Journée sans cours' };

  /* ---------- Outils ---------- */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tm = (d, s) => R.slotTime(d, s).map((x) => x.replace(':', 'h')).join('–');
  const chip = (status, text) => `<span class="chip st-${status}">${esc(text || ST[status])}</span>`;
  const meIdent = () => (ui.role === 'prof' ? ui.me : ui.role === 'dir' ? 'dir' : 'vs');
  const isPP = () => Object.entries(S.pp).find(([, t]) => t === ui.me);
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const T = (id) => S.tById[id];
  const lineStatus = (l) => (!l.sol ? 'atraiter' : l.sol.kind === 'relais' ? (l.sol.who ? 'relais' : 'ouvert') : l.sol.kind);
  const weekLabel = (w) => `Semaine ${w}`;
  const range = (w) => `${R.dayDate(w, 0).getDate()} → ${R.fmtDate(w, 4)}`;

  /* ---------- En-tête ---------- */
  function header() {
    const st = R.state();
    const who = meIdent();
    const unread = R.notifsFor(who).filter((n) => !n.read).length;
    const roles = [['vs', 'Vie scolaire'], ['prof', 'Enseignant'], ['dir', 'Direction'], ['ecran', 'Écran']];
    return `
    <header class="top">
      <div class="brand">
        <svg class="baton" viewBox="0 0 40 40" aria-hidden="true"><rect x="7" y="16" width="26" height="8" rx="4" transform="rotate(-32 20 20)"/><circle cx="9" cy="29" r="3.2"/><circle cx="31" cy="11" r="3.2"/></svg>
        <span class="brand-name">Relais</span>
      </div>
      <div class="weeknav" role="group" aria-label="Semaine">
        <button class="ghost" data-act="week" data-d="-1" ${ui.week <= R.WEEK_FIRST ? 'disabled' : ''} aria-label="Semaine précédente">‹</button>
        <div class="weeklabel"><strong>${weekLabel(ui.week)}</strong><span>${R.parity(ui.week)} · ${range(ui.week)}</span></div>
        <button class="ghost" data-act="week" data-d="1" ${ui.week >= R.WEEK_LAST ? 'disabled' : ''} aria-label="Semaine suivante">›</button>
      </div>
      <div class="who">
        <div class="seg" role="tablist" aria-label="Voir en tant que">
          ${roles.map(([k, l]) => `<button role="tab" aria-selected="${ui.role === k}" data-act="role" data-r="${k}">${l}</button>`).join('')}
        </div>
        ${ui.role === 'prof' ? `<select data-input="me" aria-label="Enseignant">${S.teachers.slice().sort((a, b) => a.last.localeCompare(b.last))
          .map((t) => `<option value="${t.id}" ${t.id === ui.me ? 'selected' : ''}>${esc(t.name)} · ${esc(R.subjLabel(t.subj))}</option>`).join('')}</select>` : ''}
        ${ui.role !== 'ecran' ? `<button class="bell" data-act="notifs" aria-label="Notifications">${bellSvg}${unread ? `<b>${unread}</b>` : ''}</button>` : ''}
      </div>
    </header>
    <div class="demo">Maquette avec des données fictives. Horloge de démonstration : <strong>mardi 3 novembre, 10h05</strong>. Vos essais restent dans ce navigateur. <button class="link" data-act="reset">Recommencer la démo</button></div>
    ${ui.role !== 'ecran' ? `<nav class="tabs" aria-label="Sections">${TABS[ui.role].filter(([k]) => k !== 'classe' || isPP())
      .map(([k, l]) => `<button data-act="tab" data-t="${k}" aria-current="${ui.tab === k ? 'page' : 'false'}">${l}${badge(k)}</button>`).join('')}</nav>` : ''}`;
  }
  const bellSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a6 6 0 0 0-6 6v3.6L4.3 15.5A1 1 0 0 0 5.2 17h13.6a1 1 0 0 0 .9-1.5L18 12.6V9a6 6 0 0 0-6-6Zm0 19a2.5 2.5 0 0 0 2.4-2h-4.8A2.5 2.5 0 0 0 12 22Z"/></svg>';
  function badge(k) {
    const st = R.state();
    if (ui.role === 'vs' && k === 'saisir') return '';
    if (ui.role === 'vs' && k === 'fil') { const n = st.lines.filter((l) => !l.sol && l.w >= R.NOW.week).length; return n ? `<i class="count warn">${n}</i>` : ''; }
    if (ui.role === 'vs' && k === 'demandes') { const n = st.roomReqs.filter((r) => r.status === 'attente').length; return n ? `<i class="count">${n}</i>` : ''; }
    if (ui.role === 'prof' && k === 'relais') { const n = myRelais().filter((x) => x.rs.can && !x.rs.mine).length; return n ? `<i class="count">${n}</i>` : ''; }
    if (ui.role === 'prof' && k === 'echanges') { const n = st.exchanges.filter((x) => x.status === 'propose' && x.b.teacher === ui.me).length; return n ? `<i class="count">${n}</i>` : ''; }
    return '';
  }

  /* ---------- LE FIL ---------- */
  function vFil() {
    const st = R.state();
    const w = ui.week;
    const q = norm(ui.q.trim());
    const match = (l) => (!ui.level || R.level(l.cls) === ui.level) && (!ui.todo || !l.sol) &&
      (!q || l.cls.includes(q) || norm(R.tName(l.teacher)).includes(q) || (l.sol && l.sol.who && norm(R.tName(l.sol.who)).includes(q)));
    const evMatch = (e) => (!ui.level || e.kind === 'journee' || e.kind === 'info' || e.classes.some((c) => R.level(c) === ui.level)) &&
      (!q || norm(e.title).includes(q) || e.classes.some((c) => c.includes(q)));
    let html = `<div class="filters">
      <div class="seg small">${[['', 'Toutes'], ...R.LEVELS].map(([k, l]) => `<button aria-pressed="${ui.level === k}" data-act="level" data-l="${k}">${l}</button>`).join('')}</div>
      <input type="search" data-input="q" placeholder="Classe ou professeur" value="${esc(ui.q)}" aria-label="Filtrer par classe ou professeur">
      ${ui.role === 'vs' ? `<label class="check"><input type="checkbox" data-input="todo" ${ui.todo ? 'checked' : ''}> Seulement ce qui reste à traiter</label>` : ''}
    </div>`;
    let any = false;
    for (let d = 0; d < 5; d++) {
      const evs = st.events.filter((e) => e.w === w && e.d === d && evMatch(e));
      const lines = st.lines.filter((l) => l.w === w && l.d === d && match(l)).sort((a, b) => R.SLOTS.indexOf(a.s) - R.SLOTS.indexOf(b.s) || a.cls.localeCompare(b.cls));
      const today = w === R.NOW.week && d === R.NOW.day;
      if (!evs.length && !lines.length) continue;
      any = true;
      html += `<section class="day ${today ? 'today' : ''}">
        <header class="dayhead"><h2>${R.DAYS[d]} ${R.fmtDate(w, d)}</h2>${today ? '<span class="tag">Aujourd\'hui</span>' : ''}${ribbon(w, d)}</header>
        ${banners(evs)}
        ${lines.length ? `<div class="rows">${lines.map((l) => row(l)).join('')}</div>` : ''}
      </section>`;
    }
    if (!any) html += `<div class="empty"><p>Rien de signalé ${ui.q || ui.level || ui.todo ? 'avec ces filtres' : 'cette semaine'}.</p>${ui.role === 'vs' ? '<button class="primary" data-act="tab" data-t="saisir">Saisir une absence</button>' : ''}</div>`;
    return html;
  }
  function ribbon(w, d) {
    const st = R.state();
    const order = ['atraiter', 'ouvert', 'relais', 'inversion', 'etude', 'self'];
    return `<div class="ribbon" aria-hidden="true">${R.SLOTS.map((s) => {
      if (!R.daySlots(d).includes(s)) return `<span class="rb off">${s}</span>`;
      const ls = st.lines.filter((l) => l.w === w && l.d === d && l.s === s).map(lineStatus);
      const ev = st.events.find((e) => e.w === w && e.d === d && e.slots.includes(s) && e.kind !== 'info');
      const worst = order.find((o) => ls.includes(o)) || (ev ? ev.kind : '');
      return `<span class="rb ${worst ? 'st-' + worst : ''}" title="${s}">${s}${ls.length ? `<i>${ls.length}</i>` : ''}</span>`;
    }).join('')}</div>`;
  }
  function banners(evs) {
    const groups = {};
    evs.forEach((e) => (groups[e.title + e.kind] = groups[e.title + e.kind] || []).push(e));
    return Object.values(groups).map((list) => {
      const e = list[0];
      const det = list.map((x) => x.kind === 'journee' ? 'Toutes les classes' : x.kind === 'info' ? `${x.slots.join('–')} (${tm(x.d, x.slots[0])})${x.room ? ', ' + esc(x.room) : ''}`
        : `${x.classes.join(', ')} en ${x.slots.length > 1 ? x.slots[0] + '–' + x.slots[x.slots.length - 1] : x.slots[0]}`).join(' · ');
      const acc = list.flatMap((x) => x.accomp || []);
      return `<div class="banner st-${e.kind}">
        <span class="kind">${KIND[e.kind]}</span>
        <div><strong>${esc(e.title)}</strong><span>${det}${acc.length ? ` · accompagnement : ${acc.map((t) => esc(R.tName(t))).join(', ')}` : ''}</span></div>
        ${ui.role === 'vs' ? `<button class="icon" data-act="delEvent" data-id="${list.map((x) => x.id).join(',')}" aria-label="Supprimer">✕</button>` : ''}
      </div>`;
    }).join('');
  }
  function row(l) {
    const status = lineStatus(l);
    const s = l.sol;
    let sol = chip(status);
    if (s && s.kind === 'relais' && s.who) sol += ` <span class="who">${esc(R.tName(s.who))}</span>`;
    if (s && s.kind === 'inversion') sol += ` <span class="who">${esc(R.tName(s.who))} · ${esc(R.subjLabel(s.subj))}</span>`;
    if (s && s.kind === 'etude') sol += ` <span class="who">${esc(s.room)}</span>`;
    const reason = l.reason === 'accompagnement' ? '<em>accompagne une sortie</em>' : l.reason === 'inversion' ? '<em>cours déplacé (inversion)</em>' : '';
    const room = s && s.kind === 'relais' ? s.room || l.room : s && s.kind === 'inversion' ? s.room || l.room : s && s.kind === 'etude' ? s.room : s && s.kind === 'self' ? 'Self' : l.room;
    const clickable = ui.role === 'vs';
    return `<div class="row ${clickable ? 'click' : ''} ${R.isPast(l.w, l.d, l.s) ? 'past' : ''}" ${clickable ? `data-act="line" data-id="${l.id}" tabindex="0" role="button"` : ''}>
      <div class="slot"><b>${l.s}</b><span>${tm(l.d, l.s)}</span></div>
      <div class="cls">${l.cls}</div>
      <div class="abs">${esc(R.tName(l.teacher))}<span>${esc(R.subjLabel(l.subj))}</span>${reason}</div>
      <div class="sol">${sol}</div>
      <div class="room">${esc(room)}</div>
      <div class="com">${esc(l.comment || '')}</div>
    </div>`;
  }

  /* ---------- Panneau : traiter un créneau (vie scolaire) ---------- */
  function pLine(id) {
    const l = R.state().lines.find((x) => x.id === id);
    if (!l) return '';
    const sg = R.suggest(l);
    const status = lineStatus(l);
    const s = l.sol;
    const showAll = ui.panelAll;
    const relais = showAll ? sg.relais : sg.relais.slice(0, 6);
    const past = R.isPast(l.w, l.d, l.s);
    return `<div class="phead">
        <div><h3>${l.cls} · ${R.DAYS[l.d].toLowerCase()} ${R.fmtDate(l.w, l.d)} · ${l.s}</h3>
        <p>${tm(l.d, l.s)} · ${esc(R.tName(l.teacher))}, ${esc(R.subjLabel(l.subj))} · salle ${esc(l.room)}${l.reason === 'accompagnement' ? ' · accompagne une sortie' : ''}</p></div>
        <button class="icon" data-act="close" aria-label="Fermer">✕</button>
      </div>
      <div class="pnow">${chip(status)} ${s ? esc(R.solText(l)) : 'Aucune solution choisie pour l\'instant.'}
        ${s && s.kind === 'relais' && s.who ? `<small>${s.prio ? 'prioritaire · ' : ''}${s.at != null ? 'pris ' + esc(R.fmtAbs(s.at)) : ''}</small>` : ''}</div>
      ${past ? '<p class="note">Ce créneau est passé : les modifications restent possibles pour corriger l\'historique.</p>' : ''}
      ${sg.inversions.length ? `<h4>Inversions possibles</h4><ul class="opts">${sg.inversions.map((o, i) => `<li>
          <div><strong>${esc(R.tName(o.who))}</strong> prend la ${l.cls} maintenant (${esc(R.subjLabel(o.subj))}) au lieu de ${o.sameDay ? '' : R.DAYS[o.from.d].toLowerCase() + ' '}${o.from.s}.
          <span>${o.fullSwap ? `Échange complet : ${esc(R.tName(l.teacher))} fera son cours ${o.sameDay ? 'en ' + o.from.s : R.DAYS[o.from.d].toLowerCase() + ' en ' + o.from.s}.` : o.hole ? esc(o.hole.charAt(0).toUpperCase() + o.hole.slice(1)) + '.' : 'Un nouveau créneau sera à traiter en ' + o.from.s + '.'}</span></div>
          <button class="secondary" data-act="solInv" data-id="${l.id}" data-i="${i}">Choisir</button></li>`).join('')}</ul>` : ''}
      ${sg.self ? `<h4>Self</h4><ul class="opts"><li><div>La classe va au self en avance.</div><button class="secondary" data-act="sol" data-id="${l.id}" data-k="self">Choisir</button></li></ul>` : ''}
      <h4>Relais</h4>
      <div class="openbox">
        <div><strong>Ouvrir aux inscriptions</strong><span>Premier arrivé, premier servi. Un prof de la classe peut reprendre le relais jusqu'à la veille à 17h. Les profs de la classe sont prévenus.</span></div>
        <button class="primary" data-act="open" data-id="${l.id}" ${s && s.kind === 'relais' && !s.who ? 'disabled' : ''}>${s && s.kind === 'relais' && !s.who ? 'Ouvert' : 'Ouvrir'}</button>
      </div>
      <p class="sub">Ou confier directement à un collègue libre :</p>
      <ul class="opts">${relais.map((r) => `<li>
          <div><div><strong>${esc(R.tName(r.who))}</strong> <span class="muted">${esc(R.subjLabel(T(r.who).subj))}</span></div><div>${r.prio ? '<span class="tag prio">Prof de la classe</span>' : ''}${r.pres ? `<span class="tag">${r.pres}</span>` : ''}</div></div>
          <button class="secondary" data-act="solRelais" data-id="${l.id}" data-w="${r.who}" ${s && s.who === r.who ? 'disabled' : ''}>${s && s.who === r.who ? 'Choisi' : 'Confier'}</button></li>`).join('')}</ul>
      ${sg.relais.length > 6 ? `<button class="link" data-act="panelAll">${showAll ? 'Voir moins' : `Voir les ${sg.relais.length - 6} autres collègues libres`}</button>` : ''}
      ${!sg.relais.length ? '<p class="muted">Aucun collègue libre sur ce créneau.</p>' : ''}
      <h4>Étude</h4>
      <ul class="opts">${sg.etudes.map((e) => {
        const full = e.load >= e.cap; const chosen = s && s.kind === 'etude' && s.room === e.room;
        return `<li><div><strong>${esc(e.room)}</strong> <span class="gauge" aria-label="${e.load} classe(s) sur ${e.cap}">${Array.from({ length: e.cap }, (_, i) => `<i class="${i < e.load ? 'on' : ''}"></i>`).join('')}</span>
          <span class="muted">${e.load}/${e.cap} classe${e.cap > 1 ? 's' : ''}</span></div>
          <button class="secondary" data-act="sol" data-id="${l.id}" data-k="etude" data-room="${esc(e.room)}" ${(full && !chosen) || chosen ? 'disabled' : ''}>${chosen ? 'Choisi' : full ? 'Complet' : 'Choisir'}</button></li>`;
      }).join('')}</ul>
      <h4>Commentaire</h4>
      <div class="inline"><input data-input="comment" data-id="${l.id}" value="${esc(l.comment || '')}" placeholder="PACTE, RCD, travail à faire…" aria-label="Commentaire"><button class="secondary" data-act="saveComment" data-id="${l.id}">Enregistrer</button></div>
      <div class="pfoot"><button class="link danger" data-act="delLine" data-id="${l.id}">Retirer ce créneau du fil</button></div>`;
  }

  /* ---------- SAISIR UNE ABSENCE ---------- */
  const DAYW = [['lundi', 'lun'], ['mardi', 'mar'], ['mercredi', 'mer'], ['jeudi', 'jeu'], ['vendredi', 'ven']];
  function parse(text) {
    const t = norm(text).replace(/[,;.]/g, ' ');
    const words = t.split(/\s+/).filter(Boolean);
    const teachers = S.teachers.filter((x) => { const n = norm(x.last); return words.some((w) => w.length >= 3 && n.startsWith(w)); });
    const days = [];
    words.forEach((w) => { DAYW.forEach(([full, short], i) => { if ((w === full || w === short) && !days.includes(i)) days.push(i); }); });
    if (/\baujourd/.test(t) && ui.week === R.NOW.week) days.push(R.NOW.day);
    if (/\bdemain\b/.test(t) && ui.week === R.NOW.week && R.NOW.day < 4) days.push(R.NOW.day + 1);
    let slotsFor = (d) => R.daySlots(d);
    const rg = t.match(/\b([ms][1-4])\s*(?:-|a|à|au)\s*([ms][1-4])\b/);
    const singles = t.match(/\b[ms][1-4]\b/g);
    if (rg) { const a = R.SLOTS.indexOf(rg[1].toUpperCase()), b = R.SLOTS.indexOf(rg[2].toUpperCase()); slotsFor = (d) => R.daySlots(d).filter((s) => { const i = R.SLOTS.indexOf(s); return i >= Math.min(a, b) && i <= Math.max(a, b); }); }
    else if (singles) { const set = singles.map((x) => x.toUpperCase()); slotsFor = (d) => R.daySlots(d).filter((s) => set.includes(s)); }
    else if (/\bmatin(ee)?\b/.test(t)) slotsFor = (d) => R.daySlots(d).filter((s) => s[0] === 'M');
    else if (/apres[- ]?midi|aprem/.test(t)) slotsFor = (d) => R.daySlots(d).filter((s) => s[0] === 'S');
    return { teachers, days, slotsFor };
  }
  function vSaisir() {
    const p = ui.parsed;
    const text = ui.sentence || '';
    const res = text ? parse(text) : null;
    let preview = '';
    if (res) {
      const t = res.teachers.length === 1 ? res.teachers[0] : res.teachers.find((x) => x.id === ui.pickT);
      if (!res.teachers.length) preview = '<p class="hint">Je ne reconnais pas encore de nom de professeur.</p>';
      else if (!t) preview = `<p class="hint">Plusieurs collègues correspondent :</p><div class="pick">${res.teachers.map((x) => `<button class="secondary" data-act="pickT" data-t="${x.id}">${esc(x.name)} · ${esc(R.subjLabel(x.subj))}</button>`).join('')}</div>`;
      else if (!res.days.length) preview = `<p class="hint"><strong>${esc(t.name)}</strong> : quel jour ?</p>`;
      else {
        const items = res.days.map((d) => ({ d, slots: res.slotsFor(d), lessons: R.lessonsOf(t.id, ui.week, d, res.slotsFor(d)) }));
        const n = items.reduce((a, x) => a + x.lessons.length, 0);
        ui.pending = { t: t.id, items: items.map(({ d, slots }) => ({ d, slots })) };
        preview = `<div class="preview">
          <p><strong>${esc(t.name)}</strong>, ${esc(R.subjLabel(t.subj))}, absent${t.civ === 'Mme' ? 'e' : ''} ${items.map((x) => `${R.DAYS[x.d].toLowerCase()} ${R.fmtDate(ui.week, x.d)} (${x.slots.length === R.daySlots(x.d).length ? 'toute la journée' : x.slots.join(', ')})`).join(' et ')}.</p>
          ${n ? `<div class="rows compact">${items.flatMap((x) => x.lessons).map((x) => `<div class="row"><div class="slot"><b>${x.s}</b><span>${tm(x.d, x.s)}</span></div><div class="cls">${x.cls}</div><div class="abs">${esc(R.subjLabel(x.subj))}</div><div class="room">${esc(x.room)}</div></div>`).join('')}</div>
          <button class="primary big" data-act="createAbs">Ajouter ${n} créneau${n > 1 ? 'x' : ''} au fil</button>`
          : '<p class="hint">Aucun cours sur cette période : rien à ajouter au fil.</p>'}
        </div>`;
      }
    }
    const ex = ['Masson absente jeudi matin', 'Huet mardi', 'Faure vendredi M1-M3', 'Lambert jeudi et vendredi'].map((e) => {
      const last = e.split(' ')[0];
      const real = S.teachers.find((x) => x.last === last) ? e : e.replace(last, S.teachers[(e.length * 7) % S.teachers.length].last);
      return real;
    });
    return `<section class="card saisie">
      <h2>Qui est absent, et quand ?</h2>
      <p class="muted">Tapez une phrase : l'emploi du temps fait le reste. Semaine affichée : ${weekLabel(ui.week)}.</p>
      <input class="sentence" data-input="sentence" value="${esc(text)}" placeholder="Ex. : ${esc(ex[0])}" aria-label="Absence en une phrase" autocomplete="off">
      <div class="examples">${ex.map((e) => `<button class="link" data-act="example" data-v="${esc(e)}">${esc(e)}</button>`).join('')}</div>
      <div id="preview">${preview}</div>
    </section>
    ${lastCreated()}`;
  }
  function lastCreated() {
    if (!ui.created || !ui.created.length) return '';
    const st = R.state();
    const ls = ui.created.map((id) => st.lines.find((l) => l.id === id)).filter(Boolean);
    if (!ls.length) return '';
    return `<section class="card"><h3>Ajouté au fil, à traiter</h3><div class="rows">${ls.map(row).join('')}</div></section>`;
  }

  /* ---------- RELAIS ---------- */
  function myRelais() {
    const st = R.state();
    return st.lines.filter((l) => l.sol && l.sol.kind === 'relais' && l.w >= R.NOW.week && !R.isPast(l.w, l.d, l.s))
      .map((l) => ({ l, rs: R.relaisState(l, ui.me) }))
      .filter((x) => x.rs.can || x.rs.mine || (x.rs.taken && x.rs.prio) || x.rs.closed && x.rs.mine)
      .sort((a, b) => R.slotAbs(a.l.w, a.l.d, a.l.s) - R.slotAbs(b.l.w, b.l.d, b.l.s));
  }
  function relaisCard(l, rs) {
    const s = l.sol;
    const dl = R.deadlineAbs(l.w, l.d);
    let action = '';
    if (rs.mine) action = `<div class="mine">C'est vous qui prenez le relais.</div>${rs.open ? `<button class="secondary" data-act="withdraw" data-id="${l.id}">Me désister</button>` : ''}`;
    else if (rs.action === 'prendre') action = `<button class="primary take" data-act="take" data-id="${l.id}">Je prends le relais</button>`;
    else if (rs.action === 'reprendre') action = `<p class="hint">Actuellement pris par ${esc(R.tName(rs.holder))}, qui n'a pas la classe. ${R.pron(rs.holder) === 'il' ? 'Il' : 'Elle'} sera prévenu${R.pron(rs.holder) === 'il' ? '' : 'e'}.</p><button class="primary take" data-act="take" data-id="${l.id}">Reprendre le relais (prioritaire)</button>`;
    else if (rs.taken) action = `<p class="hint">Pris par ${esc(R.tName(rs.holder))}.</p>`;
    return `<article class="rcard ${rs.mine ? 'is-mine' : ''}">
      <div class="rc-when"><b>${R.DAYS_SHORT[l.d]} ${R.dayDate(l.w, l.d).getDate()}</b><span>${l.s}</span><small>${tm(l.d, l.s)}</small></div>
      <div class="rc-body">
        <div class="rc-cls">${l.cls}</div>
        <p>${esc(R.subjLabel(l.subj))} · ${esc(R.tName(l.teacher))}${l.reason === 'accompagnement' ? ' accompagne une sortie' : ' absent' + (T(l.teacher).civ === 'Mme' ? 'e' : '')} · salle ${esc(s.room || l.room)}</p>
        <div class="tags">${rs.prio ? '<span class="tag prio">Vous avez cette classe · prioritaire</span>' : ''}${R.presence(ui.me, l.w, l.d, l.s) ? `<span class="tag">Vous êtes ${R.presence(ui.me, l.w, l.d, l.s)}</span>` : ''}
          <span class="tag light">Inscriptions jusqu'à ${esc(R.fmtAbs(dl))}</span></div>
      </div>
      <div class="rc-act">${action}</div>
    </article>`;
  }
  function vRelaisProf() {
    const list = myRelais();
    const mine = list.filter((x) => x.rs.mine), open = list.filter((x) => !x.rs.mine);
    return `<section>
      <h2 class="h">Relais que vous pouvez prendre</h2>
      <p class="muted lead">Seuls les créneaux où vous êtes libre apparaissent. Si vous avez la classe, vous êtes prioritaire : vous pouvez reprendre un relais pris par un collègue qui ne l'a pas, jusqu'à la veille à 17h.</p>
      ${open.length ? open.map((x) => relaisCard(x.l, x.rs)).join('') : '<div class="empty"><p>Aucun relais ouvert sur vos créneaux libres. Vous serez prévenu dès qu\'un relais s\'ouvre sur une de vos classes.</p></div>'}
      ${mine.length ? `<h2 class="h">Vos relais à venir</h2>${mine.map((x) => relaisCard(x.l, x.rs)).join('')}` : ''}
    </section>`;
  }
  function vRelaisVS() {
    const st = R.state();
    const ls = st.lines.filter((l) => l.sol && l.sol.kind === 'relais' && l.w >= R.NOW.week && !R.isPast(l.w, l.d, l.s))
      .sort((a, b) => R.slotAbs(a.w, a.d, a.s) - R.slotAbs(b.w, b.d, b.s));
    const open = ls.filter((l) => !l.sol.who), taken = ls.filter((l) => l.sol.who);
    const block = (title, arr, emptyText) => `<h2 class="h">${title} <span class="muted">${arr.length}</span></h2>${arr.length ? `<div class="rows">${arr.map((l) => {
      const dl = R.deadlineAbs(l.w, l.d); const closed = R.nowAbs() >= dl;
      return row(l).replace('<div class="com">', `<div class="com">${closed ? '<span class="tag warn">Inscriptions closes</span> ' : `<span class="tag light">jusqu'à ${esc(R.fmtAbs(dl))}</span> `}${l.sol.who ? (l.sol.prio ? '<span class="tag prio">a la classe</span> ' : '') : ''}`);
    }).join('')}</div>` : `<p class="muted">${emptyText}</p>`}`;
    return `<section>${block('Relais ouverts', open, 'Aucun relais en attente.')}${block('Relais pris', taken, 'Aucun relais pris pour le moment.')}</section>`;
  }

  /* ---------- TEMPS FORTS ---------- */
  function vTF() {
    const f = ui.tf || (ui.tf = { title: '', kind: 'sortie', d: 3, slots: [], classes: [], accomp: [], stats: true, room: '', from: '', to: '' });
    const pv = f.title || f.slots.length ? R.previewEvent({ w: ui.week, d: f.d, kind: f.kind, classes: f.classes, slots: f.slots, accomp: f.accomp }) : null;
    const st = R.state();
    const list = st.events.filter((e) => e.w === ui.week).sort((a, b) => a.d - b.d);
    const canCreate = f.title.trim() && f.slots.length && (f.kind === 'journee' || f.kind === 'info' || f.classes.length);
    return `<div class="split">
    <section class="card">
      <h2>Ajouter une sortie ou un temps fort</h2>
      <label class="field"><span>Intitulé</span><input data-input="tf.title" value="${esc(f.title)}" placeholder="Ex. : Sortie au théâtre, Sécurité routière"></label>
      <div class="field"><span>Type</span><div class="seg small">${Object.entries(KIND).map(([k, l]) => `<button aria-pressed="${f.kind === k}" data-act="tfKind" data-k="${k}">${l}</button>`).join('')}</div></div>
      <div class="field"><span>Jour</span><div class="seg small">${R.DAYS.map((dn, d) => `<button aria-pressed="${f.d === d}" data-act="tfDay" data-d="${d}">${dn.slice(0, 3)} ${R.dayDate(ui.week, d).getDate()}</button>`).join('')}</div></div>
      <div class="field"><span>Horaires</span>
        <div class="inline"><label class="mini">de <input type="time" data-input="tf.from" value="${esc(f.from)}"></label><label class="mini">à <input type="time" data-input="tf.to" value="${esc(f.to)}"></label><span class="muted">ou choisissez les créneaux :</span></div>
        <div class="slotpick">${R.daySlots(f.d).map((s) => `<button aria-pressed="${f.slots.includes(s)}" data-act="tfSlot" data-s="${s}"><b>${s}</b><small>${tm(f.d, s)}</small></button>`).join('')}</div>
      </div>
      ${f.kind === 'info' ? `<label class="field"><span>Lieu</span><input data-input="tf.room" value="${esc(f.room)}" placeholder="Ex. : Polyvalente"></label>` : ''}
      ${f.kind !== 'journee' && f.kind !== 'info' ? `<div class="field"><span>Classes</span>${R.LEVELS.map(([lv, ll]) => {
        const cls = R.CLASSES.filter((c) => R.level(c) === lv); const all = cls.every((c) => f.classes.includes(c));
        return `<div class="clspick"><button class="lvl" aria-pressed="${all}" data-act="tfLevel" data-l="${lv}">Toute la ${ll}</button>${cls.map((c) => `<button aria-pressed="${f.classes.includes(c)}" data-act="tfClass" data-c="${c}">${c}</button>`).join('')}</div>`;
      }).join('')}</div>
      <div class="field"><span>Accompagnateurs</span>
        <div class="inline"><select data-input="tf.addAccomp" aria-label="Ajouter un accompagnateur"><option value="">Ajouter un collègue…</option>${S.teachers.slice().sort((a, b) => a.last.localeCompare(b.last)).filter((t) => !f.accomp.includes(t.id)).map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></div>
        <div class="tags">${f.accomp.map((t) => `<button class="tag removable" data-act="tfRmAcc" data-t="${t}">${esc(R.tName(t))} ✕</button>`).join('')}</div></div>` : ''}
      <label class="check"><input type="checkbox" data-input="tf.stats" ${f.stats ? 'checked' : ''}> Compter dans les statistiques d'heures manquées</label>
      ${pv ? `<div class="pv">
        <p><strong>${pv.hours}</strong> heure${pv.hours > 1 ? 's' : ''} de cours concernée${pv.hours > 1 ? 's' : ''}.</p>
        ${pv.freed.length ? `<p>Profs libérés, prévenus et proposés pour un relais : ${Object.entries(pv.freed.reduce((m, x) => ((m[x.t] = m[x.t] || []).push(x.cls + ' ' + x.s), m), {})).map(([t, l]) => `${esc(R.tName(t))} (${l.join(', ')})`).join(' · ')}.</p>` : ''}
        ${pv.cover.length ? `<p class="warnline">Cours à couvrir (accompagnateurs) : ${pv.cover.map((x) => `${x.cls} en ${x.s} (${esc(R.tName(x.t))})`).join(', ')}. Ils apparaîtront dans le fil, à traiter.</p>` : ''}
      </div>` : ''}
      <div><button class="primary big" data-act="tfCreate" ${canCreate ? '' : 'disabled'}>Ajouter au fil</button></div>
    </section>
    <section class="card">
      <h2>Cette semaine</h2>
      ${list.length ? list.map((e) => `<div class="banner st-${e.kind}"><span class="kind">${KIND[e.kind]}</span><div><strong>${esc(e.title)}</strong><span>${R.DAYS[e.d]} · ${e.kind === 'journee' ? 'toutes les classes' : e.kind === 'info' ? e.slots.join('–') : e.classes.join(', ') + ' · ' + e.slots.join('–')}${e.stats ? '' : ' · hors statistiques'}</span></div><button class="icon" data-act="delEvent" data-id="${e.id}" aria-label="Supprimer">✕</button></div>`).join('') : '<p class="muted">Aucun temps fort cette semaine.</p>'}
    </section></div>`;
  }

  /* ---------- DEMANDES ---------- */
  function vDemandes() {
    const st = R.state();
    const rq = st.roomReqs.slice().sort((a, b) => (a.status === 'attente' ? -1 : 1) - (b.status === 'attente' ? -1 : 1));
    const ex = st.exchanges.filter((x) => x.status === 'accepte');
    return `<section><h2 class="h">Demandes de salle</h2>
      ${rq.length ? `<div class="rows">${rq.map((r) => `<div class="row">
        <div class="slot"><b>${r.s}</b><span>${R.DAYS_SHORT[r.d]} ${R.dayDate(r.w, r.d).getDate()}</span></div><div class="cls">${r.cls}</div>
        <div class="abs">${esc(R.tName(r.t))}<span>${esc(r.from)} → <strong>${esc(r.room)}</strong>${r.why ? ' · ' + esc(r.why) : ''}</span></div>
        <div class="sol">${r.status === 'attente' ? `${R.roomFree(r.w, r.room, r.d, r.s) ? '<span class="tag ok">Salle libre</span>' : '<span class="tag warn">Salle occupée</span>'}` : chip(r.status === 'valide' ? 'relais' : 'atraiter', r.status === 'valide' ? 'Validée' : 'Refusée')}</div>
        <div class="room"></div>
        <div class="com">${r.status === 'attente' ? `<button class="secondary" data-act="room" data-id="${r.id}" data-ok="1">Valider</button> <button class="link" data-act="room" data-id="${r.id}" data-ok="0">Refuser</button>` : ''}</div></div>`).join('')}</div>` : '<p class="muted">Aucune demande.</p>'}
      <h2 class="h">Échanges entre collègues</h2>
      <p class="muted lead">L'accord des deux collègues suffit : vous êtes simplement informés.</p>
      ${ex.length ? `<div class="rows">${ex.map((x) => `<div class="row"><div class="slot"><b>${x.a.s}</b><span>${R.DAYS_SHORT[x.a.d]} ${R.dayDate(x.a.w, x.a.d).getDate()}</span></div><div class="cls">${x.a.cls}</div><div class="abs">${esc(R.tName(x.a.teacher))} ↔ ${esc(R.tName(x.b.teacher))}<span>${R.slotLabel(x.a.w, x.a.d, x.a.s)} ↔ ${R.slotLabel(x.b.w, x.b.d, x.b.s)}</span></div><div class="sol">${chip('echange', 'Accepté')}</div></div>`).join('')}</div>` : '<p class="muted">Aucun échange cette période.</p>'}
    </section>`;
  }

  /* ---------- RÉCAP ---------- */
  function vRecap() {
    const w = ui.recapW || Math.min(ui.week + (ui.week === R.NOW.week ? 1 : 0), R.WEEK_LAST);
    const txt = R.recap(w);
    return `<section class="card"><div class="cardhead"><h2>Récap de la ${weekLabel(w).toLowerCase()}</h2>
      <div class="seg small">${[R.WEEK_FIRST, R.WEEK_FIRST + 1, R.WEEK_FIRST + 2].map((x) => `<button aria-pressed="${x === w}" data-act="recapW" data-w="${x}">S${x}</button>`).join('')}</div></div>
      <p class="muted">Prêt à envoyer le mercredi : il se met à jour tout seul à chaque modification du fil.</p>
      <pre class="recap" id="recapTxt">${esc(txt)}</pre>
      <div class="inline"><button class="primary" data-act="copy">Copier le texte</button><button class="secondary" data-act="print">Imprimer</button></div></section>`;
  }

  /* ---------- RÉGLAGES ---------- */
  function vReglages() {
    return `<section class="card"><h2>Capacité des salles d'étude</h2>
      <p class="muted">Nombre maximum de classes accueillies en même temps. Valeurs à confirmer avec la vie scolaire.</p>
      ${R.ETUDES.map((e) => `<label class="field row-field"><span>${esc(e.id)}${e.levels ? ` <small class="muted">(${e.levels.map((l) => l + 'e').join(' et ')})</small>` : ''}</span><input type="number" min="1" max="9" data-input="cap" data-room="${esc(e.id)}" value="${R.etudeCap(e.id)}"></label>`).join('')}
      <h2>Règles des relais</h2>
      <ul class="plain"><li>Inscriptions : premier arrivé, premier servi, jusqu'à la veille à 17h.</li><li>Un prof qui a la classe peut reprendre le relais d'un collègue qui ne l'a pas ; le collègue est prévenu.</li><li>Pour un cours en groupe (langues, options), seuls les profs de la même matière et du même niveau sont prioritaires.</li><li>La vie scolaire peut tout modifier.</li></ul>
    </section>`;
  }

  /* ---------- MA SEMAINE (enseignant) ---------- */
  function cellProf(w, d, s) {
    const me = ui.me;
    if (!R.daySlots(d).includes(s)) return `<div class="c off"></div>`;
    const v = R.view(w);
    const abs = R.isAbsent(w, me, d, s);
    const mine = R.teacherSlot(w, me, d, s);
    const bl = R.baseT(me, d, s);
    const base = bl ? R.cellAt(w, bl.cls, d, s) : null;
    const past = R.isPast(w, d, s);
    if (abs) return `<div class="c st-atraiter ${past ? 'past' : ''}"><b>${base ? base.base.cls : ''}</b><span>${abs === 'accompagnement' ? 'Accompagnement' : 'Absent'}</span></div>`;
    if (mine) {
      const c = mine.cell;
      const tag = c.status === 'relais' ? 'Relais' : c.status === 'inversion' ? 'Inversion' : c.status === 'echange' ? 'Échange' : '';
      const req = R.state().roomReqs.find((r) => r.t === me && r.w === w && r.d === d && r.s === s && r.status === 'attente');
      return `<button class="c ${tag ? 'st-' + c.status : 'normal'} ${past ? 'past' : ''}" data-act="lesson" data-d="${d}" data-s="${s}" ${past ? 'disabled' : ''}>
        <b>${mine.cls}</b><span>${esc(c.room)}${c.roomChanged ? ' ✓' : ''}</span>${tag ? `<em>${tag}</em>` : ''}${req ? '<em>Salle demandée</em>' : ''}</button>`;
    }
    if (base && base.freed) return `<div class="c freed ${past ? 'past' : ''}"><b>${base.base.cls}</b><span>Libéré</span><em>${esc(base.event.title)}</em></div>`;
    if (base && base.exchange) return `<div class="c st-echange ${past ? 'past' : ''}"><b>${base.base.cls}</b><span>Échangé</span></div>`;
    if (base) return `<div class="c freed ${past ? 'past' : ''}"><b>${base.base.cls}</b><span>Déplacé</span></div>`;
    return `<div class="c empty-c"></div>`;
  }
  function vSemaine() {
    const w = ui.week;
    const t = T(ui.me);
    const notices = R.notifsFor(ui.me).filter((n) => !n.read).slice(0, 3);
    return `<section>
      <div class="cardhead"><h2 class="h">Mon emploi du temps réel · ${esc(t.name)}</h2><span class="muted">Touchez un cours pour proposer un échange ou demander une salle.</span></div>
      ${notices.length ? `<div class="notices">${notices.map((n) => `<div class="notice k-${n.kind}">${esc(n.text)}</div>`).join('')}</div>` : ''}
      <div class="grid" role="table" aria-label="Emploi du temps de la semaine">
        <div class="gh"></div>${R.DAYS.map((dn, d) => `<div class="gh ${w === R.NOW.week && d === R.NOW.day ? 'today' : ''}">${dn.slice(0, 3)} ${R.dayDate(w, d).getDate()}</div>`).join('')}
        ${R.SLOTS.map((s) => `<div class="gs">${s}</div>${[0, 1, 2, 3, 4].map((d) => cellProf(w, d, s)).join('')}`).join('')}
      </div>
      <div class="legend">${['relais', 'inversion', 'echange', 'atraiter'].map((k) => chip(k, k === 'atraiter' ? 'Absent / accompagnement' : ST[k])).join('')}<span class="chip freedchip">Libéré</span></div>
    </section>`;
  }
  function pLesson(d, s) {
    const w = ui.week, me = ui.me;
    const mine = R.teacherSlot(w, me, d, s);
    if (!mine) return '';
    const opts = R.findExchanges(me, w, d, s);
    const rooms = R.freeRooms(w, d, s);
    const sent = R.state().exchanges.filter((x) => x.a.teacher === me && x.a.w === w && x.a.d === d && x.a.s === s && x.status === 'propose');
    const showAll = ui.panelAll;
    return `<div class="phead"><div><h3>${mine.cls} · ${R.DAYS[d].toLowerCase()} ${R.fmtDate(w, d)} · ${s}</h3><p>${tm(d, s)} · ${esc(R.subjLabel(mine.cell.subj))} · salle ${esc(mine.cell.room)}</p></div><button class="icon" data-act="close" aria-label="Fermer">✕</button></div>
      <h4>Trouver un échange</h4>
      <p class="sub">Collègues qui ont la ${mine.cls}, libres à ce moment-là, et dont vous pouvez prendre l'heure, jusqu'aux prochaines vacances. L'accord du collègue suffit ; la vie scolaire est informée.</p>
      ${sent.length ? `<p class="notice k-echange">Proposition envoyée à ${sent.map((x) => esc(R.tName(x.b.teacher))).join(', ')}. En attente de réponse.</p>` : ''}
      ${opts.length ? `<ul class="opts">${(showAll ? opts : opts.slice(0, 6)).map((o, i) => `<li><div><strong>${esc(R.tName(o.who))}</strong> <span class="muted">${esc(R.subjLabel(o.subj))}</span><span>${o.w === w && o.d === d ? 'Le même jour : vous' : 'Vous'} prendriez son heure du <strong>${R.DAYS[o.d].toLowerCase()} ${R.fmtDate(o.w, o.d)} en ${o.s}</strong> (${tm(o.d, o.s)}).</span></div>
        <button class="secondary" data-act="propose" data-d="${d}" data-s="${s}" data-i="${i}">Proposer</button></li>`).join('')}</ul>
        ${opts.length > 6 ? `<button class="link" data-act="panelAll">${showAll ? 'Voir moins' : `Voir les ${opts.length - 6} autres possibilités`}</button>` : ''}`
      : '<p class="muted">Aucun échange possible avec cette classe d\'ici les vacances.</p>'}
      <h4>Demander une autre salle</h4>
      <p class="sub">La vie scolaire valide la demande ; vous êtes prévenu.</p>
      <div class="inline"><select data-input="roomPick" aria-label="Salle">${rooms.map((r) => `<option ${r === ui.roomPick ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select>
      <input data-input="roomWhy" placeholder="Pourquoi ? (facultatif)" value="${esc(ui.roomWhy || '')}"><button class="secondary" data-act="askRoom" data-d="${d}" data-s="${s}">Demander</button></div>`;
  }

  /* ---------- ÉCHANGES (enseignant) ---------- */
  function vEchanges() {
    const st = R.state();
    const recv = st.exchanges.filter((x) => x.b.teacher === ui.me);
    const sent = st.exchanges.filter((x) => x.a.teacher === ui.me);
    const line = (x, incoming) => {
      const other = incoming ? x.a.teacher : x.b.teacher;
      const give = incoming ? x.b : x.a, take = incoming ? x.a : x.b;
      return `<article class="xcard">
        <div class="xc-top"><strong>${esc(R.tName(other))}</strong><span class="muted">${esc(R.subjLabel(T(other).subj))} · ${x.a.cls}</span>${chip(x.status === 'accepte' ? 'relais' : x.status === 'refuse' ? 'atraiter' : 'ouvert', x.status === 'accepte' ? 'Accepté' : x.status === 'refuse' ? 'Refusé' : 'En attente')}</div>
        <div class="xc-swap"><div><small>Vous donnez</small><b>${R.DAYS_SHORT[give.d]} ${R.dayDate(give.w, give.d).getDate()} · ${give.s}</b><span>${tm(give.d, give.s)}</span></div><span class="arrow" aria-hidden="true">⇄</span><div><small>Vous prenez</small><b>${R.DAYS_SHORT[take.d]} ${R.dayDate(take.w, take.d).getDate()} · ${take.s}</b><span>${tm(take.d, take.s)}</span></div></div>
        ${x.status === 'propose' ? (incoming ? `<div class="inline"><button class="primary" data-act="answerX" data-id="${x.id}" data-ok="1">Accepter</button><button class="secondary" data-act="answerX" data-id="${x.id}" data-ok="0">Refuser</button></div>` : `<button class="link" data-act="cancelX" data-id="${x.id}">Annuler la proposition</button>`) : ''}
      </article>`;
    };
    return `<section><h2 class="h">Propositions reçues</h2>${recv.length ? recv.map((x) => line(x, true)).join('') : '<p class="muted">Aucune proposition reçue.</p>'}
      <h2 class="h">Vos propositions</h2>${sent.length ? sent.map((x) => line(x, false)).join('') : '<div class="empty"><p>Pour proposer un échange, touchez un de vos cours dans « Ma semaine ».</p><button class="secondary" data-act="tab" data-t="semaine">Ouvrir ma semaine</button></div>'}</section>`;
  }

  /* ---------- MA CLASSE (professeur principal) ---------- */
  function vClasse() {
    const pp = isPP();
    if (!pp) return '<p class="muted">Vous n\'êtes professeur principal d\'aucune classe.</p>';
    const cls = pp[0], w = ui.week;
    const sts = R.stats();
    const evs = R.state().events.filter((e) => e.stats && (e.kind === 'journee' || e.classes.includes(cls))).sort((a, b) => a.w - b.w || a.d - b.d);
    return `<section>
      <div class="cardhead"><h2 class="h">La ${cls} cette semaine</h2></div>
      <div class="grid" role="table">
        <div class="gh"></div>${R.DAYS.map((dn, d) => `<div class="gh">${dn.slice(0, 3)} ${R.dayDate(w, d).getDate()}</div>`).join('')}
        ${R.SLOTS.map((s) => `<div class="gs">${s}</div>${[0, 1, 2, 3, 4].map((d) => {
          if (!R.daySlots(d).includes(s)) return '<div class="c off"></div>';
          const c = R.cellAt(w, cls, d, s);
          if (!c) return '<div class="c empty-c"></div>';
          const status = c.status;
          const name = c.teacher ? R.tName(c.teacher) : '';
          return `<div class="c ${status === 'normal' ? 'normal' : 'st-' + status}"><b>${esc(R.SUBJ_SHORT[c.subj] || R.subjLabel(c.subj))}</b><span>${esc(name)}</span>${status !== 'normal' ? `<em>${ST[status]}${c.event ? ' · ' + esc(c.event.title).slice(0, 22) : ''}</em>` : ''}</div>`;
        }).join('')}`).join('')}
      </div>
      <div class="card tight"><h3>Heures de cours manquées depuis la rentrée (sorties et temps forts)</h3>
        <p class="bignum"><strong>${sts.perClass[cls].total} h</strong> <span class="muted">dont ${sts.perClass[cls].sortie} h en sortie</span></p>
        <ul class="plain">${evs.map((e) => `<li>${R.DAYS[e.d]} ${R.fmtDate(e.w, e.d)} · ${esc(e.title)} · ${e.slots.join('–')}</li>`).join('')}</ul></div>
    </section>`;
  }

  /* ---------- STATISTIQUES (direction) ---------- */
  function vStats() {
    const sts = R.stats();
    const max = Math.max(1, ...Object.values(sts.perClass).map((x) => x.total));
    const tot = Object.values(sts.perClass).reduce((a, x) => a + x.total, 0);
    const sel = ui.statClass;
    const subj = sel ? Object.entries(sts.bySubj[sel]).sort((a, b) => b[1] - a[1]) : [];
    return `<section>
      <div class="cardhead"><h2 class="h">Heures de cours manquées pour sorties et temps forts</h2><span class="muted">Depuis la rentrée, semaines à venir comprises · un créneau = 1 h · journées pédagogiques exclues</span></div>
      <p class="bignum"><strong>${tot} h</strong> <span class="muted">au total pour les ${R.CLASSES.length} classes, soit ${(tot / R.CLASSES.length).toFixed(1).replace('.', ',')} h par classe en moyenne</span></p>
      <div class="bars">${R.LEVELS.map(([lv, ll]) => `<div class="lvlgroup"><h3>${ll}</h3>${R.CLASSES.filter((c) => R.level(c) === lv).map((c) => {
        const x = sts.perClass[c];
        return `<button class="bar ${sel === c ? 'sel' : ''}" data-act="statClass" data-c="${c}" aria-label="${c} : ${x.total} heures">
          <span class="bl">${c}</span><span class="bt"><i class="b-sortie" style="width:${(x.sortie / max) * 100}%"></i><i class="b-tf" style="width:${(x.tempsfort / max) * 100}%"></i></span><span class="bv">${x.total} h</span></button>`;
      }).join('')}</div>`).join('')}</div>
      <div class="legend"><span class="chip st-sortie">Sorties</span><span class="chip st-tempsfort">Temps forts</span></div>
      ${sel ? `<div class="card tight"><h3>${sel} : détail par discipline</h3><p class="note">Visible par la direction uniquement.</p>
        ${subj.length ? `<table class="tbl"><thead><tr><th>Discipline</th><th>Heures manquées</th></tr></thead><tbody>${subj.map(([k, v]) => `<tr><td>${esc(R.subjLabel(k))}</td><td>${v} h</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Aucune heure manquée.</p>'}</div>` : '<p class="muted">Touchez une classe pour voir le détail par discipline.</p>'}
    </section>`;
  }

  /* ---------- ÉCRAN SALLE DES PROFS ---------- */
  function vEcran() {
    const st = R.state();
    const w = R.NOW.week, d = R.NOW.day;
    const lines = st.lines.filter((l) => l.w === w && l.d === d).sort((a, b) => R.SLOTS.indexOf(a.s) - R.SLOTS.indexOf(b.s));
    const evs = st.events.filter((e) => e.w === w && e.d === d);
    const nextD = d + 1 <= 4 ? d + 1 : null;
    const openTomorrow = nextD != null ? st.lines.filter((l) => l.w === w && l.d === nextD && l.sol && l.sol.kind === 'relais' && !l.sol.who) : [];
    const cur = R.daySlots(d).find((s) => { const [a, b] = R.slotTime(d, s).map(R.toMin); return R.NOW.min >= a && R.NOW.min < b; });
    const hh = `${String(Math.floor(R.NOW.min / 60)).padStart(2, '0')}:${String(R.NOW.min % 60).padStart(2, '0')}`;
    return `<div class="board">
      <div class="bhead"><div><span class="bday">${R.DAYS[d]} ${R.fmtDate(w, d)}</span><span class="bsub">Salle des profs</span></div><div class="clock">${hh}</div></div>
      ${evs.length ? `<div class="bevents">${evs.map((e) => `<span>★ ${esc(e.title)}${e.classes.length ? ' · ' + e.classes.join(', ') : ''} · ${e.slots.join('–')}</span>`).join('')}</div>` : ''}
      <div class="btable">
        <div class="br bh"><span>Heure</span><span>Classe</span><span>Absent</span><span>Remplacement</span><span>Salle</span></div>
        ${lines.map((l) => {
          const status = lineStatus(l);
          const s = l.sol;
          const what = !s ? 'À définir' : s.kind === 'relais' ? (s.who ? R.tName(s.who) : 'Relais ouvert') : s.kind === 'inversion' ? `${R.tName(s.who)} (inversion)` : s.kind === 'etude' ? 'Étude' : 'Self';
          const room = s && s.kind === 'etude' ? s.room : s && s.kind === 'self' ? 'Self' : s && s.room ? s.room : l.room;
          const past = R.isPast(l.w, l.d, l.s) && l.s !== cur;
          return `<div class="br ${past ? 'gone' : ''} ${l.s === cur ? 'now' : ''} bs-${status}"><span><b>${R.slotTime(l.d, l.s)[0].replace(':', 'h')}</b> ${l.s}</span><span class="bc">${l.cls}</span><span>${esc(R.tName(l.teacher))}</span><span class="bw">${esc(what)}</span><span>${esc(room)}</span></div>`;
        }).join('') || '<div class="br"><span>Aucune absence aujourd\'hui.</span></div>'}
      </div>
      ${openTomorrow.length ? `<div class="btomorrow"><b>Demain, relais ouverts :</b> ${openTomorrow.map((l) => `${l.cls} en ${l.s}`).join(' · ')}. Inscriptions dans Relais avant 17h.</div>` : ''}
    </div>`;
  }

  /* ---------- Notifications ---------- */
  function pNotifs() {
    const who = meIdent();
    const list = R.notifsFor(who);
    return `<div class="phead"><div><h3>Notifications</h3><p>Dans la vraie version : message Teams ou mail.</p></div><button class="icon" data-act="close" aria-label="Fermer">✕</button></div>
      ${list.length ? `<ul class="nlist">${list.map((n) => `<li class="k-${n.kind} ${n.read ? '' : 'unread'}"><p>${esc(n.text)}</p><small>${esc(R.fmtAbs(n.at))}</small></li>`).join('')}</ul>` : '<p class="muted">Rien de nouveau.</p>'}`;
  }

  /* ---------- Rendu ---------- */
  function main() {
    if (ui.role === 'ecran') return vEcran();
    const t = ui.tab;
    if (ui.role === 'vs') return { fil: vFil, saisir: vSaisir, relais: vRelaisVS, tf: vTF, demandes: vDemandes, recap: vRecap, reglages: vReglages }[t]();
    if (ui.role === 'prof') return { semaine: vSemaine, relais: vRelaisProf, echanges: vEchanges, classe: vClasse, fil: vFil }[t]();
    return { fil: vFil, stats: vStats }[t]();
  }
  function panel() {
    if (!ui.panel) return '';
    const [k, a, b] = ui.panel;
    const body = k === 'line' ? pLine(a) : k === 'lesson' ? pLesson(+a, b) : k === 'notifs' ? pNotifs() : '';
    return `<div class="scrim" data-act="close"></div><aside class="panel" role="dialog" aria-modal="true">${body}</aside>`;
  }
  function render() {
    const tabs = TABS[ui.role].map(([k]) => k);
    if (ui.role !== 'ecran' && !tabs.includes(ui.tab)) ui.tab = tabs[0];
    if (ui.tab === 'classe' && !isPP()) ui.tab = tabs[0];
    const focus = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.input;
    const caret = focus && document.activeElement.selectionStart;
    const scrollP = document.querySelector('.panel') ? document.querySelector('.panel').scrollTop : 0;
    $root.className = 'role-' + ui.role;
    $root.innerHTML = header() + `<main class="main">${main()}</main>` + panel() + (toastMsg ? `<div class="toast" role="status">${esc(toastMsg)}</div>` : '');
    if (focus) {
      const el = $root.querySelector(`[data-input="${focus}"]`);
      if (el) { el.focus(); if (caret != null && el.setSelectionRange && el.type !== 'number') try { el.setSelectionRange(caret, caret); } catch (e) {} }
    }
    const p = document.querySelector('.panel'); if (p) p.scrollTop = scrollP;
    saveUi();
  }
  R.onChange(render);

  /* ---------- Actions ---------- */
  document.addEventListener('click', (ev) => {
    const a = ev.target.closest('[data-act]');
    if (!a || a.disabled) return;
    const d = a.dataset;
    const st = R.state();
    switch (d.act) {
      case 'role': ui.role = d.r; ui.tab = TABS[d.r][0] ? TABS[d.r][0][0] : ''; ui.panel = null; break;
      case 'tab': ui.tab = d.t; ui.panel = null; window.scrollTo(0, 0); break;
      case 'week': ui.week = Math.max(R.WEEK_FIRST, Math.min(R.WEEK_LAST, ui.week + +d.d)); ui.created = null; break;
      case 'reset': if (confirmReset()) { R.reset(); ui.me = R.state().me; ui.created = null; ui.tf = null; ui.sentence = ''; toast('Démo réinitialisée.'); } break;
      case 'notifs': ui.panel = ['notifs']; render(); R.markRead(meIdent()); return;
      case 'close': ui.panel = null; ui.panelAll = false; break;
      case 'level': ui.level = d.l; break;
      case 'line': ui.panel = ['line', d.id]; ui.panelAll = false; break;
      case 'panelAll': ui.panelAll = !ui.panelAll; break;
      case 'sol': R.setSolution(d.id, d.k === 'etude' ? { kind: 'etude', room: d.room } : { kind: d.k }); toast(d.k === 'self' ? 'Self choisi.' : `Étude ${d.room} choisie.`); return;
      case 'solRelais': { const l = st.lines.find((x) => x.id === d.id); R.setSolution(d.id, { kind: 'relais', who: d.w, room: l.room, at: R.nowAbs(), prio: R.teachesClass(d.w, l.cls) }); toast(`Relais confié à ${R.tName(d.w)}, qui est prévenu.`); return; }
      case 'solInv': { const l = st.lines.find((x) => x.id === d.id); const o = R.suggest(l).inversions[+d.i]; R.setSolution(d.id, { kind: 'inversion', who: o.who, subj: o.subj, room: o.room, from: o.from }); toast(`Inversion avec ${R.tName(o.who)}, qui est prévenu${R.pron(o.who) === 'il' ? '' : 'e'}.`); return; }
      case 'open': R.openRelais(d.id); toast('Relais ouvert. Les profs de la classe sont prévenus.'); return;
      case 'saveComment': { const el = $root.querySelector(`[data-input="comment"][data-id="${d.id}"]`); const l = st.lines.find((x) => x.id === d.id); l.comment = el.value; R.setSolution(d.id, l.sol, el.value); toast('Commentaire enregistré.'); return; }
      case 'delLine': R.state().lines = st.lines.filter((l) => l.id !== d.id && l.refId !== d.id); ui.panel = null; R.touch(); toast('Créneau retiré du fil.'); return;
      case 'delEvent': if (confirm('Supprimer ce temps fort ? Les créneaux d\'accompagnement liés seront retirés.')) { d.id.split(',').forEach((x) => R.deleteEvent(x)); toast('Temps fort supprimé.'); } return;
      case 'example': ui.sentence = d.v; ui.pickT = null; break;
      case 'pickT': ui.pickT = d.t; break;
      case 'createAbs': {
        const p = ui.pending; if (!p) return;
        let created = [];
        p.items.forEach((it) => { created = created.concat(R.createAbsence(p.t, ui.week, it.d, it.slots).map((l) => l.id)); });
        ui.created = created; ui.sentence = ''; ui.pickT = null; ui.pending = null;
        toast(`${created.length} créneau${created.length > 1 ? 'x' : ''} ajouté${created.length > 1 ? 's' : ''} au fil.`);
        break;
      }
      case 'take': { const r = R.takeRelais(d.id, ui.me); toast(r.ok ? (r.action === 'reprendre' ? 'Relais repris. Votre collègue est prévenu.' : 'C\'est noté : vous prenez le relais. La vie scolaire est informée.') : r.msg); return; }
      case 'withdraw': R.withdrawRelais(d.id, ui.me); toast('Désistement enregistré. Le relais est de nouveau ouvert.'); return;
      case 'tfKind': ui.tf.kind = d.k; ui.tf.stats = d.k === 'sortie' || d.k === 'tempsfort'; if (d.k === 'journee') ui.tf.slots = R.daySlots(ui.tf.d); break;
      case 'tfDay': ui.tf.d = +d.d; ui.tf.slots = ui.tf.slots.filter((s) => R.daySlots(+d.d).includes(s)); break;
      case 'tfSlot': { const i = ui.tf.slots.indexOf(d.s); i >= 0 ? ui.tf.slots.splice(i, 1) : ui.tf.slots.push(d.s); ui.tf.slots.sort((a, b) => R.SLOTS.indexOf(a) - R.SLOTS.indexOf(b)); ui.tf.from = ''; ui.tf.to = ''; break; }
      case 'tfClass': { const i = ui.tf.classes.indexOf(d.c); i >= 0 ? ui.tf.classes.splice(i, 1) : ui.tf.classes.push(d.c); break; }
      case 'tfLevel': { const cls = R.CLASSES.filter((c) => R.level(c) === d.l); const all = cls.every((c) => ui.tf.classes.includes(c)); ui.tf.classes = all ? ui.tf.classes.filter((c) => !cls.includes(c)) : [...new Set(ui.tf.classes.concat(cls))]; break; }
      case 'tfRmAcc': ui.tf.accomp = ui.tf.accomp.filter((t) => t !== d.t); break;
      case 'tfCreate': { const f = ui.tf; R.createEvent({ w: ui.week, d: f.d, title: f.title.trim(), kind: f.kind, classes: f.kind === 'journee' ? [] : f.classes.slice(), slots: f.slots.slice(), accomp: f.accomp.slice(), stats: f.stats, room: f.room }); ui.tf = null; toast('Ajouté au fil. Les profs libérés sont prévenus.'); return; }
      case 'room': R.answerRoom(d.id, d.ok === '1'); toast(d.ok === '1' ? 'Salle validée. Le collègue est prévenu.' : 'Demande refusée. Le collègue est prévenu.'); return;
      case 'recapW': ui.recapW = +d.w; break;
      case 'copy': { const txt = document.getElementById('recapTxt').textContent; (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast('Récap copié.'), () => toast('Copie impossible ici : sélectionnez le texte à la main.')); return; }
      case 'print': window.print(); return;
      case 'lesson': ui.panel = ['lesson', d.d, d.s]; ui.panelAll = false; ui.roomPick = null; break;
      case 'propose': { const opts = R.findExchanges(ui.me, ui.week, +d.d, d.s); const o = opts[+d.i]; R.proposeExchange(ui.me, ui.week, +d.d, d.s, o); toast(`Proposition envoyée à ${R.tName(o.who)}.`); return; }
      case 'askRoom': { const room = ui.roomPick || R.freeRooms(ui.week, +d.d, d.s)[0]; R.requestRoom(ui.me, ui.week, +d.d, d.s, room, ui.roomWhy); ui.roomWhy = ''; toast(`Demande de la salle ${room} envoyée à la vie scolaire.`); return; }
      case 'answerX': R.answerExchange(d.id, d.ok === '1'); toast(d.ok === '1' ? 'Échange accepté. Votre collègue et la vie scolaire sont prévenus.' : 'Échange refusé. Votre collègue est prévenu.'); return;
      case 'cancelX': R.cancelExchange(d.id); toast('Proposition annulée.'); return;
      case 'statClass': ui.statClass = ui.statClass === d.c ? null : d.c; break;
      default: return;
    }
    render();
  });
  function confirmReset() { return confirm('Revenir aux données de démonstration de départ ?'); }
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && ui.panel) { ui.panel = null; render(); }
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches('.row.click')) { ev.preventDefault(); ev.target.click(); }
    if (ev.key === 'Enter' && ev.target.dataset.input === 'sentence') { const b = $root.querySelector('[data-act="createAbs"]'); if (b) b.click(); }
  });
  document.addEventListener('input', (ev) => {
    const el = ev.target, k = el.dataset && el.dataset.input;
    if (!k) return;
    if (k === 'q') { ui.q = el.value; render(); }
    else if (k === 'sentence') { ui.sentence = el.value; ui.pickT = null; render(); }
    else if (k.startsWith('tf.') && el.type !== 'checkbox' && el.tagName !== 'SELECT') {
      const f = k.slice(3); ui.tf[f] = el.value;
      if ((f === 'from' || f === 'to') && ui.tf.from && ui.tf.to) ui.tf.slots = R.slotsForRange(ui.tf.d, ui.tf.from, ui.tf.to);
      if (f !== 'title' && f !== 'room') render(); else { const b = $root.querySelector('[data-act="tfCreate"]'); if (b) b.disabled = !(ui.tf.title.trim() && ui.tf.slots.length && (ui.tf.kind === 'journee' || ui.tf.kind === 'info' || ui.tf.classes.length)); }
    } else if (k === 'roomWhy') ui.roomWhy = el.value;
  });
  document.addEventListener('change', (ev) => {
    const el = ev.target, k = el.dataset && el.dataset.input;
    if (!k) return;
    if (k === 'me') { ui.me = el.value; ui.panel = null; }
    else if (k === 'todo') ui.todo = el.checked;
    else if (k === 'tf.stats') ui.tf.stats = el.checked;
    else if (k === 'tf.addAccomp') { if (el.value) ui.tf.accomp.push(el.value); }
    else if (k === 'cap') { R.state().settings.cap[el.dataset.room] = Math.max(1, +el.value || 1); R.touch(); toast('Capacité enregistrée.'); return; }
    else if (k === 'roomPick') { ui.roomPick = el.value; return; }
    else return;
    render();
  });

  render();
})();
