import { MANEUVERS, FOCUS_COST, FOCUS_BONUS } from './content.js';
import { bundleEntries, bundleCost, validateBundle, itemDefinition, modifierManeuver, compatibleModifier, itemReason } from './equipment.js';
import { estimateBundle, calculateBundle, damageBreakdown } from './effects.js';
import { decisionActor, combatCommand, activeId, otherId } from './combat.js';

/** Structural information barrier: choosing a maneuver never receives raw rolls. */
export function publicDecisionView(state, id) {
  const c = state.combat;
  const view = { actorId: id, round: c.roundNumber, exchangeId: c.exchangeId, stage: c.stage,
    actor: structuredClone(state.combatants[id]), opponent: structuredClone(state.combatants[otherId(id)]), incoming: null };
  if (c.stage === 'reaction') {
    view.incoming = { bundle: structuredClone(c.exchange.action), result: estimateBundle(view.opponent, c.exchange.action, c.exchangeId) };
  }
  return view;
}
export function legalBundles(view, timing) {
  const a = view.actor, incoming = view.incoming ? MANEUVERS[view.incoming.bundle.maneuverId] : null;
  const supports = a.items.filter(i => modifierManeuver(i) && !itemReason(a, i, view.round));
  const result = [];
  for (const item of a.items) for (const mid of itemDefinition(item).maneuvers) {
    const m = MANEUVERS[mid]; if (m.timing !== timing) continue;
    const base = { itemId: item.id, maneuverId: mid, modifierIds: [] };
    const possible = supports.filter(i => i.id !== item.id && compatibleModifier(m, MANEUVERS[modifierManeuver(i)]));
    const subsets = [[], ...possible.map(i => [i.id])];
    if (timing === 'action') for (let i = 0; i < possible.length; i++) for (let j = i + 1; j < possible.length; j++) subsets.push([possible[i].id, possible[j].id]);
    for (const ids of subsets) {
      const bundle = { ...base, modifierIds: ids };
      if (!validateBundle(a, bundle, timing, view.round, incoming)) result.push(bundle);
    }
  }
  return result;
}
function expectedDamage(target, result) { return damageBreakdown(target, result.effect, result.damageType).damage; }
function actionScore(view, bundle, policy) {
  const r = estimateBundle(view.actor, bundle, view.exchangeId), a = view.actor, o = view.opponent;
  const cost = bundleCost(a, bundle);
  let score = -100;
  if (r.kind === 'attack') {
    const damage = expectedDamage(o,r);
    let likelyPrevented = 0;
    if (o.reactionAvailable) for (const gear of o.items) {
      if (itemReason(o,gear,view.round)) continue;
      for (const mid of itemDefinition(gear).maneuvers) {
        const m = MANEUVERS[mid];
        if (m.timing !== 'reaction' || m.manaCost > o.mana) continue;
        const b = {itemId:gear.id,maneuverId:mid,modifierIds:[]};
        const value = estimateBundle(o,b,view.exchangeId).effect;
        if ((m.kind === 'block' && r.tags.includes('blockable')) || (m.kind === 'ward' && r.tags.includes('wardable'))) likelyPrevented = Math.max(likelyPrevented,Math.min(damage,value) * .75);
        if (m.kind === 'dodge' && r.tags.includes('dodgeable')) likelyPrevented = Math.max(likelyPrevented,damage * avoidChance(o,b,view.exchangeId,r.accuracy) * .8);
      }
    }
    const net = Math.max(0,damage-likelyPrevented);
    score = Math.min(o.hp, net) + (net >= o.hp ? 6 : 0) + Math.min(r.poison * 1.8, 10) + .4;
  }
  if (r.kind === 'poison') score = Math.min(r.effect * 2, o.hp) / (1 + o.poison * .25) + (policy === 'mage' ? 1 : 0);
  if (r.kind === 'recover') score = Math.min(a.maxMana - a.mana, r.effect) * (a.mana <= 2 ? 2.3 : .6);
  if (r.kind === 'heal') score = Math.min(a.maxHp - a.hp, r.effect) * (a.hp < 15 ? 1.9 : .65);
  if (r.kind === 'sunder') score = Math.min(o.armor, r.effect) * 3;
  if (r.kind === 'stagger') {
    let block = 0;
    if (o.reactionAvailable) for (const gear of o.items) {
      if (itemReason(o,gear,view.round)) continue;
      if (itemDefinition(gear).maneuvers.includes('block') && o.mana >= MANEUVERS.block.manaCost) block = Math.max(block, estimateBundle(o,{itemId:gear.id,maneuverId:'block',modifierIds:[]},view.exchangeId).effect);
    }
    const chance = avoidChance(a,bundle,view.exchangeId,o.poise+block);
    score = o.pendingSkip || o.resolveProtection ? -30 : chance * (policy === 'sentinel' ? 6 : 5) * Math.min(1,o.hp/15);
  }
  if (r.kind === 'rally') score = a.power.charges ? -10 : Math.ceil(r.effect / 2) * 1.4;
  if (r.kind === 'weaken') score = Math.min(5, r.effect) * .75 - o.weaken;
  if (r.kind === 'penalty') score = o.statEffects.length ? -10 : r.effect * 1.3;
  if (bundle.modifierIds.some(id => modifierManeuver(a.items.find(i => i.id === id)) === 'aim')) {
    const dodgeReady = o.items.some(i => !itemReason(o,i,view.round) && itemDefinition(i).maneuvers.includes('dodge'));
    if (dodgeReady) score += Math.min(4, r.accuracy - MANEUVERS[bundle.maneuverId].accuracy);
  }
  // The policy values reserve mana and equipment instead of blindly spending all resources.
  return score - cost * .8 - MANEUVERS[bundle.maneuverId].recoveryRounds * .2;
}
function avoidChance(actor, bundle, exchangeId, difficulty) {
  const entries = bundleEntries(actor, bundle); let wins = 0, total = 0;
  const visit = (index, raw) => {
    if (index === entries.length) { total++; if (calculateBundle(actor,bundle,raw,exchangeId).effect >= difficulty) wins++; return; }
    const item = entries[index].item;
    for (const face of item.faces) visit(index + 1, { ...raw, [item.id]: face });
  };
  visit(0, {}); return total ? wins / total : 0;
}
export function chooseAction(view, policy = view.actor.policy) {
  let best = null, score = -Infinity;
  for (const bundle of legalBundles(view,'action')) {
    const s = actionScore(view,bundle,policy);
    if (s > score) { score = s; best = bundle; }
  }
  return best;
}
export function chooseReaction(view, policy = view.actor.policy) {
  const incoming = view.incoming.result, a = view.actor;
  const hpThreat = incoming.kind === 'attack' ? expectedDamage(a,incoming) : 0;
  const threat = hpThreat || (incoming.kind === 'poison' ? incoming.effect * 1.5 : incoming.kind === 'stagger' && incoming.effect >= a.poise && !a.resolveProtection ? 6 : incoming.effect * .6);
  let best = null, score = .1;
  for (const bundle of legalBundles(view,'reaction')) {
    const r = estimateBundle(a,bundle,view.exchangeId), cost = bundleCost(a,bundle); let s = -100;
    if (r.kind === 'block' || r.kind === 'ward') s = Math.min(threat,r.effect) * (hpThreat >= a.hp ? 2 : 1) + (policy === 'sentinel' && r.kind === 'block' ? .4 : 0);
    if (r.kind === 'dodge' || r.kind === 'parry') s = threat * avoidChance(a,bundle,view.exchangeId,r.kind === 'dodge' ? incoming.accuracy : incoming.parryDifficulty) + (policy === 'duelist' ? .4 : 0);
    if (r.kind === 'counter') s = hpThreat >= a.hp ? -30 : Math.min(view.opponent.hp, expectedDamage(view.opponent,r)) * .85;
    if (r.kind === 'breath') s = hpThreat >= a.hp ? -30 : Math.min(a.maxMana - a.mana, Math.floor(r.effect / 2)) * (a.mana < 3 ? 1.7 : .8);
    s -= cost * .8 + (a.mainActionAvailable && a.mana - cost < 1 ? 1 : 0);
    if (s > score) { score = s; best = bundle; }
  }
  return best;
}
/** AI receives revealed numbers only in its legal manipulation window. */
function manipulate(state, id) {
  const c = state.combat, e = c.exchange, a = state.combatants[id];
  const bundle = id === e.actorId ? e.action : e.reaction, raw = e.raw[id];
  const own = calculateBundle(a,bundle,raw,e.id,e.focus[id]);
  const other = e.locked[otherId(id)];
  const threshold = own.kind === 'dodge' ? other?.accuracy : own.kind === 'parry' ? other?.parryDifficulty : null;
  if (threshold && own.effect < threshold && !e.focus[id] && a.mana >= FOCUS_COST && a.focusReadyRound <= c.roundNumber) {
    const focused = calculateBundle(a,bundle,raw,e.id,{attribute:MANEUVERS[bundle.maneuverId].attribute, amount:FOCUS_BONUS});
    if (focused.effect >= threshold) return { type: 'FOCUS', attribute: MANEUVERS[bundle.maneuverId].attribute };
  }
  const weak = bundleEntries(a,bundle).map(({item}) => ({item, below: item.faces.reduce((x,y)=>x+y,0)/item.faces.length - raw[item.id]})).sort((x,y)=>y.below-x.below)[0];
  if (weak?.below > 0 && e.manipulations[id] < 2 && (a.freeRecollections > 0 || (a.mana >= 2 && threshold && own.effect < threshold))) return { type:'REROLL', itemId:weak.item.id };
  if (threshold && own.effect < threshold && a.mana >= 2 && raw[bundle.itemId] < Math.max(...a.items.find(i=>i.id===bundle.itemId).faces)) {
    const nudged = calculateBundle(a,bundle,{...raw,[bundle.itemId]:raw[bundle.itemId]+1},e.id,e.focus[id]);
    if (nudged.effect >= threshold) return {type:'NUDGE',itemId:bundle.itemId};
  }
  return { type:'LOCK_RESULT' };
}
/** One command at a time, tagged with current revision. The same reducer checks all AI choices. */
export function nextAICommand(state, id = 'enemy') {
  if (decisionActor(state) !== id) return null;
  const c = state.combat;
  if (c.stage === 'summary') return id === 'hero' ? combatCommand(state,'ACK_EXCHANGE') : null;
  if (['manipulate_actor','manipulate_defender'].includes(c.stage)) return combatCommand(state,'LOCK_RESULT',manipulate(state,id));
  const view = publicDecisionView(state,id), reaction = c.stage === 'reaction';
  const best = reaction ? chooseReaction(view) : chooseAction(view);
  if (!best) return combatCommand(state,reaction ? 'PASS_REACTION' : 'PASS_TURN');
  if (c.draft.itemId !== best.itemId || c.draft.maneuverId !== best.maneuverId) return combatCommand(state,'SELECT_MANEUVER',{itemId:best.itemId,maneuverId:best.maneuverId});
  const remove = c.draft.modifierIds.find(id=>!best.modifierIds.includes(id));
  const add = best.modifierIds.find(id=>!c.draft.modifierIds.includes(id));
  if (remove || add) return combatCommand(state,'TOGGLE_MODIFIER',{itemId:remove || add});
  return combatCommand(state,reaction ? 'DECLARE_REACTION' : 'DECLARE_ACTION');
}
