const { spawnSync } = require('child_process');
const tsc = process.env.COCOS_TYPESCRIPT
    ? require('path').join(process.env.COCOS_TYPESCRIPT, 'lib/tsc.js')
    : 'C:/xunlei1/cocos/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/tsc.js';
for (const args of [
    [tsc, '--noEmit', '-p', 'tsconfig.chess.json'],
    ['tools/test-chess.cjs'],
    ['tools/test-ai.cjs'],
    ['tools/test-ai-controller.cjs'],
]) {
    const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status || 1);
}
console.log('PASS: V2 static check, all V1 regressions, AI and controller tests');
