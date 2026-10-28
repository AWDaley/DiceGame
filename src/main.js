import { DICE, ENCOUNTERS, FAMILY, ATTRIBUTES, MAX_JAR, NUDGE_COST, REROLL_COST, SHOP_DIE_COST, SHOP_FORGE_COST, SHOP_HEAL_COST } from './content.js';
import { renderCharacterPanel, renderStatsSidebar, renderRollBreakdown, attributeTag } from './character-ui.js';
import { adjustedRoll, canCommit, definition, dieStateInfo, isModifier, jarManaCost, modifiedValue, newGame, nextIntent, pendingModifiers, reduceGame, rolledLabel } from './game.js';

let game = newGame();
const root = document.querySelector('#app');
const modal = document.querySelector('#how-to-play');
const icon = { heart: '♥', magic: '✦', gold: '◈', clock: '◷', arrow: '→' };
const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'": '&#39;' }[ch]));
const percent = (v, max) => `${Math.max(0,Math.min(100,100*v/max))}%`;
const dieById = id => game.dice.find(d => d.id === id);
const isCast = () => game.phase === 'cast';
const selectedDie = () => dieById(game.activeDie);
const info = die => dieStateInfo(game,die);
const stat = (label,value,kind='') => `<span class="status-chip ${kind}"><span class="status-chip__symbol">${esc(value)}</span>${esc(label)}</span>`;

function bar(value,max,kind){return `<div class="statbar ${kind}"><div style="width:${percent(value,max)}"></div></div>`;}
function printIntent(move) {
  return [move.attack ? `<span class="intent-element attack-intent">⚔ ${move.attack} ${move.damageType || 'physical'} attack</span>` : '',move.guard ? `<span class="intent-element">⬡ ${move.guard} block</span>` : '',move.poison ? `<span class="intent-element poison-intent">☣ ${move.poison} poison</span>` : '',move.interruptAt ? `<span class="intent-element interrupt-intent">⚡ Interrupt with ${move.interruptAt} stagger</span>` : '', move.statPenalty ? `<span class="intent-element poison-intent">−${move.statPenalty.amount} ${ATTRIBUTES[move.statPenalty.attribute].name} next turn</span>` : ''].filter(Boolean).join('');
}
function resourceCards() {
  const h=game.hero, e=game.enemy, en=ENCOUNTERS[game.encounter];
  const move=nextIntent(game);
  const isBetween = ['character','levelup','reward','shop','forge','won'].includes(game.phase);
  return `<section class="arena" aria-label="Combatants and encounter status">
    <div class="combatant hero-combatant">
      <div class="combatant__icon hero-avatar" aria-hidden="true">✧</div>
      <div class="combatant__stats">
        <span class="eyebrow">THE PLAYER <span class="eyebrow-sep">/</span> RUN 01</span>
        <div class="combatant__line"><h2>The Wanderer</h2><span class="stat-number"><span class="red-heart">${icon.heart}</span> ${h.hp}<small>/${h.maxHp}</small></span></div>
        ${bar(h.hp,h.maxHp,'hp')}
        <div class="status-line">${stat('Mana',`${h.mana}/${h.maxMana}`,'mana-chip')}${h.freeRecollections ? stat('Free reroll', h.freeRecollections, 'mana-chip') : ''}${h.block ? stat('Block',h.block,'block-chip') : ''}${h.poison ? stat('Poison',h.poison,'poison-chip') : ''}${h.strengthCharges ? stat(`Power · ${h.strengthCharges} hits`,`+${h.strength}`,'power-chip') : ''}</div>
      </div>
    </div>
    <div class="arena-center"><span class="arcane-mark">✳</span><span class="encounter-number">${game.encounter+1} / ${ENCOUNTERS.length}</span><span class="arena-dash">ENCOUNTER</span></div>
    <div class="combatant enemy-combatant">
      <div class="combatant__icon enemy-avatar" aria-hidden="true">${en.icon}</div>
      <div class="combatant__stats">
        <span class="eyebrow">${esc(en.subtitle)}</span>
        <div class="combatant__line"><h2>${esc(en.name)}</h2><span class="stat-number"><span class="red-heart">${icon.heart}</span> ${e.hp}<small>/${e.maxHp}</small></span></div>
        ${bar(e.hp,e.maxHp,'enemy-hp')}
        <div class="status-line">${e.armor ? stat('Armor / hit',e.armor,'armor-chip') : ''}${e.block ? stat('Block',e.block,'block-chip') : ''}${e.poison ? stat('Poison',e.poison,'poison-chip') : ''}${e.weak ? stat('Weakened',e.weak,'poison-chip') : ''}${move?.interruptAt ? stat('Stagger',`${e.stagger}/${move.interruptAt}`,'stagger-chip') : ''}${!e.armor && !e.block && !e.poison && !e.weak && !move?.interruptAt ? '<span class="quiet-status">No active effects</span>' : ''}</div>
      </div>
    </div>
    ${!isBetween && move ? `<div class="intent-strip"><span class="intent-caption">⌁ ENEMY INTENT</span><strong>${esc(move.name)}</strong><div class="intent-effects">${printIntent(move)}</div>${en.mechanic ? `<small class="encounter-rule">${esc(en.mechanic)}</small>` : ''}</div>` : ''}
  </section>`;
}
function phaseHeader(marker,title,copy,extra='') {
  return `<div class="section-heading"><div class="section-heading__copy"><span class="eyebrow accent-eyebrow">${esc(marker)}</span><h1>${title}</h1><p>${copy}</p></div>${extra}</div>`;
}
function faceElement(value, die, compact=false) {
  return `<div class="dice-face ${compact?'compact-face':''} ${FAMILY[definition(die).family].accent}" aria-label="Rolled ${esc(value)}"><span class="dice-glyph">${esc(definition(die).icon)}</span><span class="dice-value">${esc(value)}</span><span class="face-spark spark-one"></span><span class="face-spark spark-two"></span></div>`;
}
function dieCard(die, opts={}) {
  const d=definition(die),data=info(die), selected=game.selected.includes(die.id), unavailable=die.remaining>0;
  const unaffordable = !selected && !unavailable && jarManaCost(game) + d.manaCost > game.hero.mana;
  const label=selected ? 'Remove from jar' : 'Add to jar';
  return `<button class="inventory-die ${data.accent} ${selected?'chosen':''} ${unavailable?'cooling':''} ${unaffordable?'unaffordable':''}" data-action="toggle-die" data-id="${esc(die.id)}" type="button" aria-pressed="${selected}" ${unavailable?'disabled':''} aria-label="${esc(label)}: ${esc(d.name)}${unavailable?', cooldown '+die.remaining:''}, costs ${d.manaCost} mana">
    <div class="die-top"><span class="die-symbol">${esc(d.icon)}</span><span class="die-top-right">${unavailable?`${icon.clock} ${die.remaining} TURN${die.remaining!==1?'S':''}`:selected?'✓ IN JAR':`D6 · CD ${d.cooldown}`}</span></div>
    <div class="die-identity"><h3>${esc(d.name)}</h3><span class="family-tag">${esc(data.label)}</span></div>
    ${attributeTag(game, d.attribute)}
    <div class="die-detail">${esc(d.description)}</div>
    <div class="mini-faces" aria-label="Die faces: ${die.faces.join(', ')}">${die.faces.map(n=>`<span>${n}</span>`).join('')}</div>
    <div class="inventory-die__foot"><span>${unavailable?'RECOVERING':selected?'REMOVE FROM JAR':unaffordable?'TOO EXPENSIVE':'SELECT DIE'}</span><span class="die-mana-cost">✦ ${d.manaCost} MANA</span></div>
  </button>`;
}
function jarSlot(id, index) {
  if (!id) return `<div class="jar-slot jar-slot--empty"><span class="jar-slot__index">0${index+1}</span><span class="jar-slot__plus">+</span><span class="jar-slot__caption">EMPTY</span></div>`;
  const die=dieById(id);const f=definition(die);return `<div class="jar-slot ${FAMILY[f.family].accent}"><span class="jar-slot__index">0${index+1}</span><span class="jar-slot__glyph">${esc(f.icon)}</span><span class="jar-slot__name">${esc(f.name)}</span><span class="jar-slot__cost">✦ ${f.manaCost}</span><button class="jar-slot__remove" data-action="toggle-die" data-id="${esc(id)}" type="button" aria-label="Remove ${esc(f.name)} from jar">×</button></div>`;
}
function selectionPanel() {
  const eligible=game.dice.filter(d=>d.remaining===0).length;
  const cost=jarManaCost(game), manaLeft=game.hero.mana-cost;
  const canRoll=game.selected.some(id=>!isModifier(dieById(id))) && cost<=game.hero.mana;
  return `${phaseHeader('01 / PREPARE THE JAR','Choose your <em>dice.</em>','Each die costs mana to roll. Spend big now, or save mana for manipulating your results and preparing future turns.',`<div class="phase-meta"><span class="phase-meta__big">TURN ${game.turn}</span><span>${eligible} dice ready</span></div>`)}
  <div class="jar-panel">
    <div class="panel-label"><span class="dot-ornament">✧</span> YOUR JAR <span class="subtle-inline">${game.selected.length} / ${MAX_JAR} SLOTS FILLED</span></div>
    <div class="jar-slots">${Array.from({length:MAX_JAR},(_,i)=>jarSlot(game.selected[i],i)).join('')}</div>
    <div class="jar-budget" aria-live="polite"><div class="jar-budget__numbers"><strong>✦ ${cost} / ${game.hero.mana} mana to roll</strong><span>${manaLeft} left to manipulate · +${game.hero.manaRegen} next turn</span></div><div class="jar-budget__track" aria-hidden="true">${Array.from({length:game.hero.maxMana},(_,i)=>`<span class="${i<cost?'reserved':i<game.hero.mana?'unspent':''}"></span>`).join('')}</div></div>
    <div class="jar-actions"><div class="jar-helper"><span class="helper-sigil">◈</span> Your first Recollection is free each turn. Extra rerolls cost mana, and dice used enter cooldown.</div><button class="primary-button" type="button" data-action="roll" ${canRoll?'':'disabled'}>ROLL THE JAR <span>➜</span></button></div>
  </div>
  <div class="collection-heading"><div><span class="eyebrow">YOUR COLLECTION</span><h2>The dice satchel <small>${game.dice.length} dice</small></h2></div><span class="collection-helper">CLICK A DIE TO ${game.selected.length?'ADD OR REMOVE':'SELECT'}</span></div>
  <div class="dice-inventory">${[...game.dice].sort((a,b)=>a.remaining-b.remaining).map(d=>dieCard(d)).join('')}</div>`;
}
function effectText(die, value) {
  const t=definition(die).family;
  if (t==='attack') return `${value} DAMAGE`;
  if (t==='block') return `${value} BLOCK`;
  if (t==='poison') return `${value} POISON`;
  if (t==='weaken') return `−${value} NEXT ATTACK`;
  if (t==='strength') return `+${Math.ceil(value/2)} POWER / 2 HITS`;
  if (t==='sunder') return `REMOVE UP TO ${value} ARMOR`;
  if (t==='stagger') return `${value} STAGGER`;
  if (t==='mana') return `+${value} MANA (CAP ${game.hero.maxMana})`;
  if (t==='heal') return `+${value} HP`;
  return '';
}
function attachedFor(id) {return Object.entries(game.links).filter(([,target])=>target===id).map(([modifier])=>modifier);}
function rollTile(id,index) {
  const die=dieById(id),d=definition(die),inf=info(die),value=game.rolls[id],mod=inf.isModifier;
  const active=game.activeDie===id, attachedTo=game.links[id];
  const currentModifier=selectedDie() && isModifier(selectedDie()) ? game.activeDie : null;
  const canTarget=!mod && currentModifier && currentModifier !== id;
  const attached=attachedFor(id);
  return `<article class="rolled-die ${inf.accent} ${active?'active-roll':''} ${canTarget?'drop-target':''} ${attachedTo?'linked-die':''}" ${mod?`draggable="true" data-mod-id="${esc(id)}"`:`data-target-id="${esc(id)}"`}>
    <button class="roll-target" data-action="select-roll" data-id="${esc(id)}" type="button" aria-pressed="${active}" aria-label="${esc(d.name)} rolled ${esc(value)}${canTarget ? '; attach selected modifier here' : ''}">
      <span class="rolled-die__top"><span class="rolled-die__seq">${String(index+1).padStart(2,'0')}</span><span class="rolled-die__family">${esc(inf.label)}</span></span>
      ${faceElement(value,die)}
      <strong class="rolled-die__name">${esc(d.name)}</strong>
      <span class="rolled-die__result">${mod ? d.family==='add'?`ADDS +${modifiedValue(game,id)}`:`MULTIPLIES ×${modifiedValue(game,id)}`:effectText(die,modifiedValue(game,id))}</span>
      ${renderRollBreakdown(game, id)}
    </button>
    <div class="roll-attachments">${mod ? (attachedTo ? `<span class="attached-label">↳ ${esc(definition(dieById(attachedTo)).name)}</span>` : '<span class="unattached-label">○ NEEDS A TARGET</span>') : (attached.length ? attached.map(mid=>`<button class="attachment-chip" type="button" data-action="detach" data-id="${esc(mid)}" title="Detach modifier">${esc(rolledLabel(dieById(mid),adjustedRoll(game,mid)))} <span>×</span></button>`).join('') : '<span class="no-attachment">DROP MODIFIER HERE</span>')}</div>
  </article>`;
}
function rollTools() {
  const d=selectedDie(),value=d?game.rolls[d.id]:null;
  const canNudge=!!d && value<Math.max(...d.faces) && game.hero.mana>=NUDGE_COST;
  const rerollCost=game.hero.freeRecollections>0?0:REROLL_COST;
  return `<section class="control-panel">
    <div class="panel-label"><span class="dot-ornament">✧</span> ARCANE CONTROL <span class="panel-trailing">${game.hero.mana}/${game.hero.maxMana} MANA</span></div>
    <div class="mana-meter">${Array.from({length:game.hero.maxMana},(_,i)=>`<span class="mana-crystal ${i<game.hero.mana?'filled':''}" aria-hidden="true">◆</span>`).join('')}</div>
    ${d ? `<div class="selected-roll-name"><span class="eyebrow">SELECTED DIE</span><h3>${esc(definition(d).name)}</h3>${renderRollBreakdown(game, d.id)}<p>Raw face <strong>${value}</strong>. ${isModifier(d)?'Click any non-purple die to attach this modifier.':'Manipulate this die before casting.'}</p></div>
    <div class="tool-actions"><button class="tool-button" data-action="reroll" data-id="${esc(d.id)}" type="button" ${game.hero.mana<rerollCost?'disabled':''}><span>↻</span><span>Recollection<small>${rerollCost?'ADDITIONAL REROLL':'FIRST REROLL FREE'}</small></span><b>${rerollCost?`${rerollCost} ✦`:'FREE'}</b></button>
    <button class="tool-button" data-action="nudge" data-id="${esc(d.id)}" type="button" ${!canNudge?'disabled':''}><span>↑</span><span>Nudge +1<small>CHANGE THE RESULT</small></span><b>2 ✦</b></button></div>
    ${game.links[d.id]?`<button class="text-button" data-action="detach" data-id="${esc(d.id)}" type="button">⤫ Detach from ${esc(definition(dieById(game.links[d.id])).name)}</button>`:''}` : `<div class="no-selected"><div class="no-selected__icon">✧</div><h3>Take control of fate.</h3><p>Tap a rolled die to reroll or nudge it. Select a purple modifier, then tap an effect die to attach.</p></div>`}
    <div class="control-note"><span>⟡</span><p>Jar cost: <b>${game.lastJarCost} mana</b>. Recover <b>${game.hero.manaRegen} mana</b> each turn; unused mana carries over (max ${game.hero.maxMana}). Mana dice restore resources when the cast resolves. Attachments are free.</p></div>
  </section>`;
}
function resolutionTrack() {
  return `<section class="resolution-panel"><div class="panel-label"><span class="dot-ornament">✧</span> ACTIVATION ORDER <span class="panel-trailing">LEFT ${icon.arrow} RIGHT</span></div>
    <p class="resolution-hint">Reorder effects to time buffs before attacks. Modifiers activate with their attached die.</p>
    <div class="resolution-track">${game.order.map((id,index)=>{
      const die=dieById(id),d=definition(die),attached=attachedFor(id);
      return `<div class="resolve-step ${FAMILY[d.family].accent}"><div class="step-order">0${index+1}</div><span class="step-icon">${esc(d.icon)}</span><div class="step-copy"><strong>${esc(d.name)}</strong><small>${esc(effectText(die,modifiedValue(game,id)))}</small>${attached.length?`<span class="step-mods">${attached.map(m=>esc(rolledLabel(dieById(m),adjustedRoll(game,m)))).join(' · ')}</span>`:''}</div><div class="step-buttons"><button data-action="reorder" data-id="${esc(id)}" data-step="-1" type="button" ${index===0?'disabled':''} aria-label="Move ${esc(d.name)} earlier">←</button><button data-action="reorder" data-id="${esc(id)}" data-step="1" type="button" ${index===game.order.length-1?'disabled':''} aria-label="Move ${esc(d.name)} later">→</button></div></div>`;
    }).join('')}</div></section>`;
}
function castPanel() {
  const unattached=pendingModifiers(game).length;
  return `${phaseHeader('02 / BEND THE OUTCOME','Make the roll <em>matter.</em>','Your jar has already consumed its mana. Use free Recollection or spend remaining mana to refine your results, then arrange attachments and resolve.',`<div class="phase-meta"><span class="phase-meta__big">TURN ${game.turn}</span><span>ROLL COMPLETE</span></div>`)}
  <div class="rolled-header"><span class="eyebrow">DICE ON THE TABLE</span><span class="roll-hint">${unattached ? `${unattached} MODIFIER${unattached>1?'S':''} UNATTACHED`: '✓ ALL MODIFIERS CONNECTED'}</span></div>
  <div class="rolled-grid">${game.selected.map(rollTile).join('')}</div>
  <div class="control-grid">${rollTools()}${resolutionTrack()}</div>
  <div class="cast-footer"><div class="cast-footer__note">${unattached?'<strong>✧ Attach all purple dice to continue.</strong><span>Tap modifier → tap target. You can also drag them.</span>':'<strong>✦ Your combo is ready.</strong><span>Committing resolves your effects, then the enemy acts.</span>'}</div><button class="primary-button" type="button" data-action="commit" ${canCommit(game)?'':'disabled'}>COMMIT THE CAST <span>➜</span></button></div>`;
}
function offerCard(type,purchase=false,sold=false) {
  const d=DICE[type],f=FAMILY[d.family];
  return `<div class="offer-card ${f.accent}"><div class="offer-visual"><div class="offer-die-face"><span>${esc(d.icon)}</span></div><span class="family-tag">${esc(f.label)}</span></div><div class="offer-body"><h3>${esc(d.name)}</h3>${attributeTag(game, d.attribute)}<p>${esc(d.description)}</p><div class="offer-meta"><span>6 SIDES</span><span>COOLDOWN ${d.cooldown}</span><span>✦ ${d.manaCost} MANA</span></div></div>
    <button type="button" class="offer-buy" data-action="${purchase?'shop-buy-die':'claim-die'}" data-die-type="${esc(type)}" ${sold||purchase&&game.gold<SHOP_DIE_COST?'disabled':''}>${sold?'SOLD':purchase?`BUY FOR ${SHOP_DIE_COST} ◈`:'CLAIM DIE  →'}</button></div>`;
}
function rewardPanel(){return `${phaseHeader('03 / VICTORY REWARD','Claim your <em>fortune.</em>','One battle behind you. Choose a free die, improve a face, or rest before visiting the traveling merchant.',`<div class="phase-meta"><span class="phase-meta__big">+${ENCOUNTERS[game.encounter].gold} GOLD</span><span>ENCOUNTER CLEARED</span></div>`)}
  <div class="reward-splash"><div class="reward-splash__sigil">✦</div><div><span class="eyebrow accent-eyebrow">VICTORY</span><h2>The jar sings with possibility.</h2><p>Take one reward. Additional dice and upgrades await in the shop.</p></div></div>
  <div class="collection-heading"><div><span class="eyebrow">FREE REWARD</span><h2>Choose a new die</h2></div><span class="collection-helper">PICK ONE OF THREE</span></div>
  <div class="offers-grid">${game.rewardOffers.map(type=>offerCard(type)).join('')}</div>
  <div class="reward-extras"><button type="button" data-action="forge-start" class="extra-card"><span class="extra-card__icon">⚒</span><span><strong>Forge a face</strong><small>Improve any one face on a die you own.</small></span><b>FREE →</b></button><button type="button" data-action="rest" class="extra-card"><span class="extra-card__icon">♥</span><span><strong>Rest by the fire</strong><small>Recover up to 14 HP before the next fight.</small></span><b>FREE →</b></button></div>`;}
function shopPanel(){return `${phaseHeader('04 / THE TRAVELING MERCHANT','A deal with <em>fate.</em>','Spend your winnings on dice, healing, or a stronger face. All purchases are optional.',`<div class="phase-meta"><span class="phase-meta__big gold-text">◈ ${game.gold} GOLD</span><span>SHOP INVENTORY</span></div>`)}
  <div class="collection-heading"><div><span class="eyebrow">MERCHANT INVENTORY</span><h2>Dice for sale</h2></div><span class="collection-helper">${SHOP_DIE_COST} GOLD EACH</span></div>
  <div class="offers-grid">${game.shopOffers.map(t=>offerCard(t,true,game.shopSold.includes(t))).join('')}</div>
  <div class="reward-extras"><button type="button" data-action="forge-start" class="extra-card" ${game.gold<SHOP_FORGE_COST?'disabled':''}><span class="extra-card__icon">⚒</span><span><strong>Upgrade a face</strong><small>Increase one face by +1 (up to 12).</small></span><b>${SHOP_FORGE_COST} ◈</b></button><button type="button" data-action="shop-heal" class="extra-card" ${game.gold<SHOP_HEAL_COST||game.hero.hp===game.hero.maxHp?'disabled':''}><span class="extra-card__icon">♥</span><span><strong>Restorative draught</strong><small>Recover up to 12 HP.</small></span><b>${SHOP_HEAL_COST} ◈</b></button></div>
  <div class="cast-footer"><div class="cast-footer__note"><strong>✧ Ready for the next room?</strong><span>Unused gold and your upgraded dice carry forward.</span></div><button class="primary-button" data-action="next-encounter" type="button">NEXT ENCOUNTER <span>➜</span></button></div>`;}
function forgePanel(){return `${phaseHeader('04 / THE DICE FORGE','Shape your <em>fortune.</em>','Choose a die, then select the exact face you want to increase by one. Each of its six faces is equally likely to be rolled.',`<div class="phase-meta"><span class="phase-meta__big">${game.forgeCost?`${game.forgeCost} GOLD`:'FREE REWARD'}</span><button data-action="forge-cancel" type="button" class="ghost-button">← BACK</button></div>`)}
  <div class="forge-guide"><span>⚒</span><div><strong>Engraving alters probability, not die size.</strong><p>Upgrade a weak face to improve consistency, or push a high face higher for a bigger jackpot. All dice remain six-sided in the prototype.</p></div></div>
  <div class="forge-inventory">${game.dice.map(d=>{const t=definition(d),f=FAMILY[t.family];return `<div class="forge-row ${f.accent}"><div class="forge-ident"><span class="forge-symbol">${esc(t.icon)}</span><div><strong>${esc(t.name)}</strong><span>CD ${t.cooldown} · D6 · AVG ${(d.faces.reduce((a,b)=>a+b)/6).toFixed(1)}</span></div></div><div class="forge-faces">${d.faces.map((v,i)=>`<button type="button" data-action="upgrade-face" data-id="${esc(d.id)}" data-face-index="${i}" ${v>=12?'disabled':''} aria-label="Upgrade face ${i+1} of ${esc(t.name)}, currently ${v}"><span>${v}</span><small>+1</small></button>`).join('')}</div></div>`;}).join('')}</div>`;}
function finalPanel(won) {return `<div class="final-screen"><div class="final-emblem">${won?'✦':'✕'}</div><span class="eyebrow accent-eyebrow">${won?'THE FINAL CHAMBER CONQUERED':'YOUR JOURNEY ENDS'}</span><h1>${won?'Fate has been <em>rewritten.</em>':'The jar has <em>fallen silent.</em>'}</h1><p>${won?'You defeated all four guardians. Your strategy, your dice, your victory.':'The next attempt begins with a fresh jar. Experiment with different combinations and save mana for key turns.'}</p><div class="final-numbers"><span><b>${game.encounter+ (won?1:0)}${won?'':' / '+ENCOUNTERS.length}</b> Chambers cleared</span><span><b>${game.dice.length}</b> Dice collected</span><span><b>${game.gold}</b> Gold remaining</span></div><button class="primary-button" data-action="new-run" type="button">BEGIN A NEW RUN <span>➜</span></button></div>`;}
function sidebar() {
  const active=['select','cast'].includes(game.phase);
  const ready=game.dice.filter(d=>d.remaining===0).length;
  return `<aside class="sidebar">${renderStatsSidebar(game)}<section class="sidebar-card run-stats"><div class="panel-label"><span class="dot-ornament">✧</span> RUN DETAILS</div><div class="run-stats__grid"><div><span>CHAMBER</span><b>${String(game.encounter+1).padStart(2,'0')} <small>/ ${ENCOUNTERS.length}</small></b></div><div><span>CURRENT TURN</span><b>${game.turn}</b></div><div><span>GOLD</span><b class="gold-text">◈ ${game.gold}</b></div><div><span>OWNED DICE</span><b>${game.dice.length}</b></div></div>
    <div class="divider"></div><div class="sidebar-subtitle">COOLDOWN STATUS</div><div class="cooldown-count"><span><i class="count-ready"></i> ${ready} ready</span><span><i class="count-wait"></i> ${game.dice.length-ready} recovering</span></div></section>
    <section class="sidebar-card log-card"><div class="panel-label"><span class="dot-ornament">✧</span> CHRONICLE <span class="panel-trailing">LIVE</span></div><div class="log-feed" aria-label="Battle log" aria-live="polite">${game.log.slice(0,9).map(l=>`<div class="log-line ${l.type}"><span>›</span>${esc(l.message)}</div>`).join('')}</div></section>
    ${active ? `<section class="hint-card"><span class="hint-card__icon">✦</span><span class="eyebrow">THE ART OF THE JAR</span><h3>${game.phase==='select'?'Choose with intention.':'Attach. Arrange. Commit.'}</h3><p>${game.phase==='select'?'Loading dice costs mana. Cheap dice leave more energy to manipulate the roll; save expensive combinations for dangerous turns.':'Additive modifiers apply first, then multipliers. A buff die activates only when its place in the order is reached.'}</p><button type="button" data-action="help">READ THE FIELD GUIDE →</button></section>`:''}</aside>`;
}
function render() {
  let main;
  switch(game.phase) {
    case 'character':
    case 'levelup': main=renderCharacterPanel(game);break;
    case 'select': main=selectionPanel();break;
    case 'cast': main=castPanel();break;
    case 'reward': main=rewardPanel();break;
    case 'shop': main=shopPanel();break;
    case 'forge': main=forgePanel();break;
    case 'won': main=finalPanel(true);break;
    case 'lost': main=finalPanel(false);break;
    default: main='';
  }
  root.innerHTML=`${resourceCards()}<div class="workbench"><div class="workbench-main">${main}</div>${sidebar()}</div>${game.notice?`<div class="toast" role="status">✧ ${esc(game.notice)}</div>`:''}`;
}
function update(action) {
  const previous = document.activeElement;
  const focusData = previous?.dataset?.action ? { ...previous.dataset } : null;
  game=reduceGame(game,action);render();
  if (focusData && root.querySelectorAll) {
    const target = [...root.querySelectorAll('[data-action]')].find(el => !el.disabled && Object.entries(focusData).every(([k,v]) => el.dataset[k] === v));
    target?.focus({ preventScroll: true });
  }
}

document.addEventListener('click',event=>{
  const el=event.target.closest('[data-action]'); if(!el || el.disabled) return;
  const action=el.dataset.action;
  const id=el.dataset.id;
  if(action==='help'){modal.showModal();return;}
  if(action==='close-help'){modal.close();return;}
  if(action==='new-run') { if(['character','select','cast','levelup','reward','shop','forge'].includes(game.phase) && !window.confirm('Start over? Current run progress will be lost.')) return;update({type:'NEW_GAME'});return; }
  const acts={ 'allocate-attribute':()=>({type:'ALLOCATE_ATTRIBUTE',attribute:el.dataset.attribute,delta:Number(el.dataset.delta)}), 'choose-talent':()=>({type:'CHOOSE_TALENT',talent:el.dataset.talent}), 'confirm-attributes':()=>({type:'CONFIRM_ATTRIBUTES'}), 'focus':()=>({type:'FOCUS',attribute:el.dataset.attribute}), 'toggle-die':()=>({type:'TOGGLE_DIE',id}), 'roll':()=>({type:'ROLL'}), 'reroll':()=>({type:'REROLL',id}), 'nudge':()=>({type:'NUDGE',id}), 'detach':()=>({type:'DETACH',id}), 'commit':()=>({type:'COMMIT'}), 'reorder':()=>({type:'REORDER',id,step:Number(el.dataset.step)}), 'claim-die':()=>({type:'CLAIM_DIE',dieType:el.dataset.dieType}), 'rest':()=>({type:'REST'}), 'forge-start':()=>({type:'FORGE_START'}), 'forge-cancel':()=>({type:'FORGE_CANCEL'}), 'upgrade-face':()=>({type:'UPGRADE_FACE',id,faceIndex:Number(el.dataset.faceIndex)}), 'shop-buy-die':()=>({type:'SHOP_BUY_DIE',dieType:el.dataset.dieType}), 'shop-heal':()=>({type:'SHOP_HEAL'}), 'next-encounter':()=>({type:'NEXT_ENCOUNTER'}) };
  if(action==='select-roll'){
    const active=selectedDie();
    const target=dieById(id);
    if (active && isModifier(active) && target && !isModifier(target) && active.id!==id) update({type:'ATTACH',modId:active.id,targetId:id});
    else update({type:'SELECT_ROLL',id});
  } else if(acts[action]) update(acts[action]());
});
let draggedMod = null;
root.addEventListener('dragstart', event => {
  const tile=event.target.closest('[data-mod-id]');
  if(!isCast()||!tile) return;
  draggedMod=tile.dataset.modId;
  event.dataTransfer.effectAllowed='move';
  event.dataTransfer.setData('text/plain',draggedMod);
});
root.addEventListener('dragover',event=>{
  const tile=event.target.closest('[data-target-id]');
  if(!tile || !draggedMod || !isCast())return;
  event.preventDefault();event.dataTransfer.dropEffect='link';tile.classList.add('drop-hover');
});
root.addEventListener('dragleave',event=>{
  const tile=event.target.closest('[data-target-id]');
  if(tile)tile.classList.remove('drop-hover');
});
root.addEventListener('drop',event=>{
  const tile=event.target.closest('[data-target-id]');
  if(!tile || !isCast())return;
  event.preventDefault();tile.classList.remove('drop-hover');
  const modId=draggedMod || event.dataTransfer.getData('text/plain');draggedMod=null;
  if(modId)update({type:'ATTACH',modId,targetId:tile.dataset.targetId});
});
root.addEventListener('dragend',()=>{draggedMod=null;});
render();