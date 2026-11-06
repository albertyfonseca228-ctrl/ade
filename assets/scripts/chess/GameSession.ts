import { ChessRules } from './ChessRules';
import type { ChessAI, Move } from './ChessRules';
import type { Difficulty } from './OfflineAI';

export type GameMode = 'local' | 'ai';
export type Phase = 'menu' | 'ready' | 'animating' | 'thinking' | 'disposed';
export interface AnimatedMove { move: Move; epoch: number }

/** Pure game state, shared by the Cocos controller and headless regression tests. */
export class GameSession {
    readonly rules = new ChessRules();
    mode: GameMode = 'local';
    difficulty: Difficulty = 'medium';
    phase: Phase = 'menu';
    epoch = 0;
    plies = 0;
    notice = '';
    get canPlay(): boolean {
        return this.phase === 'ready' && !this.rules.ended && (this.mode === 'local' || this.rules.engine.turn() === 'r');
    }
    start(mode: GameMode, difficulty = this.difficulty): void {
        if (this.phase === 'disposed') return;
        this.epoch++; this.mode = mode; this.difficulty = difficulty;
        this.rules.engine.reset(); this.plies = 0; this.notice = ''; this.phase = 'ready';
    }
    home(): void {
        if (this.phase === 'disposed') return;
        this.epoch++; this.phase = 'menu'; this.notice = '';
    }
    humanMove(from: string, to: string): AnimatedMove | null {
        if (!this.canPlay) return null;
        const move = this.rules.engine.move({ from, to });
        return move ? this.animate(move) : null;
    }
    private animate(move: Move): AnimatedMove {
        this.plies++; this.notice = ''; this.phase = 'animating';
        return { move, epoch: this.epoch };
    }
    finishAnimation(epoch: number): boolean {
        if (epoch !== this.epoch || this.phase !== 'animating') return false;
        this.phase = 'ready'; return true;
    }
    undo(): void {
        if (this.phase === 'menu' || this.phase === 'disposed') return;
        this.epoch++;
        let count = this.mode === 'ai' && this.rules.engine.turn() === 'r' ? 2 : 1;
        while (count-- > 0 && this.plies > 0) { this.rules.engine.undo(); this.plies--; }
        this.phase = 'ready'; this.notice = '';
    }
    async requestAI(ai: ChessAI): Promise<AnimatedMove | null> {
        if (this.phase !== 'ready' || this.mode !== 'ai' || this.rules.ended || this.rules.engine.turn() !== 'b') return null;
        const epoch = this.epoch;
        const fen = this.rules.engine.fen();
        this.phase = 'thinking';
        const valid = () => this.epoch === epoch && this.phase === 'thinking' && this.rules.engine.fen() === fen;
        const legal = this.rules.engine.moves({ verbose: true });
        let answer: { from: string; to: string } | null = null;
        try { answer = await ai.chooseMove(fen, legal, { isCancelled: () => !valid() }); }
        catch (_error) { if (valid()) this.notice = 'AI 搜索异常，已使用合法备用走法'; }
        if (!valid()) return null;
        const selected = answer && legal.find(m => m.from === answer!.from && m.to === answer!.to);
        if (!selected && !this.notice) this.notice = 'AI 返回无效走法，已使用合法备用走法';
        const move = (selected || legal[0]) && this.rules.engine.move(selected || legal[0]);
        if (!move) { this.phase = 'ready'; return null; }
        const notice = this.notice;
        const animated = this.animate(move);
        this.notice = notice;
        return animated;
    }
    dispose(): void { this.epoch++; this.phase = 'disposed'; }
}
