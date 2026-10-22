/**
 * Zero-dependency standalone exporter for the small, static Jarbound prototype.
 * Generates an index.html containing its own CSS and browser JavaScript so the
 * downloaded file works over file:// (no server, install, or network required).
 *
 * Keep the developer-facing code in src/*.js as regular ES modules, while the
 * generated player-facing index.html has no module imports or external assets.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFile(resolve(root, path), 'utf8');

function flattenLocalModule(code, name) {
  const stripped = code
    .replace(/^import\s+\{[^}]*\}\s+from\s+['"]\.\/(?:content|game)\.js['"];?\s*\r?\n?/gm, '')
    .replace(/^export\s+(?=(?:const|let|var|function|class)\b)/gm, '');
  if (/^\s*(?:import|export)\b/m.test(stripped)) {
    throw new Error(`Unsupported ES-module syntax in ${name}; update the offline exporter.`);
  }
  return stripped;
}

export async function generateStandaloneHTML() {
  const [template, css, content, game, main] = await Promise.all([
    read('src/index.template.html'),
    read('styles.css'),
    read('src/content.js'),
    read('src/game.js'),
    read('src/main.js'),
  ]);
  const flattened = [
    ['content.js', content], ['game.js', game], ['main.js', main],
  ].map(([name, code]) => `// === ${name} ===\n${flattenLocalModule(code, name)}`).join('\n\n');
  const script = `(() => {\n'use strict';\n${flattened}\n})();`;
  // Remove remote Google Fonts: system fallback fonts are available offline.
  const offlineCss = css.replace(/^@import\s+url\([^)]*\);[ \t]*\r?\n?/gm, '');
  const styleTag = `<style>\n${offlineCss}\n</style>`;
  const scriptTag = `<script>\n${script.replace(/<\/script/gi, '<\\/script')}\n</script>`;
  const cssMarker = '<link rel="stylesheet" href="./styles.css" />';
  const scriptMarker = '<script type="module" src="./src/main.js"></script>';
  if (!template.includes(cssMarker) || !template.includes(scriptMarker)) {
    throw new Error('Expected style/module reference missing in src/index.template.html');
  }
  return '<!-- Generated with `npm run build`. Works directly from file://. -->\n' +
    template.replace(cssMarker, styleTag).replace(scriptMarker, scriptTag);
}

const invokedAsScript = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsScript) {
  const generated = await generateStandaloneHTML();
  if (process.argv.includes('--check')) {
    const committed = await read('index.html');
    if (generated !== committed) {
      console.error('index.html is out of date. Run `npm run build` and commit the result.');
      process.exitCode = 1;
    } else {
      console.log('Standalone index.html is up to date and contains no external runtime dependencies.');
    }
  } else {
    await writeFile(resolve(root, 'index.html'), generated, 'utf8');
    console.log('Built self-contained index.html. Double-click to play offline.');
  }
}
