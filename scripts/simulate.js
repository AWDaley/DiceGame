/** Seeded, telemetry-free local policy probes. Capped samples are reported, never force-lost. */
import { writeFile, mkdir } from 'node:fs/promises';
import { newGame, reduceGame } from '../src/game.js';
import { decisionActor } from '../src/combat.js';
import { nextAICommand } from '../src/enemy-ai.js';
import { ENCOUNTERS } from '../src/content.js';
export function seededRng(seed) {
  let state=seed>>>0;
  return ()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
}
export function runSample(build, encounter, seed, roundLimit=60) {
  let s=newGame(); const rng=seededRng(seed), counts={recovery:0,reactions:0,skips:0,manaSpent:0};
  function apply(type, fields={}) {
    const next=reduceGame(s,{type,expectedRevision:s.revision,...fields},rng);
    if(next.revision===s.revision)throw new Error(next.notice);s=next;
  }
  for(const [attribute,n] of Object.entries(build.stats))for(let i=0;i<n;i++)apply('ALLOCATE_ATTRIBUTE',{attribute,delta:1});
  if(s.combatants.hero.attributes.vitality>=2)apply('CHOOSE_TALENT',{talent:'iron_skin'});
  if(s.combatants.hero.attributes.spirit>=2)apply('CHOOSE_TALENT',{talent:'meditation'});
  apply('CONFIRM_ATTRIBUTES');
  if(build.gear)s.combatants.hero.equippedItemIds=build.gear.map(type=>s.combatants.hero.items.find(i=>i.definitionId===type).id);
  s.encounter=encounter;apply('BEGIN_BATTLE');
  const hpStart=s.combatants.hero.hp;
  let commands=0;
  while(s.phase==='battle'&&s.combat.roundNumber<=roundLimit&&commands<4000) {
    const command=nextAICommand(s,decisionActor(s));
    if(!command)throw new Error('Missing command');
    const next=reduceGame(s,command,rng);
    if(next.revision===s.revision)throw new Error(next.notice);
    for(const e of next.events.filter(e=>e.id>s.eventCounter)) {
      if(e.actorId==='hero') {
        if(e.type==='MANA_RECOVERED')counts.recovery++;
        if(e.type==='REACTION_DECLARED')counts.reactions++;
        if(e.type==='MAIN_ACTION_SKIPPED')counts.skips++;
        if(['ACTION_DECLARED','REACTION_DECLARED','ROLL_MANIPULATED'].includes(e.type))counts.manaSpent+=e.data.cost||0;
      }
    }
    for(const a of Object.values(next.combatants)) {
      if(a.hp<0||a.hp>a.maxHp||a.mana<0||a.mana>a.maxMana)throw new Error('Resource invariant violated');
      if(a.items.some(i=>i.charges!==null&&i.charges<0))throw new Error('Charge invariant violated');
    }
    s=next;commands++;
  }
  return {build:build.name, encounter:ENCOUNTERS[encounter].name, seed, outcome:s.phase==='battle'?'round-cap':s.outcome,
    rounds:s.combat.roundNumber,hpLost:hpStart-s.combatants.hero.hp,commands,...counts};
}
export const BUILDS=[
  {name:'balanced',stats:{might:1,finesse:1,vitality:1}},
  {name:'might',stats:{might:2,vitality:1}},
  {name:'finesse',stats:{finesse:2,spirit:1},gear:['short_sword','nimble_boots','round_shield','focus_crystal','power_charm','aiming_lens','venom_vial','healing_potion']},
  {name:'arcana',stats:{arcana:2,spirit:1},gear:['fire_wand','venom_staff','ward_focus','nimble_boots','focus_crystal','power_charm','echo_crystal','healing_potion']},
  {name:'endurance',stats:{vitality:2,spirit:1},gear:['short_sword','warhammer','round_shield','focus_crystal','power_charm','nimble_boots','healing_potion','echo_crystal']},
];
if(process.argv[1]?.endsWith('simulate.js')) {
  const samples=[];
  for(const build of BUILDS)for(let i=0;i<4;i++)for(let seed=1;seed<=5;seed++)samples.push(runSample(build,i,seed));
  const summary=BUILDS.map(b=>{const rows=samples.filter(s=>s.build===b.name);return {build:b.name,samples:rows.length,wins:rows.filter(s=>s.outcome==='victory').length,capped:rows.filter(s=>s.outcome==='round-cap').length,averageRounds:+(rows.reduce((a,s)=>a+s.rounds,0)/rows.length).toFixed(1)};});
  const output={note:'Policy probes, not human win rates. Each encounter begins at full resources, with starting attributes.',summary,samples};
  await mkdir('test-results', { recursive: true });
  await writeFile('test-results/simulation-results.json',JSON.stringify(output,null,2)+'\n');
  console.log(JSON.stringify(summary,null,2));
  if (process.argv.includes('--strict') && samples.some(s => s.outcome === 'round-cap')) process.exitCode = 1;
}
