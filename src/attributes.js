import { ATTRIBUTES, TALENTS, MAX_MANA, MANA_REGEN, BASE_HP, HP_PER_VITALITY } from './content.js';

export function emptyAttributes() { return Object.fromEntries(Object.keys(ATTRIBUTES).map(key => [key, 0])); }
/** Timed penalties are eligible only after their originating exchange. */
export function temporaryAttributeBonus(actor, attribute, exchangeId, focus = null) {
  return actor.statEffects.filter(e => e.attribute === attribute && e.uses > 0 && e.startsAfterExchange < exchangeId)
    .reduce((sum, e) => sum + e.amount, 0) + (focus?.attribute === attribute ? focus.amount : 0);
}
export function attributeBonus(actor, attribute, exchangeId = 0, focus = null) {
  return (actor.attributes[attribute] || 0) + temporaryAttributeBonus(actor, attribute, exchangeId, focus);
}
export function derivedStats(actor) {
  const resistances = { physical: 0, poison: 0, arcane: 0 };
  let manaRegen = MANA_REGEN;
  for (const id of Object.values(actor.talents)) {
    const t = TALENTS[id];
    if (!t || actor.attributes[t.attribute] < 2) continue;
    manaRegen += t.manaRegen || 0;
    if (t.resistance) resistances[t.resistance] += t.amount;
  }
  return { maxHp: (actor.baseHp ?? BASE_HP) + actor.attributes.vitality * HP_PER_VITALITY,
    maxMana: (actor.baseMana ?? MAX_MANA) + actor.attributes.spirit, manaRegen, resistances };
}
export function syncDerivedStats(actor) {
  const d = derivedStats(actor);
  actor.hp = Math.min(d.maxHp, Math.max(0, actor.hp + d.maxHp - actor.maxHp));
  actor.mana = Math.min(d.maxMana, Math.max(0, actor.mana + d.maxMana - actor.maxMana));
  Object.assign(actor, d);
}
export function missingTalents(actor) { return ['vitality','spirit'].filter(a => actor.attributes[a] >= 2 && !actor.talents[a]); }
export function canConfirmAttributes(state) {
  return ['character','levelup'].includes(state.phase) && state.combatants.hero.attributePoints === 0 && !missingTalents(state.combatants.hero).length;
}
export function multiplierFromRoll(n) { return Math.max(1, Math.min(3, Math.ceil(n / 2))); }
