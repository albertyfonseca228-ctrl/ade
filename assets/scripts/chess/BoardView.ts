import { Color, EventTouch, Graphics, HorizontalTextAlignment, Label, Node, tween, UITransform, Vec3, VerticalTextAlignment } from 'cc';
import { Move, Piece, RulesEngine } from './ChessRules';

const INK = new Color(82, 47, 27);
const RED = new Color(174, 43, 35);
const GOLD = new Color(238, 185, 77);
export const squareAt = (col: number, row: number): string => 'abcdefghi'[col] + (9 - row);
const position = (square: string): Vec3 => new Vec3((square.charCodeAt(0) - 101) * 72, (Number(square[1]) - 4.5) * 72);

export function uiNode(parent: Node, name: string, width: number, height: number, x = 0, y = 0): Node {
    const node = new Node(name);
    node.layer = 1 << 25;
    parent.addChild(node);
    node.addComponent(UITransform).setContentSize(width, height);
    node.setPosition(x, y);
    return node;
}

export function text(parent: Node, value: string, x: number, y: number, size = 28, width = 660): Label {
    const node = uiNode(parent, value, width, size + 18, x, y);
    const label = node.addComponent(Label);
    label.string = value;
    label.fontSize = size;
    label.lineHeight = size + 8;
    label.horizontalAlign = HorizontalTextAlignment.CENTER;
    label.verticalAlign = VerticalTextAlignment.CENTER;
    label.color = INK;
    return label;
}

export class BoardView {
    private readonly pieces: Node;
    private readonly hints: Node;
    private pieceNodes = new Map<string, Node>();
    constructor(parent: Node, onSquare: (square: string) => void) {
        const board = uiNode(parent, 'Board', 680, 760, 0, -10);
        const g = board.addComponent(Graphics);
        g.fillColor = new Color(235, 204, 148);
        g.roundRect(-338, -376, 676, 752, 16); g.fill();
        g.strokeColor = INK; g.lineWidth = 2;
        const line = (x: number, y: number, xx: number, yy: number) => { g.moveTo(x, y); g.lineTo(xx, yy); };
        for (let r = 0; r < 10; r++) line(-288, 324 - r * 72, 288, 324 - r * 72);
        for (let c = 0; c < 9; c++) {
            const x = -288 + c * 72;
            if (c === 0 || c === 8) line(x, -324, x, 324);
            else { line(x, 324, x, 36); line(x, -36, x, -324); }
        }
        for (const y of [-324, 180]) { line(-72, y, 72, y + 144); line(72, y, -72, y + 144); }
        g.stroke();
        text(board, '楚 河', -144, 0, 32, 200);
        text(board, '汉 界', 144, 0, 32, 200);
        this.hints = uiNode(board, 'LegalMoves', 680, 760);
        this.pieces = uiNode(board, 'Pieces', 680, 760);
        board.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
            const p = event.getUILocation();
            const local = board.getComponent(UITransform)!.convertToNodeSpaceAR(new Vec3(p.x, p.y));
            const col = Math.round(local.x / 72 + 4);
            const row = Math.round(4.5 - local.y / 72);
            if (col >= 0 && col < 9 && row >= 0 && row < 10) onSquare(squareAt(col, row));
        });
    }

    render(engine: RulesEngine, selected: string | null, legal: Move[]): void {
        for (const child of [...this.pieces.children]) child.destroy();
        this.pieces.removeAllChildren();
        this.pieceNodes.clear();
        for (const child of [...this.hints.children]) child.destroy();
        this.hints.removeAllChildren();
        engine.board().forEach((row, r) => row.forEach((piece, c) => {
            if (!piece) return;
            const square = squareAt(c, r);
            const node = this.drawPiece(piece, square === selected);
            node.setPosition(position(square));
            this.pieceNodes.set(square, node);
        }));
        for (const move of legal) {
            const p = position(move.to);
            const marker = uiNode(this.hints, move.to, 64, 64, p.x, p.y);
            const g = marker.addComponent(Graphics);
            g.fillColor = new Color(42, 124, 86, 180);
            g.strokeColor = GOLD; g.lineWidth = 5;
            if (engine.get(move.to)) { g.circle(0, 0, 34); g.stroke(); }
            else { g.circle(0, 0, 9); g.fill(); }
        }
    }

    animate(move: Move, done: () => void): void {
        const node = this.pieceNodes.get(move.from);
        if (!node) { done(); return; }
        node.setSiblingIndex(this.pieces.children.length - 1);
        tween(node).to(0.18, { position: position(move.to) }, { easing: 'quadOut' }).call(done).start();
    }

    private drawPiece(piece: Piece, selected: boolean): Node {
        const node = uiNode(this.pieces, 'Piece', 64, 64);
        const g = node.addComponent(Graphics);
        g.fillColor = new Color(247, 225, 179);
        g.strokeColor = selected ? GOLD : INK;
        g.lineWidth = selected ? 5 : 2;
        g.circle(0, 0, 31); g.fill(); g.stroke();
        g.lineWidth = 1; g.circle(0, 0, 26); g.stroke();
        const names: Record<string, string> = piece.color === 'r'
            ? { r: '车', n: '马', b: '相', a: '仕', k: '帅', c: '炮', p: '兵' }
            : { r: '车', n: '马', b: '象', a: '士', k: '将', c: '砲', p: '卒' };
        text(node, names[piece.type], 0, 0, 36, 64).color = piece.color === 'r' ? RED : INK;
        return node;
    }
}
