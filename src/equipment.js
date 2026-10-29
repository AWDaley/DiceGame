import { EQUIPMENT, MANEUVERS, LOADOUT_CAP, ACTION_SUPPORTS, REACTION_SUPPORTS, ATTRIBUTES } from './content.js';

/** @typedef {{id:string, definitionId:string, faces:number[], charges:number|null, readyRound:number, lastUsedRound:number}} Item */
export function makeItem(definitionId, id) {
  const d = Object.hasOwn(EQUIPMENT, definitionId) ? EQUIPMENT[definitionId] : null;
  if (!d || typeof id !== 'string' || !id) throw new Error(`Unknown equipment or invalid ID: ${definitionId}`);
  return { id, definitionId, faces: [...d.faces], charges: d.charges ?? null, readyRound: 1, lastUsedRound: 0 };
}
export function itemById(actor, id) { return actor.items.find(item => item.id === id); }
export function itemDefinition(item) { return EQUIPMENT[item.definitionId]; }
export function modifierManeuver(item) { return itemDefinition(item).maneuvers.find(id => MANEUVERS[id].timing === 'modifier'); }
export function validItemInstance(item) {
  if (!item || typeof item.id !== 'string' || !item.id || !Object.hasOwn(EQUIPMENT, item.definitionId)) return false;
  const maxCharges = EQUIPMENT[item.definitionId].charges;
  return Array.isArray(item.faces) && item.faces.length === 6
    && item.faces.every(n => Number.isInteger(n) && n >= 0 && n <= 12)
    && (maxCharges === undefined ? item.charges === null : Number.isInteger(item.charges) && item.charges >= 0 && item.charges <= maxCharges)
    && Number.isInteger(item.readyRound) && item.readyRound >= 1
    && Number.isInteger(item.lastUsedRound) && item.lastUsedRound >= 0;
}
export function itemReason(actor, item, round) {
  if (!item) return 'Item not owned.';
  if (!validItemInstance(item)) return 'Invalid equipment instance.';
  if (!actor.equippedItemIds.includes(item.id)) return 'In backpack; equip between battles.';
  if (item.charges === 0) return 'Out of charges; replenish between battles.';
  if (item.readyRound > round) return item.lastUsedRound === round ? `Used this round; ready in round ${item.readyRound}.` : `Recovering; ready in round ${item.readyRound}.`;
  return '';
}
export function compatibleModifier(primary, modifier) {
  if (!primary || !modifier || modifier.timing !== 'modifier' || primary.timing === 'modifier') return false;
  if (modifier.kind === 'aim') return primary.timing === 'action' && primary.tags.includes('dodgeable');
  if (modifier.kind === 'venom') return ['attack','counter'].includes(primary.kind) && primary.tags.includes('weapon');
  return ['add','multiply'].includes(modifier.kind);
}
export function compatibleReaction(reaction, incoming) {
  return reaction?.timing === 'reaction' && !!incoming && reaction.respondsTo.some(tag => tag === 'any' || incoming.tags.includes(tag));
}
export function bundleEntries(actor, bundle) {
  if (!bundle) return [];
  return [{ item: itemById(actor, bundle.itemId), maneuverId: bundle.maneuverId }, ...(bundle.modifierIds || []).map(id => {
    const item = itemById(actor, id); return { item, maneuverId: item ? modifierManeuver(item) : null };
  })];
}
export function bundleCost(actor, bundle) {
  return bundleEntries(actor, bundle).reduce((total, e) => total + (MANEUVERS[e.maneuverId]?.manaCost || 0), 0);
}
export function validateBundle(actor, bundle, timing, round, incoming = null) {
  if (!bundle || typeof bundle.itemId !== 'string' || !Array.isArray(bundle.modifierIds)) return 'Choose a primary maneuver.';
  const primary = MANEUVERS[bundle.maneuverId], item = itemById(actor, bundle.itemId);
  if (!primary || primary.timing !== timing || !validItemInstance(item) || !itemDefinition(item).maneuvers.includes(bundle.maneuverId)) return 'This item cannot perform that maneuver.';
  if (timing === 'reaction' && !compatibleReaction(primary, incoming)) return 'That reaction cannot answer this maneuver.';
  const limit = timing === 'action' ? ACTION_SUPPORTS : REACTION_SUPPORTS;
  if (bundle.modifierIds.length > limit) return `At most ${limit} supporting items allowed.`;
  const ids = [bundle.itemId, ...bundle.modifierIds];
  if (ids.some(id => typeof id !== 'string') || new Set(ids).size !== ids.length) return 'Each physical item can only be used once.';
  for (const id of ids) {
    const owned = itemById(actor, id), reason = itemReason(actor, owned, round);
    if (reason) return reason;
    if (id !== bundle.itemId && !compatibleModifier(primary, MANEUVERS[modifierManeuver(owned)])) return 'Modifier is incompatible with this maneuver.';
  }
  if (bundleCost(actor, bundle) > actor.mana) return 'Not enough mana for this combination.';
  return '';
}
export function validateLoadout(actor) {
  if (!Array.isArray(actor.items) || !actor.items.every(validItemInstance) || new Set(actor.items.map(i => i.id)).size !== actor.items.length) return 'Invalid or duplicated owned equipment.';
  const ids = actor.equippedItemIds;
  if (!Array.isArray(ids) || ids.length > LOADOUT_CAP || new Set(ids).size !== ids.length) return `Equip at most ${LOADOUT_CAP} unique items.`;
  if (ids.some(id => !itemById(actor, id))) return 'Loadout contains an unowned item.';
  const items = ids.map(id => itemById(actor, id));
  if (!items.some(i => i.definitionId === 'focus_crystal')) return 'Equip a Focus Crystal so you can always recover mana.';
  if (!items.some(i => i.charges === null && itemDefinition(i).maneuvers.some(id => MANEUVERS[id].timing === 'action' && ['attack','poison'].includes(MANEUVERS[id].kind)))) return 'Equip a repeatable attack or poison spell.';
  return '';
}
/** Validate static content once at boot and in CI; never silently ignore bad data. */
export function validateDefinitions() {
  for (const [id, m] of Object.entries(MANEUVERS)) {
    if (!ATTRIBUTES[m.attribute] || !['action','reaction','modifier'].includes(m.timing)) throw new Error(`Invalid maneuver ${id}`);
    if (![m.manaCost, m.recoveryRounds].every(n => Number.isInteger(n) && n >= 0)) throw new Error(`Invalid cost/recovery: ${id}`);
    if (!Array.isArray(m.tags) || (m.timing === 'reaction' && !Array.isArray(m.respondsTo))) throw new Error(`Missing tags: ${id}`);
    if (m.tags.includes('dodgeable') && !(Number.isInteger(m.accuracy) && m.accuracy > 0)) throw new Error(`Missing accuracy: ${id}`);
    if (m.tags.includes('parryable') && !(Number.isInteger(m.parryDifficulty) && m.parryDifficulty > 0)) throw new Error(`Missing parry difficulty: ${id}`);
  }
  for (const [id, d] of Object.entries(EQUIPMENT)) {
    if (d.faces.length !== 6 || !d.faces.every(n => Number.isInteger(n) && n >= 0 && n <= 12) || !d.maneuvers.length || d.maneuvers.some(m => !MANEUVERS[m])) throw new Error(`Invalid equipment: ${id}`);
    if (d.charges !== undefined && !(Number.isInteger(d.charges) && d.charges > 0)) throw new Error(`Invalid charges: ${id}`);
    if (d.maneuvers.some(m => MANEUVERS[m].timing === 'modifier') && d.maneuvers.length !== 1) throw new Error(`Modifier item must have one maneuver: ${id}`);
  }
  return true;
}
