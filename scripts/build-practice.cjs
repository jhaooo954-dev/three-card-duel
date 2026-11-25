const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const files = ['club-engines/card.cjs', 'club-engines/dice.cjs', 'engine.cjs', 'club-engines/tenhalf3.cjs'];
const modules = files.map(file => {
  const key = file.replace(/^club-engines\//, '');
  return [key, fs.readFileSync(path.join(root, file), 'utf8').replace("require('../engine.cjs')", "require('engine.cjs')")];
});
const code = modules.map(([key, source]) => JSON.stringify(key) + ': function(module, require){\n' + source + '\n}').join(',\n');
const runtime = fs.readFileSync(path.join(__dirname, 'practice-runtime.js'), 'utf8');
fs.writeFileSync(path.join(root, 'public/club/practice.js'), `(()=>{'use strict';
const modules = {${code}};
const cache = {};
function require(name) {
  if (name === 'node:crypto') return {webcrypto: window.crypto};
  if (cache[name]) return cache[name].exports;
  const module = {exports: {}};
  cache[name] = module;
  modules[name](module, require);
  return module.exports;
}
${runtime}
})();\n`);
