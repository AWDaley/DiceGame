import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script } from 'node:vm';
import { generateStandaloneHTML } from '../scripts/build-standalone.js';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('distributed index.html exactly matches the standalone build', async () => {
  assert.equal(html, await generateStandaloneHTML());
});

test('standalone game has no module loading or external styles/scripts/fonts', () => {
  assert.match(html, /<style>\s*/);
  assert.match(html, /<script>\s*/);
  assert.doesNotMatch(html, /<script[^>]+src=/i);
  assert.doesNotMatch(html, /<script[^>]+type=["']module/i);
  assert.doesNotMatch(html, /<link[^>]+stylesheet/i);
  assert.doesNotMatch(html, /@import\s+url\(/i);
  assert.doesNotMatch(html, /fetch\s*\(/);
});

test('standalone script starts, selects dice, rolls and New Run resets the game', () => {
  const match = html.match(/<script>\s*([\s\S]*?)\s*<\/script>/i);
  assert.ok(match, 'expected a classic inline game script');
  new Script(match[1]); // Fail fast on syntax errors in the generated game.
  const handlers = {};
  const root = {
    innerHTML: '',
    addEventListener(event, callback) { handlers[`root:${event}`] = callback; },
  };
  const document = {
    querySelector(selector) {
      if (selector === '#app') return root;
      if (selector === '#how-to-play') return { showModal() {}, close() {} };
      throw new Error(`Unexpected query: ${selector}`);
    },
    addEventListener(event, callback) { handlers[event] = callback; },
  };
  new Script(match[1]).runInNewContext({
    document, window: { confirm: () => true }, structuredClone,
  });
  assert.match(root.innerHTML, /THE DICE SATCHEL|dice satchel/i);
  assert.match(root.innerHTML, /Choose your/);
  const click = (action, id) => handlers.click({
    target: { closest: () => ({ disabled: false, dataset: { action, id } }) },
  });
  click('toggle-die', 'die-1');
  assert.match(root.innerHTML, /1 \/ 5 SLOTS FILLED/);
  click('roll');
  assert.match(root.innerHTML, /ROLL COMPLETE/);
  click('new-run');
  assert.match(root.innerHTML, /0 \/ 5 SLOTS FILLED/);
  assert.match(root.innerHTML, /Choose your/);
});
