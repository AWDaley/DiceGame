import { ATTRIBUTES, MANEUVERS, EQUIPMENT, ENCOUNTERS, ACTION_SUPPORTS, REACTION_SUPPORTS } from './content.js';
import { itemById, itemDefinition, modifierManeuver, bundleCost, validateBundle, itemReason, compatibleModifier } from './equipment.js';
import { estimateBundle, calculateBundle } from './effects.js';
import { activeId, decisionActor, legalManeuvers } from './combat.js';
import { esc, buttonData, heading, faces } from './ui-utils.js';

const pct=(v,max)=>Math.max(0,Math.min(100,100*v/max));
export function renderArena(state) {
  const c=state.combat, battle=state.phase==='battle';
  const card=(id)=>{
    const a=state.combatants[id];
    return `<div class="combatant ${id}-combatant"><div class="combatant__icon ${id==='hero'?'hero-avatar':'enemy-avatar'}" aria-hidden="true">${id==='hero'?'✧':ENCOUNTERS[state.encounter].icon}</div><div class="combatant__stats"><span class="eyebrow">${id==='hero'?'THE WANDERER':ENCOUNTERS[state.encounter].subtitle}</span><div class="combatant__line"><h2>${a.name}</h2><span class="stat-number">${a.hp}<small>/${a.maxHp} HP</small></span></div><div class="statbar ${id==='hero'?'hp':'enemy-hp'}"><div style="width:${pct(a.hp,a.maxHp)}%"></div></div><div class="status-line"><span class="status-chip mana-chip">✦ ${a.mana}/${a.maxMana} mana</span><span class="status-chip">Poise ${a.poise}</span>${a.armor?`<span class="status-chip">Armor ${a.armor}</span>`:''}${a.poison?`<span class="status-chip poison-chip">Poison ${a.poison}</span>`:''}${a.pendingSkip?'<span class="status-chip poison-chip">Main skip pending</span>':''}${a.resolveProtection?'<span class="status-chip power-chip">Resolve</span>':''}${battle?`<span class="status-chip">Reaction ${a.reactionAvailable?'ready':'spent'}</span>`:''}</div></div></div>`;
  };
  return `<section class="arena" aria-label="Combatants">${card('hero')}<div class="arena-center"><span class="arcane-mark">✳</span><span class="encounter-number">${state.encounter+1} / 4</span><span class="arena-dash">${battle?`ROUND ${c.roundNumber}`:'CHAMBER'}</span></div>${card('enemy')}</section>`;
}
function rangeText(state,id,bundle) {
  if (!bundle) return '';
  const actor=state.combatants[id], e=state.combat.exchangeId;
  const min=estimateBundle(actor,bundle,e,null,'min'), max=estimateBundle(actor,bundle,e,null,'max');
  return `<span>${min.effect}–${max.effect} ${esc(min.kind==='attack'?'damage':min.kind)}${max.accuracy?` · Accuracy ${min.accuracy===max.accuracy?min.accuracy:`${min.accuracy}–${max.accuracy}`}`:''}${max.poison?` · Poison payload ${min.poison}–${max.poison}`:''}${max.parryDifficulty?` · Parry ${max.parryDifficulty}`:''}</span>`;
}
function bundleName(state,id,bundle) {
  if (!bundle) return 'No reaction';
  return [MANEUVERS[bundle.maneuverId].name,...bundle.modifierIds.map(mid=>itemDefinition(itemById(state.combatants[id],mid)).name)].join(' + ');
}
function draftPanel(state) {
  const c=state.combat, h=state.combatants.hero, reacting=c.stage==='reaction';
  const timing=reacting?'reaction':'action', d=c.draft, primary=MANEUVERS[d.maneuverId];
  const cost=bundleCost(h,d.itemId?d:null), reason=validateBundle(h,d,timing,c.roundNumber,reacting?MANEUVERS[c.exchange.action.maneuverId]:null);
  const candidates=legalManeuvers(state,'hero',timing);
  const groups=h.items.filter(item=>h.equippedItemIds.includes(item.id)&&itemDefinition(item).maneuvers.some(mid=>MANEUVERS[mid].timing===timing));
  return `${heading(reacting?'REACT / ENEMY MAIN TURN':'ACT / YOUR MAIN TURN',reacting?'Choose your <em>response.</em>':'Construct a <em>maneuver.</em>',reacting?'Commit a reaction before either side rolls. Blocking, evading, retaliating and recovering are different choices.':'Choose one action and up to two compatible supports. Keep mana and equipment for the enemy’s turn.')}
    ${reacting?`<section class="incoming-panel" data-dice-count="${1+c.exchange.action.modifierIds.length}" aria-label="Incoming maneuver"><span class="eyebrow">DECLARED · NOT YET ROLLED</span><h2>${bundleName(state,'enemy',c.exchange.action)}</h2><p>${MANEUVERS[c.exchange.action.maneuverId].description}</p><div class="range-line">${rangeText(state,'enemy',c.exchange.action)}</div><p class="muted">${MANEUVERS[c.exchange.action.maneuverId].damageType||'Non-HP effect'} · ${MANEUVERS[c.exchange.action.maneuverId].tags.join(' · ')||'Recovery / support'}</p></section>`:''}
    <section class="maneuver-jar" aria-label="Maneuver jar"><div><span class="eyebrow">${reacting?'REACTION':'ACTION'} JAR</span><h2>${primary?primary.name:'Select a primary maneuver'}</h2><div class="range-line">${primary?rangeText(state,'hero',d):'One equipment die defines the maneuver.'}</div><p class="jar-support-names">${d.modifierIds.map(id=>itemDefinition(itemById(h,id)).name).join(' + ')||'No supporting equipment selected'}</p></div><div class="jar-budget-v4"><strong>${cost} / ${h.mana} mana reserved</strong><span>${h.mana-cost} left for manipulation${!reacting?' and defense':''}</span><span>${d.modifierIds.length} / ${reacting?REACTION_SUPPORTS:ACTION_SUPPORTS} support slots</span></div><div class="jar-buttons"><button class="primary-button" ${buttonData(state,'declare')} ${reason?'disabled':''}>COMMIT ${reacting?'REACTION':'ACTION'} →</button><button class="ghost-button" ${buttonData(state,reacting?'pass-reaction':'pass-turn')}>${reacting?'PASS REACTION':'PASS MAIN TURN'}</button></div></section>
    <h2 class="subheading">${reacting?'Reactive equipment':'Main actions'} <small>one physical item, one use per round</small></h2><div class="gear-grid">${groups.map(item=>{
      const def=itemDefinition(item), chosen=d.itemId===item.id;
      return `<article class="gear-card ${chosen?'chosen':''}"><div class="gear-top"><span class="gear-icon">${def.icon}</span><span class="eyebrow">${def.name}</span>${item.charges!==null?`<span class="charge-label">${item.charges} charges</span>`:''}</div>${faces(item)}<div class="maneuver-options">${candidates.filter(x=>x.itemId===item.id).map(x=>{
        const m=MANEUVERS[x.maneuverId]; return `<button class="maneuver-choice ${d.itemId===item.id&&d.maneuverId===x.maneuverId?'selected':''}" ${buttonData(state,'maneuver',{'item-id':item.id,'maneuver-id':x.maneuverId})} ${x.reason?'disabled':''} aria-pressed="${d.itemId===item.id&&d.maneuverId===x.maneuverId}"><strong>${m.name} <span>✦ ${m.manaCost}</span></strong><small>${ATTRIBUTES[m.attribute].name} +${h.attributes[m.attribute]} · ${m.recoveryRounds} extra recovery${m.accuracy?` · Accuracy ${m.accuracy}`:''}</small><p>${m.description}</p>${x.reason?`<span class="unavailable-reason">${esc(x.reason)}</span>`:''}</button>`;
      }).join('')}</div>${def.maneuvers.length>1?'<p class="shared-warning">All maneuvers share this item’s availability.</p>':''}</article>`;
    }).join('')}</div>
    <h2 class="subheading">Supporting equipment <small>attachments lock at commitment</small></h2><div class="support-grid">${h.items.filter(i=>h.equippedItemIds.includes(i.id)&&modifierManeuver(i)).map(item=>{
      const def=itemDefinition(item), mid=modifierManeuver(item), m=MANEUVERS[mid], selected=d.modifierIds.includes(item.id);
      const next={...d,modifierIds:selected?d.modifierIds.filter(id=>id!==item.id):[...d.modifierIds,item.id]};
      const invalid=selected?'':!primary?'Select a primary first.':validateBundle(h,next,timing,c.roundNumber,reacting?MANEUVERS[c.exchange.action.maneuverId]:null);
      return `<button class="support-card ${selected?'chosen':''}" ${buttonData(state,'support',{'item-id':item.id})} aria-pressed="${selected}" ${invalid?'disabled':''}><span class="gear-icon">${def.icon}</span><strong>${def.name} · ${m.manaCost} mana</strong><small>${ATTRIBUTES[m.attribute].name} +${h.attributes[m.attribute]}${item.charges!==null?` · ${item.charges} charges`:''}</small><p>${m.description}</p>${invalid?`<span class="unavailable-reason">${esc(invalid)}</span>`:''}</button>`;
    }).join('')}</div>`;
}
function resultPanel(state, id) {
  const c=state.combat,e=c.exchange,a=state.combatants[id],bundle=id===e.actorId?e.action:e.reaction;
  if (!bundle) return `<section class="roll-side"><span class="eyebrow">${a.name}</span><h2>No reaction</h2><p>Relies on passive defenses.</p></section>`;
  const locked=e.locked[id], result=locked||calculateBundle(a,bundle,e.raw[id],e.id,e.focus[id]);
  const own=decisionActor(state)==='hero'&&id==='hero'&&!locked;
  return `<section class="roll-side" aria-label="${id} roll"><div class="roll-side-head"><span class="eyebrow">${a.name} · ${id===e.actorId?'ACTING':'DEFENDING'}</span><span class="lock-tag">${locked?'LOCKED':decisionActor(state)===id?'CAN MANIPULATE':'WAITING FOR ACTOR'}</span></div><h2>${result.name}</h2><div class="effect-total"><b>${result.kind==='breath'?Math.floor(result.effect/2):result.effect}</b><span>${result.kind==='attack'||result.kind==='counter'?`${result.damageType} damage`:result.kind==='breath'?'mana recovered (half strength)':result.kind}${result.accuracy?` · Accuracy ${result.accuracy}`:''}${result.poison?` · ${result.poison} poison on wound`:''}</span></div><p class="roll-formula">(${result.breakdown[0].adjusted} + ${result.add}) × ${result.multiplier}${result.power?` + ${result.power} power`:''}${result.weakened?` − ${result.weakened} weakened`:''} = ${result.effect}${result.capped?' (capped)':''}${result.kind==='breath'?`; floor(${result.effect} ÷ 2) = ${Math.floor(result.effect/2)} mana`:''}</p>
    <div class="exchange-dice">${result.breakdown.map(b=>{
      const item=itemById(a,b.itemId),m=MANEUVERS[b.maneuverId],cost=a.freeRecollections?0:1;
      return `<div class="exchange-die"><div class="raw-face">${b.raw}</div><div class="die-math"><strong>${itemDefinition(item).name}</strong><span>Face ${b.raw} + ${b.permanent} ${ATTRIBUTES[b.attribute].name}${b.temporary?` ${b.temporary>0?'+':''}${b.temporary} temporary`:''} = ${b.adjusted}</span>${m.kind==='multiply'?`<small>Multiplier ×${b.contribution} (bounded ×1–×3)</small>`:''}${own?`<div class="inline-tools"><button class="ghost-button" ${buttonData(state,'reroll',{'item-id':b.itemId})} aria-label="Reroll ${itemDefinition(item).name}" ${a.mana<cost?'disabled':''}>↻ ${cost?'1 MANA':'FREE'}</button><button class="ghost-button" ${buttonData(state,'nudge',{'item-id':b.itemId})} aria-label="Nudge ${itemDefinition(item).name}" ${a.mana<2||b.raw>=Math.max(...item.faces)?'disabled':''}>+1 · 2 MANA</button></div>`:''}</div></div>`;
    }).join('')}</div></section>`;
}
function manipulationPanel(state) {
  const c=state.combat,e=c.exchange;
  return `${heading('REVEALED / POST-ROLL CONTROL','Bend the <em>result.</em>',`${c.stage==='manipulate_actor'?'The acting side locks first. The defender still has its manipulation window.':'The acting side is locked. Your reaction has the final manipulation window.'} Recollection is shared across this entire round.`)}
    <div class="exchange-grid">${resultPanel(state,e.actorId)}${resultPanel(state,e.defenderId)}</div>
    <div class="cast-footer"><p class="muted">${state.combatants.hero.freeRecollections?'One free reroll remains this round.':'Free reroll spent. Additional rerolls cost 1 mana.'} Focus is available in your character panel.</p><button class="primary-button" ${buttonData(state,'lock')}>LOCK MY RESULT <span>→</span></button></div>`;
}
function summaryPanel(state) {
  const c=state.combat,events=state.events.filter(e=>e.id>c.summaryStart),e=c.exchange;
  return `${heading('EXCHANGE / COMPLETE','The outcome is <em>settled.</em>', c.summaryForcedSkip?'A forced skip grants Resolve protection. Reactions and resource recovery still follow the normal round rules.':'Continue to the next main turn. Mana and free rerolls refresh only at the next round’s start.')}
    ${e?`<div class="summary-duel"><span>${bundleName(state,e.actorId,e.action)}</span><span>against</span><span>${bundleName(state,e.defenderId,e.reaction)}</span></div>`:''}
    <div class="exchange-outcome" role="status">${events.filter(e=>!['DIE_ROLLED','RESULT_LOCKED','TURN_STARTED'].includes(e.type)).map(e=>`<p data-event="${e.type}">${esc(e.text)}</p>`).join('')}</div>
    <button class="primary-button" ${buttonData(state,'continue')}>CONTINUE <span>→</span></button>`;
}
export function renderBattle(state) {
  if (state.combat.stage==='summary') return summaryPanel(state);
  if (['action','reaction'].includes(state.combat.stage)) return draftPanel(state);
  return manipulationPanel(state);
}
export function renderEnemyEquipment(state) {
  if (state.phase!=='battle') return '';
  const e=state.combatants.enemy,c=state.combat;
  return `<section class="sidebar-card"><div class="panel-label">OPPONENT’S EQUIPMENT</div><p class="focus-note">${ENCOUNTERS[state.encounter].tendency}</p><div class="enemy-equipment">${e.items.filter(i=>e.equippedItemIds.includes(i.id)).map(i=>`<div><strong>${itemDefinition(i).icon} ${itemDefinition(i).name}</strong><small>${itemReason(e,i,c.roundNumber)||'Ready'}${i.charges!==null?` · ${i.charges} charges`:''}</small></div>`).join('')}</div></section>`;
}
