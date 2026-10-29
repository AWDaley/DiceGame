import { VERSION } from './content.js';
import { validateDefinitions } from './equipment.js';
import { newGame, reduceGame } from './game.js';
import { decisionActor } from './combat.js';
import { nextAICommand } from './enemy-ai.js';
import { renderCharacterPanel, renderStatsSidebar } from './character-ui.js';
import { renderLoadout, renderRewards, renderShop, renderForge } from './loadout-ui.js';
import { renderArena, renderBattle, renderEnemyEquipment } from './battle-ui.js';
import { esc, buttonData, heading } from './ui-utils.js';

let game = newGame();
const root = document.querySelector('#app');
const modal = document.querySelector('#how-to-play');
function renderTerminal(state) {
  const won=state.phase==='won';
  return `${heading(won?'CAMPAIGN COMPLETE':'RUN COMPLETE',won?'Fate has been <em>rewritten.</em>':state.outcome==='draw'?'Both combatants <em>fall.</em>':'The jar falls <em>silent.</em>',won?'You defeated all four opponents with equipment, attributes and reactions.':state.outcome==='draw'?'Simultaneous poison ended this run in a draw, without rewards.':'Try a different loadout, save mana for defense, and choose when to recover.')}<div class="exchange-outcome">${state.events.slice(-6).map(e=>`<p>${esc(e.text)}</p>`).join('')}</div><button class="primary-button" ${buttonData(state,'new-run')}>BEGIN A NEW RUN →</button>`;
}
function render() {
  const panels = { character:renderCharacterPanel, levelup:renderCharacterPanel, loadout:renderLoadout, battle:renderBattle,
    reward:renderRewards, shop:renderShop, forge:renderForge, won:renderTerminal, lost:renderTerminal };
  const main = panels[game.phase]?.(game);
  if (!main) throw new Error(`Unknown campaign phase: ${game.phase}`);
  root.innerHTML = `${game.phase!=='character'?renderArena(game):''}<div class="workbench v04"><div class="workbench-main">${main}</div><aside class="sidebar">${renderStatsSidebar(game)}${renderEnemyEquipment(game)}
    <section class="sidebar-card log-card"><div class="panel-label">CHRONICLE <span class="panel-trailing">v${VERSION}</span></div><div class="log-feed" aria-label="Battle log">${game.events.slice(-12).reverse().map(e=>`<div class="log-line"><span>›</span>${esc(e.text)}</div>`).join('')||'<p class="muted">Choose your character and equipment to begin.</p>'}</div></section></aside></div>${game.notice?`<div class="toast" role="status">${esc(game.notice)}</div>`:''}`;
}
/** Automatic enemy decisions are synchronous, bounded, and never skip a human window. */
function advanceEnemy() {
  for (let steps=0; decisionActor(game)==='enemy'; steps++) {
    if (steps>=40) throw new Error('Enemy decision limit reached; no human choice was skipped.');
    const command=nextAICommand(game);
    if (!command) throw new Error('Enemy has no legal decision.');
    const next=reduceGame(game,command);
    if (next.revision===game.revision) throw new Error(next.notice || 'Enemy command was rejected.');
    game=next;
  }
}
function update(action) {
  const focused = document.activeElement?.dataset?.action ? { ...document.activeElement.dataset } : null;
  game=reduceGame(game,action);
  try { advanceEnemy(); } catch(error) { game={...game,notice:`Combat stopped: ${error.message} Use New Run to reset.`}; }
  render();
  if (focused) {
    const entries=Object.entries(focused).filter(([key])=>!['revision','exchange'].includes(key));
    const target=[...root.querySelectorAll('[data-action]')].find(el=>!el.disabled&&entries.every(([k,v])=>el.dataset[k]===v));
    target?.focus({preventScroll:true});
  }
}
document.addEventListener('click',event=>{
  const el=event.target.closest('[data-action]');
  if (!el || el.disabled || event.detail>1) return;
  const d=el.dataset, action=d.action;
  if (action==='help') { modal.showModal(); return; }
  if (action==='close-help') { modal.close(); return; }
  if (action==='new-run') {
    if (!['character','won','lost'].includes(game.phase)&&!window.confirm('Start over? Current run progress will be lost.')) return;
    update({type:'NEW_GAME',expectedRevision:game.revision}); return;
  }
  const types={allocate:'ALLOCATE_ATTRIBUTE',talent:'CHOOSE_TALENT','confirm-attributes':'CONFIRM_ATTRIBUTES',equip:'TOGGLE_EQUIPMENT','begin-battle':'BEGIN_BATTLE',claim:'CLAIM_ITEM',rest:'REST','forge-start':'FORGE_START','forge-cancel':'FORGE_CANCEL','upgrade-face':'UPGRADE_FACE',buy:'SHOP_BUY_ITEM','shop-heal':'SHOP_HEAL',refill:'SHOP_REFILL','next-encounter':'NEXT_ENCOUNTER',maneuver:'SELECT_MANEUVER',support:'TOGGLE_MODIFIER','pass-reaction':'PASS_REACTION','pass-turn':'PASS_TURN',reroll:'REROLL',nudge:'NUDGE',focus:'FOCUS',lock:'LOCK_RESULT',continue:'ACK_EXCHANGE'};
  const type=action==='declare'?(game.combat.stage==='reaction'?'DECLARE_REACTION':'DECLARE_ACTION'):types[action];
  if (!type) return;
  update({ type, actorId:'hero', expectedRevision:Number(d.revision), exchangeId:Number(d.exchange),
    itemId:d.itemId, maneuverId:d.maneuverId, attribute:d.attribute, talent:d.talent,
    delta:Number(d.delta), faceIndex:Number(d.faceIndex), definitionId:d.definitionId });
});
try { validateDefinitions(); render(); }
catch(error) { root.innerHTML=`<section class="exchange-outcome" role="alert"><h1>Unable to start Jarbound</h1><p>${esc(error.message)}</p><p>Use the complete generated index.html from the v0.4 download.</p></section>`; throw error; }
