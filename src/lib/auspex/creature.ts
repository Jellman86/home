/**
 * The Auspex creature, ported from `AuspexMascot.swift` in the Auspex repo.
 *
 * The grammar is the app's, not this site's, and it is worth restating because
 * every number below serves it: the mask is a courtesy pitched at what a person
 * can read, and none of it is information about what the thing actually is. So
 * the body never changes colour, nothing it does is aimed at the cursor, and the
 * only part allowed to be sharp is the part the mask was covering.
 *
 * The creature is drawn on a 72-cell grid at any size. What is behind the mask
 * is drawn at 288. That contrast is the whole idea — the facade is
 * low-resolution and the thing wearing it is not — so keep it whatever else
 * changes here.
 */

export const BODY = ['#3D1F66', '#592B8F', '#783DB8', '#9959E0'] as const;
export const MASK_FACE = '#F5EDFA';
export const MASK_SHADE = '#D9C7E8';
export const INK = '#0A0514';
export const EYE = '#C77DFF';
export const GLOW = '#7A2ED4';

export const GRID = 72;
export const CX = 36;
export const CY = 33;
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

/** The painted face. Minimal on purpose — closer to an emoticon than a drawing,
 *  because at card size the mask is all there is. */
function faceMarks(p: Painter, mx: number, my: number, k: number) {
    const dot = (x: number, y: number, r = 1.2) =>
        p.stamp(mx + x * k, my + y * k, Math.max(0.6, r * k), INK, 1);
    const e = 5;
    dot(-e, -5, 1.4);
    dot(e, -5, 1.4);
    // Screen y grows downward, so a smile puts its centre lower: positive depth.
    for (let i = -3; i <= 3; i++) dot(i, 4 + Math.round(Math.cos((i / 3) * 1.35) * 1.6), 0.85);
}

export function drawMask(p: Painter, mx: number, my: number, k: number) {
    const rx = 10 * k, ry = 13 * k;
    for (let y = -ry; y <= ry; y++)
        for (let x = -rx; x <= rx; x++) {
            if ((x * x) / (rx * rx) + (y * y) / (ry * ry) > 1) continue;
            const lit = x + y < -6 * k;
            p.plot(mx + x, my + y, lit ? '#FFFFFF' : x > 5 * k ? MASK_SHADE : MASK_FACE);
        }
    faceMarks(p, mx, my, k);
}

/**
 * The card-sized form: the mask, a halo carrying the state, and every so often
 * a limb slithering out from behind it.
 *
 * A whole creature at forty points is a smudge — every part of it reduces to
 * about four visible pixels. The mask survives being small because it is one
 * large shape with high contrast, and it is what carries the expression anyway.
 */
export function renderCompact(p: Painter, t: number, reduceMotion: boolean) {
    const cx = CX, cy = CY + 2 + Math.sin(t * 0.7) * 1.2;
    for (let r = 30; r > 21; r--) p.stamp(cx, cy, r, GLOW, 0.05 + ((30 - r) / 9) * 0.13);

    if (!reduceMotion) {
        // Slow and thin rather than quick and thick: the effect depends on
        // catching a glimpse of something behind it, not on an arm being waved.
        const period = 15, window = 4.6, phase = t % period;
        if (phase < window) {
            const mirrored = Math.floor(t / period) % 2 === 1;
            for (let i = 0; i < 3; i++) {
                const local = (phase - i * 0.5) / (window - i * 0.5);
                if (local <= 0) continue;
                const extended =
                    local < 0.4 ? smoothstep(local / 0.4)
                    : local > 0.62 ? 1 - smoothstep((local - 0.62) / 0.38)
                    : 1;
                if (extended <= 0.02) continue;
                const spread = [0.35, 0.9, 1.5][i];
                const base = mirrored ? Math.PI - spread : spread;
                let theta = base, x = cx + Math.cos(base) * 11, y = cy + Math.sin(base) * 11;
                const length = [24, 30, 21][i] * extended;
                for (let s = 0; s < length; s += 0.5) {
                    const progress = s / Math.max(length, 0.001);
                    theta += 0.14 * Math.pow(progress, 1.2) * Math.sin(t * 1.15 - s * 0.5 + i * 2.1) * (mirrored ? -1 : 1);
                    x += Math.cos(theta) * 0.5;
                    y += Math.sin(theta) * 0.5 * 0.94;
                    p.stamp(x, y, Math.max(1.2, 3 * Math.pow(1 - progress, 0.6)), BODY[3 - Math.min(3, (progress * 4) | 0)], 1);
                }
            }
        }
    }
    drawMask(p, cx, cy, 2.15);
}

/* ------------------------------------------------------------------------ *
 * The page-sized form. Nothing here goes through the 72-cell painter: at this
 * scale one cell is most of a phone, so the shapes are drawn straight to the
 * canvas and quantised onto a lattice instead. The chunk is the look, and it
 * has to hold however large the thing is drawn.
 * ------------------------------------------------------------------------ */

export const lattice = (v: number, cell: number) => Math.floor(v / cell) * cell;

/**
 * A slice of something much larger than the viewport. Exactly one curved edge
 * ever crosses the frame, so there is no outline to complete: you get a curve
 * and have to guess, which is the only honest way to draw something the viewer
 * is not equipped to read.
 */
export function paleMass(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, rx: number, ry: number,
    cell: number, w: number, h: number, alpha: number
) {
    for (let py = lattice(-cell, cell); py < h + cell; py += cell)
        for (let px = lattice(-cell, cell); px < w + cell; px += cell) {
            const gx = px + cell / 2 - cx, gy = py + cell / 2 - cy;
            if ((gx * gx) / (rx * rx) + (gy * gy) / (ry * ry) > 1) continue;
            const lit = (gx / rx) * 10 + (gy / ry) * 13 < -6;
            ctx.globalAlpha = alpha * (lit ? 1.5 : 1);
            ctx.fillStyle = lit ? '#FFFFFF' : (gx / rx) * 10 > 5 ? MASK_SHADE : MASK_FACE;
            ctx.fillRect(px, py, cell + 0.6, cell + 0.6);
        }
    ctx.globalAlpha = 1;
}

/** Where an eye would be, if this were a face. */
export function inkMass(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, r: number,
    cell: number, w: number, h: number, alpha: number
) {
    for (let py = lattice(cy - r, cell); py < cy + r + cell; py += cell)
        for (let px = lattice(cx - r, cell); px < cx + r + cell; px += cell) {
            if (px + cell < 0 || py + cell < 0 || px > w || py > h) continue;
            const gx = px + cell / 2 - cx, gy = py + cell / 2 - cy;
            if (gx * gx + gy * gy > r * r) continue;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = INK;
            ctx.fillRect(px, py, cell + 0.6, cell + 0.6);
        }
    ctx.globalAlpha = 1;
}

/**
 * The one sharp thing on the page: a fine cell a quarter the size of the
 * creature's, a slit pupil and a wet highlight, set into a socket so it does
 * not float on the dark. Aimed off-frame — it is not addressing the reader.
 */
export function lens(
    ctx: CanvasRenderingContext2D,
    ex: number, ey: number, H: number, W: number,
    cell: number, alpha: number, t: number, w: number, h: number
) {
    const pulse = 0.62 + 0.38 * Math.abs(Math.sin(t * 2.3));

    for (let py = lattice(ey - H * 1.28, cell * 4); py < ey + H * 1.28 + cell * 4; py += cell * 4)
        for (let px = lattice(ex - W * 2.3, cell * 4); px < ex + W * 2.3 + cell * 4; px += cell * 4) {
            const dx = (px + cell * 2 - ex) / (W * 2.3), dy = (py + cell * 2 - ey) / (H * 1.28);
            const d = dx * dx + dy * dy;
            if (d > 1) continue;
            if (px + cell * 4 < 0 || py + cell * 4 < 0 || px > w || py > h) continue;
            ctx.globalAlpha = alpha * 0.85 * (1 - Math.sqrt(d) * 0.45);
            ctx.fillStyle = '#060210';
            ctx.fillRect(px, py, cell * 4 + 0.6, cell * 4 + 0.6);
        }
    ctx.globalAlpha = 1;

    for (let py = lattice(ey - H, cell); py < ey + H + cell; py += cell) {
        const dy = py + cell / 2 - ey;
        if (Math.abs(dy) > H) continue;
        const halfWidth = W * (1 - Math.pow(Math.abs(dy) / H, 1.7));
        for (let px = lattice(ex - halfWidth, cell); px < ex + halfWidth + cell; px += cell) {
            const dx = px + cell / 2 - ex;
            if (Math.abs(dx) > halfWidth) continue;
            if (px + cell < 0 || py + cell < 0 || px > w || py > h) continue;
            // Banded by colour rather than by alpha: alpha over a near-black
            // socket just produced a dark blob with no hue left in it.
            const band = Math.cos((Math.abs(dx) / Math.max(halfWidth, 1)) * 1.9) * pulse;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = band > 0.86 ? '#E9CBFF' : band > 0.62 ? EYE : band > 0.34 ? '#8B4FD0' : '#4C2580';
            ctx.fillRect(px, py, cell + 0.4, cell + 0.4);
        }
    }

    const slitH = H * 0.84, slitW = Math.max(cell, W * 0.13);
    for (let py = lattice(ey - slitH, cell); py < ey + slitH + cell; py += cell) {
        const dy = py + cell / 2 - ey;
        if (Math.abs(dy) > slitH) continue;
        const half = slitW * (1 - Math.pow(Math.abs(dy) / slitH, 0.9));
        for (let px = lattice(ex - half, cell); px < ex + half + cell; px += cell) {
            if (Math.abs(px + cell / 2 - ex) > half) continue;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = '#000000';
            ctx.fillRect(px, py, cell + 0.4, cell + 0.4);
        }
    }

    // One light source, so the small eyes elsewhere can agree with it.
    const hx = ex - W * 0.46, hy = ey - H * 0.44, hr = Math.max(cell * 1.4, W * 0.19);
    for (let py = lattice(hy - hr, cell); py < hy + hr + cell; py += cell)
        for (let px = lattice(hx - hr, cell); px < hx + hr + cell; px += cell) {
            const dx = px + cell / 2 - hx, dy = py + cell / 2 - hy;
            if (dx * dx + dy * dy > hr * hr) continue;
            ctx.globalAlpha = alpha * 0.9;
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(px, py, cell + 0.4, cell + 0.4);
        }
    ctx.globalAlpha = 1;
}

/** An eye opening where there is no body to hold it. Same construction as the
 *  large one, three cells wide. */
export function strayEye(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, cell: number, alpha: number, phase: number, t: number
) {
    const open = 0.45 + 0.55 * Math.abs(Math.sin(t * 0.42 + phase));
    // A socket built from the same cells as the eye rather than a rectangle
    // behind it: a plate reads as a decal stuck onto the scene.
    ctx.globalAlpha = alpha * 0.88;
    ctx.fillStyle = '#09030F';
    for (const [row, wide] of [[-3, 1], [-2, 2], [-1, 3], [0, 3], [1, 3], [2, 2], [3, 1]] as const)
        ctx.fillRect(x - (wide + 0.5) * cell, y + (row - 0.5) * cell, (wide * 2 + 1) * cell, cell * 2);
    const rows = [1, 2, 3, 3, 3, 2, 1];
    for (let r = 0; r < rows.length; r++) {
        const half = (rows[r] / 2) * open;
        if (half < 0.4) continue;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = EYE;
        ctx.fillRect(x - half * cell, y + (r - 3) * cell, half * 2 * cell, cell + 0.4);
    }
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#000000';
    ctx.fillRect(x - cell * 0.5, y - cell * 2 * open, cell, cell * 4 * open);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x - cell * 1.1, y - cell * 1.6, cell * 0.8, cell * 0.8);
    ctx.globalAlpha = 1;
}
