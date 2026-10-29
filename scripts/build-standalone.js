/** Restricted named-ES-module bundler. Private module scopes are kept isolated.
 * No runtime dependencies, eval, network imports or hand-edited output. */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative, sep } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFile(resolve(root, path), 'utf8');
/** Exported for fixture tests. `load` resolves repository-relative source paths. */
export async function bundleModules(entry, load) {
  const visiting = new Set(), built = new Map(), chunks = [];
  async function visit(path) {
    if (visiting.has(path)) throw new Error(`Circular module dependency: ${path}`);
    if (built.has(path)) return built.get(path);
    visiting.add(path);
    let code = await load(path);
    const imports = [];
    code = code.replace(/^import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"];?\s*\r?\n?/gm, (_, names, source) => {
      if (!source.startsWith('./') || !source.endsWith('.js')) throw new Error(`Unsupported import ${source} in ${path}`);
      imports.push({ names: names.split(',').map(s=>s.trim()).filter(Boolean), source }); return '';
    });
    const bindings = [];
    for (const imp of imports) {
      const target = relative(root,resolve(root,dirname(path),imp.source)).split(sep).join('/');
      if (target.startsWith('../')) throw new Error('Import escapes source root.');
      const dependency = await visit(target);
      for (const name of imp.names) if (!/^[A-Za-z_$][\w$]*$/.test(name) || !dependency.exports.includes(name)) throw new Error(`Unknown or unsupported import ${name} from ${target}`);
      bindings.push(`const { ${imp.names.join(', ')} } = ${dependency.id};`);
    }
    const exports = [];
    code = code.replace(/^export\s+(?=(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*))/gm, (_,name)=>{exports.push(name); return '';});
    if (/^\s*(?:import|export)\b/m.test(code) || /\bimport\s*\(/.test(code)) throw new Error(`Unsupported module syntax in ${path}`);
    const module = { id: `module${built.size}`, exports };
    chunks.push(`// === ${path} ===\nconst ${module.id} = (() => {\n${bindings.join('\n')}\n${code}\nreturn Object.freeze({ ${exports.join(', ')} });\n})();`);
    built.set(path,module); visiting.delete(path); return module;
  }
  await visit(entry);
  return `(() => {\n'use strict';\n${chunks.join('\n\n')}\n})();`;
}
export async function generateStandaloneHTML() {
  const [template,css,script] = await Promise.all([read('src/index.template.html'),read('styles.css'),bundleModules('src/main.js',read)]);
  const cssMarker='<link rel="stylesheet" href="./styles.css" />', scriptMarker='<script type="module" src="./src/main.js"></script>';
  if (!template.includes(cssMarker)||!template.includes(scriptMarker)) throw new Error('Missing build markers in template.');
  const offlineCss=css.replace(/^@import\s+url\([^)]*\);[^\S\r\n]*\r?\n?/gm,'');
  const result='<!-- Generated with npm run build. Self-contained and playable from file://. -->\n'+template
    .replace(cssMarker,()=>`<style>\n${offlineCss}\n</style>`)
    .replace(scriptMarker,()=>`<script>\n${script.replace(/<\/script/gi,'<\\/script')}\n</script>`);
  return result;
}
if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const html=await generateStandaloneHTML();
  if (process.argv.includes('--check')) {
    if (html!==await read('index.html')) { console.error('index.html is stale. Run npm run build.'); process.exitCode=1; }
    else console.log('Standalone HTML is current.');
  } else { await writeFile(resolve(root,'index.html'),html,'utf8'); console.log('Built offline index.html.'); }
}
