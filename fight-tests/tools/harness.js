// Loads the simulation scripts into one node context with a tiny canvas stub (Terrain.create makes canvases).
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.resolve(__dirname, '../..');   // the repository
module.exports = function load(extra = []) {
  const fakeCtx = new Proxy({}, { get: (t, k) => (k === 'getImageData' || k === 'createImageData') ? (x, y, w, h) => ({ data: new Uint8ClampedArray((w || x) * (h || y) * 4) }) : typeof k === 'string' ? () => {} : undefined, set: () => true });
  const document = { createElement: () => ({ getContext: () => fakeCtx, width: 0, height: 0 }) };
  const ctx = vm.createContext({ console, performance, document, setTimeout });
  const files = ['util', 'data', 'icons', 'terrain', 'path', 'fog', 'entities', 'game', 'ai', 'maps', 'sim'].map(f => 'js/' + f + '.js').concat(extra);
  const src = files.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/^'use strict';/, '')).join('\n;\n');
  vm.runInContext(src + '\n;globalThis.__api = { G, Game, Sim, AI, Terrain, Path, Fog, Data, MapGen, Util, Unit, Building, LabTests: typeof LabTests !== "undefined" ? LabTests : null, FightScenarios: typeof FightScenarios !== "undefined" ? FightScenarios : null };', ctx, { filename: 'sim-bundle' });
  return ctx.__api;
};
