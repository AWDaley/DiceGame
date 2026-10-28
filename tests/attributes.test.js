import test from 'node:test';
import assert from 'node:assert/strict';
import { DICE, ATTRIBUTES } from '../src/content.js';
import { newGame, reduceGame, modifiedValue, adjustedRoll, rollBreakdown, makeDie, nextIntent } from '../src/game.js';
import { attributeBonus, syncDerivedStats, canConfirmAttributes, canFocus } from '../src/attributes.js';

const act = (s, type, payload = {}, rng = () => .5) => reduceGame(s, { type, ...payload }, rng);
const id = (s, type) => s.dice.find(d => d.type === type).id;
function allocate(s, attribute, times = 1) {
  for (let i = 0; i < times; i++) s = act(s, 'ALLOCATE_ATTRIBUTE', { attribute, delta: 1 });
  return s;
}
function start(stats = { might: 2, finesse: 1 }, talents = []) {
  let s = newGame();
  for (const [attribute, points] of Object.entries(stats)) s = allocate(s, attribute, points);
  for (const talent of talents) s = act(s, 'CHOOSE_TALENT', { talent });
  s = act(s, 'CONFIRM_ATTRIBUTES');
  assert.equal(s.phase, 'select');
  return s;
}
function roll(s, ...types) {
  for (const type of types) s = act(s, 'TOGGLE_DIE', { id: id(s, type) });
  return act(s, 'ROLL');
}
function attach(s, modifier, target) {
  return act(s, 'ATTACH', { modId: id(s, modifier), targetId: id(s, target) });
}
function encounter(s, index, moveIndex = 0) {
  s.encounter = index;
  s.enemy = { ...s.enemy, hp: 200, maxHp: 200, armor: 0, block: 0, poison: 0, moveIndex };
  return s;
}

test('all dice have exactly one valid attribute, independent of family', () => {
  for (const [name, d] of Object.entries(DICE)) assert.ok(Object.hasOwn(ATTRIBUTES, d.attribute), name);
  assert.notEqual(DICE.guard.attribute, DICE.parry.attribute);
  assert.notEqual(DICE.guard.attribute, DICE.barrier.attribute);
  assert.equal(DICE.guard.family, DICE.parry.family);
  assert.equal(DICE.guard.family, DICE.barrier.family);
});

test('creation starts at zero stats with three points and blocks combat until confirmed', () => {
  const s = newGame();
  assert.equal(s.phase, 'character');
  assert.equal(s.hero.attributePoints, 3);
  assert.deepEqual(Object.values(s.hero.attributes), [0, 0, 0, 0, 0]);
  assert.equal(act(s, 'ROLL').phase, 'character');
  assert.equal(act(s, 'CONFIRM_ATTRIBUTES').phase, 'character');
  assert.equal(act(s, 'TOGGLE_DIE', { id: id(s, 'strike') }).selected.length, 0);
});

test('allocation caps, invalid attributes and malformed deltas cannot spend points', () => {
  let s = allocate(newGame(), 'might', 2);
  const snapshot = structuredClone(s);
  assert.equal(allocate(s, 'might').hero.attributePoints, 1);
  for (const attribute of ['luck', '__proto__', 'constructor']) {
    assert.deepEqual(act(s, 'ALLOCATE_ATTRIBUTE', { attribute, delta: 1 }).hero, s.hero);
  }
  for (const delta of [0, 2, -2, NaN, '1']) {
    assert.deepEqual(act(s, 'ALLOCATE_ATTRIBUTE', { attribute: 'finesse', delta }).hero, s.hero);
  }
  assert.deepEqual(s, snapshot, 'actions must not mutate the input');
  assert.equal(act(s, 'ALLOCATE_ATTRIBUTE', { attribute: 'arcana', delta: -1 }).hero.attributes.arcana, 0);
});

test('attributes cannot be changed or talents bought during a battle', () => {
  const s = start();
  assert.deepEqual(allocate(s, 'might').hero, s.hero);
  assert.deepEqual(act(s, 'CHOOSE_TALENT', { talent: 'iron_skin' }).hero, s.hero);
});

test('Vitality capacity updates are reversible, without a healing/refund exploit', () => {
  let s = newGame();
  s.hero.hp = 30;
  s = allocate(s, 'vitality', 2);
  assert.equal(s.hero.maxHp, 72);
  assert.equal(s.hero.hp, 42);
  s = act(s, 'CHOOSE_TALENT', { talent: 'iron_skin' });
  s = act(s, 'ALLOCATE_ATTRIBUTE', { attribute: 'vitality', delta: -1 });
  assert.equal(s.hero.maxHp, 66);
  assert.equal(s.hero.hp, 36);
  assert.equal(s.hero.talents.vitality, undefined);
  assert.equal(s.hero.resistances.physical, 0);
  s = allocate(s, 'vitality');
  assert.equal(s.hero.hp, 42);
});

test('Spirit expands mana but only Meditation improves regeneration', () => {
  let s = allocate(newGame(), 'spirit', 2);
  assert.equal(s.hero.maxMana, 9);
  assert.equal(s.hero.mana, 9);
  assert.equal(s.hero.manaRegen, 4);
  assert.equal(canConfirmAttributes(s), false);
  s = allocate(s, 'arcana');
  assert.equal(canConfirmAttributes(s), false, 'new talent choice is required');
  s = act(s, 'CHOOSE_TALENT', { talent: 'meditation' });
  assert.equal(s.hero.manaRegen, 5);
  assert.equal(canConfirmAttributes(s), true);
  s = act(s, 'CONFIRM_ATTRIBUTES');
  assert.equal(s.hero.mana, 9);
  s.hero.mana = 0;
  s = act(roll(s, 'quick'), 'COMMIT');
  assert.equal(s.hero.mana, 5);
});

test('talents require their permanent threshold and can be changed only while newly unlocked', () => {
  let s = allocate(newGame(), 'vitality');
  assert.equal(act(s, 'CHOOSE_TALENT', { talent: 'iron_skin' }).hero.talents.vitality, undefined);
  s = allocate(s, 'vitality');
  s = act(s, 'CHOOSE_TALENT', { talent: 'iron_skin' });
  s = act(s, 'CHOOSE_TALENT', { talent: 'antitoxin' });
  assert.equal(s.hero.resistances.physical, 0);
  assert.equal(s.hero.resistances.poison, 2);
  s = allocate(s, 'might');
  s = act(s, 'CONFIRM_ATTRIBUTES');
  s.enemy.hp = 1;
  s = act(roll(s, 'strike'), 'COMMIT');
  assert.equal(s.phase, 'levelup');
  s = act(s, 'CHOOSE_TALENT', { talent: 'iron_skin' });
  assert.equal(s.hero.talents.vitality, 'antitoxin');
});

test('stat bonuses are applied once to the target and separately to each modifier', () => {
  let s = roll(start(), 'strike', 'plus', 'multiply');
  s = attach(attach(s, 'plus', 'strike'), 'multiply', 'strike');
  const b = rollBreakdown(s, id(s, 'strike'));
  assert.equal(b.raw, 4);
  assert.equal(b.adjusted, 6); // 4 + Might 2
  assert.equal(b.additive, 5); // Plus 4 + Finesse 1
  assert.equal(b.multiplier, 2);
  assert.equal(b.final, 22);
  assert.equal(s.rolls[id(s, 'strike')], 4);
});

test('moving and detaching a modifier recomputes the result without stat accumulation', () => {
  let s = roll(start(), 'strike', 'guard', 'plus');
  s = attach(s, 'plus', 'strike');
  assert.equal(modifiedValue(s, id(s, 'strike')), 11);
  s = attach(s, 'plus', 'guard');
  assert.equal(modifiedValue(s, id(s, 'strike')), 6);
  assert.equal(modifiedValue(s, id(s, 'guard')), 9);
  s = act(s, 'DETACH', { id: id(s, 'plus') });
  assert.equal(modifiedValue(s, id(s, 'guard')), 4);
});

test('every effect family, including heal, mana, stagger, and sunder, uses its assigned stat', () => {
  const s = start();
  for (const attribute of Object.keys(ATTRIBUTES)) s.hero.attributes[attribute] = 2;
  for (const [type, d] of Object.entries(DICE)) {
    const die = makeDie(type, `test-${type}`);
    s.dice.push(die);
    s.rolls[die.id] = 4;
    assert.equal(adjustedRoll(s, die.id), 6, type);
    assert.equal(modifiedValue(s, die.id), d.family === 'multiply' ? 3 : Math.min(d.outputCap ?? 999, 6), type);
  }
});

test('negative temporary stats clamp adjusted dice at zero without changing raw faces', () => {
  let s = roll(start(), 'strike', 'plus');
  s.hero.statEffects = [
    { attribute: 'might', amount: -20, source: 'Test', expiresAfterTurn: 1 },
    { attribute: 'finesse', amount: -20, source: 'Test', expiresAfterTurn: 1 },
  ];
  s = attach(s, 'plus', 'strike');
  assert.equal(modifiedValue(s, id(s, 'strike')), 0);
  assert.equal(modifiedValue(s, id(s, 'plus')), 0);
  assert.equal(s.rolls[id(s, 'strike')], 4);
});

test('multiplier conversion uses adjusted roll and is bounded from one to three', () => {
  let s = roll(start({ arcana: 2, might: 1 }), 'strike', 'multiply');
  assert.equal(modifiedValue(s, id(s, 'multiply')), 3);
  s.hero.statEffects = [{ attribute: 'arcana', amount: 100, source: 'Test', expiresAfterTurn: 1 }];
  assert.equal(modifiedValue(s, id(s, 'multiply')), 3);
  s.hero.statEffects[0].amount = -100;
  assert.equal(modifiedValue(s, id(s, 'multiply')), 1);
});

test('rerolls and nudges affect only raw faces; adjusted values may exceed six', () => {
  let s = roll(start(), 'strike');
  const target = id(s, 'strike');
  s = act(s, 'REROLL', { id: target }, () => .999);
  assert.equal(s.rolls[target], 6);
  assert.equal(modifiedValue(s, target), 8);
  const mana = s.hero.mana;
  s = act(s, 'NUDGE', { id: target });
  assert.equal(s.hero.mana, mana, 'cannot nudge beyond the highest raw face');
  s = act(s, 'REROLL', { id: target }, () => 0);
  s = act(s, 'NUDGE', { id: target });
  assert.equal(s.rolls[target], 2);
  assert.equal(modifiedValue(s, target), 4);
});

test('Focus improves already rolled dice and their previews without changing raw values', () => {
  let s = roll(start(), 'strike', 'plus', 'multiply');
  s = attach(attach(s, 'plus', 'strike'), 'multiply', 'strike');
  const faces = structuredClone(s.rolls);
  assert.equal(modifiedValue(s, id(s, 'strike')), 22);
  s = act(s, 'FOCUS', { attribute: 'might' });
  assert.equal(s.hero.mana, 0);
  assert.deepEqual(s.rolls, faces);
  assert.equal(modifiedValue(s, id(s, 'strike')), 26);
  assert.equal(act(s, 'FOCUS', { attribute: 'might' }).hero.statEffects.length, 1);
});

test('Focus cannot spend reserved mana or be used in noncombat phases', () => {
  let s = start();
  for (const type of ['strike', 'multiply', 'rally']) s = act(s, 'TOGGLE_DIE', { id: id(s, type) });
  const rejected = act(s, 'FOCUS', { attribute: 'might' });
  assert.match(rejected.notice, /reserve/);
  assert.equal(rejected.hero.mana, 7);
  const initial = newGame();
  assert.equal(act(initial, 'FOCUS', { attribute: 'might' }).hero.statEffects.length, 0);
});

test('Focus expires after the current turn and skips exactly two future turns', () => {
  let s = start();
  s.enemy.hp = 500;
  s = act(s, 'FOCUS', { attribute: 'might' });
  assert.equal(attributeBonus(s, 'might'), 4);
  s = act(roll(s, 'quick'), 'COMMIT');
  assert.equal(s.turn, 2);
  assert.equal(attributeBonus(s, 'might'), 2);
  assert.equal(s.hero.focusRemaining, 2);
  assert.equal(canFocus(s), false);
  s = act(roll(s, 'quick'), 'COMMIT');
  assert.equal(s.hero.focusRemaining, 1);
  s = act(roll(s, 'quick'), 'COMMIT');
  assert.equal(s.hero.focusRemaining, 0);
  assert.equal(canFocus(s), true);
});

test('temporary Vitality and Spirit never modify capacity, regeneration, or talent eligibility', () => {
  for (const attribute of ['vitality', 'spirit']) {
    let s = start();
    const before = { maxHp: s.hero.maxHp, maxMana: s.hero.maxMana, manaRegen: s.hero.manaRegen };
    s = act(s, 'FOCUS', { attribute });
    syncDerivedStats(s.hero);
    assert.deepEqual({ maxHp: s.hero.maxHp, maxMana: s.hero.maxMana, manaRegen: s.hero.manaRegen }, before);
    assert.deepEqual(s.hero.talents, {});
  }
});

test('enemy penalties are telegraphed, last exactly the next player turn, then expire', () => {
  let s = encounter(start({ finesse: 2, might: 1 }), 1, 2);
  assert.equal(nextIntent(s).statPenalty.attribute, 'finesse');
  s = act(roll(s, 'guard'), 'COMMIT');
  assert.equal(s.turn, 2);
  assert.equal(attributeBonus(s, 'finesse'), 0);
  assert.equal(s.hero.statEffects[0].expiresAfterTurn, 2);
  s = act(roll(s, 'guard'), 'COMMIT');
  assert.equal(s.turn, 3);
  assert.equal(attributeBonus(s, 'finesse'), 2);
  assert.equal(s.hero.statEffects.length, 0);
});

test('interrupting a penalty attack prevents its damage and attribute penalty', () => {
  let s = encounter(start(), 1, 2); // Disruptor 4 + Might 2 >= threshold 5
  s = act(roll(s, 'stagger'), 'COMMIT');
  assert.equal(s.hero.hp, 60);
  assert.equal(s.hero.statEffects.length, 0);
  assert.match(s.log.map(l => l.message).join(' '), /interrupted/);
});

test('Focus can counter a penalty additively without deleting it', () => {
  let s = encounter(start({ finesse: 2, might: 1 }), 1, 2);
  s = act(roll(s, 'guard'), 'COMMIT');
  s = act(s, 'FOCUS', { attribute: 'finesse' });
  assert.equal(s.hero.statEffects.length, 2);
  assert.equal(attributeBonus(s, 'finesse'), 2);
  assert.equal(s.hero.attributes.finesse, 2);
});

test('Iron Skin reduces physical damage before block but not arcane damage', () => {
  let s = start({ vitality: 2, might: 1 }, ['iron_skin']);
  const hp = s.hero.hp;
  s = act(roll(s, 'guard'), 'COMMIT'); // attack 7 - resistance 1 - block 6 = 0
  assert.equal(s.hero.hp, hp);
  s = encounter(start({ vitality: 2, might: 1 }, ['iron_skin']), 3);
  s = act(roll(s, 'quick'), 'COMMIT');
  assert.equal(s.hero.hp, 62); // 72 - 10 arcane
});

test('Antitoxin reduces poison ticks, not stacks, and leaves normal attacks unchanged', () => {
  let s = encounter(start({ vitality: 2, might: 1 }, ['antitoxin']), 1);
  s.hero.poison = 3;
  s = act(roll(s, 'quick'), 'COMMIT'); // attack 5, applies 2 more poison: 5-stack tick resists 2
  assert.equal(s.hero.hp, 64); // 72 - 5 - 3
  assert.equal(s.hero.poison, 4);
  assert.equal(s.hero.resistances.poison, 2);
});

test('Arcane Warding applies only to explicitly arcane attacks', () => {
  let s = encounter(start({ spirit: 2, arcana: 1 }, ['warding']), 3);
  s = act(roll(s, 'quick'), 'COMMIT');
  assert.equal(s.hero.hp, 52); // 60 - (10 - 2)
  let physical = start({ spirit: 2, arcana: 1 }, ['warding']);
  physical = act(roll(physical, 'quick'), 'COMMIT');
  assert.equal(physical.hero.hp, 53);
});

test('non-final victories award exactly one point and cannot skip or repeat allocation', () => {
  let s = start();
  s.enemy.hp = 1;
  s = act(roll(s, 'strike'), 'COMMIT');
  assert.equal(s.phase, 'levelup');
  assert.equal(s.hero.attributePoints, 1);
  assert.equal(s.level, 2);
  assert.equal(act(s, 'REST').phase, 'levelup');
  assert.equal(act(s, 'NEXT_ENCOUNTER').phase, 'levelup');
  assert.equal(act(s, 'COMMIT').hero.attributePoints, 1);
  assert.equal(act(s, 'ALLOCATE_ATTRIBUTE', { attribute: 'might', delta: -1 }).hero.attributes.might, 2);
  s = allocate(s, 'might');
  s = act(s, 'CONFIRM_ATTRIBUTES');
  assert.equal(s.phase, 'reward');
  assert.equal(s.hero.attributes.might, 3);
  assert.equal(s.hero.attributePoints, 0);
  assert.equal(act(s, 'CONFIRM_ATTRIBUTES').phase, 'reward');
});

test('later allocation stops at four and can be refunded only to its earned baseline', () => {
  let s = start();
  s.hero.attributes.might = 4;
  s.enemy.hp = 1;
  s = act(roll(s, 'strike'), 'COMMIT');
  assert.equal(allocate(s, 'might').hero.attributes.might, 4);
  s = allocate(s, 'vitality');
  assert.equal(s.hero.hp, 66);
  s = act(s, 'ALLOCATE_ATTRIBUTE', { attribute: 'vitality', delta: -1 });
  assert.equal(s.hero.hp, 60);
  assert.equal(s.hero.attributePoints, 1);
});

test('newly reaching a talent threshold during leveling requires a choice', () => {
  let s = start({ vitality: 1, might: 2 });
  s.enemy.hp = 1;
  s = act(roll(s, 'strike'), 'COMMIT');
  s = allocate(s, 'vitality');
  assert.equal(canConfirmAttributes(s), false);
  s = act(s, 'CHOOSE_TALENT', { talent: 'iron_skin' });
  assert.equal(canConfirmAttributes(s), true);
  assert.equal(s.hero.resistances.physical, 1);
});

test('attributes and talents persist between fights while statuses and cooldowns reset', () => {
  let s = start({ spirit: 2, might: 1 }, ['meditation']);
  s = act(s, 'FOCUS', { attribute: 'might' });
  s.enemy.hp = 1;
  s = act(roll(s, 'strike'), 'COMMIT');
  s = act(allocate(s, 'might'), 'CONFIRM_ATTRIBUTES');
  s = act(s, 'REST');
  s = act(s, 'NEXT_ENCOUNTER');
  assert.equal(s.encounter, 1);
  assert.equal(s.hero.attributes.spirit, 2);
  assert.equal(s.hero.talents.spirit, 'meditation');
  assert.equal(s.hero.mana, 9);
  assert.equal(s.hero.manaRegen, 5);
  assert.equal(s.hero.focusRemaining, 0);
  assert.deepEqual(s.hero.statEffects, []);
});

test('Quick Cut remains a weak free fallback even with stats, attachments, and Battle Hymn', () => {
  let s = roll(start({ finesse: 2, might: 1 }), 'quick', 'plus', 'multiply');
  s = attach(attach(s, 'plus', 'quick'), 'multiply', 'quick');
  assert.equal(modifiedValue(s, id(s, 'quick')), 3);
  assert.equal(rollBreakdown(s, id(s, 'quick')).capped, true);
  s.hero.strength = 10;
  s.hero.strengthCharges = 2;
  s = act(s, 'COMMIT');
  assert.equal(s.enemy.hp, 37);
  assert.equal(DICE.quick.manaCost, 0);
  assert.equal(DICE.channel.manaCost, 1);
  assert.equal(DICE.channel.cooldown, 2);
});

test('New Run fully resets level, allocation, talents, effects, mana, and HP', () => {
  let s = start({ vitality: 2, spirit: 1 }, ['antitoxin']);
  s = act(s, 'FOCUS', { attribute: 'vitality' });
  s = act(s, 'NEW_GAME');
  assert.deepEqual(s, newGame());
  assert.equal(s.hero.maxHp, 60);
  assert.equal(s.hero.maxMana, 7);
});

test('malformed reorder actions cannot corrupt the activation order', () => {
  const s = roll(start(), 'strike', 'guard');
  for (const step of [NaN, .5, '1', 2, undefined]) assert.deepEqual(act(s, 'REORDER', { id: id(s, 'strike'), step }).order, s.order);
});
