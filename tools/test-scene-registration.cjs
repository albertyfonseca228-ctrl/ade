const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { scriptClassId, scriptUuid } = require('./cocos-class-id.cjs');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const meta = JSON.parse(read('assets/scripts/chess/ChessGame.ts.meta'));
const sceneMeta = JSON.parse(read('assets/scenes/ChineseChess.scene.meta'));
const scene = JSON.parse(read('assets/scenes/ChineseChess.scene'));
const expected = scriptClassId(meta.uuid);
assert.equal(expected, '60c64J5dLtKgpzwg5pvvwY9'); // independent Creator 3.8.8 _RF.push fixture
assert.equal(scriptUuid(expected), meta.uuid);
assert.equal(scene[scene[0].scene.__id__]._id, sceneMeta.uuid);
const canvasIndex = scene.findIndex(item => item.__type__ === 'cc.Node' && item._name === 'Canvas');
assert(canvasIndex > 0);
const scripts = scene[canvasIndex]._components.map(ref => scene[ref.__id__]).filter(item => !item.__type__.startsWith('cc.'));
assert.equal(scripts.length, 1);
assert.equal(scripts[0].__type__, expected, 'Canvas component class ID must match Creator script registration, not asset UUID compression');
assert.equal(scripts[0].node.__id__, canvasIndex);

// Evaluate the existing Creator-generated System.register chunk, not just JSON.
// Mock only the engine boundary: decorator registers under the active _RF UUID.
const target = path.join(root, 'temp/programming/packer-driver/targets/editor');
const importMapPath = path.join(target, 'import-map.json');
if (fs.existsSync(importMapPath)) {
    const imports = JSON.parse(fs.readFileSync(importMapPath, 'utf8')).imports;
    const entry = Object.keys(imports).find(key => key.endsWith('/assets/scripts/chess/ChessGame.ts'));
    assert(entry, 'Creator import map must include ChessGame.ts');
    const chunk = fs.readFileSync(path.resolve(target, imports[entry]), 'utf8');
    let frame;
    let exported;
    const classes = new Map();
    class Component {}
    const cc = {
        Component,
        cclegacy: { _RF: { push(_module, uuid) { frame = uuid; }, pop() { frame = undefined; } } },
        _decorator: { ccclass(name) { return cls => { classes.set(frame, cls); cls.registeredName = name; return cls; }; } },
        __checkObsolete__() {}, __checkObsoleteInNamespace__() {},
    };
    const rulesSource = read('assets/scripts/chess/ChessRules.ts');
    assert(rulesSource.includes("from '../vendor/xiangqi-esm'"));
    const xiangqiScope = { exports: {} };
    const esm = read('assets/scripts/vendor/xiangqi-esm.ts');
    vm.runInNewContext(esm.replace(/export\s*\{\s*Xiangqi\s*\};?\s*$/, 'exports.Xiangqi = Xiangqi;'), xiangqiScope);
    class ChessRules { constructor() { this.engine = new xiangqiScope.exports.Xiangqi(); } }
    vm.runInNewContext(chunk, {
        System: { register(deps, declare) {
            const module = declare((name, value) => { if (name === 'ChessGame') exported = value; }, { meta: {} });
            assert.equal(deps.length, 4);
            module.setters[0]({ report() {} });
            module.setters[1](cc);
            module.setters[2]({}); // BoardView methods are used only by onLoad
            module.setters[3]({ ChessRules });
            module.execute();
        } }, console,
    });
    assert.equal(classes.get(scripts[0].__type__), exported, 'Scene class ID must resolve to the compiled ChessGame constructor');
    assert(exported.prototype instanceof Component);
    assert.equal(exported.registeredName, 'ChessGame');
    const instance = new exported(); // includes constructor-time Xiangqi initialisation
    assert.equal(instance.rules.engine.board().flat().filter(Boolean).length, 32);
    assert.equal(instance.rules.engine.moves().length, 44);
    console.log('PASS: actual Creator chunk registers the scene class ID; component constructor and ESM engine initialize');
} else {
    console.log('SKIP: Creator compiled chunk not available; import project in Creator to enable registration check');
}

// Resolve every relative TypeScript import and reject circular module dependencies.
const active = new Set();
const done = new Set();
function visit(file) {
    assert(!active.has(file), `Circular dependency: ${file}`);
    if (done.has(file)) return;
    active.add(file);
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
        const dep = path.resolve(path.dirname(file), match[1] + '.ts');
        assert(fs.existsSync(dep), `Unresolved import: ${dep}`);
        visit(dep);
    }
    active.delete(file); done.add(file);
}
visit(path.join(root, 'assets/scripts/chess/ChessGame.ts'));
console.log('PASS: metadata UUID round trip, Canvas binding, scene UUID, relative imports and no circular dependencies');
