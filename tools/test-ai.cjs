const assert = require('assert/strict');
const { createLoader } = require('./chess-test-runtime.cjs');
const load = createLoader();
const { OfflineAI, DIFFICULTIES } = load('assets/scripts/chess/OfflineAI.ts');
const { createRulesEngine } = load('assets/scripts/chess/ChessRules.ts');
const { GameSession } = load('assets/scripts/chess/GameSession.ts');
const { FrameGate } = load('assets/scripts/chess/FrameGate.ts');
const equalMove = (a,b) => a.from === b.from && a.to === b.to;

async function choose(engine, difficulty) {
    // Deterministic 60 Hz frame clock. All production search code executes unchanged.
    let clock = 0;
    const ai = new OfflineAI(difficulty, async () => { clock += 16; }, () => clock);
    const before = engine.fen();
    const legal = engine.moves({verbose:true});
    const move = await ai.chooseMove(before, legal);
    assert(move && legal.some(m => equalMove(m, move)));
    assert.match(move.from, /^[a-i][0-9]$/); assert.match(move.to, /^[a-i][0-9]$/);
    assert.equal(engine.get(move.from).color, engine.turn());
    assert.notEqual(engine.get(move.to)?.color, engine.turn());
    assert.equal(engine.fen(), before, 'Search must not mutate the live board');
    assert(ai.stats.frames >= 1, 'Search must yield before running');
    assert(ai.stats.elapsedMs <= DIFFICULTIES[difficulty].timeMs + 16);
    return {move, stats:ai.stats};
}
const firstAI = { async chooseMove(_fen, moves) { return moves[0]; } };
function red(session) {
    const result = session.humanMove('e3','e4'); assert(result);
    assert.equal(session.canPlay, false);
    assert(session.finishAnimation(result.epoch));
}

async function main() {
    const summary = [];
    for (const difficulty of ['easy','medium','hard']) {
        const engine = createRulesEngine();
        const result = await choose(engine, difficulty);
        assert(result.stats.frames > 1, 'Opening search must span multiple frames');
        summary.push({difficulty,...result.stats});
        engine.move({from:'e3',to:'e4'});
        await choose(engine, difficulty); // actual black turn after player's first move
        const capture = createRulesEngine('4k4/9/9/9/r3p4/R8/9/9/9/4K4 b - - 0 1');
        const reply = await choose(capture, difficulty);
        assert.equal(reply.move.from,'a5'); assert.equal(reply.move.to,'a4', 'Take an undefended rook');
        const check = createRulesEngine('4k4/9/4R4/9/9/9/9/9/9/3K5 b - - 0 1');
        assert(check.in_check());
        const evasion = await choose(check, difficulty);
        assert(check.move(evasion.move)); assert(!check.in_checkmate());
        // Switch back to the responding side to verify its king is no longer attacked.
        const fen = check.fen().split(' '); fen[1]='b';
        assert(!createRulesEngine(fen.join(' ')).in_check());
        const mate = createRulesEngine('4k4/9/9/9/4p4/9/N8/r8/5r3/4K4 b - - 0 1');
        const winning = await choose(mate, difficulty);
        assert(mate.move(winning.move)); assert(mate.in_checkmate(), 'Prefer immediate mate over material');
    }
    const session = new GameSession();
    assert.equal(session.phase,'menu');
    session.start('local'); const initial=session.rules.engine.fen();
    red(session);
    const black = session.humanMove('e6','e5'); assert(black); session.finishAnimation(black.epoch);
    session.undo(); assert.equal(session.plies,1); session.undo(); assert.equal(session.rules.engine.fen(),initial);
    session.start('ai'); red(session);
    let animated=await session.requestAI(firstAI); assert(animated); session.finishAnimation(animated.epoch);
    assert.equal(session.plies,2); assert(session.canPlay);
    session.undo(); assert.equal(session.rules.engine.fen(),initial); assert.equal(session.plies,0);
    session.undo(); assert.equal(session.plies,0);

    for (const action of ['restart','undo','mode','home','dispose']) {
        session.start('ai'); red(session);
        let resolve;
        let calls=0;
        const pending=session.requestAI({chooseMove() { calls++; return new Promise(r=>resolve=r); }});
        assert.equal(session.phase,'thinking'); assert.equal(session.canPlay,false);
        assert.equal(await session.requestAI(firstAI),null); assert.equal(calls,1);
        assert.equal(session.humanMove('e6','e5'),null);
        if(action==='restart')session.start('ai');
        if(action==='undo')session.undo();
        if(action==='mode')session.start('local');
        if(action==='home')session.home();
        if(action==='dispose')session.dispose();
        const saved=session.rules.engine.fen(); const phase=session.phase;
        resolve({from:'e6',to:'e5'});
        assert.equal(await pending,null); assert.equal(session.rules.engine.fen(),saved); assert.equal(session.phase,phase);
    }
    for(const response of [null,{from:'z99',to:'a0'},{from:'e4',to:'e5'}]) {
        const s=new GameSession(); s.start('ai'); red(s);
        animated=await s.requestAI({async chooseMove(){return response;}});
        assert(animated); assert.equal(s.rules.engine.turn(),'r'); assert(s.notice);
    }
    const failure=new GameSession(); failure.start('ai'); red(failure);
    assert(await failure.requestAI({async chooseMove(){throw new Error('Test failure');}})); assert(failure.notice);
    const race=new GameSession(); race.start('ai'); red(race);
    let oldResolve, newResolve;
    const old=race.requestAI({chooseMove(){return new Promise(r=>oldResolve=r);}});
    race.start('ai'); red(race);
    const current=race.requestAI({chooseMove(){return new Promise(r=>newResolve=r);}});
    oldResolve({from:'e6',to:'e5'}); assert.equal(await old,null);
    assert.equal(race.phase,'thinking','Old AI must not clear the new AI thinking state');
    newResolve({from:'e6',to:'e5'}); assert(await current); assert.equal(race.phase,'animating');
    const gate=new FrameGate(); let resumed=false;
    const waiting=gate.next().then(()=>resumed=true);
    await Promise.resolve(); assert.equal(resumed,false); gate.tick(); await waiting; assert(resumed);
    let cancelled=false;
    const engine=createRulesEngine();
    const ai=new OfflineAI('hard',gate.next);
    const pending=ai.chooseMove(engine.fen(),engine.moves({verbose:true}),{isCancelled:()=>cancelled});
    gate.tick(); await Promise.resolve(); cancelled=true; gate.dispose(); assert.equal(await pending,null);

    // A finished game cannot accept human or AI moves.
    const ended=new GameSession(); ended.start('ai');
    assert(ended.rules.engine.load('rnbakab1r/9/1c5c1/p1p5p/4p1p2/4P1P2/P1P3nCP/1C3A3/4NK3/RNB2AB1R r - - 0 1'));
    assert(ended.rules.ended); assert.equal(ended.humanMove('a0','a1'),null); assert.equal(await ended.requestAI(firstAI),null);
    console.table(summary);
    console.log('PASS: 3 levels, both sides, legal coordinates, no friendly capture, capture tactics, check evasion, frame yielding, deadlines, local/AI undo, restart, modes, cancellation, invalid/rejected AI, disposal and game-over lock');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
