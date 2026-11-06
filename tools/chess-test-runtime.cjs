const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require(process.env.COCOS_TYPESCRIPT || 'C:/xunlei1/cocos/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript');

function createLoader(cc = {}) {
    const cache = new Map();
    function load(file) {
        file = path.resolve(file);
        if (cache.has(file)) return cache.get(file).exports;
        const module = { exports: {} };
        cache.set(file, module);
        const source = fs.readFileSync(file, 'utf8');
        const code = ts.transpileModule(source, { fileName: file, compilerOptions: {
            module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2018, experimentalDecorators: true,
        } }).outputText;
        const relativeRequire = request => {
            if (request === 'cc') return cc;
            if (!request.startsWith('.')) throw new Error(`Runtime dependency forbidden: ${request}`);
            return load(path.resolve(path.dirname(file), request + '.ts'));
        };
        vm.runInThisContext(`(function(require,module,exports){\n${code}\n})`, { filename: file })(relativeRequire, module, module.exports);
        return module.exports;
    }
    return load;
}
module.exports = { createLoader };
