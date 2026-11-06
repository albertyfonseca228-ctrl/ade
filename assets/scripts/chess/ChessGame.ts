import { _decorator, Canvas, Component, Graphics, Color, Label, Node, ResolutionPolicy, view } from 'cc';
import { BoardView, text, uiNode } from './BoardView';
import { ChessAI, ChessRules, Move } from './ChessRules';
const { ccclass } = _decorator;

@ccclass('ChessGame')
export class ChessGame extends Component {
    private readonly rules = new ChessRules();
    private board!: BoardView;
    private status!: Label;
    private selected: string | null = null;
    private legal: Move[] = [];
    private busy = false;
    private generation = 0;
    /** Phase 2: supply an offline AI implementation and call requestAI after red moves. */
    ai: ChessAI | null = null;

    onLoad(): void {
        view.setDesignResolutionSize(720, 1280, ResolutionPolicy.SHOW_ALL);
        const canvas = this.node.getComponent(Canvas);
        if (canvas?.cameraComponent) canvas.cameraComponent.orthoHeight = 640;
        const root = uiNode(this.node, 'ChessUI', 720, 1280);
        const bg = root.addComponent(Graphics);
        bg.fillColor = new Color(249, 237, 210);
        bg.rect(-360, -640, 720, 1280); bg.fill();
        text(root, '中国象棋', 0, 535, 54);
        text(root, '本 地 双 人 对 战', 0, 474, 24);
        this.status = text(root, '', 0, 416, 30);
        this.board = new BoardView(root, square => this.select(square));
        this.button(root, '悔 棋', -165, () => this.undo());
        this.button(root, '重新开始', 165, () => this.restart());
        text(root, '红方先行 · 点击棋子查看合法走法', 0, -540, 23);
        text(root, '规则：xiangqi.js · BSD-2-Clause', 0, -586, 18);
        this.refresh();
    }

    private button(parent: Node, title: string, x: number, action: () => void): void {
        const node = uiNode(parent, title, 260, 74, x, -462);
        const g = node.addComponent(Graphics);
        g.fillColor = new Color(225, 192, 132);
        g.roundRect(-130, -37, 260, 74, 12); g.fill();
        text(node, title, 0, 0, 29, 250);
        node.on(Node.EventType.TOUCH_END, action, this);
    }

    private select(square: string): void {
        if (this.busy || this.rules.ended) return;
        const engine = this.rules.engine;
        if (this.selected && this.legal.some(m => m.to === square)) {
            const move = engine.move({ from: this.selected, to: square });
            if (!move) return;
            this.busy = true;
            this.board.animate(move, () => {
                this.busy = false; this.clearSelection(); this.refresh();
            });
            return;
        }
        if (square === this.selected) this.clearSelection();
        else if (engine.get(square)?.color === engine.turn()) {
            this.selected = square;
            this.legal = engine.moves({ square, verbose: true });
        } else this.clearSelection();
        this.refresh();
    }

    private clearSelection(): void { this.selected = null; this.legal = []; }
    private refresh(): void {
        this.board.render(this.rules.engine, this.selected, this.legal);
        this.status.string = this.rules.status;
    }
    private undo(): void {
        if (this.busy) return;
        this.generation++; this.rules.engine.undo(); this.clearSelection(); this.refresh();
    }
    private restart(): void {
        if (this.busy) return;
        this.generation++; this.rules.engine.reset(); this.clearSelection(); this.refresh();
    }

    /** Stale AI responses are discarded after restart, undo or scene destruction. */
    async requestAI(): Promise<void> {
        if (!this.ai || this.busy || this.rules.ended) return;
        const generation = this.generation;
        const fen = this.rules.engine.fen();
        this.busy = true;
        try {
            const move = await this.ai.chooseMove(fen, this.rules.engine.moves({ verbose: true }));
            if (generation !== this.generation || !this.isValid) return;
            if (move) this.rules.engine.move(move);
        } finally {
            if (generation === this.generation && this.isValid) {
                this.busy = false; this.clearSelection(); this.refresh();
            }
        }
    }
    onDestroy(): void { this.generation++; }
}
