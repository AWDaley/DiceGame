import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newGame, makeDie, rollValue, reduceGame, modifiedValue,
  pendingModifiers, canCommit, nextIntent,
} from '../src/game.js';
import { ENCOUNTERS, MAX_JAR, SHOP_DIE_COST, SHOP_FORGE_COST } from '../src/content.js';

const rng = () => 0.5; // rolling the fourth face of a standard d6 -> 4
const first = (s, type) => s.dice.find(d => d.type === type).id;
const act = (s, type, fields = {}, random = rng) => reduceGame(s, { type, ...fields }, random);
function roll(s, ...types) {
  for (const type of types) s = act(s, 'TOGGLE_DIE', { id: first(s, type) });
  return act(s, 'ROLL');
}

test('new runs initialize the campaign, mana, dice, and telegraphed intent', () => {
  const s = newGame();
  assert.equal(s.phase, 'select');
  assert.equal(s.hero.hp, 60);
  assert.equal(s.hero.mana, 5);
  assert.equal(s.dice.length, 10);
  assert.equal(nextIntent(s).name, 'Heavy Swing');
});

test('die instances have independent editable six-face arrays', () => {
  const a = makeDie('strike', '1');
  const b = makeDie('strike', '2');
  a.faces[0] = 12;
  assert.deepEqual(b.faces, [1, 2, 3, 4, 5, 6]);
  assert.equal(rollValue(a, () => 0), 12);
  assert.equal(rollValue(a, () => 0.99999), 6);
});

test('jar capacity and deselection preserve immutable source state', () => {
  const original = newGame();
  let s = original;
  for (const d of original.dice.slice(0, MAX_JAR)) s = act(s, 'TOGGLE_DIE', { id: d.id });
  assert.equal(s.selected.length, MAX_JAR);
  const denied = act(s, 'TOGGLE_DIE', { id: original.dice[MAX_JAR].id });
  assert.equal(denied.selected.length, MAX_JAR);
  assert.match(denied.notice, /only hold 5/);
  assert.deepEqual(original.selected, []);
  s = act(s, 'TOGGLE_DIE', { id: original.dice[0].id });
  assert.equal(s.selected.length, MAX_JAR - 1);
});

test('rolling only modifiers is forbidden rather than soft-locking the turn', () => {
  const s = newGame();
  const p = act(s, 'TOGGLE_DIE', { id: first(s, 'plus') });
  const result = act(p, 'ROLL');
  assert.equal(result.phase, 'select');
  assert.match(result.notice, /effect die/);
});

test('rolled dice display deterministic faces and attachments are required', () => {
  let s = roll(newGame(), 'strike', 'plus', 'multiply');
  assert.equal(s.phase, 'cast');
  assert.deepEqual(Object.values(s.rolls), [4, 4, 4]);
  assert.equal(canCommit(s), false);
  assert.equal(pendingModifiers(s).length, 2);
  s = act(s, 'ATTACH', { modId: first(s, 'plus'), targetId: first(s, 'strike') });
  assert.equal(modifiedValue(s, first(s, 'strike')), 8);
  s = act(s, 'ATTACH', { modId: first(s, 'multiply'), targetId: first(s, 'strike') });
  assert.equal(modifiedValue(s, first(s, 'strike')), 16);
  assert.equal(canCommit(s), true);
});

test('modifier attachments may be moved and detached without consuming mana', () => {
  let s = roll(newGame(), 'strike', 'guard', 'plus');
  const plus = first(s, 'plus');
  s = act(s, 'ATTACH', { modId: plus, targetId: first(s, 'strike') });
  s = act(s, 'ATTACH', { modId: plus, targetId: first(s, 'guard') });
  assert.equal(modifiedValue(s, first(s, 'strike')), 4);
  assert.equal(modifiedValue(s, first(s, 'guard')), 8);
  s = act(s, 'DETACH', { id: plus });
  assert.equal(modifiedValue(s, first(s, 'guard')), 4);
  assert.equal(s.hero.mana, 5);
  assert.equal(canCommit(s), false);
});

test('modifiers cannot target other modifiers or dice that were not rolled', () => {
  const s = roll(newGame(), 'strike', 'plus', 'multiply');
  assert.match(act(s, 'ATTACH', { modId: first(s, 'plus'), targetId: first(s, 'multiply') }).notice, /effect dice/);
  assert.match(act(s, 'ATTACH', { modId: first(s, 'plus'), targetId: first(s, 'guard') }).notice, /rolled dice/);
});

test('mana rerolls and nudges change a rolled value and enforce a maximum face', () => {
  let s = roll(newGame(), 'strike');
  s = act(s, 'REROLL', { id: first(s, 'strike') }, () => 0);
  assert.equal(s.rolls[first(s, 'strike')], 1);
  assert.equal(s.hero.mana, 4);
  s = act(s, 'NUDGE', { id: first(s, 'strike') });
  assert.equal(s.rolls[first(s, 'strike')], 2);
  assert.equal(s.hero.mana, 2);
  s = act(s, 'NUDGE', { id: first(s, 'strike') });
  assert.equal(s.hero.mana, 0);
  const denied = act(s, 'REROLL', { id: first(s, 'strike') });
  assert.equal(denied.hero.mana, 0);
  assert.match(denied.notice, /Not enough mana/);
});

test('nudging the highest face does not spend mana', () => {
  const s = act(act(newGame(), 'TOGGLE_DIE', { id: 'die-1' }), 'ROLL', {}, () => 0.999);
  assert.equal(s.rolls['die-1'], 6);
  const next = act(s, 'NUDGE', { id: 'die-1' });
  assert.equal(next.hero.mana, s.hero.mana);
  assert.match(next.notice, /highest face/);
});

test('shield absorbs damage; mana regenerates; zero-cooldown dice are ready immediately', () => {
  let s = roll(newGame(), 'guard');
  s = act(s, 'REROLL', { id: first(s, 'guard') }, () => 0);
  assert.equal(s.hero.mana, 4);
  s = act(s, 'COMMIT');
  assert.equal(s.hero.hp, 54); // guard 1 absorbs one of 7
  assert.equal(s.hero.mana, 5);
  assert.equal(s.hero.block, 0);
  assert.equal(s.turn, 2);
  assert.equal(s.dice.find(d => d.type === 'guard').remaining, 0);
});

test('damage penetrates enemy block then HP', () => {
  let s = newGame();
  s.enemy.block = 3;
  s = roll(s, 'strike');
  s = act(s, 'COMMIT');
  assert.equal(s.enemy.hp, 39);
  assert.equal(s.enemy.block, 0);
});

test('poison applies at the enemy turn start and decays', () => {
  let s = roll(newGame(), 'venom');
  s = act(s, 'COMMIT');
  assert.equal(s.enemy.hp, 36);
  assert.equal(s.enemy.poison, 3);
  assert.equal(s.dice.find(d => d.type === 'venom').remaining, 1);
});

test('weak reduces the next enemy attack and is then consumed', () => {
  let s = roll(newGame(), 'hex');
  s = act(s, 'COMMIT');
  assert.equal(s.hero.hp, 57); // 7 attack minus 4 weak
  assert.equal(s.enemy.weak, 0);
});

test('activation order changes when strength contributes to attack damage', () => {
  let buffFirst = roll(newGame(), 'rally', 'strike');
  buffFirst = act(buffFirst, 'COMMIT');
  assert.equal(buffFirst.enemy.hp, 34); // strike 4 + power 2
  let attackFirst = roll(newGame(), 'rally', 'strike');
  attackFirst = act(attackFirst, 'REORDER', { id: first(attackFirst, 'strike'), step: -1 });
  attackFirst = act(attackFirst, 'COMMIT');
  assert.equal(attackFirst.enemy.hp, 36);
  assert.equal(attackFirst.hero.strengthCharges, 2);
});

test('cooldowns correctly skip the stated number of future turns', () => {
  let s = roll(newGame(), 'strike', 'plus');
  s = act(s, 'ATTACH', { modId: first(s, 'plus'), targetId: first(s, 'strike') });
  s = act(s, 'COMMIT');
  assert.equal(s.dice.find(d => d.type === 'plus').remaining, 1);
  s = roll(s, 'guard');
  s = act(s, 'COMMIT');
  assert.equal(s.dice.find(d => d.type === 'plus').remaining, 0);
});

test('winning an encounter offers three free dice and gold', () => {
  let s = newGame();
  s.enemy.hp = 1;
  s = roll(s, 'strike');
  s = act(s, 'COMMIT');
  assert.equal(s.phase, 'reward');
  assert.equal(s.rewardOffers.length, 3);
  assert.equal(s.gold, ENCOUNTERS[0].gold);
  const type = s.rewardOffers[0];
  s = act(s, 'CLAIM_DIE', { dieType: type });
  assert.equal(s.phase, 'shop');
  assert.equal(s.dice.length, 11);
});

test('rest, shop heal, purchasing, and the next encounter work', () => {
  let s = newGame();
  s.enemy.hp = 1;
  s.hero.hp = 20;
  s = act(roll(s, 'strike'), 'COMMIT');
  s = act(s, 'REST');
  assert.equal(s.hero.hp, 34);
  assert.equal(s.phase, 'shop');
  const offered = s.shopOffers[0];
  s = act(s, 'SHOP_BUY_DIE', { dieType: offered });
  assert.equal(s.gold, ENCOUNTERS[0].gold - SHOP_DIE_COST);
  assert.equal(s.dice.length, 11);
  s = act(s, 'NEXT_ENCOUNTER');
  assert.equal(s.encounter, 1);
  assert.equal(s.turn, 1);
  assert.equal(s.enemy.name, ENCOUNTERS[1].name);
});

test('face forging increases a single face and charges shop gold', () => {
  let s = newGame();
  s.enemy.hp = 1;
  s = act(roll(s, 'strike'), 'COMMIT');
  s = act(s, 'CLAIM_DIE', { dieType: s.rewardOffers[0] });
  const before = s.gold;
  s = act(s, 'FORGE_START');
  assert.equal(s.forgeCost, SHOP_FORGE_COST);
  s = act(s, 'UPGRADE_FACE', { id: first(s, 'strike'), faceIndex: 0 });
  assert.deepEqual(s.dice.find(d => d.type === 'strike').faces, [2, 2, 3, 4, 5, 6]);
  assert.equal(s.gold, before - SHOP_FORGE_COST);
  assert.equal(s.phase, 'shop');
});

test('forging can be selected instead of free die reward', () => {
  let s = newGame();
  s.enemy.hp = 1;
  s = act(roll(s, 'strike'), 'COMMIT');
  s = act(s, 'FORGE_START');
  assert.equal(s.forgeCost, 0);
  s = act(s, 'UPGRADE_FACE', { id: first(s, 'guard'), faceIndex: 5 });
  assert.equal(s.phase, 'shop');
  assert.equal(s.dice.find(d => d.type === 'guard').faces[5], 7);
  assert.equal(s.gold, ENCOUNTERS[0].gold);
});

test('death and final victory are separate terminal states', () => {
  let dying = newGame();
  dying.hero.hp = 1;
  dying = act(roll(dying, 'guard'), 'COMMIT');
  assert.equal(dying.phase, 'lost');
  let winning = newGame();
  winning.encounter = ENCOUNTERS.length - 1;
  winning.enemy = { ...winning.enemy, hp: 1, name: ENCOUNTERS.at(-1).name };
  winning = act(roll(winning, 'strike'), 'COMMIT');
  assert.equal(winning.phase, 'won');
});

test('unknown actions have no effect', () => {
  const s = newGame();
  assert.equal(reduceGame(s, { type: 'UNKNOWN' }), s);
});