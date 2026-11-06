import { Xiangqi } from '../vendor/xiangqi-esm';

export type Side = 'r' | 'b';
export interface Piece { type: string; color: Side }
export interface Move { from: string; to: string; color: Side; piece: string; captured?: string }
export interface RulesEngine {
    board(): (Piece | null)[][];
    get(square: string): Piece | null;
    moves(options: { square?: string; verbose: true }): Move[];
    move(move: { from: string; to: string }): Move | null;
    undo(): Move | null;
    reset(): void;
    turn(): Side;
    fen(): string;
    in_check(): boolean;
    in_checkmate(): boolean;
    in_stalemate(): boolean;
    in_draw(): boolean;
    game_over(): boolean;
}

/** AI receives an isolated FEN snapshot; it never mutates the live game. */
export interface ChessAI {
    chooseMove(fen: string, legalMoves: ReadonlyArray<Move>, context?: { isCancelled(): boolean }): Promise<{ from: string; to: string } | null>;
}

export function createRulesEngine(fen?: string): RulesEngine {
    return new (Xiangqi as unknown as { new(fen?: string): RulesEngine })(fen);
}

export class ChessRules {
    readonly engine: RulesEngine = createRulesEngine();
    get ended(): boolean {
        return this.engine.game_over();
    }
    get status(): string {
        const side = this.engine.turn() === 'r' ? '红方' : '黑方';
        const pieces = this.engine.board().reduce((all, row) => all.concat(row), [] as (Piece | null)[]);
        if (!pieces.some(p => p?.type === 'k' && p.color === 'r')) return '黑方获胜';
        if (!pieces.some(p => p?.type === 'k' && p.color === 'b')) return '红方获胜';
        if (this.engine.in_checkmate() || this.engine.in_stalemate()) {
            return `${side === '红方' ? '黑方' : '红方'}获胜 · ${this.engine.in_checkmate() ? '将死' : '困毙'}`;
        }
        if (this.engine.in_draw()) return '和棋 · 无子可胜 / 重复局面 / 自然限着';
        return `${side}走棋${this.engine.in_check() ? ' · 将军！请应将' : ''}`;
    }
}
