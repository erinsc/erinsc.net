import { Vec2 } from "./vec2.js";

const RADIUS = 25;
const LINE = 5;
const EDGE = RADIUS * 2 + LINE * 2;
const SPEED = 1/25;
export const INFLUENCE = RADIUS * RADIUS * 8;

function expect<T>(value: T | null | undefined, msg = "unexpected null type"): T {
    if (value == null)
        throw new Error(msg);
    return value;
}

export class Term {
    pos: Vec2;
    offset: Vec2;

    constructor(pos = new Vec2(0, 0)) {
        this.pos = pos;
        this.offset = new Vec2(0, 0);
    }
    // Move a Term towards pos + offset
    step(pos: Vec2) {
        pos.addAssign(this.offset);
        this.pos.subAssign(this.pos.sub(pos).multAssign(SPEED));
    }
    // Get total height of the subtree. ignores shared links
    getHeight(): number {
        return 1;
    }
    // Returns a list of max widths from the left and right of this Term for every height
    // Includes itself, which will always be [0, 0]
    setOffset(level: number, levels: Map<ShareTerm, number>): [number, number][] {
        return [[0, 0]];
    }
    drawTerm(parent: Term | null, ctx: CanvasRenderingContext2D, style: CSSStyleDeclaration) {
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = style.backgroundColor;
        ctx.lineWidth = 6;
        ctx.fill();
        ctx.strokeStyle = style.borderTopColor;
        ctx.stroke();
    }
    copy(relables: Map<ShareTerm, ShareTerm>): Term {
        return new Term(this.pos.copy());
    }
    reduce(pos: Vec2 | null): Term | boolean {
        return false;
    }
    replace(from: ShareTerm, to: Term): Term | null {
        return null;
    }
}
// Represents an abstraction Term
export class AbsTerm extends Term {
    shr: ShareTerm;
    body: Term;

    constructor(shr: ShareTerm, body: Term, pos = new Vec2(0, 0)) {
        super(pos);
        this.shr = shr;
        this.body = body;
    }
    step(pos: Vec2) {
        super.step(pos);

        if (this.shr)
            this.shr.step(pos.copy());
        if (this.body)
            this.body.step(pos);
    }
    getHeight(): number {
        return this.body.getHeight() + 2;
    }
    // Body is shifted to the right by EDGE
    // Var is shifted all the way below the body
    setOffset(level: number, levels: Map<ShareTerm, number>): [number, number][] {
        var widths: [number, number][] = [[0, 0]];

        const right_height = this.body.getHeight();
        levels.set(this.shr, right_height + level + 1);

        const right = this.body.setOffset(level + 1, levels);
        var shift = -Infinity;

        for(var i = 0; i < right.length; i++) {
            shift = Math.max(shift, -right[i][0]);
        }
        shift += EDGE;

        for(var i = 0; i < right.length; i++) {
            const r = right[i][1] + shift;
            widths.push([0, r]);
        }

        this.body.offset.set(shift, EDGE);
        this.shr.offset.set(0, (right_height) * EDGE);
        widths.push([0, 0]);

        return widths;
    }
    drawTerm(parent: Term | null, ctx: CanvasRenderingContext2D, style: CSSStyleDeclaration) {
        if (parent) {
            const start = parent.pos;
            const end = this.pos;
            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.arcTo(end.x, start.y, end.x, end.y, RADIUS);
            ctx.lineTo(end.x, end.y);
            ctx.strokeStyle = style.color;
            ctx.lineWidth = 6;
            ctx.stroke();
        }

        this.body?.drawTerm(this, ctx, style);
        this.shr?.drawTerm(this, ctx, style);
        
        ctx.beginPath();
        ctx.roundRect(this.pos.x-RADIUS, this.pos.y-RADIUS, RADIUS*2, RADIUS*2, RADIUS/2);
        ctx.fillStyle = style.backgroundColor;
        ctx.lineWidth = 6;
        ctx.fill();
        ctx.strokeStyle = style.borderTopColor;
        ctx.stroke();

        ctx.beginPath();
        ctx.strokeStyle = style.borderTopColor;
        ctx.fillStyle = style.borderTopColor;
        ctx.lineWidth = 3;
        ctx.strokeText("λ", this.pos.x, this.pos.y+2);
        ctx.fillText("λ", this.pos.x, this.pos.y+2);
    }
    copy(shares: Map<ShareTerm, ShareTerm>): AbsTerm {
        const copied_shr = new ShareTerm(this.shr.label, this.shr.pos.copy());
        shares.set(this.shr, copied_shr);

        const body = this.body.copy(shares);
        const copied = new AbsTerm(copied_shr, body, this.pos.copy());

        shares.delete(this.shr);
        return copied;
    }
    reduce(pos: Vec2 | null): Term | boolean {
        const body = this.body.reduce(pos);
        if (body === true) return true;
        if (body) {
            this.body = body;
            return true;
        }
        return false;
    }
    replace(from: ShareTerm, to: Term): Term | null {
        const body = this.body.replace(from, to);
        if (body)
            this.body = body;
        return null;
    }
}
// Represents an application
export class AppTerm extends Term {
    func: Term;
    arg: Term;

    constructor(func: Term, arg: Term, pos = new Vec2(0, 0)) {
        super(pos);
        this.func = func;
        this.arg = arg;
    }
    step(pos: Vec2) {
        super.step(pos);
        
        if (this.func)
            this.func.step(pos.copy());
        if (this.arg)
            this.arg.step(pos);
    }
    getHeight(): number {
        return Math.max(this.func.getHeight(), this.arg.getHeight()) + 1;
    }
    setOffset(level: number, levels: Map<ShareTerm, number>): [number, number][] {
        const left = this.func.setOffset(level + 1, levels);
        const right = this.arg.setOffset(level + 1, levels);

        const min_height = Math.min(left.length, right.length);

        // Find the widest distance between the trees, at equal levels
        var shift = 0;
        for(var i = 0; i < min_height; i++) {
            const current = left[i][1] - right[i][0];
            shift = Math.max(shift, current);
        }
        // Includes padding and shift from center
        shift = Math.max(EDGE, (shift + EDGE) / 2);

        // build width graph, first from both sides...
        var widths: [number, number][] = [[0, 0]];
        for(var i = 0; i < min_height; i++) {
            const l = left[i][0] - shift;
            const r = right[i][1] + shift;
            widths.push([l, r]);
        }
        // Then complete whichever branch was longer
        for(var i = min_height; i < left.length; i++) {
            const l = left[i][0] - shift;
            const r = left[i][1] - shift;
            widths.push([l, r]);
        }
        for(var i = min_height; i < right.length; i++) {
            const l = right[i][0] + shift;
            const r = right[i][1] + shift;
            widths.push([l, r]);
        }

        // Set offsets of kids
        this.func.offset.set(-shift, EDGE);
        this.arg.offset.set(shift, EDGE);

        return widths;
    }
    drawTerm(parent: Term | null, ctx: CanvasRenderingContext2D, style: CSSStyleDeclaration) {
        if (parent) {
            const start = parent.pos;
            const end = this.pos;
            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.arcTo(end.x, start.y, end.x, end.y, RADIUS);
            ctx.lineTo(end.x, end.y);
            ctx.strokeStyle = style.color;
            ctx.lineWidth = 6;
            ctx.stroke();
        }

        this.arg?.drawTerm(this, ctx, style);
        this.func?.drawTerm(this, ctx, style);
        
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, RADIUS, 0, Math.PI * 2);
        ctx.strokeStyle = style.borderTopColor;

        if (this.func instanceof AbsTerm)
            ctx.fillStyle = style.color;
        else
            ctx.fillStyle = style.backgroundColor;
        
        ctx.lineWidth = 6;
        ctx.fill();
        
        ctx.stroke();
    }
    copy(shares: Map<ShareTerm, ShareTerm>): AppTerm {
        const func = this.func.copy(shares);
        const arg = this.arg.copy(shares);

        return new AppTerm(func, arg, this.pos.copy());
    }
    reduce(pos: Vec2 | null): Term | boolean {
        const func = this.func.reduce(pos);
        if (func === true) return true;
        if (func) {
            this.func = func;
            return true;
        }
        if ((this.func instanceof AbsTerm) && (!pos || pos.sub(this.pos).lengthSqr() < INFLUENCE)) {
            const body = this.func.body.replace(this.func.shr, this.arg);
            if (body)
                return body;
            return this.func.body;
        }
        const arg = this.arg.reduce(pos);
        if (arg === true) return true;
        if (arg) {
            this.arg = arg;
            return true;
        }
        return false;
    }
    replace(from: ShareTerm, to: Term): Term | null {
        const func = this.func.replace(from, to);
        if (func)
            this.func = func;
        const arg = this.arg.replace(from, to);
        if (arg)
            this.arg = arg;
        return null;
    }
}
// Kind of an end point. pointed to by ShareTerm that this term is tied to.
export class VarTerm extends Term {
    shr: ShareTerm;

    constructor(shr: ShareTerm, pos = new Vec2(0, 0)) {
        super(pos);
        this.shr = shr;
    }
    getHeight(): number {
        return 1;
    }
    setOffset(level: number, levels: Map<ShareTerm, number>): [number, number][] {   
        var weights: [number, number][] = [];
        var rem = (levels.get(this.shr) || 0) - level + 1;
        for (var i = 0; i < rem; i++)
            weights.push([0, 0]);
        return weights;
    }
    drawTerm(parent: Term | null, ctx: CanvasRenderingContext2D, style: CSSStyleDeclaration) {
        if (parent) {
            const start = parent.pos;
            const end = this.pos;
            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.arcTo(end.x, start.y, end.x, end.y-RADIUS, RADIUS);
            ctx.lineTo(end.x, end.y-RADIUS);
            ctx.strokeStyle = style.color;
            ctx.lineWidth = 6;
            ctx.stroke();
        }
        this.shr.drawTerm(this, ctx, style);
    }
    copy(shares: Map<ShareTerm, ShareTerm>): VarTerm {
        let s = shares.get(this.shr) || this.shr;
        return new VarTerm(s, this.pos.copy());
    }
    replace(from: ShareTerm, to: Term): Term | null {
        if (this.shr === from) {
            const map = new Map<ShareTerm, ShareTerm>();
            return to.copy(map);
        }
        return null;
    }
}
export class ShareTerm extends Term {
    label: string;

    constructor(label: string, pos = new Vec2(2, 2)) {
        super(pos);
        this.label = label;
    }
    getHeight(): number {
        return 1;
    }
    drawTerm(parent: Term | null, ctx: CanvasRenderingContext2D, style: CSSStyleDeclaration) {
        if (parent) {
            const start = this.pos;
            const end = parent.pos;

            ctx.beginPath();
            ctx.moveTo(end.x, end.y-RADIUS);
            ctx.lineTo(end.x, start.y-RADIUS);
            ctx.strokeStyle = style.backgroundColor;
            ctx.lineWidth = 18;
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(start.x, start.y)

            if (parent instanceof VarTerm) {
                ctx.arcTo(end.x, start.y, end.x, end.y-RADIUS, RADIUS);
                ctx.lineTo(end.x, end.y-RADIUS);
            } else {
                ctx.arcTo(start.x, end.y, end.x, end.y, RADIUS);
                ctx.lineTo(end.x, end.y);
            }
            ctx.lineTo(end.x, end.y-RADIUS);
            ctx.strokeStyle = style.color;
            ctx.lineWidth = 6;
            ctx.stroke();
        }
        
        ctx.beginPath();
        ctx.roundRect(this.pos.x-RADIUS, this.pos.y-RADIUS, RADIUS*2, RADIUS*2, RADIUS/2);
        ctx.fillStyle = style.backgroundColor;
        ctx.lineWidth = 6;
        ctx.fill();
        ctx.strokeStyle = style.borderTopColor;
        ctx.stroke();

        ctx.beginPath();
        ctx.fillStyle = style.color;
        ctx.strokeStyle = style.color;
        ctx.lineWidth = 3;
        ctx.strokeText(this.label, this.pos.x, this.pos.y);
        ctx.fillText(this.label, this.pos.x, this.pos.y);
    }
    replace(from: ShareTerm, to: Term): Term | null {
        return null;
    }
}

export class Graph {
    canvas: HTMLCanvasElement;
    root: Term | null;
    timer: number | null = null;

    tracking: boolean;
    target_zoom: number;
    target_center: Vec2;

    dragging: boolean;
    drag_start: Vec2;
    drag_last: Vec2;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.root = null;
        
        this.tracking = false;
        this.target_zoom = 6;
        this.target_center = new Vec2(30, 30);

        this.dragging = false;
        this.drag_start = new Vec2(0, 0);
        this.drag_last = new Vec2(0, 0);

        const ctx = expect(this.canvas.getContext("2d"));
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "40px 'TeX Gyre Adventor', sans-serif";

        ctx.setTransform(this.target_zoom, 0, 0, this.target_zoom, this.target_center.x, this.target_center.y);

    }
    draw() {
        const styles = getComputedStyle(this.canvas);
        const ctx = expect(this.canvas.getContext("2d"));

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.restore();

        this.root?.drawTerm(null, ctx, styles);
    }
    start() {
        if (this.timer) 
            return;
        this.timer = requestAnimationFrame(() => this.frame());
    }
    stop() {
        if (this.timer) {
            cancelAnimationFrame(this.timer);
            this.timer = null;
        }
    }
    step() {
        this.root?.step(new Vec2(0, 0));

        if (this.tracking) {
            const ctx = expect(this.canvas.getContext("2d"));
            const m = ctx.getTransform();

            const newZoom = m.a + (this.target_zoom - m.a) * SPEED;
            const cx = (this.canvas.width / 2 - m.e) / m.a;
            const cy = (this.canvas.height / 2 - m.f) / m.a;
            const newCx = cx + (this.target_center.x - cx) * SPEED;
            const newCy = cy + (this.target_center.y - cy) * SPEED;

            ctx.setTransform(newZoom, 0, 0, newZoom, this.canvas.width / 2 - newCx * newZoom, this.canvas.height / 2 - newCy * newZoom);
        }
    }
    setOffset(): [number, number][] {
        const levels = new Map<ShareTerm, number>();
        if (this.root) {
            this.root.offset.set(0, 0);
            return this.root.setOffset(0, levels);
        }
        return [];
    }
    bounds(): [number, number, number, number] {
        const top = -RADIUS * 2;
        const bottom = ((this.root?.getHeight() || 0) - 1) * EDGE;
        const widths = this.setOffset();

        var left = Infinity, right = -Infinity;
        for (var i = 0; i < widths.length; i++) {
            left = Math.min(left, widths[i][0]);
            right = Math.max(right, widths[i][1]);
        }
        left -= RADIUS * 2;
        right += RADIUS * 2;
        return [left, top, right - left, bottom - top];
    }
    reduce(pos: Vec2 | null): boolean {
        const root = this.root?.reduce(pos) || null;
        if (root instanceof Term) {
            this.root = root;
        }
        if (root) {
            this.setOffset();
            this.fitBounds();
            return true;
        }
        return false;
    }
    frame() {
        this.timer = null;
        this.draw();
        this.step();
        this.start();
    }
    fitBounds() {
        const ctx = expect(this.canvas.getContext("2d"));
        const bounds = this.bounds();

        const zoom = Math.min(this.canvas.width / bounds[2], this.canvas.height / bounds[3]);
        const center_x = bounds[0] + bounds[2] / 2;
        const center_y = bounds[1] + bounds[3] / 2;

        this.target_center.set(center_x, center_y);
        this.target_zoom = zoom;
    }
    pageToCanvas(e: MouseEvent): Vec2 {
        const rect = this.canvas.getBoundingClientRect();
        const sx = this.canvas.width / rect.width;
        const sy = this.canvas.height / rect.height;

        const x = (e.clientX - rect.left) * sx;
        const y = (e.clientY - rect.top) * sy;

        return new Vec2(x, y);
    }
    canvasToWorld(p: Vec2): Vec2 {
    const ctx = expect(this.canvas.getContext("2d"));
    const w = ctx.getTransform().inverse().transformPoint(new DOMPoint(p.x, p.y));
    return new Vec2(w.x, w.y);
    }
}