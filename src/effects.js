import { MANEUVERS } from './content.js';
import { temporaryAttributeBonus, multiplierFromRoll } from './attributes.js';
import { bundleEntries } from './equipment.js';
import { emit } from './events.js';

const bounded = (n, cap = 999) => Math.min(cap, Math.max(0, n));
/** Pure: never rolls or changes the actor. Used for both previews and locking. */
export function calculateBundle(actor, bundle, raw, exchangeId, focus = null) {
  if (!bundle) return null;
  const primary = MANEUVERS[bundle.maneuverId];
  const breakdown = bundleEntries(actor, bundle).map(({item, maneuverId}) => {
    const m = MANEUVERS[maneuverId];
    const face = raw[item.id];
    if (!Number.isFinite(face)) throw new Error(`Missing face for ${item.id}`);
    const permanent = actor.attributes[m.attribute] || 0;
    const temporary = temporaryAttributeBonus(actor, m.attribute, exchangeId, focus);
    const adjusted = Math.max(0, face + permanent + temporary);
    return { itemId: item.id, maneuverId, attribute: m.attribute, raw: face, permanent, temporary, adjusted,
      contribution: m.kind === 'multiply' ? multiplierFromRoll(adjusted) : adjusted };
  });
  let add = 0, multiplier = 1, accuracy = primary.accuracy || 0, poison = 0;
  for (const b of breakdown.slice(1)) {
    const kind = MANEUVERS[b.maneuverId].kind;
    if (kind === 'add') add += b.contribution;
    if (kind === 'multiply') multiplier *= b.contribution;
    if (kind === 'aim') accuracy += b.contribution;
    if (kind === 'venom') poison += b.contribution;
  }
  const attack = ['attack','counter'].includes(primary.kind);
  const power = attack && actor.power.charges > 0 ? actor.power.amount : 0;
  const weakened = attack ? actor.weaken : 0;
  const base = (breakdown[0].adjusted + add) * multiplier;
  const effect = bounded(base + power - weakened, primary.outputCap ?? 999);
  return { maneuverId: bundle.maneuverId, kind: primary.kind, damageType: primary.damageType || null,
    name: primary.name, tags: [...primary.tags], parryDifficulty: primary.parryDifficulty || 0,
    penaltyAttribute: primary.penaltyAttribute || null, effect, accuracy: bounded(accuracy), poison: bounded(poison),
    breakdown, add, multiplier, power, weakened, base, capped: effect !== base + power - weakened };
}
export function estimateBundle(actor, bundle, exchangeId, focus = null, mode = 'mean') {
  if (!bundle) return null;
  const raw = Object.fromEntries(bundleEntries(actor, bundle).map(({item}) => [item.id,
    mode === 'min' ? Math.min(...item.faces) : mode === 'max' ? Math.max(...item.faces) : item.faces.reduce((a,b)=>a+b,0)/item.faces.length]));
  return calculateBundle(actor, bundle, raw, exchangeId, focus);
}
export function damageBreakdown(target, amount, damageType, protection = 0) {
  const armored = damageType === 'physical' ? Math.min(amount, target.armor) : 0;
  const resisted = Math.min(amount - armored, target.resistances[damageType] || 0);
  const blocked = Math.min(amount - armored - resisted, protection);
  return { armored, resisted, blocked, damage: Math.max(0, amount - armored - resisted - blocked) };
}
export function applyDamage(state, sourceId, targetId, amount, damageType, protection = 0) {
  const target = state.combatants[targetId];
  const result = damageBreakdown(target, amount, damageType, protection);
  const before = target.hp;
  target.hp = Math.max(0, target.hp - result.damage);
  emit(state, 'DAMAGE_APPLIED', sourceId, { targetId, amount, damageType, ...result, hpLost: before - target.hp },
    `${target.name}: ${result.damage} ${damageType} damage (${result.armored} armor, ${result.resisted} resisted, ${result.blocked} defended).`);
  return result.damage;
}
function restoreMana(state, id, amount) {
  const actor = state.combatants[id], restored = Math.min(actor.maxMana - actor.mana, amount);
  actor.mana += restored;
  emit(state, 'MANA_RECOVERED', id, { amount: restored }, `${actor.name} recovers ${restored} mana.`);
}
function applyPoison(state, id, targetId, amount) {
  if (amount <= 0) return;
  const target = state.combatants[targetId];
  target.poison = bounded(target.poison + amount);
  emit(state, 'POISON_APPLIED', id, { targetId, amount }, `${target.name} receives ${amount} poison.`);
}
function consumeAttackAttempt(actor) {
  if (actor.power.charges > 0 && --actor.power.charges === 0) actor.power.amount = 0;
  actor.weaken = 0;
}
function consumeStatuses(actor, exchangeId) {
  for (const status of actor.statEffects) if (status.startsAfterExchange < exchangeId) status.uses--;
  actor.statEffects = actor.statEffects.filter(status => status.uses > 0);
}
function executePrimary(state, id, targetId, result, defense) {
  const actor = state.combatants[id], target = state.combatants[targetId];
  const protection = defense && ((defense.kind === 'block' && result.tags.includes('blockable')) || (defense.kind === 'ward' && result.tags.includes('wardable'))) ? defense.effect : 0;
  const strength = Math.max(0, result.effect - protection);
  switch (result.kind) {
    case 'attack':
    case 'counter': {
      const damage = applyDamage(state, id, targetId, result.effect, result.damageType, protection);
      if (damage > 0) applyPoison(state, id, targetId, result.poison);
      break;
    }
    case 'recover': restoreMana(state, id, result.effect); break;
    case 'breath': restoreMana(state, id, Math.floor(result.effect / 2)); break;
    case 'heal': {
      const amount = Math.min(actor.maxHp - actor.hp, result.effect);
      actor.hp += amount;
      emit(state, 'HEALED', id, { amount }, `${actor.name} restores ${amount} HP.`); break;
    }
    case 'poison': applyPoison(state, id, targetId, strength); break;
    case 'sunder': {
      const amount = Math.min(target.armor, strength);
      target.armor -= amount;
      emit(state, 'ARMOR_REMOVED', id, { targetId, amount }, `${actor.name} removes ${amount} armor from ${target.name}.`); break;
    }
    case 'weaken':
      target.weaken = bounded(target.weaken + strength);
      emit(state, 'WEAKEN_APPLIED', id, { targetId, amount: strength }, `${target.name} loses up to ${strength} damage on its next attack attempt.`); break;
    case 'rally':
      actor.power = { amount: Math.ceil(result.effect / 2), charges: 2 };
      emit(state, 'POWER_APPLIED', id, { ...actor.power }, `${actor.name}: next 2 attack attempts gain ${actor.power.amount} damage.`); break;
    case 'penalty':
      if (strength > 0) {
        target.statEffects.push({ id: `${state.combat.exchangeId}:${id}:${result.penaltyAttribute}`, attribute: result.penaltyAttribute, amount: -strength, uses: 1, startsAfterExchange: state.combat.exchangeId, source: result.name });
        emit(state, 'ATTRIBUTE_PENALTY', id, { targetId, attribute: result.penaltyAttribute, amount: strength }, `${target.name}: −${strength} ${result.penaltyAttribute} for its next rolled exchange.`);
      }
      break;
    case 'stagger': {
      const succeeds = strength >= target.poise && !target.pendingSkip && !target.resolveProtection;
      if (succeeds) target.pendingSkip = true;
      const reason = strength < target.poise ? 'below Poise' : target.resolveProtection ? 'Resolve protects' : !succeeds ? 'skip already pending' : 'next main action will be skipped';
      emit(state, succeeds ? 'SKIP_SCHEDULED' : 'STAGGER_RESISTED', id, { targetId, stagger: strength, poise: target.poise, reason }, `${result.name}: ${strength} stagger vs ${target.poise} Poise — ${reason}.`);
      break;
    }
    default: throw new Error(`Unsupported primary effect: ${result.kind}`);
  }
}
/** Resolve once using locked values, never recalculating an opponent's locked roll. */
export function resolveExchange(state) {
  const e = state.combat.exchange;
  const actor = state.combatants[e.actorId], defender = state.combatants[e.defenderId];
  const action = e.locked[e.actorId], reaction = e.locked[e.defenderId] || null;
  const dodged = reaction?.kind === 'dodge' && reaction.effect >= action.accuracy;
  const parried = reaction?.kind === 'parry' && reaction.effect >= action.parryDifficulty;
  if (action.kind === 'attack') consumeAttackAttempt(actor);
  if (dodged || parried) {
    emit(state, parried ? 'ACTION_INTERRUPTED' : 'ATTACK_AVOIDED', e.defenderId,
      { maneuverId: action.maneuverId, defense: reaction.effect, difficulty: parried ? action.parryDifficulty : action.accuracy },
      `${defender.name} ${parried ? 'parries' : 'dodges'} ${action.name}: ${reaction.effect} meets ${parried ? action.parryDifficulty : action.accuracy}.`);
  } else {
    if (['dodge','parry'].includes(reaction?.kind)) emit(state, 'AVOIDANCE_FAILED', e.defenderId, {}, `${reaction.name} fails to meet the difficulty.`);
    executePrimary(state, e.actorId, e.defenderId, action, reaction);
  }
  // A stagger schedules a future main skip, not the already committed reaction.
  if (actor.hp > 0 && defender.hp > 0 && ['counter','breath'].includes(reaction?.kind)) {
    if (reaction.kind === 'counter') consumeAttackAttempt(defender);
    executePrimary(state, e.defenderId, e.actorId, reaction, null);
  }
  consumeStatuses(actor, e.id);
  if (e.reaction) consumeStatuses(defender, e.id);
  emit(state, 'EXCHANGE_RESOLVED', e.actorId, { exchangeId: e.id }, 'Exchange resolved. Equipment and mana remain shared for this round.');
}
export function tickPoison(state) {
  const ticks = Object.entries(state.combatants).map(([id, c]) => ({ id, stacks: c.poison, damage: Math.max(0, c.poison - c.resistances.poison) }));
  for (const tick of ticks) {
    const c = state.combatants[tick.id];
    c.hp = Math.max(0, c.hp - tick.damage);
    c.poison = Math.max(0, tick.stacks - 1);
    if (tick.stacks) emit(state, 'POISON_TICK', tick.id, tick, `${c.name} takes ${tick.damage} poison damage; ${c.poison} stacks remain.`);
  }
}
