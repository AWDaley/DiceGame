import test from 'node:test';
import assert from 'node:assert/strict';

// Render the browser UI with a minimal DOM test double. No network or dependencies.
test('interface exposes new mana budgeting, free Recollection and selected attachments', async () => {
  const clickHandlers = {};
  const root = {
    innerHTML: '',
    addEventListener(type, handler) { clickHandlers[`root:${type}`] = handler; },
  };
  const modal = { showModal() {}, close() {} };
  globalThis.document = {
    querySelector(sel) { return sel === '#app' ? root : modal; },
    addEventListener(type, handler) { clickHandlers[type] = handler; },
  };
  globalThis.window = { confirm: () => true };
  try {
    await import('../src/main.js');
    assert.match(root.innerHTML, /0 \/ 7 mana to roll/);
    assert.match(root.innerHTML, /✦ 3 MANA/);
    function click(action,id) {
      clickHandlers.click({ target: { closest: () => ({ disabled:false, dataset:{action,id} }) } });
    }
    click('toggle-die','die-1');
    click('toggle-die','die-7');
    assert.match(root.innerHTML, /2 \/ 7 mana to roll/);
    click('roll');
    assert.match(root.innerHTML, /5\/7 MANA/);
    click('select-roll','die-7');
    click('select-roll','die-1');
    assert.match(root.innerHTML, /attachment-chip/);
    click('select-roll','die-1');
    assert.match(root.innerHTML, /FIRST REROLL FREE/);
    click('reroll','die-1');
    assert.match(root.innerHTML, /ADDITIONAL REROLL/);
    click('commit');
    assert.match(root.innerHTML, /TURN 2|FREE REWARD/);
  } finally {
    delete globalThis.document;
    delete globalThis.window;
  }
});
