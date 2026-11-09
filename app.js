'use strict';
/* Duel des Esprits — interface */

const $ = s => document.querySelector(s);
let G = null;
const ui = { mode: null, aiBusy: false, prev: [LP_START, LP_START], ended: false };
let toastTimer = null;

/* ---------- Statistiques locales ---------- */
function loadStats() {
  try { return JSON.parse(localStorage.getItem('dde_stats')) || { w: 0, l: 0 }; } catch (e) { return { w: 0, l: 0 }; }
}
function saveStats(s) { try { localStorage.setItem('dde_stats', JSON.stringify(s)); } catch (e) { /* ignoré */ } }
function showStats() { const s = loadStats(); $('#stats').textContent = `Victoires : ${s.w} · Défaites : ${s.l}`; }

/* ---------- Utilitaires d'affichage ---------- */
function show(id) { ['menu', 'game'].forEach(s => $('#' + s).classList.toggle('hidden', s !== id)); }

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2000);
}

function openModal(html) { $('#modal-body').innerHTML = html; $('#modal').classList.remove('hidden'); }
function closeModal() { $('#modal').classList.add('hidden'); }
function closeSheet() { $('#sheet').classList.add('hidden'); }

function cardEl(id, st, extra) {
  const c = cardOf(id);
  extra = extra || '';
  if (c.type === 'monster') {
    const atk = c.atk + (st ? st.bonusAtk : 0), def = c.def + (st ? st.bonusDef : 0);
    const pos = st ? (st.pos === 'def' ? ' · DÉF' : ' · ATK') : '';
    const cls = `card ${ATTR[c.attr].cls}${st && st.pos === 'def' ? ' def' : ''}${st && (st.bonusAtk || st.bonusDef) ? ' buffed' : ''} ${extra}`;
    return `<div class="${cls}"><div class="c-name">${c.name}</div><div class="c-lvl">★${c.lvl}${pos}</div>` +
      `<div class="c-art">${c.icon}</div><div class="c-stats"><span>⚔${atk}</span><span>🛡${def}</span></div></div>`;
  }
  const label = c.type === 'spell' ? 'MAGIE' : 'PIÈGE';
  return `<div class="card ${c.type} ${extra}"><div class="c-name">${c.name}</div><div class="c-lvl">${label}</div><div class="c-art">${c.icon}</div></div>`;
}

const slot = (zone, i, inner, cls) => `<div class="slot ${cls || ''}" data-z="${zone}-${i}">${inner || ''}</div>`;

function monRow(pi) {
  const key = pi === 0 ? 'me-m' : 'opp-m';
  return G.P[pi].m.map((m, i) => {
    let cls = '';
    if (ui.mode && m) {
      if (pi === 0 && ui.mode.type === 'tribute') cls = ui.mode.chosen.includes(i) ? 'sel on' : 'sel';
      if (pi === 0 && ui.mode.type === 'target') cls = 'sel';
      if (pi === 1 && ui.mode.type === 'attack') cls = 'sel target';
    }
    if (!ui.mode && pi === 0 && m && G.cur === 0 && m.acted) cls = 'done';
    return slot(key, i, m ? cardEl(m.id, m) : '', cls);
  }).join('');
}

function trapRow(pi) {
  const key = pi === 0 ? 'me-t' : 'opp-t';
  return G.P[pi].t.map((t, i) => {
    let inner = '';
    if (t) inner = pi === 0 ? `<div class="chip trap">${cardOf(t.id).icon}</div>` : '<div class="back"></div>';
    return slot(key, i, inner, '');
  }).join('');
}

function render() {
  const me = G.P[0], op = G.P[1];

  [[0, me], [1, op]].forEach(([i, p]) => {
    const k = i === 0 ? 'me' : 'opp';
    $('#' + k + '-lp').textContent = p.lp;
    $('#' + k + '-fill').style.width = Math.min(100, p.lp / LP_START * 100) + '%';
    $('#' + k + '-deck').textContent = '🂠 ' + p.deck.length;
    if (p.lp < ui.prev[i]) pulse(i, 'hit'); else if (p.lp > ui.prev[i]) pulse(i, 'heal');
    ui.prev[i] = p.lp;
  });

  $('#opp-hand').innerHTML = op.hand.map(() => '<div class="mini"></div>').join('');
  $('#opp-t').innerHTML = trapRow(1);
  $('#opp-m').innerHTML = monRow(1);
  $('#me-m').innerHTML = monRow(0);
  $('#me-t').innerHTML = trapRow(0);

  const mine = G.cur === 0 && G.over == null;
  $('#hand').innerHTML = me.hand.map((id, i) => {
    const c = cardOf(id);
    const playable = mine && !ui.mode && (c.type === 'monster' ? !summonCheck(G, 0, i) : !spellCheck(G, 0, i));
    return slot('hand', i, cardEl(id), playable ? 'ok' : '');
  }).join('');

  $('#turn-info').textContent = G.over != null ? 'Partie terminée'
    : `Tour ${G.turnNo} — ${G.cur === 0 ? 'À vous de jouer' : "L'adversaire joue…"}`;

  const log = $('#log');
  log.innerHTML = G.log.slice(-6).map(l => `<div>${l}</div>`).join('');
  log.scrollTop = log.scrollHeight;

  $('#btn-end').disabled = !mine || !!ui.mode;

  const b = $('#banner');
  if (ui.mode) {
    let txt = '';
    if (ui.mode.type === 'tribute') txt = `Sacrifiez ${ui.mode.need - ui.mode.chosen.length} monstre(s) : touchez vos monstres`;
    if (ui.mode.type === 'target') txt = 'Choisissez un de vos monstres';
    if (ui.mode.type === 'attack') txt = 'Touchez le monstre adverse à attaquer';
    $('#banner-text').textContent = txt;
    b.classList.remove('hidden');
  } else b.classList.add('hidden');
}

function pulse(i, cls) {
  const el = $(i === 0 ? '#me-bar' : '#opp-bar');
  el.classList.remove('hit', 'heal');
  void el.offsetWidth;
  el.classList.add(cls);
}

/* ---------- Fiche d'une carte ---------- */
function metaOf(c, st) {
  if (c.type === 'monster') {
    const atk = c.atk + (st ? st.bonusAtk : 0), def = c.def + (st ? st.bonusDef : 0);
    return `${ATTR[c.attr].name} • Niveau ${c.lvl} • ATK ${atk} / DEF ${def}`;
  }
  return c.type === 'spell' ? 'Carte Magie' : "Carte Piège (se déclenche quand l'adversaire attaque)";
}

function openSheet(id, st, actions, note) {
  const c = cardOf(id);
  $('#sheet-card').innerHTML = cardEl(id, st, 'big');
  $('#sheet-info').innerHTML = `<h3>${c.name}</h3><p class="meta">${metaOf(c, st)}</p><p>${c.text}</p>` +
    (note ? `<p class="note">${note}</p>` : '');
  const box = $('#sheet-actions');
  box.innerHTML = '';
  actions.forEach(a => {
    const b = document.createElement('button');
    b.textContent = a.label;
    if (a.why) {
      b.disabled = true;
      box.appendChild(b);
      const s = document.createElement('small');
      s.textContent = a.why;
      box.appendChild(s);
    } else {
      b.onclick = () => { closeSheet(); a.fn(); };
      box.appendChild(b);
    }
  });
  $('#sheet').classList.remove('hidden');
}

/* ---------- Actions du joueur ---------- */
function afterAction() {
  render();
  if (G.lastTrap) {
    toast('Piège activé : ' + cardOf(G.lastTrap.id).name + ' !');
    G.lastTrap = null;
  }
  checkOver();
}

function doAct(fn) {
  const err = fn();
  if (err) toast(err);
  afterAction();
}

function startSummon(hi, pos) {
  const need = tributeNeed(cardOf(G.P[0].hand[hi]));
  if (need === 0) return doAct(() => summon(G, 0, hi, pos, []));
  ui.mode = { type: 'tribute', hi, pos, need, chosen: [] };
  render();
}

function startSpell(hi) {
  const k = cardOf(G.P[0].hand[hi]).effect.k;
  if (k === 'buffAtk' || k === 'buffDef') { ui.mode = { type: 'target', hi }; render(); }
  else doAct(() => playCard(G, 0, hi));
}

function onHand(i) {
  const id = G.P[0].hand[i], c = cardOf(id), mine = G.cur === 0 && G.over == null;
  const acts = [];
  let note = '';
  if (c.type === 'monster') {
    const why = mine ? summonCheck(G, 0, i) : "Ce n'est pas votre tour";
    acts.push({ label: 'Invoquer en Attaque', why, fn: () => startSummon(i, 'atk') });
    acts.push({ label: 'Invoquer en Défense', why, fn: () => startSummon(i, 'def') });
    const need = tributeNeed(c);
    if (need) note = `Nécessite ${need} sacrifice(s) de vos monstres.`;
  } else if (c.type === 'spell') {
    const why = mine ? spellCheck(G, 0, i) : "Ce n'est pas votre tour";
    acts.push({ label: 'Activer', why, fn: () => startSpell(i) });
  } else {
    const why = mine ? spellCheck(G, 0, i) : "Ce n'est pas votre tour";
    acts.push({ label: 'Poser face cachée', why, fn: () => doAct(() => playCard(G, 0, i)) });
  }
  openSheet(id, null, acts, note);
}

function onMyMon(i) {
  const m = G.P[0].m[i];
  if (!m) return;
  if (ui.mode) {
    const md = ui.mode;
    if (md.type === 'tribute') {
      const k = md.chosen.indexOf(i);
      if (k >= 0) md.chosen.splice(k, 1); else md.chosen.push(i);
      if (md.chosen.length === md.need) { ui.mode = null; doAct(() => summon(G, 0, md.hi, md.pos, md.chosen)); }
      else render();
    } else if (md.type === 'target') {
      ui.mode = null;
      doAct(() => playCard(G, 0, md.hi, i));
    }
    return;
  }
  const mine = G.cur === 0 && G.over == null;
  const hasOpp = G.P[1].m.some(Boolean);
  const acts = [];
  const whyAtk = mine ? attackCheck(G, 0, i) : "Ce n'est pas votre tour";
  acts.push({
    label: hasOpp ? 'Attaquer' : 'Attaque directe', why: whyAtk,
    fn: () => {
      if (!hasOpp) doAct(() => attack(G, 0, i, -1));
      else { ui.mode = { type: 'attack', mi: i }; render(); }
    }
  });
  acts.push({
    label: m.pos === 'atk' ? 'Passer en Défense' : 'Passer en Attaque',
    why: mine ? changePosCheck(G, 0, i) : "Ce n'est pas votre tour",
    fn: () => doAct(() => changePos(G, 0, i))
  });
  openSheet(m.id, m, acts, '');
}

function onOppMon(i) {
  const m = G.P[1].m[i];
  if (!m) return;
  if (ui.mode && ui.mode.type === 'attack') {
    const md = ui.mode;
    ui.mode = null;
    doAct(() => attack(G, 0, md.mi, i));
    return;
  }
  openSheet(m.id, m, [], '');
}

function onMyTrap(i) {
  const t = G.P[0].t[i];
  if (t) openSheet(t.id, null, [], 'Posé face cachée : il se déclenchera seul quand l\'adversaire attaquera.');
}

$('#game').addEventListener('click', ev => {
  const z = ev.target.closest('[data-z]');
  if (!z || !G) return;
  const parts = z.dataset.z.split('-');
  const idx = +parts.pop(), key = parts.join('-');
  if (key === 'hand') { if (ui.mode) { ui.mode = null; render(); } onHand(idx); }
  else if (key === 'me-m') onMyMon(idx);
  else if (key === 'opp-m') onOppMon(idx);
  else if (key === 'me-t') { if (!ui.mode) onMyTrap(idx); }
});

$('#banner-cancel').onclick = () => { ui.mode = null; render(); };
$('#sheet').addEventListener('click', e => { if (e.target.id === 'sheet') closeSheet(); });
$('#sheet-close').onclick = closeSheet;
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });

/* ---------- Tour de l'adversaire ---------- */
function runAI() {
  if (ui.aiBusy) return;
  ui.aiBusy = true;
  const g = G;
  let n = 0;
  const step = () => {
    if (g !== G) return;                       // une nouvelle partie a démarré
    if (G.over != null || G.cur !== 1) { ui.aiBusy = false; afterAction(); return; }
    const did = aiStep(G);
    if (!did || ++n > 40) {
      endTurn(G);
      ui.aiBusy = false;
      afterAction();
      return;
    }
    afterAction();
    setTimeout(step, 800);
  };
  setTimeout(step, 700);
}

function onEnd() {
  if (G.cur !== 0 || G.over != null) return;
  ui.mode = null;
  endTurn(G);
  afterAction();
  if (G.over == null && G.cur === 1) runAI();
}

/* ---------- Fin de partie ---------- */
function checkOver() {
  if (G.over == null || ui.ended) return;
  ui.ended = true;
  const win = G.over === 0, s = loadStats();
  if (win) s.w++; else s.l++;
  saveStats(s);
  const why = G.why === 'deck'
    ? (win ? "L'adversaire n'a plus de cartes à piocher." : "Vous n'avez plus de cartes à piocher.")
    : (win ? "Les PV de l'adversaire sont tombés à zéro." : 'Vos PV sont tombés à zéro.');
  setTimeout(() => {
    openModal(`<h2>${win ? '🏆 Victoire !' : '💀 Défaite…'}</h2><p style="text-align:center">${why}</p>` +
      `<button class="primary" id="again">Rejouer</button><button id="tomenu">Menu principal</button>`);
    $('#again').onclick = startDuel;
    $('#tomenu').onclick = () => { closeModal(); showStats(); show('menu'); };
  }, 900);
}

/* ---------- Démarrage / menus ---------- */
function startDuel() {
  closeModal(); closeSheet();
  G = newGame();
  ui.mode = null; ui.aiBusy = false; ui.ended = false; ui.prev = [LP_START, LP_START];
  show('game');
  render();
  toast(G.cur === 0 ? 'Le sort vous désigne : vous commencez !' : "L'adversaire commence.");
  if (G.cur === 1) runAI();
}

const RULES = `<h2>📜 Règles du jeu</h2>
<ul>
<li><b>But :</b> faire tomber les PV de l'adversaire (4000) à zéro. Celui qui ne peut plus piocher perd aussi.</li>
<li><b>Un tour :</b> vous piochez 1 carte, puis vous jouez : <b>1 invocation</b> par tour, autant de magies que vous voulez, jusqu'à 3 pièges posés, puis vous attaquez.</li>
<li><b>Sacrifices :</b> niveau 1-4 = aucun ; niveau 5-6 = 1 sacrifice ; niveau 7+ = 2 sacrifices.</li>
<li><b>Positions :</b> un monstre en <b>Attaque</b> peut attaquer ; en <b>Défense</b> il protège mieux (c'est sa DEF qui compte).</li>
<li><b>Combat :</b> contre un monstre en attaque, la différence d'ATK est infligée en dégâts au perdant (égalité : les deux sont détruits). Contre un monstre en défense, l'ATK doit dépasser la DEF pour le détruire (sinon l'attaquant subit la différence).</li>
<li><b>Attaque directe :</b> possible seulement si l'adversaire n'a aucun monstre.</li>
<li><b>Pièges :</b> posés face cachée, ils se déclenchent tout seuls quand l'adversaire attaque.</li>
<li>Pas d'attaque au tout premier tour. Main limitée à 7 cartes.</li>
</ul>
<button class="primary" id="rules-ok">Compris</button>`;

$('#btn-solo').onclick = startDuel;
$('#btn-online').onclick = () => toast('Le mode Battle Link arrive bientôt !');
$('#btn-rules').onclick = () => { openModal(RULES); $('#rules-ok').onclick = closeModal; };
$('#btn-end').onclick = onEnd;
$('#btn-menu').onclick = () => {
  openModal(`<h2>Menu</h2><button class="primary" id="m-resume">Reprendre</button><button id="m-rules">Règles</button><button id="m-quit">Abandonner la partie</button>`);
  $('#m-resume').onclick = closeModal;
  $('#m-rules').onclick = () => { openModal(RULES); $('#rules-ok').onclick = closeModal; };
  $('#m-quit').onclick = () => {
    if (G && G.over == null) { const s = loadStats(); s.l++; saveStats(s); }
    G = null; closeModal(); showStats(); show('menu');
  };
};

showStats();
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { /* hors serveur : ignoré */ }); });
}
