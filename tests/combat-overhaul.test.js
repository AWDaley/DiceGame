import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, reduceGame, modifiedValue, nextIntent, jarManaCost } from '../src/game.js';
import { DICE, MAX_MANA, MANA_REGEN } from '../src/content.js';
const rng = () => 0.5;
const first = (s, type) => s.dice.find(d => d.type === type).id;
const act = (s, type, fields = {}, random = rng) => reduceGame(s, { type, ...fields }, random);
function roll(s, ...types) {
  for (const type of types) s = act(s, 'TOGGLE_DIE', { id: first(s, type) });
  return act(s, 'ROLL');
}

test('each die has a nonnegative mana cost and budget is charged only when rolled', () => {
  for (const d of Object.values(DICE)) {
    assert.equal(Number.isInteger(d.manaCost), true);
    assert.equal(d.manaCost >= 0, true);
  }
  let s = newGame();
  s = act(s, 'TOGGLE_DIE', { id: first(s, 'strike') });
  s = act(s, 'TOGGLE_DIE', { id: first(s, 'multiply') });
  assert.equal(jarManaCost(s), 4);
  assert.equal(s.hero.mana, MAX_MANA, 'selecting should not spend mana');
  s = act(s, 'TOGGLE_DIE', { id: first(s, 'multiply') });
  assert.equal(jarManaCost(s), 1, 'deselecting refunds the reservation');
  s = act(s, 'ROLL');
  assert.equal(s.lastJarCost, 1);
  assert.equal(s.hero.mana, MAX_MANA - 1);
});

test('cannot add an unaffordable die, and ROLL validates forged state too', () => {
  let s = newGame();
  s = act(s, 'TOGGLE_DIE', { id: first(s, 'strike') });
  s = act(s, 'TOGGLE_DIE', { id: first(s, 'rally') });
  s = act(s, 'TOGGLE_DIE', { id: first(s, 'multiply') });
  assert.equal(jarManaCost(s), 6);
  const declined = act(s, 'TOGGLE_DIE', { id: first(s, 'venom') });
  assert.match(declined.notice, /Not enough mana/);
  assert.deepEqual(declined.selected, s.selected);
  assert.equal(declined.hero.mana, MAX_MANA);
  const forged = structuredClone(s);
  forged.hero.mana = 5;
  const denied = act(forged, 'ROLL');
  assert.equal(denied.phase, 'select');
  assert.match(denied.notice, /Not enough mana/);
  assert.equal(denied.hero.mana, 5);
});

test('at zero mana, the cheap fallback can still roll and one free reroll works', () => {
  let s = newGame();
  s.hero.mana = 0;
  const refused = act(s, 'TOGGLE_DIE', { id: first(s, 'strike') });
  assert.match(refused.notice, /Not enough mana/);
  s = act(s, 'TOGGLE_DIE', { id: first(s, 'quick') });
  s = act(s, 'ROLL');
  assert.equal(s.phase, 'cast');
  assert.equal(s.hero.mana, 0);
  s = act(s, 'REROLL', { id: first(s, 'quick') });
  assert.equal(s.hero.freeRecollections, 0);
  assert.equal(s.hero.mana, 0);
  const declined = act(s, 'REROLL', { id: first(s, 'quick') });
  assert.match(declined.notice, /Not enough mana/);
});

test('mana regenerates exactly at the end of a turn and respects max capacity', () => {
  let s = newGame();
  s.hero.mana = 1;
  s = roll(s, 'strike');
  assert.equal(s.hero.mana, 0);
  s = act(s, 'COMMIT');
  assert.equal(s.hero.mana, MANA_REGEN);
  assert.equal(s.hero.freeRecollections, 1);
  s = roll(s, 'quick');
  s = act(s, 'COMMIT');
  assert.equal(s.hero.mana, MAX_MANA);
});

test('Hollow Sentinel armor reduces every physical hit; poison bypasses armor', () => {
  const base = newGame();
  base.encounter = 2;
  base.enemy = { ...base.enemy, name: 'Hollow Sentinel', hp: 66, maxHp: 66, armor: 3 };
  const strike = act(roll(structuredClone(base), 'strike'), 'COMMIT');
  assert.equal(strike.enemy.hp, 65);
  assert.equal(strike.enemy.armor, 3);
  const venom = act(roll(structuredClone(base), 'venom'), 'COMMIT');
  assert.equal(venom.enemy.hp, 62);
  assert.equal(venom.enemy.armor, 3);
});

test('ordering a sunder die before attacks removes permanent armor for that encounter', () => {
  const base = newGame();
  base.encounter = 2;
  base.enemy = { ...base.enemy, name: 'Hollow Sentinel', hp: 66, maxHp: 66, armor: 3 };
  const early = act(roll(structuredClone(base), 'sunder', 'strike'), 'COMMIT');
  assert.equal(early.enemy.armor, 0);
  assert.equal(early.enemy.hp, 62);
  let late = roll(structuredClone(base), 'sunder', 'strike');
  late = act(late, 'REORDER', { id: first(late, 'strike'), step: -1 });
  late = act(late, 'COMMIT');
  assert.equal(late.enemy.hp, 65);
  assert.equal(late.enemy.armor, 0, 'the armor reduction persists');
});

test('stagger that meets a telegraphed threshold interrupts a charged attack', () => {
  let s = newGame();
  s.enemy.moveIndex = 2; // Scrap Brute Overhead Slam, 14 attack / 5 stagger
  s = roll(s, 'stagger', 'plus');
  s = act(s, 'ATTACH', { modId: first(s, 'plus'), targetId: first(s, 'stagger') });
  assert.equal(modifiedValue(s, first(s, 'stagger')), 8);
  s = act(s, 'COMMIT');
  assert.equal(s.hero.hp, 60);
  assert.equal(s.enemy.moveIndex, 0);
  assert.equal(s.enemy.stagger, 0);
  assert.match(s.log.map(x => x.message).join(' '), /interrupted/);
});

test('insufficient stagger cannot interrupt, and stagger never carries to the next turn', () => {
  let s = newGame();
  s.enemy.moveIndex = 2;
  s = act(roll(s, 'stagger'), 'COMMIT');
  assert.equal(s.hero.hp, 46);
  assert.equal(s.enemy.stagger, 0);
  const plain = act(roll(newGame(), 'stagger'), 'COMMIT');
  assert.equal(plain.hero.hp, 53);
  assert.equal(plain.enemy.stagger, 0);
});

test('Jarbreaker charged finale has an independently tuned stagger threshold', () => {
  let s = newGame();
  s.encounter = 3;
  s.enemy = { ...s.enemy, name: 'The Jarbreaker', hp: 86, maxHp: 86, moveIndex: 3 };
  assert.equal(nextIntent(s).interruptAt, 7);
  s = roll(s, 'stagger', 'plus');
  s = act(s, 'ATTACH', { modId: first(s, 'plus'), targetId: first(s, 'stagger') });
  s = act(s, 'COMMIT');
  assert.equal(s.hero.hp, 60);
  assert.equal(s.enemy.moveIndex, 0);
});
