const RADIUS = 25;
const LINE = 5;
const EDGE = RADIUS * 2 + LINE * 2;
const SPEED = 1/25;
const INFLUENCE = RADIUS * RADIUS * 8;

function expect<T>(value: T | null | undefined, msg = "unexpected null type"): T {
    if (value == null)
        throw new Error(msg);
    return value;
}

class Vec2 {
    x: number;
    y: number;

    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
    }
    set(x: number, y: number) {
        this.x = x;
        this.y = y;
    }
    copy() {
        const v = new Vec2(this.x, this.y);
        return v;
    }
    addAssign(other: Vec2) {
        this.x += other.x;
        this.y += other.y;
        return this;
    }
    invertAssign() {
        this.x = -this.x;
        this.y = -this.y;
        return this;
    }
    add(other: Vec2) {
        var v = this.copy();
        return v.addAssign(other);
    }
    subAssign(other: Vec2) {
        this.x -= other.x;
        this.y -= other.y;
        return this;
    }
    sub(other: Vec2) {
        var v = this.copy();
        return v.subAssign(other);
    }
    multAssign(val: number) {
        this.x *= val;
        this.y *= val;
        return this
    }
    lengthSqr() {
        return this.x * this.x + this.y * this.y;
    }
}

class Term {
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
class AbsTerm extends Term {
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
        ctx.lineWidth = 3;
        ctx.strokeText("λ", this.pos.x, this.pos.y+2);
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
class AppTerm extends Term {
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
class VarTerm extends Term {
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
        var rem = expect(levels.get(this.shr)) - level + 1;
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
    // TODO: Fix copying if body is a single variable. it doesnt seem to copy at all
    copy(shares: Map<ShareTerm, ShareTerm>): VarTerm {
        console.log("VAR COPIED", this.shr.label);
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
class ShareTerm extends Term {
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

            if (parent instanceof VarTerm)
                ctx.arcTo(end.x, start.y, end.x, end.y-RADIUS, RADIUS);

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
        ctx.strokeStyle = style.color;
        ctx.lineWidth = 3;
        ctx.strokeText(this.label, this.pos.x, this.pos.y);
    }
    replace(from: ShareTerm, to: Term): Term | null {
        return null;
    }
}

class Graph {
    canvas: HTMLCanvasElement;
    root: Term | null;

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
        this.target_zoom = 1;
        this.target_center = new Vec2(0, 0);

        this.dragging = false;
        this.drag_start = new Vec2(0, 0);
        this.drag_last = new Vec2(0, 0);

        const ctx = expect(this.canvas.getContext("2d"));
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "40px 'TeX Gyre Adventor', sans-serif";
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
            this.setOffset();
            return true;
        }
        if (root) {
            this.setOffset();
            return true;
        }
        return false;
    }
    frame() {
        this.draw();
        this.step();

        requestAnimationFrame(() => this.frame());
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
class Parser {
    pos: number;
    tokens: string[];
    shares: Map<string, ShareTerm>;

    constructor() {
        this.pos = 0;
        this.tokens = [];
        this.shares = new Map<string, ShareTerm>();
    }
    parse(text: string): Term | null {
        this.tokens = text.match(/[\\λ.()]|[A-Za-z']+/g) || [];
        this.pos = 0;

        return this.parseApp();
    }
    isVar(t: string): boolean {
        return t !== undefined && /^[A-Za-z']+$/.test(t);
    }
    isLambda(t: string): boolean {
        return t === "\\" || t === "λ";
    }
    pop(): string {
        const token = this.tokens[this.pos];
        this.pos++;
        return token;
    }
    // Parses a chain of applications, including only one Term
    parseApp(): Term | null {
        var left = null;
        var right = null;

        while (true) {
            const token = this.tokens[this.pos];

            if (this.isVar(token)) {
                right = this.parseVar();
            } else if (this.isLambda(token)) {
                this.pop(); // Spend the lambda
                right = this.parseAbs();
            } else if (token === '(') {
                this.pop(); // Spend the opening bracket
                right = this.parseApp();
                this.pop(); // Spend the closing bracket
            } else if (token === ')' || token === undefined) {
                return left;
            } else {
                throw new Error("Application contains something wrong: " + token);
            }

            if (left) {
                if (right)
                    left = new AppTerm(left, right);
            } else {
                left = right;
            }
        }
    }
    // Parses an abstraction. can parse the shortform of it too
    parseAbs(): Term {
        const token = this.pop();
        if (this.isVar(token)) {
            // In case the variable name already exists, pop out temporarily
            const prev = this.shares.get(token);

            const v = new ShareTerm(token);
            this.shares.set(token, v);

            // Recursive call
            const body = this.parseAbs();
            const term = new AbsTerm(v, body);

            // Restore previous variable
            if (prev)
                this.shares.set(token, prev);
            return term;

        } else if (token === '.') {
            return expect(this.parseApp());
        } else {
            throw new Error("An abstraction contains something wrong: " + token);
        }
    }
    parseVar(): Term {
        const token = this.pop();
        const shr = this.shares.get(token);
        if (shr) {
            const v = new VarTerm(shr);
            return v;
        }
        return new ShareTerm(token);
    }
}

function bind(ctx: Element) { 
    const canvas = expect(ctx.querySelector("canvas"));
    const graph = new Graph(canvas);
    const c = graph.canvas;

    // TODO: create camera focusing thing

    c.addEventListener("pointerdown", e => {
        graph.dragging = true;
        graph.drag_start = graph.pageToCanvas(e);
        graph.drag_last = graph.drag_start;
    });
    function canvasStopMoving(e: PointerEvent) {
        const ctx = expect(graph.canvas.getContext("2d"));

        graph.dragging = false;
        const p = graph.pageToCanvas(e);
        const diff = p.sub(graph.drag_start);

        if (diff.lengthSqr() <= INFLUENCE) {
            const c = graph.canvasToWorld(p);
            graph.reduce(c);
            graph.setOffset();
        }
    }
    c.addEventListener("pointerup", e => canvasStopMoving(e));
    c.addEventListener("pointerleave", e => canvasStopMoving(e));
    c.addEventListener("pointercancel", e => canvasStopMoving(e));

    c.addEventListener("pointermove", e => {
        if (!graph.dragging)
            return;

        graph.tracking = false;
        const ctx = expect(graph.canvas.getContext("2d"));
        const p = graph.pageToCanvas(e);
        const zoom = ctx.getTransform().a;

        const diff = p.sub(graph.drag_last);
        graph.drag_last = p;

        ctx.translate(diff.x / zoom, diff.y / zoom);
    });
    c.addEventListener("wheel", e => {
        e.preventDefault(); 
        const ctx = expect(graph.canvas.getContext("2d"));
        const scale = 1 + Math.sign(-e.deltaY) / 10;

        const p = graph.pageToCanvas(e);
        const w = ctx.getTransform().inverse().transformPoint(new DOMPoint(p.x, p.y));

        ctx.translate(w.x, w.y);
        ctx.scale(scale, scale);
        ctx.translate(-w.x, -w.y);
    }, { passive: false });

    const input = expect(ctx.querySelector("textarea"), "no input element");
    const resetBtn = expect(ctx.querySelector(".buttons .reset"), "no button element");

    function resetCanvas() {
        const text = input.value;
        const parser = new Parser();
        graph.root = parser.parse(text);
        graph.setOffset();
        fitBounds();
    }

    resetBtn.addEventListener('click', resetCanvas);
    resetCanvas();

    function resizeInput() {
        input.style.height = "0px";   // reset so it can also shrink
        input.style.height = input.scrollHeight + 10 + "px";
    }

    input.addEventListener("input", resizeInput);
    resizeInput();

    let autoTimer: number | null = null;
    let autoDelay: number = 1000;
    const autoBtn = expect(ctx.querySelector(".buttons .auto"), "no button element");

    function autoReduce() {
        if (autoBtn.getAttribute('aria-pressed') !== 'true')
            return;

        if (!graph.reduce(null)) {
            autoBtn.setAttribute('aria-pressed', 'false');
            return;
        }
        fitBounds();
        autoTimer = window.setTimeout(autoReduce, autoDelay);
    }
    autoBtn.addEventListener('click', () => {
        const reversed = autoBtn.getAttribute('aria-pressed') === 'true';
        autoBtn.setAttribute('aria-pressed', (!reversed).toString());

        autoReduce();
    })

    const fastBtn = expect(ctx.querySelector(".buttons .fast"), "no button element");
    fastBtn.addEventListener('click', () => {
        const reversed = fastBtn.getAttribute('aria-pressed') === 'true';
        fastBtn.setAttribute('aria-pressed', (!reversed).toString());

        autoDelay = reversed ? 1000 : 10;
    })

    const examples = expect(ctx.querySelector<HTMLSelectElement>(".examples"), "no examples select");
    examples.addEventListener("change", () => {
        input.value = examples.value;
        resetCanvas();
        resizeInput();
    });

    function fitBounds() {
        const ctx = expect(graph.canvas.getContext("2d"));
        const bounds = graph.bounds();

        const zoom = Math.min(canvas.width / bounds[2], canvas.height / bounds[3]);
        const center_x = bounds[0] + bounds[2] / 2;
        const center_y = bounds[1] + bounds[3] / 2;

        graph.target_center.set(center_x, center_y);
        graph.target_zoom = zoom;
        graph.tracking = true;
    }

    requestAnimationFrame(() => graph.frame());
}

const context = document.getElementsByClassName("lc-sim");

for (var i = 0; i < context.length; i++) {
    bind(context[i]);
}

// (\n f x.n f(f x))(\f x.f(f(x)))

