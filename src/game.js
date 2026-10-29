import { ATTRIBUTES, TALENTS, ENCOUNTERS, EQUIPMENT, STARTING_ITEMS, REWARD_POOL, BASE_HP, MAX_MANA,
  STARTING_ATTRIBUTE_POINTS, STARTING_ATTRIBUTE_CAP, ATTRIBUTE_CAP, SHOP_ITEM_COST, SHOP_FORGE_COST, SHOP_HEAL_COST, SHOP_REFILL_COST, LOADOUT_CAP, MANA_REGEN, HP_PER_VITALITY } from './content.js';
import { emptyAttributes, syncDerivedStats, canConfirmAttributes } from './attributes.js';
import { makeItem, itemById, itemDefinition, validateLoadout } from './equipment.js';
import { COMBAT_COMMANDS, initializeCombat, applyCombatCommand, terminalOutcome } from './combat.js';
import { emit } from './events.js';

export function makeCombatant(id, name, options = {}) {
  const baseHp = options.baseHp ?? BASE_HP, baseMana = options.baseMana ?? MAX_MANA;
  const actor = { id, name, baseHp, baseMana, attributes: { ...emptyAttributes(), ...options.attributes }, talents: {},
    hp: baseHp, maxHp: baseHp, mana: baseMana, maxMana: baseMana, manaRegen: MANA_REGEN,
    resistances: { physical: 0, poison: 0, arcane: 0 }, armor: options.armor || 0, poise: options.poise || 7,
    items: [], equippedItemIds: [], attributePoints: 0, poison: 0, weaken: 0, power: { amount: 0, charges: 0 },
    statEffects: [], pendingSkip: false, resolveProtection: false, focusReadyRound: 1,
    mainActionAvailable: true, reactionAvailable: true, freeRecollections: 1, policy: options.policy || 'balanced' };
  syncDerivedStats(actor);
  return actor;
}
function createEnemy(index) {
  const def = ENCOUNTERS[index];
  const enemy = makeCombatant('enemy', def.name, { ...def, baseHp: def.hp - (def.attributes.vitality || 0) * HP_PER_VITALITY });
  enemy.items = def.items.map((type, i) => makeItem(type, `enemy-${index}-${i + 1}`));
  enemy.equippedItemIds = enemy.items.map(item => item.id);
  return enemy;
}
export function newGame() {
  const hero = makeCombatant('hero', 'The Wanderer');
  hero.attributePoints = STARTING_ATTRIBUTE_POINTS;
  hero.items = STARTING_ITEMS.map((type, i) => makeItem(type, `item-${i + 1}`));
  hero.equippedItemIds = hero.items.slice(0, LOADOUT_CAP).map(item => item.id);
  return { schemaVersion: 4, revision: 0, phase: 'character', encounter: 0, level: 1, nextId: hero.items.length + 1,
    combatants: { hero, enemy: createEnemy(0) }, combat: null, allocationBase: emptyAttributes(),
    gold: 0, rewardOffers: [], shopOffers: [], shopSold: [], forgeCost: 0, forgeReturn: 'shop',
    outcome: null, notice: '', events: [], eventCounter: 0 };
}
function pickOffers(rng) {
  const pool = [...REWARD_POOL], offers = [];
  while (offers.length < 3 && pool.length) {
    const n = rng();
    if (!Number.isFinite(n) || n < 0 || n >= 1) throw new Error('RNG outside [0, 1).');
    offers.push(pool.splice(Math.floor(n * pool.length), 1)[0]);
  }
  return offers;
}
function addOwned(state, definitionId) {
  state.combatants.hero.items.push(makeItem(definitionId, `item-${state.nextId++}`));
  emit(state, 'ITEM_ACQUIRED', 'hero', { definitionId }, `Acquired ${EQUIPMENT[definitionId].name}; equip it between encounters.`);
}
function finishBattle(state, rng) {
  const outcome = terminalOutcome(state);
  if (!outcome) return;
  state.outcome = outcome;
  if (outcome !== 'victory') {
    state.phase = 'lost';
    emit(state, 'RUN_ENDED', null, { outcome }, outcome === 'draw' ? 'Both combatants fall to poison. The run ends in a draw, without rewards.' : 'The Wanderer falls. Your next build begins with a new run.');
    return;
  }
  const gold = ENCOUNTERS[state.encounter].gold;
  state.gold += gold;
  emit(state, 'VICTORY', 'hero', { gold }, `${state.combatants.enemy.name} defeated. ${gold} gold found.`);
  if (state.encounter === ENCOUNTERS.length - 1) { state.phase = 'won'; return; }
  state.phase = 'levelup'; state.level++;
  state.combatants.hero.attributePoints = 1;
  state.allocationBase = { ...state.combatants.hero.attributes };
  state.combatants.hero.statEffects = [];
  state.rewardOffers = pickOffers(rng); state.shopOffers = pickOffers(rng); state.shopSold = [];
}
const CAMPAIGN_COMMANDS = ['ALLOCATE_ATTRIBUTE','CHOOSE_TALENT','CONFIRM_ATTRIBUTES','TOGGLE_EQUIPMENT','BEGIN_BATTLE','CLAIM_ITEM','REST','FORGE_START','FORGE_CANCEL','UPGRADE_FACE','SHOP_BUY_ITEM','SHOP_HEAL','SHOP_REFILL','NEXT_ENCOUNTER'];
/** Pure reducer: invalid commands cannot mutate resources, items or the RNG stream. */
export function reduceGame(original, action, rng = Math.random) {
  if (!action || typeof action.type !== 'string') return original;
  if (action.type === 'NEW_GAME') {
    if (action.expectedRevision !== original.revision) return { ...original, notice: 'Stale request; choose again.' };
    return { ...newGame(), revision: original.revision + 1 };
  }
  if (![...CAMPAIGN_COMMANDS, ...COMBAT_COMMANDS].includes(action.type)) return original;
  if (action.expectedRevision !== original.revision) return { ...original, notice: 'Stale request; choose again.' };
  const state = structuredClone(original), hero = state.combatants.hero;
  state.notice = '';
  try {
    if (COMBAT_COMMANDS.includes(action.type)) {
      if (state.phase !== 'battle') throw new Error('Combat is not active.');
      applyCombatCommand(state, action, rng);
      finishBattle(state, rng);
    } else switch (action.type) {
      case 'ALLOCATE_ATTRIBUTE': {
        if (!['character','levelup'].includes(state.phase) || !Object.hasOwn(ATTRIBUTES, action.attribute) || ![1,-1].includes(action.delta)) throw new Error('Attributes can only be changed during allocation.');
        const key = action.attribute, cap = state.phase === 'character' ? STARTING_ATTRIBUTE_CAP : ATTRIBUTE_CAP;
        if (action.delta === 1 && (hero.attributePoints < 1 || hero.attributes[key] >= cap)) throw new Error('No available point or attribute at its cap.');
        if (action.delta === -1 && hero.attributes[key] <= state.allocationBase[key]) throw new Error('Established attributes cannot be refunded.');
        hero.attributes[key] += action.delta; hero.attributePoints -= action.delta;
        if (hero.attributes[key] < 2) delete hero.talents[key];
        syncDerivedStats(hero); break;
      }
      case 'CHOOSE_TALENT': {
        const talent = Object.hasOwn(TALENTS, action.talent) ? TALENTS[action.talent] : null;
        if (!['character','levelup'].includes(state.phase) || !talent || hero.attributes[talent.attribute] < 2 || state.allocationBase[talent.attribute] >= 2) throw new Error('That talent is unavailable or locked.');
        hero.talents[talent.attribute] = action.talent; syncDerivedStats(hero); break;
      }
      case 'CONFIRM_ATTRIBUTES':
        if (!canConfirmAttributes(state)) throw new Error('Spend all points and choose your unlocked talents.');
        state.phase = state.phase === 'character' ? 'loadout' : 'reward'; break;
      case 'TOGGLE_EQUIPMENT': {
        if (state.phase !== 'loadout') throw new Error('Change equipment only between battles.');
        const item = itemById(hero, action.itemId);
        if (!item) throw new Error('Item not owned.');
        const ids = hero.equippedItemIds;
        if (ids.includes(item.id)) hero.equippedItemIds = ids.filter(id => id !== item.id);
        else if (ids.length < LOADOUT_CAP) ids.push(item.id);
        else throw new Error('Eight items are already equipped. Unequip one first.');
        break;
      }
      case 'BEGIN_BATTLE': {
        if (state.phase !== 'loadout') throw new Error('Prepare equipment before battle.');
        const reason = validateLoadout(hero); if (reason) throw new Error(reason);
        state.combatants.enemy = createEnemy(state.encounter); state.outcome = null;
        initializeCombat(state); break;
      }
      case 'CLAIM_ITEM':
        if (state.phase !== 'reward' || !state.rewardOffers.includes(action.definitionId)) throw new Error('That reward is not offered.');
        addOwned(state, action.definitionId); state.phase = 'shop'; break;
      case 'REST':
        if (state.phase !== 'reward') throw new Error('Rest is a victory reward.');
        hero.hp = Math.min(hero.maxHp, hero.hp + 14); state.phase = 'shop'; break;
      case 'FORGE_START':
        if (!['reward','shop'].includes(state.phase)) throw new Error('Forge between encounters.');
        state.forgeReturn = state.phase;
        state.forgeCost = state.phase === 'shop' ? SHOP_FORGE_COST : 0;
        if (state.gold < state.forgeCost) throw new Error('Not enough gold.');
        state.phase = 'forge'; break;
      case 'FORGE_CANCEL':
        if (state.phase !== 'forge') throw new Error('Not at the forge.');
        state.phase = state.forgeReturn; break;
      case 'UPGRADE_FACE': {
        if (state.phase !== 'forge') throw new Error('Not at the forge.');
        const item = itemById(hero, action.itemId), n = action.faceIndex;
        if (!item || !Number.isInteger(n) || n < 0 || n >= item.faces.length) throw new Error('Choose a valid item face.');
        if (item.faces[n] >= 12 || state.gold < state.forgeCost) throw new Error('Face at its cap, or insufficient gold.');
        item.faces[n]++; state.gold -= state.forgeCost; state.phase = 'shop';
        emit(state, 'FACE_UPGRADED', 'hero', { itemId: item.id, faceIndex: n }, `${itemDefinition(item).name}: face ${n + 1} is now ${item.faces[n]}. All its maneuvers share that face.`); break;
      }
      case 'SHOP_BUY_ITEM':
        if (state.phase !== 'shop' || !state.shopOffers.includes(action.definitionId) || state.shopSold.includes(action.definitionId) || state.gold < SHOP_ITEM_COST) throw new Error('Item unavailable or insufficient gold.');
        state.gold -= SHOP_ITEM_COST; state.shopSold.push(action.definitionId); addOwned(state, action.definitionId); break;
      case 'SHOP_HEAL':
        if (state.phase !== 'shop' || state.gold < SHOP_HEAL_COST || hero.hp >= hero.maxHp) throw new Error('Healing is unavailable.');
        state.gold -= SHOP_HEAL_COST; hero.hp = Math.min(hero.maxHp, hero.hp + 12); break;
      case 'SHOP_REFILL': {
        const item = itemById(hero, action.itemId), max = item && itemDefinition(item).charges;
        if (state.phase !== 'shop' || !max || item.charges >= max || state.gold < SHOP_REFILL_COST) throw new Error('Refill is unavailable.');
        state.gold -= SHOP_REFILL_COST; item.charges = max; break;
      }
      case 'NEXT_ENCOUNTER':
        if (state.phase !== 'shop' || state.encounter >= ENCOUNTERS.length - 1) throw new Error('No next encounter.');
        state.encounter++; state.phase = 'loadout'; break;
      default: return original;
    }
    state.revision++;
    return state;
  } catch (error) {
    return { ...original, notice: error.message || 'Invalid command.' };
  }
}
