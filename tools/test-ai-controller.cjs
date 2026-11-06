const assert = require('assert/strict');
const { createLoader } = require('./chess-test-runtime.cjs');
const animations = [];
class Node {
    static EventType = { TOUCH_END: 'touch-end' };
    constructor(name='') { this.name=name; this.children=[]; this.components=new Map(); this.active=true; this.listeners=new Map(); }
    addChild(node) { node.parent=this; this.children.push(node); }
    addComponent(Type) { const component=new Type(); component.node=this; this.components.set(Type,component); return component; }
    getComponent(Type) { return this.components.get(Type); }
    setPosition(...args) { this.position=args; }
    setSiblingIndex() {}
    on(event, handler, context) { this.listeners.set(event,()=>handler.call(context)); }
    removeAllChildren() { this.children=[]; }
    destroy() { this.destroyed=true; }
}
class Component { constructor() { this.isValid=true; this.node=new Node('Canvas'); } }
class UITransform { setContentSize() {} }
class Graphics { rect(){} roundRect(){} fill(){} stroke(){} circle(){} moveTo(){} lineTo(){} }
class Canvas {}
class Label {}
class Color { constructor(...args) { this.rgba=args; } }
class Vec3 { constructor(x=0,y=0,z=0) { Object.assign(this,{x,y,z}); } }
const cc = {
    Node, Component, UITransform, Graphics, Canvas, Label, Color, Vec3,
    _decorator:{ccclass:()=>Type=>Type},
    HorizontalTextAlignment:{CENTER:1},VerticalTextAlignment:{CENTER:1},
    ResolutionPolicy:{SHOW_ALL:0},view:{setDesignResolutionSize(){}},
    Tween:{stopAllByTarget(node) { animations.filter(a=>a.node===node).forEach(a=>a.stopped=true); }},
    tween(node) { const entry={node}; return {to(){return this;},call(cb){entry.cb=cb;return this;},start(){animations.push(entry);}}; },
};
function finish() { const batch=animations.splice(0); batch.filter(a=>!a.stopped).forEach(a=>a.cb()); }
const load=createLoader(cc);
const {ChessGame}=load('assets/scripts/chess/ChessGame.ts');
const {OfflineAI}=load('assets/scripts/chess/OfflineAI.ts');
const {FrameGate}=load('assets/scripts/chess/FrameGate.ts');
const {createRulesEngine}=load('assets/scripts/chess/ChessRules.ts');

async function frames(game, until) {
    for(let i=0;i<500 && !until();i++) { game.update(); await Promise.resolve(); await Promise.resolve(); }
    assert(until(),'Controller did not reach expected phase');
}
async function main() {
    const game=new ChessGame(); game.onLoad();
    assert(game.menu.active); assert(!game.game.active);
    game.session.difficulty='easy'; game.beginGame('ai');
    assert(!game.menu.active); assert(game.game.active);
    game.select('e3'); game.select('e4');
    assert.equal(game.session.phase,'animating');
    assert.equal(game.session.plies,1);
    // AI must wait for the player's tween completion.
    await Promise.resolve(); assert.equal(game.session.phase,'animating');
    finish(); assert.equal(game.session.phase,'thinking'); assert(game.status.string.includes('思考'));
    game.select('e6'); assert.equal(game.selected,null);
    await frames(game,()=>game.session.phase==='animating');
    assert.equal(game.session.plies,2);
    assert(animations.some(a=>!a.stopped),'AI must play a tween');
    finish(); assert.equal(game.session.phase,'ready'); assert(game.session.canPlay);
    game.undo(); assert.equal(game.session.plies,0);
    assert.equal(game.board.pieceNodes.size,32);
    // Stop an in-progress player animation; old callback cannot trigger black AI.
    game.select('e3'); game.select('e4'); game.beginGame('local'); finish();
    assert.equal(game.session.mode,'local'); assert.equal(game.session.plies,0); assert.equal(game.session.phase,'ready');
    game.beginGame('ai'); game.select('e3'); game.select('e4'); finish();
    assert.equal(game.session.phase,'thinking');
    game.home(); await frames(game,()=>game.session.phase==='menu');
    assert(game.menu.active); assert(!game.game.active);
    game.beginGame('ai'); game.select('e3'); game.select('e4'); finish();
    game.onDestroy(); await Promise.resolve(); await Promise.resolve();
    assert.equal(game.session.phase,'disposed');
    assert.equal(game.frames.waiting.length,0);
    finish(); assert.equal(game.session.phase,'disposed');

    // Real-clock search on this host, with 60 Hz simulated by a test-only timer.
    // Production uses only Component.update, never Node timers.
    const gate=new FrameGate();
    const ticker=setInterval(()=>gate.tick(),16);
    const ai=new OfflineAI('hard',gate.next);
    const engine=createRulesEngine(); engine.move({from:'e3',to:'e4'});
    let result;
    try { result=await ai.chooseMove(engine.fen(),engine.moves({verbose:true})); }
    finally {clearInterval(ticker);gate.dispose();}
    assert(result); assert(ai.stats.frames>1); assert(ai.stats.elapsedMs<4000);
    console.log('Real-clock hard AI (host measurement, not Android):',ai.stats);
    console.log('PASS: real TS controller menu, player tween -> AI, input lock, AI tween, full-round undo, animation cancellation, mode/home transitions and scene disposal');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
