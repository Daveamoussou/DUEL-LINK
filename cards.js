'use strict';
/* Duel des Esprits — cartes (toutes originales, inspirées des légendes d'Afrique de l'Ouest) */

const ATTR = {
  T: { name: 'Terre',   cls: 'a-T' },
  E: { name: 'Eau',     cls: 'a-E' },
  F: { name: 'Feu',     cls: 'a-F' },
  V: { name: 'Vent',    cls: 'a-V' },
  O: { name: 'Ombre',   cls: 'a-O' },
  L: { name: 'Lumière', cls: 'a-L' }
};

/*
  Effets possibles :
   heal n | burn n | draw n | killStrongest | killWeakest
   buffAtk n | buffDef n | revive | sweepTraps
  Pièges (se déclenchent quand l'adversaire attaque) :
   negate | trapKill | reflect n | weaken | trapHeal n
  Monstres : onSummon = effet à l'invocation, pierce = dégâts perçants
*/
const CARDS = [
  // ---------- MONSTRES ----------
  { id: 'm01', type: 'monster', name: 'Esprit du Baobab', attr: 'T', lvl: 2, atk: 600, def: 1000, icon: '🌳',
    text: "À l'invocation : gagnez 300 PV. Les anciens disent que l'arbre veille sur le village.", onSummon: { k: 'heal', n: 300 } },
  { id: 'm02', type: 'monster', name: 'Griot Conteur', attr: 'L', lvl: 3, atk: 800, def: 900, icon: '🪘',
    text: "À l'invocation : piochez 1 carte. Sa mémoire garde mille histoires.", onSummon: { k: 'draw', n: 1 } },
  { id: 'm03', type: 'monster', name: 'Chasseur Donso', attr: 'T', lvl: 3, atk: 1200, def: 900, icon: '🏹',
    text: "Un chasseur patient, fidèle à sa confrérie." },
  { id: 'm04', type: 'monster', name: 'Gazelle des Savanes', attr: 'V', lvl: 3, atk: 1000, def: 1000, icon: '🦌',
    text: "Rapide comme le vent de la plaine." },
  { id: 'm05', type: 'monster', name: 'Tisseuse des Ombres', attr: 'O', lvl: 3, atk: 900, def: 1100, icon: '🕷️',
    text: "À l'invocation : l'adversaire perd 300 PV. Ses fils attrapent les imprudents.", onSummon: { k: 'burn', n: 300 } },
  { id: 'm06', type: 'monster', name: 'Hyène Rôdeuse', attr: 'O', lvl: 3, atk: 1300, def: 800, icon: '🐺',
    text: "Elle guette dans le noir le moindre faux pas." },
  { id: 'm07', type: 'monster', name: 'Dame des Lagunes', attr: 'E', lvl: 4, atk: 1500, def: 1200, icon: '🧜',
    text: "Elle veille sur les eaux calmes et défend ses rives." },
  { id: 'm08', type: 'monster', name: 'Masque Gardien', attr: 'O', lvl: 4, atk: 1400, def: 1600, icon: '🎭',
    text: "Un masque ancien animé par l'esprit d'un ancêtre." },
  { id: 'm09', type: 'monster', name: 'Amazone du Dahomey', attr: 'F', lvl: 4, atk: 1700, def: 1000, icon: '🗡️',
    text: "Dégâts perçants : si elle attaque un monstre en défense, l'excédent est infligé en dégâts.", pierce: true },
  { id: 'm10', type: 'monster', name: 'Forgeron des Flammes', attr: 'F', lvl: 4, atk: 1600, def: 1300, icon: '🔨',
    text: "Il forge les lames qui ne rouillent jamais." },
  { id: 'm11', type: 'monster', name: 'Crocodile du Mono', attr: 'E', lvl: 4, atk: 1700, def: 1100, icon: '🐊',
    text: "Il garde le fleuve et ne lâche jamais sa proie." },
  { id: 'm12', type: 'monster', name: "Aigle de l'Harmattan", attr: 'V', lvl: 4, atk: 1600, def: 1000, icon: '🦅',
    text: "Dégâts perçants. Il plane sur les vents secs du désert.", pierce: true },
  { id: 'm13', type: 'monster', name: 'Tortue Sage', attr: 'T', lvl: 4, atk: 800, def: 2000, icon: '🐢',
    text: "Sa carapace a vu passer des siècles." },
  { id: 'm14', type: 'monster', name: 'Gardien du Village', attr: 'L', lvl: 4, atk: 1300, def: 1800, icon: '🛡️',
    text: "Il protège les siens jusqu'au dernier souffle." },
  { id: 'm15', type: 'monster', name: 'Lion du Mandé', attr: 'T', lvl: 5, atk: 2100, def: 1700, icon: '🦁',
    text: "Roi de la savane. Demande 1 sacrifice." },
  { id: 'm16', type: 'monster', name: 'Léopard de la Nuit', attr: 'O', lvl: 5, atk: 2200, def: 1400, icon: '🐆',
    text: "Silencieux et mortel. Demande 1 sacrifice." },
  { id: 'm17', type: 'monster', name: 'Buffle Sauvage', attr: 'F', lvl: 5, atk: 2000, def: 1500, icon: '🐃',
    text: "Rien n'arrête sa charge. Demande 1 sacrifice." },
  { id: 'm18', type: 'monster', name: 'Serpent Arc-en-ciel', attr: 'E', lvl: 6, atk: 2300, def: 1800, icon: '🐍',
    text: "À l'invocation : détruit le monstre adverse le plus faible. Demande 1 sacrifice.", onSummon: { k: 'killWeakest' } },
  { id: 'm19', type: 'monster', name: 'Éléphant des Anciens', attr: 'T', lvl: 6, atk: 2400, def: 2000, icon: '🐘',
    text: "Mémoire et puissance réunies. Demande 1 sacrifice." },
  { id: 'm20', type: 'monster', name: "Roi d'Abomey", attr: 'L', lvl: 7, atk: 2800, def: 2200, icon: '👑',
    text: "Dégâts perçants. Un souverain légendaire. Demande 2 sacrifices.", pierce: true },
  { id: 'm21', type: 'monster', name: 'Esprit du Tonnerre', attr: 'V', lvl: 7, atk: 3000, def: 2000, icon: '⚡',
    text: "À l'invocation : l'adversaire perd 500 PV. Demande 2 sacrifices.", onSummon: { k: 'burn', n: 500 } },
  { id: 'm22', type: 'monster', name: 'Grand Serpent des Eaux', attr: 'E', lvl: 8, atk: 3300, def: 2500, icon: '🐉',
    text: "À l'invocation : détruit le monstre adverse le plus fort. Demande 2 sacrifices.", onSummon: { k: 'killStrongest' } },

  // ---------- MAGIES ----------
  { id: 's01', type: 'spell', name: 'Eau de Source', icon: '💧', effect: { k: 'heal', n: 1000 },
    text: "Gagnez 1000 PV." },
  { id: 's02', type: 'spell', name: "Tam-tam d'Inspiration", icon: '🥁', effect: { k: 'draw', n: 2 },
    text: "Piochez 2 cartes." },
  { id: 's03', type: 'spell', name: 'Feu de Camp', icon: '🔥', effect: { k: 'burn', n: 700 },
    text: "Infligez 700 dégâts à l'adversaire." },
  { id: 's04', type: 'spell', name: 'Coup de Foudre', icon: '🌩️', effect: { k: 'killStrongest' },
    text: "Détruit le monstre adverse le plus fort." },
  { id: 's05', type: 'spell', name: 'Masque de Guerre', icon: '🪖', effect: { k: 'buffAtk', n: 700 },
    text: "Un de vos monstres gagne 700 ATK de façon permanente." },
  { id: 's06', type: 'spell', name: 'Bouclier Ancestral', icon: '🔰', effect: { k: 'buffDef', n: 700 },
    text: "Un de vos monstres gagne 700 DEF de façon permanente." },
  { id: 's07', type: 'spell', name: 'Appel des Ancêtres', icon: '🪔', effect: { k: 'revive' },
    text: "Ramenez de votre cimetière le monstre le plus fort de niveau 6 ou moins." },
  { id: 's08', type: 'spell', name: "Vent d'Harmattan", icon: '🌬️', effect: { k: 'sweepTraps' },
    text: "Détruit tous les pièges de l'adversaire." },

  // ---------- PIÈGES ----------
  { id: 't01', type: 'trap', name: "Mur d'Épines", icon: '🌵', effect: { k: 'negate' },
    text: "Quand l'adversaire attaque : annule l'attaque." },
  { id: 't02', type: 'trap', name: 'Fosse du Chasseur', icon: '🕳️', effect: { k: 'trapKill' },
    text: "Quand l'adversaire attaque : détruit le monstre attaquant." },
  { id: 't03', type: 'trap', name: 'Miroir de Calebasse', icon: '🪞', effect: { k: 'reflect', n: 800 },
    text: "Quand l'adversaire attaque : annule l'attaque et lui inflige 800 dégâts." },
  { id: 't04', type: 'trap', name: 'Brume Trompeuse', icon: '🌫️', effect: { k: 'weaken' },
    text: "Quand l'adversaire attaque : l'ATK du monstre attaquant est divisée par 2 pour ce combat." },
  { id: 't05', type: 'trap', name: 'Gris-gris Protecteur', icon: '🧿', effect: { k: 'trapHeal', n: 1000 },
    text: "Quand l'adversaire attaque : gagnez 1000 PV." }
];

const CARD_BY_ID = {};
CARDS.forEach(c => { CARD_BY_ID[c.id] = c; });
