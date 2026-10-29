import { ATTRIBUTES, TALENTS, MANEUVERS, STARTING_ATTRIBUTE_CAP, ATTRIBUTE_CAP, FOCUS_COST } from './content.js';
import { canConfirmAttributes, temporaryAttributeBonus } from './attributes.js';
import { decisionActor } from './combat.js';
import { esc, buttonData, heading } from './ui-utils.js';

export function renderCharacterPanel(state) {
  const h = state.combatants.hero, creating = state.phase === 'character', cap = creating ? STARTING_ATTRIBUTE_CAP : ATTRIBUTE_CAP;
  return `<section class="character-builder" aria-label="Character attributes">
    ${heading(creating ? '00 / CHARACTER' : `VICTORY / LEVEL ${state.level}`, creating ? 'Give your equipment <em>character.</em>' : 'Grow into your <em>power.</em>', creating ? 'Allocate three points. Your attributes improve the dice rolled by your equipment.' : 'Invest your new attribute point before choosing a reward. Previous investments stay locked.')}
    <div class="character-derived"><strong class="points-left" aria-live="polite">${h.attributePoints} POINTS LEFT</strong><span>♥ ${h.maxHp} max HP</span><span>✦ ${h.maxMana} max mana</span><span>↻ ${h.manaRegen} mana / round</span></div>
    <div class="attribute-grid">${Object.entries(ATTRIBUTES).map(([id,a])=>`<article class="attribute-card"><div class="attribute-card-heading"><span class="attribute-emblem">${a.icon}</span><h2>${a.name}</h2><b class="attribute-score">+${h.attributes[id]}</b></div><p>${a.description}</p><small class="attribute-examples">${[...new Set(Object.values(MANEUVERS).filter(m=>m.attribute===id).map(m=>m.name))].join(' · ')}</small><div class="attribute-controls"><button class="ghost-button" ${buttonData(state,'allocate',{attribute:id,delta:-1})} aria-label="Remove ${a.name} point" ${h.attributes[id]<=state.allocationBase[id]?'disabled':''}>−</button><span>${h.attributes[id]} / ${cap}</span><button class="ghost-button" ${buttonData(state,'allocate',{attribute:id,delta:1})} aria-label="Add ${a.name} point" ${!h.attributePoints||h.attributes[id]>=cap?'disabled':''}>+</button></div></article>`).join('')}</div>
    ${['vitality','spirit'].filter(a=>h.attributes[a]>=2).map(a=>`<section class="talent-group"><h3>${ATTRIBUTES[a].name} talent <small>${state.allocationBase[a]>=2?'LOCKED':'CHOOSE ONE'}</small></h3><div class="talent-options">${Object.entries(TALENTS).filter(([,t])=>t.attribute===a).map(([id,t])=>`<button class="talent-choice ${h.talents[a]===id?'chosen':''}" ${buttonData(state,'talent',{talent:id})} aria-pressed="${h.talents[a]===id}" ${state.allocationBase[a]>=2?'disabled':''}><strong>${t.name}</strong><span>${t.description}</span></button>`).join('')}</div></section>`).join('')}
    <div class="cast-footer"><p class="muted">Vitality and Spirit unlock a talent at two points.</p><button class="primary-button" ${buttonData(state,'confirm-attributes')} ${canConfirmAttributes(state)?'':'disabled'}>${creating?'CHOOSE EQUIPMENT':'CHOOSE YOUR REWARD'} <span>→</span></button></div>
  </section>`;
}
export function renderStatsSidebar(state) {
  const h = state.combatants.hero, c = state.combat;
  const manipulating = state.phase==='battle' && ['manipulate_actor','manipulate_defender'].includes(c.stage) && decisionActor(state)==='hero';
  const focus = c?.exchange?.focus.hero;
  const available = manipulating && h.focusReadyRound<=c.roundNumber && h.mana>=FOCUS_COST;
  return `<section class="sidebar-card character-sheet"><div class="panel-label">✧ CHARACTER <span class="panel-trailing">LV ${state.level}</span></div><div class="attribute-list">${Object.entries(ATTRIBUTES).map(([id,a])=>{
    const temp = state.phase==='battle' ? temporaryAttributeBonus(h,id,c.exchangeId,focus) : 0;
    return `<div class="attribute-line"><span>${a.icon} ${a.name}</span><strong>+${h.attributes[id]}${temp?` (${temp>0?'+':''}${temp})`:''}</strong><button class="focus-button" ${buttonData(state,'focus',{attribute:id})} aria-label="Focus ${a.name}" ${available?'':'disabled'}>Focus</button></div>`;
  }).join('')}</div><p class="focus-note">Focus: 2 mana → +2 to one attribute for this exchange. ${state.phase==='battle'&&h.focusReadyRound>c.roundNumber?`Ready round ${h.focusReadyRound}.`:'Use in your manipulation window; skips 2 recovery rounds.'}</p>
    <div class="derived-list"><span>Mana recovery <b>${h.manaRegen} / round</b></span><span>Physical / arcane resist <b>${h.resistances.physical} / ${h.resistances.arcane}</b></span><span>Poison resistance <b>${h.resistances.poison}</b></span><span>Gold <b>◈ ${state.gold}</b></span></div>
    <div class="character-talents">${Object.values(h.talents).map(id=>`<span>${TALENTS[id].name}</span>`).join('')}</div>
    ${h.statEffects.length?`<div class="stat-effects">${h.statEffects.map(e=>`<p class="negative-stat">${e.amount} ${esc(ATTRIBUTES[e.attribute].name)}<small>Next eligible rolled exchange; does not alter resource capacity.</small></p>`).join('')}</div>`:''}</section>`;
}
