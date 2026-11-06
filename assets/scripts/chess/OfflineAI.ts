import { createRulesEngine } from './ChessRules';
import type { ChessAI, Move, RulesEngine } from './ChessRules';

export type Difficulty = 'easy' | 'medium' | 'hard';
export const DIFFICULTIES = {
    easy: { depth: 1, timeMs: 350, nodes: 800, quiescence: 0 },
    medium: { depth: 2, timeMs: 1200, nodes: 5000, quiescence: 1 },
    hard: { depth: 4, timeMs: 2800, nodes: 18000, quiescence: 2 },
} as const;
const VALUE: Record<string, number> = { k: 100000, r: 900, c: 450, n: 400, b: 200, a: 200, p: 100 };
const MATE = 1000000;
const value = (type?: string): number => VALUE[(type || '').toLowerCase()] || 0;
const same = (a: { from: string; to: string }, b: { from: string; to: string }): boolean => a.from === b.from && a.to === b.to;

/** Original search code. Rules/move validation remain the BSD xiangqi.js implementation. */
export class OfflineAI implements ChessAI {
    readonly stats = { nodes: 0, completedDepth: 0, frames: 0, elapsedMs: 0, maxSliceMs: 0 };
    constructor(readonly difficulty: Difficulty, private readonly nextFrame: () => Promise<void>, private readonly now = () => Date.now()) {}

    async chooseMove(fen: string, supplied: ReadonlyArray<Move>, context?: { isCancelled(): boolean }): Promise<Move | null> {
        Object.assign(this.stats, { nodes: 0, completedDepth: 0, frames: 0, elapsedMs: 0, maxSliceMs: 0 });
        const cancelled = () => !!context?.isCancelled();
        if (cancelled()) return null;
        // Let the thinking label render BEFORE construction or any search work.
        await this.nextFrame();
        if (cancelled()) return null;
        const start = this.now();
        const engine = createRulesEngine(fen);
        const legal = engine.moves({ verbose: true }).filter(m => supplied.some(s => same(s, m)));
        if (!legal.length || engine.game_over()) return null;
        const config = DIFFICULTIES[this.difficulty];
        let best = this.order(legal)[0];
        let partial = best;
        let rootScore = -Infinity;
        const self = this;
        function* iterations(): Generator<void, void, unknown> {
            for (let depth = 1; depth <= config.depth; depth++) {
                let alpha = -MATE;
                let candidate = best;
                rootScore = -Infinity;
                for (const move of self.order(legal, best)) {
                    yield;
                    if (!engine.move(move)) continue;
                    let score: number;
                    try { score = -(yield* self.search(engine, depth - 1, -MATE, -alpha, 1, config.quiescence)); }
                    finally { engine.undo(); }
                    if (score > rootScore) { rootScore = score; candidate = move; }
                    if (score > alpha) alpha = score;
                    if (depth === 1) partial = candidate;
                }
                best = candidate;
                self.stats.completedDepth = depth;
                if (rootScore > MATE - 100) return;
            }
        }
        const iterator = iterations();
        try {
            let done = false;
            while (!done && !cancelled() && this.now() - start < config.timeMs && this.stats.nodes < config.nodes) {
                await this.nextFrame();
                this.stats.frames++;
                if (cancelled()) return null;
                const sliceStart = this.now();
                let steps = 0;
                do {
                    done = !!iterator.next().done;
                    steps++;
                } while (!done && !cancelled() && steps < 32 && this.now() - sliceStart < 4 && this.now() - start < config.timeMs && this.stats.nodes < config.nodes);
                this.stats.maxSliceMs = Math.max(this.stats.maxSliceMs, this.now() - sliceStart);
            }
        } finally {
            iterator.return(); // runs nested finally/undo if interrupted mid-branch
            this.stats.elapsedMs = this.now() - start;
        }
        return cancelled() ? null : this.stats.completedDepth > 0 ? best : partial;
    }

    private order(moves: ReadonlyArray<Move>, preferred?: Move): Move[] {
        const priority = (m: Move) => (preferred && same(m, preferred) ? MATE : 0) + (m.captured ? 10 * value(m.captured) - value(m.piece) : 0);
        return [...moves].sort((a, b) => priority(b) - priority(a) || ((a.from + a.to) < (b.from + b.to) ? -1 : (a.from + a.to) > (b.from + b.to) ? 1 : 0));
    }

    private *search(engine: RulesEngine, depth: number, alpha: number, beta: number, ply: number, quiet: number): Generator<void, number, unknown> {
        this.stats.nodes++;
        yield;
        const moves = engine.moves({ verbose: true });
        if (!moves.length) return -MATE + ply; // Xiangqi stalemate is also a loss.
        yield;
        const kings = engine.board().reduce((sum, row) => sum + row.filter(p => p?.type === 'k').length, 0);
        if (kings < 2) return -MATE + ply;
        if (engine.in_draw()) return 0;
        const checked = engine.in_check();
        if (depth <= 0) {
            const stand = this.evaluate(engine) - (checked ? 40 : 0);
            if (quiet <= 0) return stand;
            if (!checked) {
                if (stand >= beta) return stand;
                alpha = Math.max(alpha, stand);
            }
            const tactical = checked ? moves : moves.filter(m => !!m.captured);
            if (!tactical.length) return stand;
            for (const move of this.order(tactical)) {
                yield;
                if (!engine.move(move)) continue;
                let score: number;
                try { score = -(yield* this.search(engine, 0, -beta, -alpha, ply + 1, quiet - 1)); }
                finally { engine.undo(); }
                alpha = Math.max(alpha, score);
                if (alpha >= beta) break;
            }
            return alpha;
        }
        for (const move of this.order(moves)) {
            yield;
            if (!engine.move(move)) continue;
            let score: number;
            try { score = -(yield* this.search(engine, depth - 1, -beta, -alpha, ply + 1, quiet)); }
            finally { engine.undo(); }
            alpha = Math.max(alpha, score);
            if (alpha >= beta) break;
        }
        return alpha;
    }

    private evaluate(engine: RulesEngine): number {
        let score = 0;
        engine.board().forEach((row, r) => row.forEach((piece, c) => {
            if (!piece) return;
            const advance = piece.color === 'r' ? 9 - r : r;
            const center = 4 - Math.abs(c - 4);
            let bonus = 0;
            if (piece.type === 'p') bonus = advance * 8 + (advance >= 5 ? 60 + center * 5 : 0);
            if (piece.type === 'n') bonus = center * 9 + Math.min(advance, 7) * 4;
            if (piece.type === 'c') bonus = center * 5 + Math.min(advance, 6) * 2;
            if (piece.type === 'r') bonus = center * 2 + advance * 2;
            score += (piece.color === engine.turn() ? 1 : -1) * (value(piece.type) + bonus);
        }));
        return score;
    }
}
