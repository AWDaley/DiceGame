import { ATTRIBUTES, TALENTS, DICE, STARTING_ATTRIBUTE_CAP, ATTRIBUTE_CAP, FOCUS_COST } from './content.js';
import { attributeBonus, temporaryAttributeBonus, canConfirmAttributes, canFocus } from './attributes.js';
import { rollBreakdown, jarManaCost } from './game.js';

const escapeCharacter = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const signedBonus = n => `${n >= 0 ? '+' : '−'}${Math.abs(n)}`;

export function attributeTag(state, attribute) {
  return `<span class="attribute-tag">${escapeCharacter(ATTRIBUTES[attribute].name)} ${signedBonus(attributeBonus(state, attribute))}</span>`;
}
export function renderRollBreakdown(state, id) {
  const b = rollBreakdown(state, id);
  if (!b) return '';
  const die = state.dice.find(d => d.id === id), def = DICE[die.type];
  const modifier = def.family === 'add' || def.family === 'multiply';
  return `<span class="roll-math"><span>Face ${b.raw} + ${b.permanent} ${ATTRIBUTES[b.attribute].name}${b.temporary ? ` ${signedBonus(b.temporary)} temporary` : ''} = <b>${b.adjusted}</b></span>${def.family === 'multiply' ? `<span>ceil(${b.adjusted} ÷ 2), bounded ×1–×3 → <b>×${b.final}</b></span>` : !modifier && (b.additive || b.multiplier !== 1) ? `<span>(${b.adjusted} + ${b.additive}) × ${b.multiplier} → <b>${b.final}</b></span>` : ''}${b.capped ? `<span>Output capped at ${def.outputCap}</span>` : ''}</span>`;
}
function talentChoices(state) {
  return ['vitality', 'spirit'].filter(attribute => state.hero.attributes[attribute] >= 2).map(attribute => {
    const locked = state.allocationBase[attribute] >= 2;
    return `<section class="talent-group" aria-label="${ATTRIBUTES[attribute].name} talent"><h3>${ATTRIBUTES[attribute].name} talent <small>${locked ? 'LOCKED FOR THIS RUN' : 'CHOOSE ONE'}</small></h3><div class="talent-options">${Object.entries(TALENTS).filter(([, t]) => t.attribute === attribute).map(([id, t]) => `<button class="talent-choice ${state.hero.talents[attribute] === id ? 'chosen' : ''}" type="button" data-action="choose-talent" data-talent="${id}" aria-pressed="${state.hero.talents[attribute] === id}" ${locked ? 'disabled' : ''}><strong>${t.name}</strong><span>${t.description}</span></button>`).join('')}</div></section>`;
  }).join('');
}
export function renderCharacterPanel(state) {
  const creating = state.phase === 'character', cap = creating ? STARTING_ATTRIBUTE_CAP : ATTRIBUTE_CAP;
  const hero = state.hero;
  return `<section class="character-builder" aria-label="Character attributes">
    <div class="section-heading"><div class="section-heading__copy"><span class="eyebrow accent-eyebrow">${creating ? '00 / BUILD YOUR WANDERER' : `VICTORY / LEVEL ${state.level}`}</span><h1>${creating ? 'Give your dice <em>character.</em>' : 'Grow into your <em>power.</em>'}</h1><p>${creating ? 'Spend three points. Every die uses one attribute as a roll bonus. Start with up to two points per attribute; grow to four during the run.' : 'You earned one attribute point. Invest it before choosing your free reward. Earlier investments cannot be refunded.'}</p></div><div class="phase-meta"><span class="phase-meta__big" aria-live="polite">${hero.attributePoints} POINT${hero.attributePoints === 1 ? '' : 'S'} LEFT</span><span>LEVEL ${state.level}</span></div></div>
    <div class="character-derived"><span>♥ <b>${hero.maxHp}</b> max HP</span><span>✦ <b>${hero.maxMana}</b> max mana</span><span>↻ <b>${hero.manaRegen}</b> mana / turn</span></div>
    <div class="attribute-grid">${Object.entries(ATTRIBUTES).map(([key, a]) => {
      const examples = Object.values(DICE).filter(d => d.attribute === key).map(d => d.name);
      const value = hero.attributes[key];
      return `<article class="attribute-card"><div class="attribute-card-heading"><span class="attribute-emblem" aria-hidden="true">${a.icon}</span><h2>${a.name}</h2><b class="attribute-score">+${value}</b></div><p>${a.description}</p><small class="attribute-examples">${examples.join(' · ')}</small><div class="attribute-controls"><button class="ghost-button" type="button" data-action="allocate-attribute" data-attribute="${key}" data-delta="-1" aria-label="Remove ${a.name} point" ${value <= state.allocationBase[key] ? 'disabled' : ''}>−</button><span>${value} / ${cap}</span><button class="ghost-button" type="button" data-action="allocate-attribute" data-attribute="${key}" data-delta="1" aria-label="Add ${a.name} point" ${hero.attributePoints < 1 || value >= cap ? 'disabled' : ''}>+</button></div></article>`;
    }).join('')}</div>
    <p class="attribute-note">At 2 Vitality or Spirit, choose one talent. Temporary bonuses never change maximum HP, mana, or talent eligibility.</p>
    ${talentChoices(state)}
    <div class="cast-footer"><div class="cast-footer__note"><strong>Face + attribute, then attachments.</strong><span>Rerolls change the face only. Additions apply before multipliers.</span></div><button class="primary-button" type="button" data-action="confirm-attributes" ${canConfirmAttributes(state) ? '' : 'disabled'}>${creating ? 'BEGIN ADVENTURE' : 'CHOOSE YOUR REWARD'} <span>➜</span></button></div>
  </section>`;
}
export function renderStatsSidebar(state) {
  const h = state.hero, inCombat = ['select', 'cast'].includes(state.phase);
  const canUse = canFocus(state) && (state.phase !== 'select' || h.mana - jarManaCost(state) >= FOCUS_COST);
  return `<section class="sidebar-card character-sheet"><div class="panel-label">✧ CHARACTER <span class="panel-trailing">LEVEL ${state.level}</span></div><div class="attribute-list">${Object.entries(ATTRIBUTES).map(([key, a]) => {
    const temporary = temporaryAttributeBonus(state, key);
    return `<div class="attribute-line"><span>${a.icon} ${a.name}</span><strong>${signedBonus(h.attributes[key])}${temporary ? `<small class="${temporary > 0 ? 'positive-stat' : 'negative-stat'}"> ${signedBonus(temporary)}</small>` : ''}</strong>${inCombat ? `<button type="button" class="focus-button" data-action="focus" data-attribute="${key}" ${canUse ? '' : 'disabled'} aria-label="Focus ${a.name} for 2 mana" title="+2 ${a.name} this turn. Costs 2 mana; skips 2 future turns.">Focus</button>` : ''}</div>`;
  }).join('')}</div>${inCombat ? `<p class="focus-note">Focus: +2 to one attribute this turn · 2 mana.<br>${h.focusRemaining ? `Recovering · ${Math.min(h.focusRemaining, 2)} future turn(s) remaining.` : 'Ready · use before or after rolling.'}</p>` : ''}
  <div class="derived-list"><span>Mana regeneration <b>${h.manaRegen} / turn</b></span>${Object.entries(h.resistances).map(([type, value]) => `<span>${type[0].toUpperCase() + type.slice(1)} resistance <b>${value}</b></span>`).join('')}</div>
  ${Object.values(h.talents).length ? `<div class="character-talents">${Object.values(h.talents).map(id => `<span title="${escapeCharacter(TALENTS[id].description)}">✦ ${TALENTS[id].name}</span>`).join('')}</div>` : ''}
  ${h.statEffects.length ? `<div class="stat-effects">${h.statEffects.map(e => `<p class="${e.amount > 0 ? 'positive-stat' : 'negative-stat'}">${signedBonus(e.amount)} ${ATTRIBUTES[e.attribute].name} · ${escapeCharacter(e.source)}<small>Through turn ${e.expiresAfterTurn}</small></p>`).join('')}</div>` : ''}</section>`;
}
