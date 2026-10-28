import { ATTRIBUTES, TALENTS, MAX_MANA, MANA_REGEN, BASE_HP, HP_PER_VITALITY, FOCUS_COST } from './content.js';

export function emptyAttributes() {
  return Object.fromEntries(Object.keys(ATTRIBUTES).map(key => [key, 0]));
}
export function temporaryAttributeBonus(state, attribute) {
  return state.hero.statEffects.filter(e => e.attribute === attribute && e.expiresAfterTurn >= state.turn)
    .reduce((total, effect) => total + effect.amount, 0);
}
export function attributeBonus(state, attribute) {
  return state.hero.attributes[attribute] + temporaryAttributeBonus(state, attribute);
}
export function derivedStats(hero) {
  const resistances = { physical: 0, poison: 0, arcane: 0 };
  let manaRegen = MANA_REGEN;
  for (const id of Object.values(hero.talents)) {
    const talent = TALENTS[id];
    if (!talent || hero.attributes[talent.attribute] < 2) continue;
    manaRegen += talent.manaRegen || 0;
    if (talent.resistance) resistances[talent.resistance] += talent.amount;
  }
  return { maxHp: BASE_HP + hero.attributes.vitality * HP_PER_VITALITY,
    maxMana: MAX_MANA + hero.attributes.spirit, manaRegen, resistances };
}
// Preserve missing HP/mana when raising/lowering capacities during allocation.
export function syncDerivedStats(hero) {
  const derived = derivedStats(hero);
  hero.hp = Math.min(derived.maxHp, Math.max(0, hero.hp + derived.maxHp - hero.maxHp));
  hero.mana = Math.min(derived.maxMana, Math.max(0, hero.mana + derived.maxMana - hero.maxMana));
  Object.assign(hero, derived);
}
export function missingTalents(state) {
  return ['vitality', 'spirit'].filter(key => state.hero.attributes[key] >= 2 && !state.hero.talents[key]);
}
export function canConfirmAttributes(state) {
  return ['character', 'levelup'].includes(state.phase) && state.hero.attributePoints === 0 && !missingTalents(state).length;
}
export function canFocus(state) {
  return ['select', 'cast'].includes(state.phase) && state.hero.focusRemaining === 0 && state.hero.mana >= FOCUS_COST;
}
export function multiplierFromRoll(value) { return Math.max(1, Math.min(3, Math.ceil(value / 2))); }
