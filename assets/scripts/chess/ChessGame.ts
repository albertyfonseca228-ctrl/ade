import { _decorator, Canvas, Component, Graphics, Color, Label, Node, ResolutionPolicy, view } from 'cc';
import { BoardView, text, uiNode } from './BoardView';
import { GameSession } from './GameSession';
import { FrameGate } from './FrameGate';
import { OfflineAI } from './OfflineAI';
import type { Difficulty } from './OfflineAI';
import type { AnimatedMove, GameMode } from './GameSession';
import type { Move } from './ChessRules';
const { ccclass } = _decorator;
const NAMES: Record<Difficulty, string> = { easy: '初级', medium: '中级', hard: '高级' };

@ccclass('ChessGame')
export class ChessGame extends Component {
    private readonly session = new GameSession();
    private readonly frames = new FrameGate();
    private board!: BoardView;
    private status!: Label;
    private subtitle!: Label;
    private menu!: Node;
    private game!: Node;
    private difficultyLabel!: Label;
    private notice!: Label;
    private selected: string | null = null;
    private legal: Move[] = [];
    private alive = true;

    onLoad(): void {
        view.setDesignResolutionSize(720, 1280, ResolutionPolicy.SHOW_ALL);
        const canvas = this.node.getComponent(Canvas);
        if (canvas?.cameraComponent) canvas.cameraComponent.orthoHeight = 640;
        const root = uiNode(this.node, 'ChessUI', 720, 1280);
        const bg = root.addComponent(Graphics);
        bg.fillColor = new Color(249, 237, 210);
        bg.rect(-360, -640, 720, 1280); bg.fill();
        text(root, '中国象棋', 0, 535, 54);
        this.subtitle = text(root, '离线对弈 · 选择游戏模式', 0, 474, 24);
        this.menu = uiNode(root, 'HomeMenu', 720, 850);
        text(this.menu, '人机对战难度', 0, 280, 30);
        this.difficultyLabel = text(this.menu, '', 0, 220, 25);
        const levels: Difficulty[] = ['easy', 'medium', 'hard'];
        levels.forEach((level, i) => this.button(this.menu, NAMES[level], (i - 1) * 210, 125, () => {
            this.session.difficulty = level; this.refreshMenu();
        }, 180));
        this.button(this.menu, '人机对战', 0, -15, () => this.beginGame('ai'), 380);
        this.button(this.menu, '本地双人', 0, -125, () => this.beginGame('local'), 380);
        text(this.menu, '玩家执红 · AI 执黑 · 无需联网', 0, -230, 25);
        text(this.menu, '初级练习  /  中级攻防  /  高级深思', 0, -285, 23);
        text(this.menu, '规则：xiangqi.js · BSD-2-Clause', 0, -420, 20);
        this.game = uiNode(root, 'GameScreen', 720, 1280);
        this.status = text(this.game, '', 0, 416, 30);
        this.board = new BoardView(this.game, square => this.select(square));
        this.button(this.game, '悔 棋', -165, -462, () => this.undo());
        this.button(this.game, '重新开始', 165, -462, () => this.beginGame(this.session.mode));
        this.notice = text(this.game, '', 0, -529, 21);
        this.button(this.game, '返回首页', 0, -595, () => this.home(), 260, 54);
        this.refreshMenu(); this.refresh();
    }

    update(): void { this.frames.tick(); }
    private button(parent: Node, title: string, x: number, y: number, action: () => void, width = 260, height = 74): void {
        const node = uiNode(parent, title, width, height, x, y);
        const g = node.addComponent(Graphics);
        g.fillColor = new Color(225, 192, 132);
        g.roundRect(-width / 2, -height / 2, width, height, 12); g.fill();
        text(node, title, 0, 0, 29, width - 10);
        node.on(Node.EventType.TOUCH_END, action, this);
    }
    private refreshMenu(): void { this.difficultyLabel.string = `当前：${NAMES[this.session.difficulty]}`; }
    private beginGame(mode: GameMode): void {
        this.board.cancelAnimations(); this.session.start(mode); this.clearSelection(); this.refresh();
    }
    private home(): void {
        this.board.cancelAnimations(); this.session.home(); this.clearSelection(); this.refresh();
    }
    private select(square: string): void {
        if (!this.session.canPlay) return;
        const engine = this.session.rules.engine;
        if (this.selected && this.legal.some(m => m.to === square)) {
            const animated = this.session.humanMove(this.selected, square);
            if (animated) this.animate(animated);
            return;
        }
        if (square === this.selected) this.clearSelection();
        else if (engine.get(square)?.color === engine.turn()) {
            this.selected = square; this.legal = engine.moves({ square, verbose: true });
        } else this.clearSelection();
        this.refresh();
    }
    private animate(animated: AnimatedMove): void {
        this.clearSelection();
        this.status.string = `${this.session.rules.engine.turn() === 'b' ? '红方' : '黑方'}落子中…`;
        this.board.animate(animated.move, () => {
            if (!this.alive || !this.isValid || !this.session.finishAnimation(animated.epoch)) return;
            this.refresh(); void this.requestAI();
        });
    }
    private clearSelection(): void { this.selected = null; this.legal = []; }
    private refresh(): void {
        if (!this.alive) return;
        const menu = this.session.phase === 'menu';
        this.menu.active = menu; this.game.active = !menu;
        this.subtitle.string = menu ? '离线对弈 · 选择游戏模式' : this.session.mode === 'ai'
            ? `人机对战 · ${NAMES[this.session.difficulty]} · 你执红` : '本地双人对战';
        if (menu) return;
        this.board.render(this.session.rules.engine, this.selected, this.legal);
        this.status.string = this.session.phase === 'thinking' ? '黑方 AI 思考中…' : this.session.rules.status;
        this.notice.string = this.session.notice || (this.session.mode === 'ai' ? '悔棋撤销本轮 · 思考时可重开或返回首页' : '红方先行 · 点击棋子查看合法走法');
    }
    private undo(): void {
        this.board.cancelAnimations(); this.session.undo(); this.clearSelection(); this.refresh();
    }
    async requestAI(): Promise<void> {
        if (!this.alive || this.session.phase !== 'ready' || this.session.mode !== 'ai' || this.session.rules.ended || this.session.rules.engine.turn() !== 'b') return;
        const ai = new OfflineAI(this.session.difficulty, this.frames.next);
        const pending = this.session.requestAI(ai);
        this.refresh();
        const animated = await pending;
        if (!this.alive || !this.isValid || !animated || animated.epoch !== this.session.epoch) return;
        this.animate(animated);
    }
    onDestroy(): void {
        this.alive = false; this.session.dispose(); this.frames.dispose(); this.board?.cancelAnimations();
    }
}
