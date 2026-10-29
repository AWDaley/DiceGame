import assert from 'node:assert/strict';
import { newGame, reduceGame } from '../src/game.js';
import { makeItem, itemDefinition } from '../src/equipment.js';
import { decisionActor, combatCommand } from '../src/combat.js';
export const rng = () => .5;
export function rawAct(s,type,data={},random=rng) { return reduceGame(s,{type,expectedRevision:s.revision,exchangeId:s.combat?.exchangeId,actorId:decisionActor(s),...data},random); }
export function act(s,type,data={},random=rng) { const n=rawAct(s,type,data,random); assert.equal(n.notice,'',`${type}: ${n.notice}`); assert.equal(n.revision,s.revision+1); return n; }
export function created(stats={might:1,finesse:1,vitality:1}) {
  let s=newGame();
  for(const [attribute,n] of Object.entries(stats))for(let i=0;i<n;i++)s=act(s,'ALLOCATE_ATTRIBUTE',{attribute,delta:1});
  if(s.combatants.hero.attributes.vitality>=2)s=act(s,'CHOOSE_TALENT',{talent:'iron_skin'});
  if(s.combatants.hero.attributes.spirit>=2)s=act(s,'CHOOSE_TALENT',{talent:'meditation'});
  return act(s,'CONFIRM_ATTRIBUTES');
}
export function battle() {
  // A zero-attribute fixture isolates combat arithmetic; creation has separate tests.
  let s=newGame();s.combatants.hero.attributePoints=0;s.phase='loadout';return act(s,'BEGIN_BATTLE');
}
export function install(s,id,types) {
  const a=s.combatants[id]; a.items=types.map((type,i)=>makeItem(type,`${id}-test-${i}`));a.equippedItemIds=a.items.map(i=>i.id);return s;
}
export function item(s,id,mid) { return s.combatants[id].items.find(i=>itemDefinition(i).maneuvers.includes(mid)); }
export function setFaces(s,id,mid,value) { item(s,id,mid).faces=Array(6).fill(value);return s; }
export function select(s,mid,mods=[],random=rng) {
  const id=decisionActor(s);s=act(s,'SELECT_MANEUVER',{itemId:item(s,id,mid).id,maneuverId:mid},random);
  for(const mod of mods)s=act(s,'TOGGLE_MODIFIER',{itemId:item(s,id,mod).id},random);
  return s;
}
export function declare(s,mid,mods=[],random=rng) {
  const type=s.combat.stage==='action'?'DECLARE_ACTION':'DECLARE_REACTION';
  return act(select(s,mid,mods,random),type,{},random);
}
export function revealed(s,main,reaction=null,mods=[],reactMods=[],random=rng) {
  s=declare(s,main,mods,random);
  return reaction?declare(s,reaction,reactMods,random):act(s,'PASS_REACTION',{},random);
}
export function finish(s) {
  while(s.phase==='battle' && s.combat.stage.startsWith('manipulate')) s=act(s,'LOCK_RESULT');
  return s;
}
export function exchange(s,main,reaction=null,mods=[],reactMods=[]) { return finish(revealed(s,main,reaction,mods,reactMods)); }
export function nextSlot(s) { return act(s,'ACK_EXCHANGE'); }
export function passSlot(s) { return nextSlot(act(s,'PASS_TURN')); }
export function rejected(s,type,data={},pattern=/./) {
  let calls=0;const n=rawAct(s,type,data,()=>{calls++;return .5;});
  assert.match(n.notice,pattern);assert.equal(calls,0);assert.equal(n.revision,s.revision);
  assert.deepEqual({...n,notice:s.notice},s);return n;
}
export function sequenceRng(values) { let n=0;return ()=>{assert.ok(n<values.length,'Unexpected extra RNG draw');return values[n++];}; }
