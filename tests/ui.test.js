import test from 'node:test';
import assert from 'node:assert/strict';
import { renderBattle, renderArena } from '../src/battle-ui.js';
import { renderLoadout, renderRewards, renderShop, renderForge } from '../src/loadout-ui.js';
import { renderCharacterPanel, renderStatsSidebar } from '../src/character-ui.js';
import { created, battle, revealed, declare, exchange, nextSlot, act, item } from './helpers.js';

test('loadout explains shared physical items, required recovery and backpack',()=>{const html=renderLoadout(created());for(const text of ['Backpack','Focus Crystal','8 / 8','Block','Shield Bash','share one item'])assert.ok(html.includes(text),text);});
test('action and reaction panels show correct commitment limits and public information',()=>{let s=battle();let html=renderBattle(s);assert.match(html,/up to two compatible supports/);assert.match(html,/PASS MAIN TURN/);s=nextSlot(exchange(s,'channel'));s=declare(s,'quick_strike');html=renderBattle(s);assert.match(html,/NOT YET ROLLED/);assert.match(html,/Accuracy 7/);assert.match(html,/PASS REACTION/);assert.doesNotMatch(html,/Face \d \+/);});
test('rendered math uses the same calculations as locking, and previews never change state',()=>{let s=battle();s.combatants.hero.attributes.finesse=2;s=revealed(s,'quick_strike',null,['add']);const before=structuredClone(s),html=renderBattle(s);assert.match(html,/Face 4 \+ 2 Finesse = 6/);assert.match(html,/>12<\/b>/);assert.deepEqual(s,before);});
test('panels show reaction readiness, Poise, Resolve and mana for both sides',()=>{let s=battle();s.combatants.hero.resolveProtection=true;s.combatants.enemy.pendingSkip=true;const html=renderArena(s);for(const text of ['Reaction ready','Poise','Resolve','Main skip pending','7/7 mana','5/5 mana'])assert.ok(html.includes(text),text);});
test('Focus is explained as exchange-limited and UI text uses rounds rather than old turns',()=>{const s=battle(),html=renderStatsSidebar(s);assert.match(html,/this exchange/);assert.match(html,/2 \/ round/);assert.doesNotMatch(html,/5 \/ turn/);});
test('all campaign panels render after real victory and allocation transitions',()=>{let s=battle();s.combatants.enemy.hp=1;s=exchange(s,'quick_strike');assert.match(renderCharacterPanel(s),/VICTORY/);s=act(s,'ALLOCATE_ATTRIBUTE',{attribute:'might',delta:1});s=act(s,'CONFIRM_ATTRIBUTES');assert.match(renderRewards(s),/TAKE EQUIPMENT/);s=act(s,'REST');assert.match(renderShop(s),/PREPARE NEXT ENCOUNTER/);s=act(s,'FORGE_START');assert.match(renderForge(s),/All maneuvers on that physical item share its faces/);});
