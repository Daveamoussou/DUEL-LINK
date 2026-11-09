'use strict';
/* Duel des Esprits — moteur de jeu (aucune dépendance au navigateur) */

const LP_START = 4000, HAND_START = 5, ZONES = 3, HAND_MAX = 7;

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const who = pi => (pi === 0 ? 'Joueur' : 'Adversaire');
function L(G, msg) { G.log.push(msg); if (G.log.length > 80) G.log.shift(); }
const cardOf = id => CARD_BY_ID[id];
const monAtk = m => cardOf(m.id).atk + m.bonusAtk;
const monDef = m => cardOf(m.id).def + m.bonusDef;
const freeZone = arr => arr.findIndex(x => !x);
const tributeNeed = c => (c.lvl <= 4 ? 0 : c.lvl <= 6 ? 1 : 2);
const revivable = id => { const c = cardOf(id); return c.type === 'monster' && c.lvl <= 6; };
const newMon = (id, pos, turn) => ({ id, pos, bonusAtk: 0, bonusDef: 0, acted: false, since: turn });

/* ---------- Construction du deck (30 cartes, 2 exemplaires max) ---------- */
function buildDeck() {
  const mon = CARDS.filter(c => c.type === 'monster');
  const low = mon.filter(c => c.lvl <= 4);
  const mid = mon.filter(c => c.lvl >= 5 && c.lvl <= 6);
  const hi = mon.filter(c => c.lvl >= 7);
  const sp = CARDS.filter(c => c.type === 'spell');
  const tr = CARDS.filter(c => c.type === 'trap');
  const pick = (pool, n) => shuffle(pool.concat(pool)).slice(0, n);
  const deck = [].concat(pick(low, 10), pick(mid, 4), pick(hi, 2), pick(sp, 8), pick(tr, 6)).map(c => c.id);
  return shuffle(deck);
}

function newPlayer() {
  return { lp: LP_START, deck: [], hand: [], m: [null, null, null], t: [null, null, null], grave: [] };
}

function newGame() {
  const G = { cur: Math.random() < 0.5 ? 0 : 1, turnNo: 1, summoned: false, over: null, why: '', log: [], lastTrap: null,
              P: [newPlayer(), newPlayer()] };
  G.P[0].deck = buildDeck();
  G.P[1].deck = buildDeck();
  draw(G, 0, HAND_START);
  draw(G, 1, HAND_START);
  startTurn(G);
  return G;
}

/* ---------- Bases ---------- */
function draw(G, pi, n) {
  const p = G.P[pi];
  for (let i = 0; i < n; i++) {
    if (!p.deck.length) {
      if (G.over == null) { G.over = 1 - pi; G.why = 'deck'; }
      return;
    }
    p.hand.push(p.deck.pop());
  }
}

function damage(G, pi, n) {
  const p = G.P[pi];
  p.lp = Math.max(0, p.lp - n);
  if (p.lp === 0 && G.over == null) { G.over = 1 - pi; G.why = 'pv'; }
}

function destroyMon(G, pi, mi) {
  const p = G.P[pi], m = p.m[mi];
  if (!m) return;
  p.grave.push(m.id);
  p.m[mi] = null;
  L(G, `${cardOf(m.id).name} (${who(pi)}) est détruit.`);
}

function startTurn(G) {
  G.summoned = false;
  G.P[G.cur].m.forEach(m => { if (m) m.acted = false; });
  draw(G, G.cur, 1);
  L(G, `— Tour ${G.turnNo} : ${who(G.cur)} —`);
}

function endTurn(G) {
  if (G.over != null) return;
  const p = G.P[G.cur];
  while (p.hand.length > HAND_MAX) {
    const id = p.hand.shift();
    p.grave.push(id);
    L(G, `${who(G.cur)} défausse ${cardOf(id).name} (main pleine).`);
  }
  G.cur = 1 - G.cur;
  G.turnNo++;
  startTurn(G);
}

/* ---------- Effets ---------- */
function applyEffect(G, pi, e, ctx) {
  const me = G.P[pi], op = G.P[1 - pi], oi = 1 - pi;
  switch (e.k) {
    case 'heal':
      me.lp += e.n; L(G, `${who(pi)} gagne ${e.n} PV.`); break;
    case 'burn':
      damage(G, oi, e.n); L(G, `${who(oi)} perd ${e.n} PV.`); break;
    case 'draw':
      draw(G, pi, e.n); L(G, `${who(pi)} pioche ${e.n} carte(s).`); break;
    case 'killStrongest':
    case 'killWeakest': {
      const idx = op.m.map((m, i) => (m ? i : -1)).filter(i => i >= 0);
      if (!idx.length) { L(G, 'Aucun monstre adverse à détruire.'); break; }
      idx.sort((a, b) => monAtk(op.m[a]) - monAtk(op.m[b]));
      destroyMon(G, oi, e.k === 'killStrongest' ? idx[idx.length - 1] : idx[0]);
      break;
    }
    case 'buffAtk': {
      const m = me.m[ctx.t];
      if (m) { m.bonusAtk += e.n; L(G, `${cardOf(m.id).name} gagne ${e.n} ATK.`); }
      break;
    }
    case 'buffDef': {
      const m = me.m[ctx.t];
      if (m) { m.bonusDef += e.n; L(G, `${cardOf(m.id).name} gagne ${e.n} DEF.`); }
      break;
    }
    case 'revive': {
      let gi = -1, best = -1;
      me.grave.forEach((id, i) => { if (revivable(id) && cardOf(id).atk > best) { best = cardOf(id).atk; gi = i; } });
      const z = freeZone(me.m);
      if (gi >= 0 && z >= 0) {
        const id = me.grave.splice(gi, 1)[0];
        me.m[z] = newMon(id, 'atk', G.turnNo);
        L(G, `${cardOf(id).name} revient du cimetière.`);
      }
      break;
    }
    case 'sweepTraps':
      op.t.forEach((t, i) => { if (t) { op.grave.push(t.id); op.t[i] = null; } });
      L(G, `Les pièges de ${who(oi)} sont détruits.`);
      break;
  }
}

/* ---------- Invocation ---------- */
function summonCheck(G, pi, hi) {
  if (G.cur !== pi || G.over != null) return "Ce n'est pas votre tour";
  const p = G.P[pi], c = cardOf(p.hand[hi]);
  if (!c || c.type !== 'monster') return "Ce n'est pas un monstre";
  if (G.summoned) return 'Une invocation a déjà été faite ce tour';
  const need = tributeNeed(c), cnt = p.m.filter(Boolean).length;
  if (cnt < need) return `Il faut ${need} monstre(s) à sacrifier`;
  if (need === 0 && freeZone(p.m) < 0) return 'Zones monstres pleines';
  return null;
}

function summon(G, pi, hi, pos, trib) {
  const err = summonCheck(G, pi, hi);
  if (err) return err;
  const p = G.P[pi], id = p.hand[hi], c = cardOf(id), need = tributeNeed(c);
  trib = trib || [];
  if (trib.length !== need || new Set(trib).size !== need || trib.some(i => !p.m[i])) return 'Sacrifices invalides';
  trib.forEach(i => { p.grave.push(p.m[i].id); p.m[i] = null; });
  p.hand.splice(hi, 1);
  const z = freeZone(p.m);
  p.m[z] = newMon(id, pos === 'def' ? 'def' : 'atk', G.turnNo);
  G.summoned = true;
  L(G, `${who(pi)} invoque ${c.name}${need ? ' (avec sacrifice)' : ''}.`);
  if (c.onSummon) applyEffect(G, pi, c.onSummon, {});
  return null;
}

/* ---------- Magies et pièges ---------- */
function spellCheck(G, pi, hi) {
  if (G.cur !== pi || G.over != null) return "Ce n'est pas votre tour";
  const p = G.P[pi], o = G.P[1 - pi], c = cardOf(p.hand[hi]);
  if (!c) return 'Carte invalide';
  if (c.type === 'trap') return freeZone(p.t) < 0 ? 'Zones pièges pleines' : null;
  if (c.type !== 'spell') return "Ce n'est pas une magie";
  const k = c.effect.k;
  if ((k === 'buffAtk' || k === 'buffDef') && !p.m.some(Boolean)) return 'Aucun monstre allié';
  if (k === 'revive' && !(p.grave.some(revivable) && freeZone(p.m) >= 0)) return 'Aucun monstre à rappeler (ou zones pleines)';
  if (k === 'killStrongest' && !o.m.some(Boolean)) return 'Aucun monstre adverse';
  if (k === 'sweepTraps' && !o.t.some(Boolean)) return "Aucun piège adverse";
  return null;
}

function playCard(G, pi, hi, target) {
  const err = spellCheck(G, pi, hi);
  if (err) return err;
  const p = G.P[pi], id = p.hand[hi], c = cardOf(id);
  if (c.type === 'trap') {
    p.hand.splice(hi, 1);
    p.t[freeZone(p.t)] = { id };
    L(G, `${who(pi)} pose une carte face cachée.`);
    return null;
  }
  const k = c.effect.k;
  if ((k === 'buffAtk' || k === 'buffDef') && !p.m[target]) return 'Cible invalide';
  p.hand.splice(hi, 1);
  p.grave.push(id);
  L(G, `${who(pi)} active ${c.name}.`);
  applyEffect(G, pi, c.effect, { t: target });
  return null;
}

/* ---------- Combat ---------- */
function attackCheck(G, pi, mi) {
  if (G.cur !== pi || G.over != null) return "Ce n'est pas votre tour";
  if (G.turnNo === 1) return "Pas d'attaque au premier tour";
  const m = G.P[pi].m[mi];
  if (!m) return 'Pas de monstre ici';
  if (m.pos !== 'atk') return 'Ce monstre est en défense';
  if (m.acted) return 'Ce monstre a déjà agi ce tour';
  return null;
}

function attack(G, pi, mi, ti) {
  const err = attackCheck(G, pi, mi);
  if (err) return err;
  const oi = 1 - pi, p = G.P[pi], o = G.P[oi], att = p.m[mi], ac = cardOf(att.id);
  if (ti < 0) { if (o.m.some(Boolean)) return "Des monstres bloquent l'attaque directe"; }
  else if (!o.m[ti]) return 'Cible invalide';

  att.acted = true;
  L(G, `${ac.name} (${who(pi)}) attaque${ti < 0 ? ' directement' : ' ' + cardOf(o.m[ti].id).name}.`);
  let atkVal = monAtk(att), negated = false;

  // un seul piège se déclenche par attaque (le premier posé)
  const ti2 = o.t.findIndex(t => t);
  if (ti2 >= 0) {
    const t = o.t[ti2], tc = cardOf(t.id);
    o.t[ti2] = null; o.grave.push(t.id);
    G.lastTrap = { pi: oi, id: t.id };
    L(G, `Piège activé : ${tc.name} !`);
    switch (tc.effect.k) {
      case 'negate': negated = true; break;
      case 'trapKill': destroyMon(G, pi, mi); negated = true; break;
      case 'reflect': damage(G, pi, tc.effect.n); L(G, `${who(pi)} perd ${tc.effect.n} PV.`); negated = true; break;
      case 'weaken': atkVal = Math.floor(atkVal / 2); break;
      case 'trapHeal': o.lp += tc.effect.n; L(G, `${who(oi)} gagne ${tc.effect.n} PV.`); break;
    }
  }
  if (negated || G.over != null) return null;

  if (ti < 0) {
    damage(G, oi, atkVal);
    L(G, `${who(oi)} perd ${atkVal} PV.`);
    return null;
  }
  const tg = o.m[ti];
  if (tg.pos === 'atk') {
    const d = atkVal - monAtk(tg);
    if (d > 0) { destroyMon(G, oi, ti); damage(G, oi, d); L(G, `${who(oi)} perd ${d} PV.`); }
    else if (d < 0) { destroyMon(G, pi, mi); damage(G, pi, -d); L(G, `${who(pi)} perd ${-d} PV.`); }
    else { destroyMon(G, oi, ti); destroyMon(G, pi, mi); }
  } else {
    const d = atkVal - monDef(tg);
    if (d > 0) {
      destroyMon(G, oi, ti);
      if (ac.pierce) { damage(G, oi, d); L(G, `Dégâts perçants : ${who(oi)} perd ${d} PV.`); }
    } else if (d < 0) { damage(G, pi, -d); L(G, `${who(pi)} perd ${-d} PV (contre-coup).`); }
  }
  return null;
}

function changePosCheck(G, pi, mi) {
  if (G.cur !== pi || G.over != null) return "Ce n'est pas votre tour";
  const m = G.P[pi].m[mi];
  if (!m) return 'Pas de monstre ici';
  if (m.acted || m.since === G.turnNo) return 'Changement impossible ce tour';
  return null;
}

function changePos(G, pi, mi) {
  const err = changePosCheck(G, pi, mi);
  if (err) return err;
  const m = G.P[pi].m[mi];
  m.pos = m.pos === 'atk' ? 'def' : 'atk';
  m.acted = true;
  L(G, `${cardOf(m.id).name} passe en position de ${m.pos === 'atk' ? 'attaque' : 'défense'}.`);
  return null;
}

/* ---------- Intelligence artificielle (une action par appel) ---------- */
function strongestIdx(row) {
  let bi = -1, b = -1;
  row.forEach((m, i) => { if (m && monAtk(m) > b) { b = monAtk(m); bi = i; } });
  return bi;
}
function weakestIdxs(row, n) {
  return row.map((m, i) => (m ? i : -1)).filter(i => i >= 0)
    .sort((a, b) => monAtk(row[a]) - monAtk(row[b])).slice(0, n);
}

function aiStep(G) {
  const pi = G.cur;
  if (G.over != null) return false;
  const p = G.P[pi], o = G.P[1 - pi];
  const oBest = Math.max(0, ...o.m.filter(Boolean).map(monAtk));

  // 1) magies
  for (let hi = 0; hi < p.hand.length; hi++) {
    const c = cardOf(p.hand[hi]);
    if (c.type !== 'spell' || spellCheck(G, pi, hi)) continue;
    const k = c.effect.k;
    let go = false, target;
    if (k === 'heal') go = p.lp <= 3200;
    else if (k === 'burn') go = true;
    else if (k === 'draw') go = p.hand.length <= 5;
    else if (k === 'killStrongest') go = oBest >= 1500;
    else if (k === 'buffAtk' || k === 'buffDef') {
      target = strongestIdx(p.m);
      go = target >= 0 && (o.m.some(Boolean) || (k === 'buffAtk' && G.turnNo > 1));
    }
    else if (k === 'revive' || k === 'sweepTraps') go = true;
    if (go && !playCard(G, pi, hi, target)) return true;
  }

  // 2) poser des pièges
  for (let hi = 0; hi < p.hand.length; hi++) {
    const c = cardOf(p.hand[hi]);
    if (c.type === 'trap' && !spellCheck(G, pi, hi) && !playCard(G, pi, hi)) return true;
  }

  // 3) invoquer le meilleur monstre rentable
  if (!G.summoned) {
    let best = null;
    p.hand.forEach((id, hi) => {
      const c = cardOf(id);
      if (c.type !== 'monster' || summonCheck(G, pi, hi)) return;
      const need = tributeNeed(c), tr = weakestIdxs(p.m, need);
      const cost = tr.reduce((s, i) => s + monAtk(p.m[i]), 0);
      if (need > 0 && c.atk < cost + 600) return;
      const val = c.atk + c.def / 2 - cost;
      if (!best || val > best.val) best = { hi, tr, val, c };
    });
    if (best) {
      const pos = best.c.atk >= oBest ? 'atk' : 'def';
      if (!summon(G, pi, best.hi, pos, best.tr)) return true;
    }
  }

  // 4) attaques rentables uniquement
  for (let mi = 0; mi < ZONES; mi++) {
    const m = p.m[mi];
    if (!m || attackCheck(G, pi, mi)) continue;
    if (!o.m.some(Boolean)) { if (!attack(G, pi, mi, -1)) return true; m.acted = true; continue; }
    const a = monAtk(m), ac = cardOf(m.id), targets = [];
    o.m.forEach((t, ti) => {
      if (!t) return;
      if (t.pos === 'atk' && a > monAtk(t)) targets.push({ ti, s: monAtk(t) });
      else if (t.pos === 'def' && a > monDef(t)) targets.push({ ti, s: monDef(t) / 2 + (ac.pierce ? 300 : 0) });
    });
    if (targets.length) {
      targets.sort((x, y) => y.s - x.s);
      if (!attack(G, pi, mi, targets[0].ti)) return true;
    }
    m.acted = true; // décide de ne pas attaquer
  }
  return false;
}
