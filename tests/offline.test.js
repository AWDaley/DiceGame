import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script } from 'node:vm';
import { generateStandaloneHTML, bundleModules } from '../scripts/build-standalone.js';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
test('distributed index.html exactly matches a deterministic standalone build',async()=>{assert.equal(html,await generateStandaloneHTML());assert.equal(await generateStandaloneHTML(),await generateStandaloneHTML());});
test('standalone has no module loader, network calls, remote fonts or external assets',()=>{assert.match(html,/<style>/);assert.match(html,/<script>/);for(const pattern of [/<script[^>]+src=/i,/<script[^>]+type=["']module/i,/<link[^>]+stylesheet/i,/@import\s+url\(/i,/\bfetch\s*\(/,/\beval\s*\(/])assert.doesNotMatch(html,pattern);});
test('scoped bundler isolates duplicate private helpers and resolves named imports',async()=>{const source={'src/a.js':'const helper = 3;\nexport const a = helper;','src/b.js':'const helper = 7;\nexport const b = helper;','src/main.js':"import { a } from './a.js';\nimport { b } from './b.js';\nglobalThis.result = a + b;"};const code=await bundleModules('src/main.js',async path=>source[path]);const context={};new Script(code).runInNewContext(context);assert.equal(context.result,10);});
test('bundler rejects cycles, unresolved exports, remote imports and unsupported syntax',async()=>{for(const source of [
 {'src/main.js':"import { a } from './a.js';",'src/a.js':"import { b } from './main.js';\nexport const a = 1;"},
 {'src/main.js':"import { missing } from './a.js';",'src/a.js':'export const a = 1;'},
 {'src/main.js':"import { x } from 'https://example.invalid/x.js';"},
 {'src/main.js':'export default 1;'},
 {'src/main.js':"const x = import('./x.js');"},
 ])await assert.rejects(()=>bundleModules('src/main.js',async path=>source[path]));});
test('standalone starts, allocates, equips, declares, rolls, resolves and New Run resets',()=>{
  const source=html.match(/<script>\s*([\s\S]*?)\s*<\/script>/i)[1],handlers={};
  const root={innerHTML:'',querySelectorAll:()=>[]};
  const document={activeElement:null,querySelector:s=>s==='#app'?root:{showModal(){},close(){}},addEventListener:(name,fn)=>{handlers[name]=fn;}};
  const math=Object.create(Math);math.random=()=>.5;
  new Script(source).runInNewContext({document,window:{confirm:()=>true},structuredClone,Math:math});
  function click(action,extra={}){
    const revision=root.innerHTML.match(/data-revision="(\d+)"/)[1];const exchange=root.innerHTML.match(/data-exchange="(\d+)"/)[1];
    handlers.click({detail:1,target:{closest:()=>({disabled:false,dataset:{action,revision,exchange,...extra}})}});
  }
  assert.match(root.innerHTML,/Give your equipment/);
  for(const attribute of ['might','finesse','vitality'])click('allocate',{attribute,delta:'1'});
  click('confirm-attributes');assert.match(root.innerHTML,/Pack for the/);
  click('begin-battle');assert.match(root.innerHTML,/Construct a/);
  click('maneuver',{itemId:'item-1',maneuverId:'quick_strike'});click('declare');assert.match(root.innerHTML,/Bend the/);
  click('lock');assert.match(root.innerHTML,/outcome is/);
  click('continue');assert.match(root.innerHTML,/Choose your/);
  click('new-run');assert.match(root.innerHTML,/3 POINTS LEFT/);assert.doesNotMatch(root.innerHTML,/ROUND 2/);
});
