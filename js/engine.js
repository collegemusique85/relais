/* Relais — moteur : état, calculs dérivés et règles métier.
   L'état est rangé derrière un « magasin » (store) : ici le navigateur (démo),
   demain une liste SharePoint ou une base Supabase, sans changer les règles. */
'use strict';
(function () {
  const R = window.R;
  const S = (R.school = R.buildSchool());
  const T = S.tById;

  /* ---------- Index de l'emploi du temps de base ---------- */
  const baseAt = {};               // cls|d|s -> leçon
  const teaches = {};              // t -> Set(classes)
  S.lessons.forEach((l) => {
    baseAt[l.cls + '|' + l.day + '|' + l.slot] = l;
    (teaches[l.teacher] = teaches[l.teacher] || new Set()).add(l.cls);
  });
  const baseT = {};
  S.lessons.forEach((l) => (baseT[l.teacher + '|' + l.day + '|' + l.slot] = l));
  R.baseAt = (cls, d, s) => baseAt[cls + '|' + d + '|' + s];
  R.baseT = (t, d, s) => baseT[t + '|' + d + '|' + s];
  R.teachesClass = (t, cls) => !!(teaches[t] && teaches[t].has(cls));
  R.tName = (id) => (T[id] ? T[id].name : R.VIE_SCOLAIRE.concat([R.DIRECTION]).find((p) => p.id === id)?.name || '—');
  R.subjLabel = (k) => R.SUBJECTS[k] || k;
  R.pron = (id) => (T[id] && T[id].civ === 'M.' ? 'il' : 'elle');

  /* ---------- Temps ---------- */
  const abs = (w, d, min) => ((w - 45) * 7 + d) * 1440 + min;
  R.nowAbs = () => abs(R.NOW.week, R.NOW.day, R.NOW.min);
  R.slotAbs = (w, d, s) => abs(w, d, R.toMin(R.slotTime(d, s)[0]));
  R.deadlineAbs = (w, d) => abs(w, d, 0) - 7 * 60;           // la veille à 17 h
  R.isPast = (w, d, s) => R.slotAbs(w, d, s) <= R.nowAbs();
  R.fmtAbs = (a) => {
    const day = Math.floor(a / 1440), min = a % 1440;
    const w = 45 + Math.floor(day / 7), d = day % 7;
    const hh = String(Math.floor(min / 60)).padStart(2, '0'), mm = String(min % 60).padStart(2, '0');
    const dn = d < 5 ? R.DAYS[d].toLowerCase() : d === 5 ? 'samedi' : 'dimanche';
    return `${dn} ${R.dayDate(w, 0).getDate() + d} à ${hh}h${mm}`;
  };

  /* ---------- Magasin (démo : stockage du navigateur) ---------- */
  const KEY = 'relais-demo-v3';
  let st;
  const listeners = [];
  const cache = {};
  function save() {
    Object.keys(cache).forEach((k) => delete cache[k]);
    try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* navigation privée : on garde en mémoire */ }
    listeners.forEach((f) => f());
  }
  R.onChange = (f) => listeners.push(f);
  R.touch = () => save();
  R.state = () => st;
  const id = (p) => p + ++st.seq;

  /* ---------- Vue effective d'une semaine ---------- */
  function view(w) {
    if (cache[w]) return cache[w];
    const cell = {}, tAt = {}, absent = {}, roomUse = {};
    const K = (a, d, s) => a + '|' + d + '|' + s;
    S.lessons.forEach((l) => {
      cell[K(l.cls, l.day, l.slot)] = { base: l, teacher: l.teacher, subj: l.subj, room: l.room, status: 'normal' };
    });
    st.exchanges.filter((x) => x.status === 'accepte').forEach((x) => {
      [[x.a, x.b], [x.b, x.a]].forEach(([me, other]) => {
        if (me.w !== w) return;
        const c = cell[K(me.cls, me.d, me.s)];
        if (c) Object.assign(c, { teacher: other.teacher, subj: other.subj, room: other.room, status: 'echange', exchange: x });
      });
    });
    st.roomReqs.filter((r) => r.status === 'valide' && r.w === w).forEach((r) => {
      const c = cell[K(r.cls, r.d, r.s)];
      if (c) { c.room = r.room; c.roomChanged = true; }
    });
    st.events.filter((e) => e.w === w).forEach((e) => {
      const classes = e.kind === 'journee' ? R.CLASSES : e.classes;
      e.slots.forEach((s) => {
        classes.forEach((cls) => {
          const c = cell[K(cls, e.d, s)];
          if (c && e.kind !== 'info') { c.status = e.kind; c.event = e; c.freed = c.teacher; }
        });
        (e.accomp || []).forEach((t) => (absent[K(t, e.d, s)] = 'accompagnement'));
      });
    });
    st.absences.filter((a) => a.w === w).forEach((a) => a.slots.forEach((s) => (absent[K(a.teacher, a.d, s)] = 'absence')));
    st.lines.filter((l) => l.w === w).forEach((l) => {
      const c = cell[K(l.cls, l.d, l.s)] || (cell[K(l.cls, l.d, l.s)] = { base: null, subj: l.subj, room: l.room });
      c.line = l;
      const sol = l.sol;
      if (!sol) Object.assign(c, { status: 'atraiter', teacher: null });
      else if (sol.kind === 'relais') Object.assign(c, sol.who ? { status: 'relais', teacher: sol.who } : { status: 'ouvert', teacher: null });
      else if (sol.kind === 'inversion') Object.assign(c, { status: 'inversion', teacher: sol.who, subj: sol.subj, room: sol.room || c.room });
      else if (sol.kind === 'etude') Object.assign(c, { status: 'etude', teacher: null, room: sol.room });
      else if (sol.kind === 'self') Object.assign(c, { status: 'self', teacher: null, room: 'Self' });
    });
    Object.entries(cell).forEach(([k, c]) => {
      const [cls, d, s] = k.split('|');
      if (c.room) (roomUse[K(c.room, d, s)] = roomUse[K(c.room, d, s)] || []).push(cls);
      if (c.teacher && ['normal', 'echange', 'relais', 'inversion'].includes(c.status))
        (tAt[K(c.teacher, d, s)] = tAt[K(c.teacher, d, s)] || []).push({ cls, cell: c });
    });
    return (cache[w] = { cell, tAt, absent, roomUse, K });
  }
  R.view = view;
  R.cellAt = (w, cls, d, s) => view(w).cell[cls + '|' + d + '|' + s];
  R.teacherSlot = (w, t, d, s) => (view(w).tAt[t + '|' + d + '|' + s] || [])[0];
  R.isAbsent = (w, t, d, s) => view(w).absent[t + '|' + d + '|' + s];
  R.freeAt = (t, w, d, s) => R.daySlots(d).includes(s) && !R.isAbsent(w, t, d, s) && !R.teacherSlot(w, t, d, s);
  R.roomFree = (w, room, d, s) => !(view(w).roomUse[room + '|' + d + '|' + s] || []).length;
  R.etudeLoad = (w, room, d, s) => (view(w).roomUse[room + '|' + d + '|' + s] || []).length;
  R.etudeCap = (room) => (st.settings.cap[room] != null ? st.settings.cap[room] : (R.ETUDES.find((e) => e.id === room) || {}).cap || 1);
  R.presence = (t, w, d, s) => {
    const day = R.daySlots(d), i = day.indexOf(s);
    const has = (x) => !!R.teacherSlot(w, t, d, x);
    const before = day.slice(0, i).some(has), after = day.slice(i + 1).some(has);
    return before && after ? 'entre deux cours' : before || after ? 'présent ce jour' : null;
  };

  /* ---------- Notifications (dans la vraie version : Teams ou mail via Power Automate) ---------- */
  function notify(to, text, kind) {
    st.notifs.unshift({ id: id('n'), to, at: R.nowAbs(), text, kind: kind || 'info', read: false });
  }
  R.notifsFor = (who) => st.notifs.filter((n) => n.to === who || (who.startsWith('vs') && n.to === 'vs'));
  R.markRead = (who) => { R.notifsFor(who).forEach((n) => (n.read = true)); save(); };

  const slotLabel = (w, d, s) => `${R.DAYS[d].toLowerCase()} ${R.dayDate(w, d).getDate()} en ${s}`;
  R.slotLabel = slotLabel;

  /* ---------- Absences ---------- */
  R.lessonsOf = (t, w, d, slots) => {
    const out = [];
    slots.forEach((s) => { const x = R.teacherSlot(w, t, d, s); if (x) out.push({ cls: x.cls, d, s, subj: x.cell.subj, room: x.cell.room }); });
    return out;
  };
  R.createAbsence = (t, w, d, slots, opts) => {
    opts = opts || {};
    const lessons = R.lessonsOf(t, w, d, slots);
    const a = { id: id('a'), w, d, teacher: t, slots: slots.slice(), at: R.nowAbs() };
    st.absences.push(a);
    const lines = lessons.map((x) => ({ id: id('l'), w, d, s: x.s, cls: x.cls, subj: x.subj, teacher: t, room: x.room,
      reason: opts.reason || 'absence', refId: opts.refId || a.id, sol: null, comment: '' }));
    st.lines.push(...lines);
    if (!opts.silent) save();
    return lines;
  };
  R.deleteAbsence = (aid) => {
    const ls = st.lines.filter((l) => l.refId === aid).map((l) => l.id);
    st.lines = st.lines.filter((l) => !ls.includes(l.id) && !ls.includes(l.refId));
    st.absences = st.absences.filter((a) => a.id !== aid);
    save();
  };

  /* ---------- Solutions proposées pour un créneau ---------- */
  R.suggest = (line) => {
    const { w, d, s, cls, teacher } = line;
    const out = { inversions: [], self: null, relais: [], etudes: [] };
    // Inversions : un prof de la classe qui la voit plus tard et qui est libre maintenant
    const daysOrder = [d, ...[0, 1, 2, 3, 4].filter((x) => x > d)];
    daysOrder.forEach((d2) => {
      R.daySlots(d2).forEach((s2) => {
        if (d2 === d && R.SLOTS.indexOf(s2) <= R.SLOTS.indexOf(s)) return;
        const c = R.cellAt(w, cls, d2, s2);
        if (!c || !c.teacher || !['normal', 'echange'].includes(c.status) || c.teacher === teacher) return;
        if (!R.freeAt(c.teacher, w, d, s)) return;
        const day2 = R.daySlots(d2);
        const fullSwap = R.freeAt(teacher, w, d2, s2);
        const hole = s2 === 'M4' ? 'le trou passe en M4 : Self possible'
          : s2 === day2[day2.length - 1] ? 'le trou passe en fin de journée' : null;
        out.inversions.push({ who: c.teacher, subj: c.subj, room: c.room, from: { d: d2, s: s2 }, sameDay: d2 === d, fullSwap, hole,
          score: (d2 === d ? 10 : 0) + (fullSwap ? 8 : 0) + (hole ? 4 : 0) - R.SLOTS.indexOf(s2) * 0.1 - d2 });
      });
    });
    out.inversions.sort((a, b) => b.score - a.score);
    out.inversions = out.inversions.slice(0, 4);
    if (s === 'M4') out.self = true;
    // Relais : profs libres, ceux qui ont la classe d'abord
    S.teachers.forEach((t) => {
      if (t.id === teacher || !R.freeAt(t.id, w, d, s)) return;
      const prio = R.teachesClass(t.id, cls);
      const pres = R.presence(t.id, w, d, s);
      out.relais.push({ who: t.id, prio, pres, score: (prio ? 10 : 0) + (pres === 'entre deux cours' ? 3 : pres ? 2 : 0) });
    });
    out.relais.sort((a, b) => b.score - a.score || R.tName(a.who).localeCompare(R.tName(b.who)));
    // Études avec occupation en temps réel
    R.ETUDES.forEach((e) => {
      if (e.levels && !e.levels.includes(R.level(cls))) return;
      out.etudes.push({ room: e.id, load: R.etudeLoad(w, e.id, d, s), cap: R.etudeCap(e.id) });
    });
    return out;
  };

  /* ---------- Choisir une solution (vie scolaire) ---------- */
  function dropDependents(line) {
    const dep = st.lines.filter((l) => l.reason === 'inversion' && l.refId === line.id).map((l) => l.id);
    st.lines = st.lines.filter((l) => !dep.includes(l.id));
  }
  R.setSolution = (lineId, sol, comment) => {
    const line = st.lines.find((l) => l.id === lineId);
    if (!line) return;
    const prev = line.sol;
    if (prev && prev.kind === 'inversion') dropDependents(line);
    if (prev && prev.kind === 'relais' && prev.who && (!sol || sol.who !== prev.who))
      notify(prev.who, `La vie scolaire a modifié le relais de la ${line.cls} (${slotLabel(line.w, line.d, line.s)}) : vous n'êtes plus attendu.`, 'warn');
    line.sol = sol;
    if (comment != null) line.comment = comment;
    if (sol && sol.kind === 'inversion') {
      const { d: d2, s: s2 } = sol.from;
      const swap = R.freeAt(line.teacher, line.w, d2, s2);
      st.lines.push({ id: id('l'), w: line.w, d: d2, s: s2, cls: line.cls, subj: sol.subj, teacher: sol.who, room: sol.room,
        reason: 'inversion', refId: line.id, comment: '',
        sol: swap ? { kind: 'inversion', who: line.teacher, subj: line.subj, room: line.room } : (s2 === 'M4' ? { kind: 'self' } : null) });
      notify(sol.who, `Inversion : vous prenez la ${line.cls} ${slotLabel(line.w, line.d, line.s)} au lieu de ${slotLabel(line.w, d2, s2)}.`, 'ok');
    }
    if (sol && sol.kind === 'relais' && sol.who && (!prev || prev.who !== sol.who))
      notify(sol.who, `La vie scolaire vous a confié le relais de la ${line.cls}, ${slotLabel(line.w, line.d, line.s)} (salle ${sol.room || line.room}).`, 'ok');
    save();
  };
  R.openRelais = (lineId) => {
    const line = st.lines.find((l) => l.id === lineId);
    if (!line) return;
    R.setSolution(lineId, { kind: 'relais', who: null, room: line.room });
    S.teachers.filter((t) => R.teachesClass(t.id, line.cls) && R.freeAt(t.id, line.w, line.d, line.s)).forEach((t) =>
      notify(t.id, `Relais ouvert : ${line.cls}, ${slotLabel(line.w, line.d, line.s)}. Vous avez cette classe : vous êtes prioritaire.`, 'relais'));
    save();
  };

  /* ---------- Relais : prendre, reprendre, se désister (l'« arbitre ») ---------- */
  R.relaisState = (line, t) => {
    const sol = line.sol;
    if (!sol || sol.kind !== 'relais') return { can: false };
    const open = R.nowAbs() < R.deadlineAbs(line.w, line.d);
    const prio = R.teachesClass(t, line.cls);
    const free = R.freeAt(t, line.w, line.d, line.s) || sol.who === t;
    if (sol.who === t) return { mine: true, can: open, open, prio };
    if (!open) return { can: false, closed: true, prio };
    if (!free) return { can: false, busy: true, prio };
    if (!sol.who) return { can: true, action: 'prendre', prio };
    const holderPrio = R.teachesClass(sol.who, line.cls);
    if (prio && !holderPrio) return { can: true, action: 'reprendre', prio, holder: sol.who };
    return { can: false, taken: true, prio, holder: sol.who };
  };
  R.takeRelais = (lineId, t) => {
    const line = st.lines.find((l) => l.id === lineId);
    const rs = R.relaisState(line, t);
    if (!rs.can) return { ok: false, msg: rs.closed ? 'Les inscriptions sont closes (la veille à 17h).' : 'Ce relais est déjà pris.' };
    const prev = line.sol.who;
    line.sol = Object.assign({}, line.sol, { who: t, at: R.nowAbs(), prio: rs.prio });
    if (rs.action === 'reprendre') {
      notify(prev, `${R.tName(t)}, qui a la ${line.cls}, a repris le relais du ${slotLabel(line.w, line.d, line.s)}. Vous n'êtes plus attendu sur ce créneau. Merci pour votre proposition !`, 'warn');
      notify('vs', `${R.tName(t)} (prioritaire) a repris le relais de ${R.tName(prev)} : ${line.cls}, ${slotLabel(line.w, line.d, line.s)}.`, 'info');
    } else {
      notify('vs', `${R.tName(t)} prend le relais : ${line.cls}, ${slotLabel(line.w, line.d, line.s)}.`, 'info');
    }
    save();
    return { ok: true, action: rs.action };
  };
  R.withdrawRelais = (lineId, t) => {
    const line = st.lines.find((l) => l.id === lineId);
    if (!line || !line.sol || line.sol.who !== t) return;
    if (R.nowAbs() >= R.deadlineAbs(line.w, line.d)) return;
    line.sol = { kind: 'relais', who: null, room: line.room };
    notify('vs', `${R.tName(t)} s'est désisté du relais : ${line.cls}, ${slotLabel(line.w, line.d, line.s)}. Le créneau est de nouveau ouvert.`, 'warn');
    save();
  };

  /* ---------- Temps forts et sorties ---------- */
  R.slotsForRange = (d, from, to) => {
    const a = R.toMin(from), b = R.toMin(to);
    return R.daySlots(d).filter((s) => { const [x, y] = R.slotTime(d, s).map(R.toMin); return x < b && y > a; });
  };
  R.previewEvent = (ev) => {
    const classes = ev.kind === 'journee' ? R.CLASSES : ev.classes;
    const freed = [], cover = [];
    if (ev.kind !== 'info') ev.slots.forEach((s) => classes.forEach((cls) => {
      const c = R.cellAt(ev.w, cls, ev.d, s);
      if (c && c.teacher && !(ev.accomp || []).includes(c.teacher)) freed.push({ t: c.teacher, cls, s });
    }));
    (ev.accomp || []).forEach((t) => ev.slots.forEach((s) => {
      const x = R.teacherSlot(ev.w, t, ev.d, s);
      if (x && !classes.includes(x.cls)) cover.push({ t, cls: x.cls, s });
    }));
    let hours = 0;
    if (ev.kind !== 'info') ev.slots.forEach((s) => classes.forEach((cls) => { if (R.baseAt(cls, ev.d, s)) hours++; }));
    return { freed, cover, hours };
  };
  R.createEvent = (ev, opts) => {
    opts = opts || {};
    const pv = R.previewEvent(ev);
    const e = Object.assign({ id: id('e'), at: R.nowAbs() }, ev);
    st.events.push(e);
    (e.accomp || []).forEach((t) => {
      const slots = e.slots.filter((s) => { const x = R.teacherSlot(e.w, t, e.d, s); return x && !(e.kind === 'journee' ? R.CLASSES : e.classes).includes(x.cls); });
      if (slots.length) R.createAbsence(t, e.w, e.d, slots, { reason: 'accompagnement', refId: e.id, silent: true });
    });
    if (!opts.silent) {
      const byT = {};
      pv.freed.forEach((f) => (byT[f.t] = byT[f.t] || []).push(f));
      Object.entries(byT).forEach(([t, list]) => notify(t,
        `${e.title} : votre cours avec ${list.map((f) => `la ${f.cls} en ${f.s}`).join(', ')} (${R.DAYS[e.d].toLowerCase()} ${R.dayDate(e.w, e.d).getDate()}) n'a pas lieu. Vous apparaissez comme disponible pour un relais.`, 'info'));
      save();
    }
    return e;
  };
  R.deleteEvent = (eid) => {
    const ls = st.lines.filter((l) => l.refId === eid).map((l) => l.id);
    st.lines = st.lines.filter((l) => !ls.includes(l.id) && !ls.includes(l.refId));
    st.absences = st.absences.filter((a) => a.refId !== eid);
    st.events = st.events.filter((e) => e.id !== eid);
    save();
  };

  /* ---------- Trouver un échange ---------- */
  R.findExchanges = (t, w, d, s) => {
    const mine = R.teacherSlot(w, t, d, s);
    if (!mine) return [];
    const cls = mine.cls, out = [];
    for (let w2 = w; w2 <= R.WEEK_LAST; w2++) {
      for (let d2 = 0; d2 < 5; d2++) R.daySlots(d2).forEach((s2) => {
        if (w2 === w && d2 === d && s2 === s) return;
        if (R.slotAbs(w2, d2, s2) <= R.nowAbs()) return;
        const c = R.cellAt(w2, cls, d2, s2);
        if (!c || !c.teacher || c.teacher === t || !['normal'].includes(c.status)) return;
        if (!R.freeAt(c.teacher, w, d, s)) return;
        if (!R.freeAt(t, w2, d2, s2)) return;
        const dist = (w2 - w) * 7 + (d2 - d);
        out.push({ who: c.teacher, subj: c.subj, room: c.room, w: w2, d: d2, s: s2, dist });
      });
    }
    out.sort((a, b) => Math.abs(a.dist) - Math.abs(b.dist) || R.SLOTS.indexOf(a.s) - R.SLOTS.indexOf(b.s));
    return out;
  };
  R.proposeExchange = (t, w, d, s, opt, opts) => {
    const mine = R.teacherSlot(w, t, d, s);
    const x = { id: id('x'), status: 'propose', at: R.nowAbs(),
      a: { w, d, s, cls: mine.cls, teacher: t, subj: mine.cell.subj, room: mine.cell.room },
      b: { w: opt.w, d: opt.d, s: opt.s, cls: mine.cls, teacher: opt.who, subj: opt.subj, room: opt.room } };
    st.exchanges.push(x);
    notify(opt.who, `${R.tName(t)} vous propose un échange avec la ${mine.cls} : vous prendriez son heure du ${slotLabel(w, d, s)}, ${R.pron(t)} prendrait la vôtre du ${slotLabel(opt.w, opt.d, opt.s)}.`, 'echange');
    if (!(opts && opts.silent)) save();
    return x;
  };
  R.answerExchange = (xid, accept) => {
    const x = st.exchanges.find((e) => e.id === xid);
    if (!x || x.status !== 'propose') return;
    x.status = accept ? 'accepte' : 'refuse';
    notify(x.a.teacher, `${R.tName(x.b.teacher)} a ${accept ? 'accepté' : 'refusé'} l'échange avec la ${x.a.cls} (${slotLabel(x.a.w, x.a.d, x.a.s)} ↔ ${slotLabel(x.b.w, x.b.d, x.b.s)}).`, accept ? 'ok' : 'warn');
    if (accept) notify('vs', `Pour information, échange entre ${R.tName(x.a.teacher)} et ${R.tName(x.b.teacher)} avec la ${x.a.cls} : ${slotLabel(x.a.w, x.a.d, x.a.s)} ↔ ${slotLabel(x.b.w, x.b.d, x.b.s)}.`, 'info');
    save();
  };
  R.cancelExchange = (xid) => { st.exchanges = st.exchanges.filter((x) => x.id !== xid || x.status === 'accepte'); save(); };

  /* ---------- Demandes de salle ---------- */
  R.freeRooms = (w, d, s) => {
    const all = R.SPECIAL_ROOMS.concat([...new Set(S.teachers.map((t) => t.room).filter((r) => r !== 'Gymnase'))].sort());
    return all.filter((r) => R.roomFree(w, r, d, s));
  };
  R.requestRoom = (t, w, d, s, room, why, opts) => {
    const x = R.teacherSlot(w, t, d, s);
    st.roomReqs.push({ id: id('r'), t, w, d, s, cls: x.cls, from: x.cell.room, room, why: why || '', status: 'attente', at: R.nowAbs() });
    notify('vs', `${R.tName(t)} demande la salle ${room} pour la ${x.cls}, ${slotLabel(w, d, s)}.`, 'salle');
    if (!(opts && opts.silent)) save();
  };
  R.answerRoom = (rid, ok) => {
    const r = st.roomReqs.find((x) => x.id === rid);
    if (!r) return;
    if (ok && !R.roomFree(r.w, r.room, r.d, r.s)) { r.status = 'refuse'; notify(r.t, `La salle ${r.room} n'est plus libre ${slotLabel(r.w, r.d, r.s)}.`, 'warn'); save(); return; }
    r.status = ok ? 'valide' : 'refuse';
    notify(r.t, `Salle ${r.room} ${ok ? 'validée' : 'refusée'} pour la ${r.cls}, ${slotLabel(r.w, r.d, r.s)}.`, ok ? 'ok' : 'warn');
    save();
  };

  /* ---------- Statistiques : heures de cours manquées pour sorties et temps forts ---------- */
  R.stats = () => {
    const perClass = {}, bySubj = {}, byKind = {};
    R.CLASSES.forEach((c) => { perClass[c] = { total: 0, sortie: 0, tempsfort: 0 }; bySubj[c] = {}; });
    st.events.filter((e) => e.stats && e.kind !== 'info').forEach((e) => {
      const classes = e.kind === 'journee' ? R.CLASSES : e.classes;
      e.slots.forEach((s) => classes.forEach((cls) => {
        const l = R.baseAt(cls, e.d, s);
        if (!l) return;
        perClass[cls].total++;
        perClass[cls][e.kind === 'sortie' ? 'sortie' : 'tempsfort']++;
        bySubj[cls][l.subj] = (bySubj[cls][l.subj] || 0) + 1;
        byKind[e.title] = (byKind[e.title] || 0) + 1;
      }));
    });
    return { perClass, bySubj, byKind };
  };

  /* ---------- Récap du mercredi ---------- */
  R.recap = (w) => {
    const out = [];
    for (let d = 0; d < 5; d++) {
      const evs = st.events.filter((e) => e.w === w && e.d === d);
      const lines = st.lines.filter((l) => l.w === w && l.d === d).sort((a, b) => R.SLOTS.indexOf(a.s) - R.SLOTS.indexOf(b.s));
      if (!evs.length && !lines.length) continue;
      out.push(`${R.DAYS[d].toUpperCase()} ${R.fmtDate(w, d)}`);
      const grouped = {};
      evs.forEach((e) => (grouped[e.title] = grouped[e.title] || []).push(e));
      Object.entries(grouped).forEach(([title, list]) => {
        const det = list.map((e) => e.kind === 'journee' ? 'toutes les classes' : e.kind === 'info' ? e.slots.join('-') + (e.room ? ' · ' + e.room : '') : `${e.classes.join(', ')} en ${e.slots.join('-')}`).join(' ; ');
        out.push(`  ★ ${title} : ${det}`);
      });
      lines.forEach((l) => out.push(`  ${l.s.padEnd(3)} ${l.cls}  ${R.tName(l.teacher).padEnd(16)} → ${R.solText(l)}${l.comment ? ' (' + l.comment + ')' : ''}`));
      out.push('');
    }
    return out.join('\n').trim() || 'Rien de prévu cette semaine.';
  };
  R.solText = (l) => {
    const s = l.sol;
    if (!s) return 'à traiter';
    if (s.kind === 'relais') return s.who ? `relais ${R.tName(s.who)} en ${s.room || l.room}` : 'relais ouvert';
    if (s.kind === 'inversion') return `inversion avec ${R.tName(s.who)} (${R.subjLabel(s.subj)})`;
    if (s.kind === 'etude') return `étude ${s.room}`;
    if (s.kind === 'self') return 'Self';
    return '—';
  };

  /* ---------- Jeu de démonstration ---------- */
  function seed() {
    st = { v: 3, seq: 0, absences: [], lines: [], events: [], exchanges: [], roomReqs: [], notifs: [], settings: { cap: {} }, me: null };
    const rng = R.rngFrom(42);
    const pick = (a) => a[Math.floor(rng() * a.length)];
    const byS = (k) => S.teachers.filter((t) => t.subj === k);
    const W = 45;
    // Passé (pour les statistiques) : sorties et temps forts des semaines 36 à 42
    const titles = [['sortie', 'Sortie au théâtre'], ['sortie', 'Visite d\'entreprise'], ['tempsfort', 'Sécurité routière'],
      ['sortie', 'Sortie cinéma'], ['tempsfort', 'Tests de positionnement'], ['tempsfort', 'Intervention prévention'], ['sortie', 'Sortie nature']];
    R.PAST_WEEKS.forEach((w) => {
      const n = 2 + Math.floor(rng() * 3);
      for (let i = 0; i < n; i++) {
        const [kind, title] = pick(titles);
        const lv = pick(['6', '5', '4', '3']);
        const pool = R.CLASSES.filter((c) => R.level(c) === lv);
        const classes = pool.filter(() => rng() < 0.45).slice(0, 3);
        if (!classes.length) classes.push(pick(pool));
        const d = pick([0, 1, 3, 4]);
        const ds = R.daySlots(d), st0 = Math.floor(rng() * (ds.length - 1));
        const slots = ds.slice(st0, st0 + (kind === 'sortie' ? 2 + Math.floor(rng() * 3) : 1));
        st.events.push({ id: id('e'), w, d, title, kind, classes, slots, accomp: [], stats: true, past: true });
      }
    });

    // Semaine 45 — mardi : professeure d'arts plastiques absente toute la journée (déjà traité)
    const art = byS('ART')[0];
    const tue = R.createAbsence(art.id, W, 1, R.daySlots(1), { silent: true });
    tue.forEach((l, i) => {
      const sg = R.suggest(l);
      if (l.s === 'M4') l.sol = { kind: 'self' };
      else if (i === 1 && sg.relais.find((r) => r.prio)) { const r = sg.relais.find((x) => x.prio); l.sol = { kind: 'relais', who: r.who, room: l.room, at: R.nowAbs() - 1500, prio: true }; l.comment = 'PACTE'; }
      else if (i === 2 && sg.inversions.length) { R.setSolution(l.id, { kind: 'inversion', who: sg.inversions[0].who, subj: sg.inversions[0].subj, room: sg.inversions[0].room, from: sg.inversions[0].from }); }
      else { const e = sg.etudes.find((x) => x.load < x.cap) || sg.etudes[0]; l.sol = { kind: 'etude', room: e.room }; }
      Object.keys(cache).forEach((k) => delete cache[k]);
    });

    // Mercredi : sécurité routière
    [['606', 'M2'], ['605', 'M3'], ['506', 'M4']].forEach(([c, s]) =>
      R.createEvent({ w: W, d: 2, title: 'Sécurité routière', kind: 'tempsfort', classes: [c], slots: [s], accomp: [], stats: true }, { silent: true }));
    Object.keys(cache).forEach((k) => delete cache[k]);

    // Jeudi : sortie de deux 5e l'après-midi, avec accompagnateurs
    const c5 = ['503', '504'];
    const accomp = S.teachers.filter((t) => R.teachesClass(t.id, '503') && t.subj !== 'EPS').slice(0, 2).map((t) => t.id);
    R.createEvent({ w: W, d: 3, title: 'Visitons nos entreprises : atelier de menuiserie', kind: 'sortie', classes: c5,
      slots: R.slotsForRange(3, '13:40', '15:50'), accomp, stats: true }, { silent: true });
    R.createEvent({ w: W, d: 3, title: 'Réunion voyage en Angleterre (4e)', kind: 'info', classes: [], slots: ['S4'], room: 'Polyvalente', accomp: [], stats: false }, { silent: true });
    Object.keys(cache).forEach((k) => delete cache[k]);
    st.lines.filter((l) => l.reason === 'accompagnement').forEach((l, i) => {
      if (i % 2) l.sol = { kind: 'relais', who: null, room: l.room };
      else { const sg = R.suggest(l); const e = sg.etudes.find((x) => x.load < x.cap) || sg.etudes[0]; l.sol = { kind: 'etude', room: e.room }; }
      Object.keys(cache).forEach((k) => delete cache[k]);
    });

    // Jeudi matin : professeur de maths absent, relais ouverts
    const ma = byS('MA').find((t) => !accomp.includes(t.id) && R.lessonsOf(t.id, W, 3, ['M1', 'M2', 'M3', 'M4']).length >= 3) || byS('MA')[0];
    const thu = R.createAbsence(ma.id, W, 3, ['M1', 'M2', 'M3', 'M4'], { silent: true });
    thu.forEach((l) => (l.sol = { kind: 'relais', who: null, room: l.room }));
    Object.keys(cache).forEach((k) => delete cache[k]);
    // Un relais déjà pris par un collègue qui n'a pas la classe, pour montrer la reprise prioritaire
    let me = null;
    for (const l of thu) {
      const sg = R.suggest(l);
      const p = sg.relais.find((r) => r.prio && R.teachesClass(r.who, l.cls) && S.pp && Object.values(S.pp).includes(r.who)) || sg.relais.find((r) => r.prio);
      const o = sg.relais.find((r) => !r.prio);
      if (p && o) {
        l.sol = { kind: 'relais', who: o.who, room: l.room, at: R.nowAbs() - 300, prio: false };
        me = p.who; break;
      }
    }
    Object.keys(cache).forEach((k) => delete cache[k]);
    me = me || S.teachers[0].id;
    st.me = me;

    // Vendredi : absence pas encore traitée
    const hg = byS('HG').find((t) => t.id !== me && R.lessonsOf(t.id, W, 4, ['S1', 'S2', 'S3']).length >= 2) || byS('HG')[1];
    R.createAbsence(hg.id, W, 4, ['S1', 'S2', 'S3'], { silent: true });
    Object.keys(cache).forEach((k) => delete cache[k]);

    // Semaine 46 et suivantes
    R.createEvent({ w: 46, d: 0, title: 'Parcours Molière : représentation théâtrale', kind: 'sortie', classes: ['604', '503'], slots: ['S1', 'S2', 'S3'], accomp: [], stats: true }, { silent: true });
    R.createEvent({ w: 46, d: 1, title: 'Tests de positionnement 6e (maths)', kind: 'tempsfort', classes: ['606'], slots: ['M3', 'M4'], accomp: [], stats: true }, { silent: true });
    R.createEvent({ w: 47, d: 4, title: 'Journée pédagogique : pas de cours', kind: 'journee', classes: [], slots: R.daySlots(4), accomp: [], stats: false }, { silent: true });
    Object.keys(cache).forEach((k) => delete cache[k]);

    // Un échange proposé à « moi » par un collègue, et une demande de salle en attente
    const myL = S.lessons.filter((l) => l.teacher === me && l.day >= 2);
    for (const l of myL) {
      const opts = R.findExchanges(me, 46, l.day, l.slot);
      if (opts.length) {
        const o = opts[0];
        R.proposeExchange(o.who, o.w, o.d, o.s, { who: me, w: 46, d: l.day, s: l.slot, subj: l.subj, room: l.room }, { silent: true });
        break;
      }
    }
    const other = S.teachers.find((t) => t.subj === 'HG' && t.id !== me && R.teacherSlot(W, t.id, 3, 'M3'));
    if (other) R.requestRoom(other.id, W, 3, 'M3', 'K501 (informatique)', 'Travail sur les cartes numériques', { silent: true });
    st.notifs.forEach((n) => (n.at = R.nowAbs() - 30 - Math.floor(rng() * 600)));
    notify(me, 'Relais ouvert ce jeudi : une de vos classes a besoin de vous. Vous êtes prioritaire.', 'relais');
    st.notifs.sort((a, b) => b.at - a.at);
  }

  R.reset = () => { seed(); save(); };
  try { st = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { st = null; }
  if (!st || st.v !== 3) { seed(); try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }
})();
