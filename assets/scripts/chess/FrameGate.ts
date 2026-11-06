/** Driven by Component.update on both Web and JSB. No timers or Worker required. */
export class FrameGate {
    private waiting: Array<() => void> = [];
    private closed = false;
    readonly next = (): Promise<void> => this.closed ? Promise.resolve() : new Promise(resolve => this.waiting.push(resolve));
    tick(): void {
        const batch = this.waiting;
        this.waiting = [];
        for (const resolve of batch) resolve();
    }
    dispose(): void { this.closed = true; this.tick(); }
}
