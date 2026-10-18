import {
  DICE, ENCOUNTERS, FAMILY, MAX_JAR, MAX_MANA, NUDGE_COST,
  REROLL_COST, REWARD_POOL, SHOP_DIE_COST, SHOP_FORGE_COST,
  SHOP_HEAL_COST, STARTING_DICE,
} from './content.js';

const DEFAULT_FACES = [1, 2, 3, 4, 5, 6];
const EFFECT_FAMILIES = new Set(['attack', 'block', 'poison', 'weaken', 'strength', 'mana', 'heal']);
const clone = value => structuredClone(value);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const randomIndex = (length, random) => Math.min(length - 1, Math.floor(clamp(random(), 0, 0.999999999) * length));

export function makeDie(type, id) {
  if (!DICE[type]) throw new Error(`Unknown die type ${type}`);
  return { id, type, faces: [...DEFAULT_FACES], remaining: 0 };
}
export function definition(die) { return DICE[die.type]; }
export function isModifier(die) { return ['add', 'multiply'].includes(definition(die).family); }
export function rolledLabel(die, value) {
  const family = definition(die).family;
  return family === 'add' ? `+${value}` : family === 'multiply' ? `×${Math.ceil(value / 2)}` : String(value);
}
export function nextIntent(state) {
  if (!state.enemy) return null;
  return ENCOUNTERS[state.encounter].moves[state.enemy.moveIndex];
}
export function rollValue(die, rng) { return die.faces[randomIndex(die.faces.length, rng)]; }

function pickOffers(rng, count = 3) {
  const pool = [...REWARD_POOL];
  const offered = [];
  for (let i = 0; i < count && pool.length; i += 1) {
    offered.push(pool.splice(randomIndex(pool.length, rng), 1)[0]);
  }
  return offered;
}
function initializeEnemy(index) {
  const e = ENCOUNTERS[index];
  return { name: e.name, hp: e.hp, maxHp: e.hp, block: 0, poison: 0, weak: 0, moveIndex: 0 };
}
function addLog(state, message, type = 'neutral') {
  state.log.unshift({ id: ++state.logCounter, message, type });
  state.log = state.log.slice(0, 40);
}
function reject(state, notice) { return { ...state, notice }; }
function findDie(state, id) { return state.dice.find(d => d.id === id); }
function addOwned(state, type) {
  state.dice.push(makeDie(type, `die-${state.nextId++}`));
}
function startBattle(state, index) {
  state.encounter = index;
  state.enemy = initializeEnemy(index);
  state.phase = 'select';
  state.turn = 1;
  state.selected = [];
  state.rolls = {};
  state.links = {};
  state.order = [];
  state.activeDie = null;
  state.hero.block = 0;
  state.hero.poison = 0;
  state.hero.strength = 0;
  state.hero.strengthCharges = 0;
  state.hero.mana = MAX_MANA;
  state.dice.forEach(d => { d.remaining = 0; });
  state.log = [];
  state.logCounter = 0;
  addLog(state, `A ${state.enemy.name} blocks your path.`, 'story');
}

export function newGame() {
  const state = {
    phase: 'select', encounter: 0, turn: 1, nextId: 1,
    dice: [], selected: [], rolls: {}, links: {}, order: [], activeDie: null,
    hero: { hp: 60, maxHp: 60, block: 0, mana: MAX_MANA, maxMana: MAX_MANA, poison: 0, strength: 0, strengthCharges: 0 },
    enemy: null, gold: 0, rewardOffers: [], shopOffers: [], shopSold: [],
    forgeReturn: 'shop', forgeCost: 0, notice: '', log: [], logCounter: 0,
  };
  STARTING_DICE.forEach(type => addOwned(state, type));
  startBattle(state, 0);
  return state;
}

function findRoll(state, id) {
  return state.rolls[id] === undefined ? null : state.rolls[id];
}
export function modifiedValue(state, dieId) {
  const die = findDie(state, dieId);
  const raw = findRoll(state, dieId);
  if (!die || raw === null) return 0;
  if (!EFFECT_FAMILIES.has(definition(die).family)) return raw;
  const entries = Object.entries(state.links).filter(([, target]) => target === dieId);
  const additive = entries.reduce((n, [id]) => n + (definition(findDie(state, id)).family === 'add' ? state.rolls[id] : 0), 0);
  const multiplier = entries.reduce((n, [id]) => n * (definition(findDie(state, id)).family === 'multiply' ? Math.ceil(state.rolls[id] / 2) : 1), 1);
  return clamp((raw + additive) * multiplier, 0, 999);
}
export function pendingModifiers(state) {
  return state.selected.filter(id => isModifier(findDie(state,id)) && !state.links[id]);
}
export function canCommit(state) {
  return state.phase === 'cast' && pendingModifiers(state).length === 0;
}
function hurtEnemy(state, amount) {
  const soaked = Math.min(state.enemy.block, amount);
  state.enemy.block -= soaked;
  state.enemy.hp = Math.max(0, state.enemy.hp - (amount - soaked));
  return { soaked, damage: amount - soaked };
}
function hurtHero(state, amount) {
  const blocked = Math.min(state.hero.block, amount);
  state.hero.block -= blocked;
  const damage = Math.max(0, amount - blocked);
  state.hero.hp = Math.max(0, state.hero.hp - damage);
  return { blocked, damage };
}
function victory(state, rng) {
  const gold = ENCOUNTERS[state.encounter].gold;
  state.gold += gold;
  state.selected = [];
  state.rolls = {};
  state.links = {};
  state.order = [];
  state.activeDie = null;
  addLog(state, `Victory! ${state.enemy.name} is defeated.`, 'good');
  if (state.encounter === ENCOUNTERS.length - 1) {
    state.phase = 'won';
  } else {
    state.phase = 'reward';
    state.rewardOffers = pickOffers(rng);
    state.shopOffers = pickOffers(rng);
    state.shopSold = [];
    addLog(state, `You found ${gold} gold and a chance to grow stronger.`, 'good');
  }
}
function nextTurn(state) {
  state.turn += 1;
  state.phase = 'select';
  state.selected = [];
  state.rolls = {};
  state.links = {};
  state.order = [];
  state.activeDie = null;
  state.dice.forEach(d => { d.remaining = Math.max(0, d.remaining - 1); });
  state.hero.mana = Math.min(state.hero.maxMana, state.hero.mana + 2);
  // Enemy poison is applied before an enemy attacks; hero poison ticks on the next turn.
  if (state.hero.poison > 0) {
    const poison = state.hero.poison;
    state.hero.hp = Math.max(0, state.hero.hp - poison);
    state.hero.poison -= 1;
    addLog(state, `Poison deals ${poison} damage to you.`, 'bad');
  }
  state.hero.block = 0;
  if (state.hero.hp === 0) { state.phase = 'lost'; addLog(state, 'Your journey ends here.', 'bad'); }
}

function commitTurn(state, rng) {
  // Dice resolve in player-chosen order. Modifiers only contribute to their target.
  for (const id of state.order) {
    const die = findDie(state, id);
    const type = definition(die);
    const value = modifiedValue(state, id);
    if (type.family === 'attack') {
      const bonus = state.hero.strengthCharges > 0 ? state.hero.strength : 0;
      const result = hurtEnemy(state, value + bonus);
      if (state.hero.strengthCharges > 0 && --state.hero.strengthCharges === 0) state.hero.strength = 0;
      addLog(state, `${type.name} hits for ${result.damage}${result.soaked ? ` (${result.soaked} blocked)` : ''}.`, 'good');
    } else if (type.family === 'block') {
      state.hero.block += value;
      addLog(state, `${type.name} grants ${value} block.`, 'good');
    } else if (type.family === 'poison') {
      state.enemy.poison += value;
      addLog(state, `${type.name} applies ${value} poison.`, 'good');
    } else if (type.family === 'weaken') {
      state.enemy.weak += value;
      addLog(state, `${type.name} weakens the next attack by ${value}.`, 'good');
    } else if (type.family === 'strength') {
      state.hero.strength = Math.ceil(value / 2);
      state.hero.strengthCharges = 2;
      addLog(state, `${type.name} empowers your next two attacks (+${state.hero.strength}).`, 'good');
    } else if (type.family === 'mana') {
      const restored = Math.min(state.hero.maxMana - state.hero.mana, value);
      state.hero.mana += restored;
      addLog(state, `${type.name} restores ${restored} mana.`, 'good');
    } else if (type.family === 'heal') {
      const healed = Math.min(state.hero.maxHp - state.hero.hp, value);
      state.hero.hp += healed;
      addLog(state, `${type.name} restores ${healed} HP.`, 'good');
    }
    if (state.enemy.hp <= 0) break;
  }
  // All rolled dice enter cooldown, even when the enemy dies during resolution.
  for (const id of state.selected) {
    const die = findDie(state, id);
    die.remaining = definition(die).cooldown + 1;
  }
  if (state.enemy.hp <= 0) { victory(state, rng); return; }
  // Enemy poison bypasses block and acts before the telegraphed move.
  if (state.enemy.poison > 0) {
    const damage = state.enemy.poison;
    state.enemy.hp = Math.max(0, state.enemy.hp - damage);
    state.enemy.poison = Math.max(0, damage - 1);
    addLog(state, `Poison deals ${damage} to ${state.enemy.name}.`, 'good');
    if (state.enemy.hp <= 0) { victory(state, rng); return; }
  }
  // Shield is retained through one player attack phase, then expires.
  state.enemy.block = 0;
  const move = nextIntent(state);
  let inflicted = 0;
  if (move.attack) {
    const attack = Math.max(0, move.attack - state.enemy.weak);
    const { damage } = hurtHero(state, attack);
    inflicted = damage;
    state.enemy.weak = 0;
  }
  if (move.guard) state.enemy.block += move.guard;
  if (move.poison) state.hero.poison += move.poison;
  state.enemy.moveIndex = (state.enemy.moveIndex + 1) % ENCOUNTERS[state.encounter].moves.length;
  const outcomes = [move.attack ? `${inflicted} damage dealt` : null, move.guard ? `${move.guard} block gained` : null, move.poison ? `${move.poison} poison applied` : null].filter(Boolean).join(', ');
  addLog(state, `${state.enemy.name} uses ${move.name}: ${outcomes}.`, 'bad');
  if (state.hero.hp <= 0) {
    state.phase = 'lost';
    addLog(state, 'Your journey ends here.', 'bad');
  } else {
    nextTurn(state);
  }
}

function validateDice(state, id, phase) {
  return state.phase === phase && findDie(state,id) && (phase === 'select' ? findDie(state,id).remaining === 0 : state.rolls[id] !== undefined);
}

export function reduceGame(original, action, rng = Math.random) {
  if (action.type === 'NEW_GAME') return newGame();
  const state = clone(original);
  state.notice = '';
  const id = action.id;
  switch (action.type) {
    case 'TOGGLE_DIE': {
      if (!validateDice(state,id,'select')) return reject(original, 'That die is still recovering.');
      if (state.selected.includes(id)) state.selected = state.selected.filter(item => item !== id);
      else if (state.selected.length < MAX_JAR) state.selected.push(id);
      else return reject(original, `Your jar can only hold ${MAX_JAR} dice.`);
      return state;
    }
    case 'ROLL': {
      if (state.phase !== 'select' || state.selected.length === 0) return reject(original, 'Choose at least one ready die.');
      if (!state.selected.some(item => !isModifier(findDie(state, item)))) return reject(original, 'Include at least one effect die so modifiers have a target.');
      state.rolls = {};
      state.selected.forEach(item => { state.rolls[item] = rollValue(findDie(state,item), rng); });
      state.links = {};
      state.order = state.selected.filter(item => !isModifier(findDie(state,item)));
      state.activeDie = null;
      state.phase = 'cast';
      addLog(state, `Turn ${state.turn}: you rolled ${state.selected.length} dice.`, 'story');
      return state;
    }
    case 'SELECT_ROLL': {
      if (!validateDice(state,id,'cast')) return original;
      state.activeDie = state.activeDie === id ? null : id;
      return state;
    }
    case 'ATTACH': {
      if (state.phase !== 'cast') return original;
      const mod = findDie(state,action.modId);
      const target = findDie(state,action.targetId);
      if (!mod || !target || !state.selected.includes(mod.id) || !state.selected.includes(target.id)) return reject(original,'Choose two rolled dice.');
      if (!isModifier(mod) || isModifier(target)) return reject(original,'Modifiers can only attach to effect dice.');
      if (mod.id === target.id) return reject(original,'A die cannot modify itself.');
      state.links[mod.id] = target.id;
      state.activeDie = null;
      return state;
    }
    case 'DETACH': {
      if (state.phase !== 'cast' || !state.links[id]) return original;
      delete state.links[id];
      state.activeDie = id;
      return state;
    }
    case 'REROLL': {
      if (!validateDice(state,id,'cast')) return original;
      if (state.hero.mana < REROLL_COST) return reject(original,'Not enough mana to reroll.');
      state.hero.mana -= REROLL_COST;
      state.rolls[id] = rollValue(findDie(state,id),rng);
      addLog(state, `Rerolled ${definition(findDie(state,id)).name} for ${REROLL_COST} mana.`, 'neutral');
      return state;
    }
    case 'NUDGE': {
      if (!validateDice(state,id,'cast')) return original;
      if (state.hero.mana < NUDGE_COST) return reject(original,'Not enough mana to nudge.');
      const die = findDie(state,id);
      if (state.rolls[id] >= Math.max(...die.faces)) return reject(original,'That die is already at its highest face.');
      state.rolls[id] += 1;
      state.hero.mana -= NUDGE_COST;
      addLog(state, `Nudged ${definition(die).name} up by 1 for ${NUDGE_COST} mana.`, 'neutral');
      return state;
    }
    case 'REORDER': {
      if (state.phase !== 'cast' || !state.order.includes(id)) return original;
      const index = state.order.indexOf(id);
      const targetIndex = index + action.step;
      if (targetIndex < 0 || targetIndex >= state.order.length) return original;
      [state.order[index],state.order[targetIndex]] = [state.order[targetIndex],state.order[index]];
      return state;
    }
    case 'COMMIT': {
      if (!canCommit(state)) return reject(original,'Attach all modifier dice before casting.');
      commitTurn(state,rng);
      return state;
    }
    case 'CLAIM_DIE': {
      if (state.phase !== 'reward' || !state.rewardOffers.includes(action.dieType)) return original;
      addOwned(state,action.dieType);
      state.phase = 'shop';
      addLog(state, `Acquired ${DICE[action.dieType].name}.`, 'good');
      return state;
    }
    case 'REST': {
      if (state.phase !== 'reward') return original;
      const healed = Math.min(14, state.hero.maxHp - state.hero.hp);
      state.hero.hp += healed;
      state.phase = 'shop';
      addLog(state, `Restored ${healed} HP by the fire.`, 'good');
      return state;
    }
    case 'FORGE_START': {
      if (state.phase !== 'reward' && state.phase !== 'shop') return original;
      if (state.phase === 'shop' && state.gold < SHOP_FORGE_COST) return reject(original,'Not enough gold to forge.');
      state.forgeReturn = 'shop';
      state.forgeCost = state.phase === 'shop' ? SHOP_FORGE_COST : 0;
      state.phase = 'forge';
      return state;
    }
    case 'FORGE_CANCEL': {
      if (state.phase !== 'forge') return original;
      state.phase = state.forgeCost === 0 ? 'reward' : 'shop';
      return state;
    }
    case 'UPGRADE_FACE': {
      if (state.phase !== 'forge') return original;
      const die = findDie(state, id);
      const index = action.faceIndex;
      if (!die || !Number.isInteger(index) || index < 0 || index >= die.faces.length) return original;
      if (die.faces[index] >= 12) return reject(original,'That face has reached the maximum value of 12.');
      if (state.gold < state.forgeCost) return reject(original,'Not enough gold.');
      die.faces[index]++;
      state.gold -= state.forgeCost;
      state.phase = 'shop';
      addLog(state, `Forged ${definition(die).name}: face ${index + 1} improved to ${die.faces[index]}.`, 'good');
      return state;
    }
    case 'SHOP_BUY_DIE': {
      if (state.phase !== 'shop' || !state.shopOffers.includes(action.dieType) || state.shopSold.includes(action.dieType)) return original;
      if (state.gold < SHOP_DIE_COST) return reject(original,'Not enough gold.');
      state.gold -= SHOP_DIE_COST;
      state.shopSold.push(action.dieType);
      addOwned(state,action.dieType);
      addLog(state, `Purchased ${DICE[action.dieType].name}.`, 'good');
      return state;
    }
    case 'SHOP_HEAL': {
      if (state.phase !== 'shop') return original;
      if (state.hero.hp === state.hero.maxHp) return reject(original,'You are already at full health.');
      if (state.gold < SHOP_HEAL_COST) return reject(original,'Not enough gold.');
      state.gold -= SHOP_HEAL_COST;
      const healed = Math.min(12,state.hero.maxHp - state.hero.hp);
      state.hero.hp += healed;
      addLog(state, `Bought a restorative draught (+${healed} HP).`, 'good');
      return state;
    }
    case 'NEXT_ENCOUNTER': {
      if (state.phase !== 'shop' || state.encounter >= ENCOUNTERS.length - 1) return original;
      startBattle(state,state.encounter + 1);
      return state;
    }
    default: return original;
  }
}

export function diceById(state) { return Object.fromEntries(state.dice.map(d => [d.id,d])); }
export function dieStateInfo(state, die) {
  const type = definition(die);
  const avg = die.faces.reduce((a,b)=>a+b,0)/die.faces.length;
  return { ...type, ...FAMILY[type.family], average: avg, isModifier: isModifier(die) };
}