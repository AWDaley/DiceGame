import { MANEUVERS, FREE_RECOLLECTIONS, REROLL_COST, NUDGE_COST, FOCUS_COST, FOCUS_BONUS, FOCUS_RECOVERY, ATTRIBUTES } from './content.js';
import { bundleCost, bundleEntries, validateBundle, itemById, itemDefinition, modifierManeuver, compatibleModifier, compatibleReaction, itemReason } from './equipment.js';
import { calculateBundle, resolveExchange, tickPoison } from './effects.js';
import { emit } from './events.js';

export const COMBAT_COMMANDS = ['SELECT_MANEUVER','TOGGLE_MODIFIER','DECLARE_ACTION','DECLARE_REACTION','PASS_REACTION','PASS_TURN','REROLL','NUDGE','FOCUS','LOCK_RESULT','ACK_EXCHANGE'];
export function otherId(id) { return id === 'hero' ? 'enemy' : 'hero'; }
export function activeId(state) { return state.combat.turnOrder[state.combat.activeTurnIndex]; }
export function decisionActor(state) {
  if (state.phase !== 'battle') return null;
  const c = state.combat;
  if (['action','manipulate_actor'].includes(c.stage)) return activeId(state);
  if (['reaction','manipulate_defender'].includes(c.stage)) return otherId(activeId(state));
  return c.stage === 'summary' ? 'hero' : null;
}
export function combatCommand(state, type, extra = {}) {
  return { type, actorId: decisionActor(state), expectedRevision: state.revision, exchangeId: state.combat.exchangeId, ...extra };
}
export function terminalOutcome(state) {
  const h = state.combatants.hero.hp, e = state.combatants.enemy.hp;
  return h <= 0 && e <= 0 ? 'draw' : h <= 0 ? 'defeat' : e <= 0 ? 'victory' : null;
}
function emptyDraft() { return { itemId: '', maneuverId: '', modifierIds: [] }; }
function beginTurn(state) {
  const c = state.combat, id = activeId(state), actor = state.combatants[id];
  c.exchangeId++;
  c.exchange = null; c.draft = emptyDraft(); c.summaryForcedSkip = false;
  c.summaryStart = state.eventCounter;
  if (actor.pendingSkip) {
    actor.pendingSkip = false; actor.mainActionAvailable = false; actor.resolveProtection = true;
    c.stage = 'summary'; c.summaryForcedSkip = true;
    emit(state, 'MAIN_ACTION_SKIPPED', id, {}, `${actor.name} loses this main action and gains Resolve until completing a later main turn.`);
  } else {
    c.stage = 'action';
    emit(state, 'TURN_STARTED', id, {}, `${actor.name} chooses a main action.`);
  }
}
function beginRound(state, first = false) {
  const c = state.combat;
  c.activeTurnIndex = 0;
  for (const actor of Object.values(state.combatants)) {
    actor.mainActionAvailable = true; actor.reactionAvailable = true; actor.freeRecollections = FREE_RECOLLECTIONS;
    if (!first) actor.mana = Math.min(actor.maxMana, actor.mana + actor.manaRegen);
  }
  emit(state, 'ROUND_STARTED', null, { round: c.roundNumber }, `Round ${c.roundNumber}: actions, reactions and Recollection refreshed${first ? '' : '; mana regenerated'}.`);
  beginTurn(state);
}
export function initializeCombat(state) {
  state.phase = 'battle';
  state.combat = { roundNumber: 1, turnOrder: ['hero','enemy'], activeTurnIndex: 0, stage: 'action', exchangeId: 0,
    exchange: null, draft: emptyDraft(), summaryStart: state.eventCounter, summaryForcedSkip: false };
  for (const actor of Object.values(state.combatants)) {
    actor.mana = actor.maxMana; actor.poison = 0; actor.weaken = 0; actor.power = { amount: 0, charges: 0 };
    actor.statEffects = []; actor.pendingSkip = false; actor.resolveProtection = false; actor.focusReadyRound = 1;
    actor.items.forEach(item => { item.readyRound = 1; item.lastUsedRound = 0; });
  }
  beginRound(state, true);
}
function commitBundle(state, id, bundle, timing) {
  const actor = state.combatants[id], cost = bundleCost(actor, bundle), c = state.combat;
  actor.mana -= cost;
  if (timing === 'action') actor.mainActionAvailable = false;
  else actor.reactionAvailable = false;
  for (const { item, maneuverId } of bundleEntries(actor, bundle)) {
    item.readyRound = c.roundNumber + MANEUVERS[maneuverId].recoveryRounds + 1;
    item.lastUsedRound = c.roundNumber;
    if (item.charges !== null) item.charges--;
  }
  emit(state, timing === 'action' ? 'ACTION_DECLARED' : 'REACTION_DECLARED', id,
    { ...structuredClone(bundle), cost }, `${actor.name} commits ${MANEUVERS[bundle.maneuverId].name}${bundle.modifierIds.length ? ` with ${bundle.modifierIds.length} support item(s)` : ''} for ${cost} mana.`);
}
function drawFace(item, rng) {
  const n = rng();
  if (!Number.isFinite(n) || n < 0 || n >= 1) throw new Error('RNG must return a finite number in [0, 1).');
  return item.faces[Math.floor(n * item.faces.length)];
}
function reveal(state, rng) {
  const e = state.combat.exchange;
  for (const [id, bundle] of [[e.actorId, e.action], [e.defenderId, e.reaction]]) {
    if (!bundle) continue;
    for (const { item } of bundleEntries(state.combatants[id], bundle)) {
      const raw = drawFace(item, rng); e.raw[id][item.id] = raw;
      emit(state, 'DIE_ROLLED', id, { itemId: item.id, raw }, `${state.combatants[id].name}: ${itemDefinition(item).name} rolls ${raw}.`);
    }
  }
  state.combat.stage = 'manipulate_actor';
}
export function legalManeuvers(state, id, timing) {
  const c = state.combat, actor = state.combatants[id];
  const incoming = c.exchange ? MANEUVERS[c.exchange.action.maneuverId] : null;
  return actor.items.filter(item => actor.equippedItemIds.includes(item.id)).flatMap(item => itemDefinition(item).maneuvers
    .filter(mid => MANEUVERS[mid].timing === timing)
    .map(maneuverId => {
      const m = MANEUVERS[maneuverId];
      let reason = itemReason(actor, item, c.roundNumber);
      if (!reason && timing === 'reaction' && !compatibleReaction(m, incoming)) reason = 'Not eligible against this maneuver.';
      if (!reason && m.manaCost > actor.mana) reason = 'Not enough mana.';
      return { itemId: item.id, maneuverId, reason };
    }));
}
/** Mutates only a cloned draft. Throws before returning on invalid commands; caller discards draft. */
export function applyCombatCommand(state, command, rng) {
  const c = state.combat, id = command.actorId, actor = state.combatants[id];
  if (command.exchangeId !== c.exchangeId || id !== decisionActor(state)) throw new Error('Stale exchange or wrong combatant.');
  const timing = c.stage === 'action' ? 'action' : c.stage === 'reaction' ? 'reaction' : null;
  const incoming = c.exchange ? MANEUVERS[c.exchange.action.maneuverId] : null;
  const manipulation = ['manipulate_actor','manipulate_defender'].includes(c.stage);
  switch (command.type) {
    case 'SELECT_MANEUVER': {
      if (!timing) throw new Error('Selections are locked after commitment.');
      const draft = { itemId: command.itemId, maneuverId: command.maneuverId, modifierIds: [] };
      const reason = validateBundle(actor, draft, timing, c.roundNumber, incoming);
      if (reason) throw new Error(reason);
      c.draft = draft; break;
    }
    case 'TOGGLE_MODIFIER': {
      if (!timing || !c.draft.itemId) throw new Error('Select a primary maneuver first.');
      const ids = c.draft.modifierIds;
      const next = { ...c.draft, modifierIds: ids.includes(command.itemId) ? ids.filter(i => i !== command.itemId) : [...ids, command.itemId] };
      const reason = validateBundle(actor, next, timing, c.roundNumber, incoming);
      if (reason) throw new Error(reason);
      c.draft = next; break;
    }
    case 'DECLARE_ACTION':
    case 'DECLARE_REACTION': {
      const requested = command.type === 'DECLARE_ACTION' ? 'action' : 'reaction';
      if (timing !== requested || !(requested === 'action' ? actor.mainActionAvailable : actor.reactionAvailable)) throw new Error('No allowance for that declaration.');
      const reason = validateBundle(actor, c.draft, requested, c.roundNumber, incoming);
      if (reason) throw new Error(reason);
      const bundle = structuredClone(c.draft);
      commitBundle(state, id, bundle, requested);
      c.draft = emptyDraft();
      if (requested === 'action') {
        c.exchange = { id: c.exchangeId, actorId: id, defenderId: otherId(id), action: bundle, reaction: null,
          raw: { hero: {}, enemy: {} }, locked: {}, focus: { hero: null, enemy: null }, manipulations: { hero: 0, enemy: 0 } };
        c.stage = 'reaction';
      } else { c.exchange.reaction = bundle; reveal(state, rng); }
      break;
    }
    case 'PASS_REACTION':
      if (c.stage !== 'reaction') throw new Error('Not a reaction window.');
      actor.reactionAvailable = false; c.draft = emptyDraft();
      emit(state, 'REACTION_PASSED', id, {}, `${actor.name} declines to react.`);
      reveal(state, rng); break;
    case 'PASS_TURN':
      if (c.stage !== 'action' || !actor.mainActionAvailable) throw new Error('Not your main turn.');
      actor.mainActionAvailable = false; c.draft = emptyDraft(); c.stage = 'summary';
      emit(state, 'MAIN_ACTION_PASSED', id, {}, `${actor.name} passes its main action.`); break;
    case 'REROLL':
    case 'NUDGE': {
      if (!manipulation) throw new Error('No manipulation window.');
      const e = c.exchange, raw = e.raw[id];
      if (!Object.hasOwn(raw, command.itemId)) throw new Error('Only manipulate your own rolled items.');
      const item = itemById(actor, command.itemId);
      const cost = command.type === 'NUDGE' ? NUDGE_COST : actor.freeRecollections > 0 ? 0 : REROLL_COST;
      if (actor.mana < cost) throw new Error('Not enough mana.');
      if (command.type === 'NUDGE' && raw[item.id] >= Math.max(...item.faces)) throw new Error('Already at the highest engraved face.');
      if (command.type === 'REROLL') {
        raw[item.id] = drawFace(item, rng);
        if (actor.freeRecollections > 0) actor.freeRecollections--;
      } else raw[item.id]++;
      actor.mana -= cost; e.manipulations[id]++;
      emit(state, 'ROLL_MANIPULATED', id, { itemId: item.id, kind: command.type, cost, raw: raw[item.id] }, `${actor.name} ${command.type === 'REROLL' ? 'rerolls' : 'nudges'} ${itemDefinition(item).name}: face ${raw[item.id]} (${cost} mana).`); break;
    }
    case 'FOCUS': {
      if (!manipulation || !Object.hasOwn(ATTRIBUTES, command.attribute)) throw new Error('Choose an attribute during your manipulation window.');
      if (actor.mana < FOCUS_COST || actor.focusReadyRound > c.roundNumber) throw new Error('Focus is unavailable or too expensive.');
      actor.mana -= FOCUS_COST; actor.focusReadyRound = c.roundNumber + FOCUS_RECOVERY + 1;
      c.exchange.focus[id] = { attribute: command.attribute, amount: FOCUS_BONUS };
      emit(state, 'FOCUS_USED', id, { attribute: command.attribute }, `${actor.name} focuses ${command.attribute}: +${FOCUS_BONUS} for this exchange only.`); break;
    }
    case 'LOCK_RESULT': {
      if (!manipulation) throw new Error('No result to lock.');
      const e = c.exchange, bundle = id === e.actorId ? e.action : e.reaction;
      e.locked[id] = calculateBundle(actor, bundle, e.raw[id], e.id, e.focus[id]);
      emit(state, 'RESULT_LOCKED', id, {}, `${actor.name} locks its result.`);
      if (c.stage === 'manipulate_actor' && e.reaction) c.stage = 'manipulate_defender';
      else { resolveExchange(state); c.stage = 'summary'; }
      break;
    }
    case 'ACK_EXCHANGE': {
      if (c.stage !== 'summary') throw new Error('No completed exchange to advance.');
      const finished = state.combatants[activeId(state)];
      if (!c.summaryForcedSkip) finished.resolveProtection = false;
      if (++c.activeTurnIndex < c.turnOrder.length) beginTurn(state);
      else {
        tickPoison(state);
        emit(state, 'ROUND_ENDED', null, {}, `Round ${c.roundNumber} ends.`);
        if (!terminalOutcome(state)) { c.roundNumber++; beginRound(state); }
        else c.stage = 'terminal';
      }
      break;
    }
    default: throw new Error('Unknown combat command.');
  }
}
