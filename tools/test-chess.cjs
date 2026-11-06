const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const scope = {exports:{}};
vm.runInNewContext(fs.readFileSync('assets/scripts/vendor/xiangqi.js','utf8'),scope);
const game = new scope.exports.Xiangqi();
const initial=game.fen();
assert.equal(game.board().flat().filter(Boolean).length,32);
assert.equal(game.moves().length,44);
assert.equal(game.turn(),'r');
assert.equal(game.move({from:'a0',to:'a3'}),null);
assert.equal(game.move({from:'b0',to:'d1'}),null); // blocked horse leg
assert.equal(game.move({from:'c0',to:'f3'}),null); // elephant must move exactly two diagonally
assert.equal(game.move({from:'e0',to:'e2'}),null); // king palace/step
assert(game.move({from:'e3',to:'e4'}));
assert.equal(game.turn(),'b');
assert(game.undo()); assert.equal(game.fen(),initial);
assert(game.move({from:'b2',to:'b9'})); // cannon jumps exactly one screen
assert.equal(game.get('b9').color,'r');
game.undo(); assert.equal(game.fen(),initial);
assert(game.load('3aca3/1Cnrk4/b3r4/2p1n4/2b6/9/9/9/4C4/ppppcK3 b - - 0 1'));
assert(game.in_stalemate()); assert(game.game_over());
assert(game.load('rnbakab1r/9/1c5c1/p1p5p/4p1p2/4P1P2/P1P3nCP/1C3A3/4NK3/RNB2AB1R r - - 0 1'));
assert(game.in_checkmate());
game.reset(); assert.equal(game.fen(),initial);
for(let i=0;i<60 && !game.game_over();i++) {
    const before=game.fen(); const moves=game.moves({verbose:true});
    const m=moves[(i*17)%moves.length];
    assert(game.move(m)); assert(game.undo()); assert.equal(game.fen(),before); assert(game.move(m));
}
const scene=JSON.parse(fs.readFileSync('assets/scenes/ChineseChess.scene','utf8'));
function check(v) {if(!v || typeof v!=='object')return; if('__id__' in v)assert(scene[v.__id__]); Object.values(v).forEach(check);}
scene.forEach(check);
require('./test-scene-registration.cjs');
assert(scene.some(x=>x.__type__==='cc.Canvas'));
assert(scene.some(x=>x.__type__==='cc.Camera'));
console.log('PASS: initial layout, 44 legal moves, invalid moves, capture, undo, turn, stalemate, checkmate, reset, 60-ply round trips, scene references');
