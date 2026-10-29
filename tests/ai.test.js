import test from 'node:test';
import assert from 'node:assert/strict';
import { publicDecisionView, chooseAction, chooseReaction, nextAICommand } from '../src/enemy-ai.js';
import { decisionActor } from '../src/combat.js';
import { reduceGame } from '../src/game.js';
import { ENCOUNTERS } from '../src/content.js';
import { battle, act, install, declare, revealed, passSlot } from './helpers.js';

test('reaction decision view structurally excludes raw rolls, locks and RNG',()=>{const s=declare(battle(),'quick_strike'),view=publicDecisionView(s,'enemy');assert.equal('raw' in view,false);assert.equal('locked' in view,false);assert.equal('exchange' in view,false);assert.equal('rng' in view,false);assert.equal(view.incoming.bundle.maneuverId,'quick_strike');});
test('policy decision is deterministic and cannot be changed by future random faces',()=>{let s=declare(battle(),'quick_strike');const before=chooseReaction(publicDecisionView(s,'enemy'));s.combat.exchange.raw.hero={fake:999};s.combat.exchange.raw.enemy={fake:0};assert.deepEqual(chooseReaction(publicDecisionView(s,'enemy')),before);});
test('depleted enemy chooses legal Channel rather than a hidden free attack',()=>{let s=passSlot(battle());s.combatants.enemy.mana=0;const b=chooseAction(publicDecisionView(s,'enemy'));assert.equal(b.maneuverId,'channel');});
test('AI stops whenever the human owns the decision',()=>{const s=battle();assert.equal(nextAICommand(s),null);const rolled=revealed(s,'quick_strike','block');assert.equal(nextAICommand(rolled),null);});
test('all enemy policies complete bounded commands through the same reducer',()=>{for(let encounter=0;encounter<ENCOUNTERS.length;encounter++){let s=battle();s.encounter=encounter;s.phase='loadout';s=act(s,'BEGIN_BATTLE');let commands=0;while(s.phase==='battle'&&s.combat.roundNumber<4&&commands<150){const id=decisionActor(s),cmd=nextAICommand(s,id);assert.ok(cmd);const next=reduceGame(s,cmd,()=>.5);assert.equal(next.notice,'',`${encounter}: ${next.notice}`);assert.equal(next.revision,s.revision+1);s=next;commands++;}assert.ok(commands<150);}});
test('finishing damage outranks repeated Shield Bash against nearly defeated enemies',()=>{let s=battle();s.combatants.enemy.hp=1;const b=chooseAction(publicDecisionView(s,'hero'));assert.ok(['quick_strike','heavy_strike'].includes(b.maneuverId));});
