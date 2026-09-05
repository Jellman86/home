/**
 * The cell painter the Auspex mascot draws with, ported from
 * `MascotPainter` in the Auspex app.
 *
 * Everything is accumulated into a coarse 72-cell grid and emitted as one
 * fill per occupied cell, so a thick, overlapping stamp costs the same as a
 * thin one — the cost is the grid, not the strokes. A sparse fine grid at
 * four times the resolution exists for the one element drawn at a
 * resolution the block does not have: the characters it turns out to be
 * made of. The mask-and-tentacles creature that used to be drawn with this
 * is gone from the app and from here.
 */


export const GRID = 72;
/** How many fine cells fit across one coarse one. */
export const FINE = 4;

export const smoothstep = (x: number) => {
    const c = x < 0 ? 0 : x > 1 ? 1 : x;
    return c * c * (3 - 2 * c);
};

/**
 * Accumulates drawing into a grid, then emits one fill per occupied cell.
 *
 * Buffering is what makes a thick, overlapping stamp cost the same as a thin
 * one — the cost is the grid, not the strokes — which is why the limbs can be
 * discs rather than the single-cell traces that came out as scattered dots.
 */
export class Painter {
    private cells: (readonly [string, number] | null)[];
    /** Sparse: only a small region is ever drawn at 4x, and a dense buffer
     *  would be sixteen times the size for nothing. */
    private fine = new Map<number, readonly [string, number]>();

    constructor(private side: number = GRID) {
        this.cells = new Array(side * side).fill(null);
    }

    clear() {
        this.cells.fill(null);
        this.fine.clear();
    }

    plot(x: number, y: number, colour: string, alpha = 1) {
        if (alpha <= 0.03) return;
        const ix = Math.floor(x), iy = Math.floor(y);
        if (ix < 0 || iy < 0 || ix >= this.side || iy >= this.side) return;
        this.cells[iy * this.side + ix] = [colour, alpha < 1 ? alpha : 1];
    }

    stamp(x: number, y: number, radius: number, colour: string, alpha = 1) {
        const r = Math.ceil(radius);
        for (let dy = -r; dy <= r; dy++)
            for (let dx = -r; dx <= r; dx++)
                if (dx * dx + dy * dy <= radius * radius) this.plot(x + dx, y + dy, colour, alpha);
    }

    plotFine(x: number, y: number, colour: string, alpha = 1) {
        if (alpha <= 0.03) return;
        const limit = this.side * FINE;
        const ix = Math.floor(x), iy = Math.floor(y);
        if (ix < 0 || iy < 0 || ix >= limit || iy >= limit) return;
        this.fine.set(iy * limit + ix, [colour, alpha < 1 ? alpha : 1]);
    }

    stampFine(x: number, y: number, radius: number, colour: string, alpha = 1) {
        const r = Math.ceil(radius);
        for (let dy = -r; dy <= r; dy++)
            for (let dx = -r; dx <= r; dx++)
                if (dx * dx + dy * dy <= radius * radius) this.plotFine(x + dx, y + dy, colour, alpha);
    }

    paint(ctx: CanvasRenderingContext2D, cell: number, originX: number, originY: number, mul = 1) {
        for (let i = 0; i < this.cells.length; i++) {
            const v = this.cells[i];
            if (!v) continue;
            ctx.globalAlpha = v[1] * mul;
            ctx.fillStyle = v[0];
            // Half a cell of overdraw closes the hairline seams that otherwise
            // show between cells at fractional scales.
            ctx.fillRect(originX + (i % this.side) * cell, originY + Math.floor(i / this.side) * cell, cell + 0.6, cell + 0.6);
        }
        if (this.fine.size) {
            const fineCell = cell / FINE;
            const limit = this.side * FINE;
            this.fine.forEach((v, i) => {
                ctx.globalAlpha = v[1] * mul;
                ctx.fillStyle = v[0];
                ctx.fillRect(originX + (i % limit) * fineCell, originY + Math.floor(i / limit) * fineCell, fineCell + 0.35, fineCell + 0.35);
            });
        }
        ctx.globalAlpha = 1;
    }
}
