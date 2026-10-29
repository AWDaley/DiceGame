import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
for (const dir of ['src','scripts']) for (const file of readdirSync(dir).filter(f=>f.endsWith('.js'))) {
  const result=spawnSync(process.execPath,['--check',`${dir}/${file}`],{stdio:'inherit'});
  if (result.status!==0) process.exit(result.status || 1);
}
const {validateDefinitions}=await import('../src/equipment.js');
validateDefinitions();
const {generateStandaloneHTML}=await import('./build-standalone.js');
const {readFile}=await import('node:fs/promises');
if (await generateStandaloneHTML()!==await readFile('index.html','utf8')) throw new Error('Stale standalone HTML: run npm run build.');
console.log('Syntax, content definitions and standalone freshness passed.');
const test=spawnSync(process.execPath,['--test'],{stdio:'inherit'});
process.exitCode=test.status || 0;
