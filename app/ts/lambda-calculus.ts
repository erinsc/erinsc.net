const RADIUS = 25;
const EDGE = 50;
const SPEED = 1/25;
const LINE = 5;

const INFLUENCE = (RADIUS + LINE) * (RADIUS + LINE);

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

    constructor() {
        this.pos = new Vec2(0, 0);
        this.offset = new Vec2(0, 0);
    }
    // Move a Term towards pos + offset
    step(pos: Vec2) {
        pos.addAssign(this.offset);
        this.pos.subAssign(this.pos.sub(pos).multAssign(SPEED));
    }
    height(): number {
        return 1;
    }
    // Returns a list of max widths from the left and right of this Term for every height
    // Includes itself, which will always be [0, 0]
    setOffset(height: number, shares: Map<ShareTerm, number>): [number, number][] {
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
    reduce(pos: Vec2): [Term, ShareTerm] | null {
        return null;
    }
    replaceShare(share: ShareTerm): Term | boolean {
        return false;
    }
    copy(shares: Map<ShareTerm, ShareTerm>): Term {
        return new Term();
    }
}
// Represents an abstraction Term
class AbsTerm extends Term {
    shr: ShareTerm | null;
    body: Term | null;

    constructor(shr: ShareTerm | null, body: Term | null) {
        super();
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
    height(): number {
        const left = this.shr?.height() || 0;
        const right = this.body?.height() || 0;

        return left + right + 1;
    }
    // Body is shifted to the right by EDGE
    // Var is shifted all the way below the body
    setOffset(height: number, shares: Map<ShareTerm, number>): [number, number][] {
        var widths: [number, number][] = [[0, 0]];
        const body_height = this.body?.height() || 0;

        if (this.shr) {
            shares.set(this.shr, height+body_height+1);
        }

        if (this.body) {
            
            const right = this.body.setOffset(height+1, shares);
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
        }
        if (this.shr) {
            this.shr.offset.set(0, widths.length * EDGE);
            const left = this.shr.setOffset(height+body_height, shares);

            for(var i = 0; i < left.length; i++) {
                widths.push(left[i]);
            }
            shares.delete(this.shr);
        }

        //console.log("ABS", widths);
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
        super.drawTerm(this, ctx, style);

        ctx.beginPath();
        ctx.strokeStyle = style.color;
        ctx.lineWidth = 3;
        ctx.strokeText("λ", this.pos.x, this.pos.y);
    }
    reduce(pos: Vec2): [Term, ShareTerm] | null {
        const body = this.body?.reduce(pos) || null;
        if (body) {
            this.body = body[0];
            return [this, body[1]];
        }
        return null;
    }
    replaceShare(share: ShareTerm): Term | boolean {
        const res = this.body?.replaceShare(share) || false;
        if (res === true)
            return true;
        if (res) {
            this.body = res;
            return true;
        }
        return false;
    }
    copy(shares: Map<ShareTerm, ShareTerm>): AbsTerm {
        if (this.shr) {
            const copied_shr = new ShareTerm(this.shr?.label + "'");
            const copied = new AbsTerm(copied_shr, null);
            shares.set(this.shr, copied_shr);

            const body = this.body?.copy(shares) || null;
            copied.body = body;
            shares.delete(this.shr);
            return copied;
        } else {
            const body = this.body?.copy(shares) || null;
            return new AbsTerm(null, body);
        }
    }
}
// Represents an application
class AppTerm extends Term {
    func: Term | null;
    arg: Term | null;

    constructor(func: Term | null, arg: Term | null) {
        super();
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
    height(): number {
        const left = this.func?.height() || 0;
        const right = this.arg?.height() || 0;

        return Math.max(left, right) + 1;
    }
    setOffset(height: number, shares: Map<ShareTerm, number>): [number, number][] {
        const left = this.func?.setOffset(height + 1, shares) ?? [];
        const right = this.arg?.setOffset(height + 1, shares) ?? [];

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
        if (this.func)
            this.func.offset.set(-shift, EDGE);
        if (this.arg)
            this.arg.offset.set(shift, EDGE);

        //console.log("APP", widths);
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
        super.drawTerm(this, ctx, style);

        ctx.beginPath();
        ctx.strokeStyle = style.color;
        ctx.lineWidth = 3;
        ctx.strokeText("O", this.pos.x, this.pos.y);
    }
    reduce(pos: Vec2): [Term, ShareTerm] | null {
        //console.log("APP");
        //console.log(pos, this.pos);

        if (pos.sub(this.pos).lengthSqr() > INFLUENCE) {
            const func = this.func?.reduce(pos) || null;
            if (func) {
                this.func = func[0];
                return [this, func[1]];
            }
            const arg = this.arg?.reduce(pos) || null;
            if (arg) {
                this.arg = arg[0];
                return [this, arg[1]];
            }
            return null;
        }
        //console.log("CLOSE ENOUGH");

        if (!(this.func instanceof AbsTerm)) {
            return null;
        }
        if (!this.func.shr || !this.func.body) {
            return null;
        }
        //console.log("REDUCING");
        this.func.shr.body = this.arg;

        return [this.func.body, this.func.shr];
    }
    replaceShare(share: ShareTerm): Term | boolean {
        const func = this.func?.replaceShare(share) || false;
        if (func === true)
            return true;
        if (func) {
            this.func = func;
            return true;
        }
        const arg = this.arg?.replaceShare(share) || false;
        if (arg === true)
            return true;
        if (arg) {
            this.arg = arg;
            return true;
        }
        return false;
    }
    copy(shares: Map<ShareTerm, ShareTerm>): AppTerm {
        const func = this.func?.copy(shares) || null;
        const arg = this.arg?.copy(shares) || null;

        return new AppTerm(func, arg);
    }
}
// Kind of an end point. pointed to by ShareTerm that this term is tied to.
class VarTerm extends Term {
    shared: ShareTerm;

    constructor(shared: ShareTerm) {
        super();
        this.shared = shared;
    }
    height(): number {
        return this.shared.height() + 1;
    }
    setOffset(height: number, shares: Map<ShareTerm, number>): [number, number][] {
        const diff = (shares.get(this.shared) || 0) - height;
        var weights: [number, number][] = [];
        for (var i = 0; i < diff; i++) {
            weights.push([0, 0]);
        }
        
        return weights;
    }
    drawTerm(parent: Term | null, ctx: CanvasRenderingContext2D, style: CSSStyleDeclaration) {
        if (parent) {
            const start = parent.pos;
            const end = this.pos;
            ctx.moveTo(start.x, start.y)
            ctx.arcTo(end.x, start.y, end.x, end.y, RADIUS);
            ctx.lineTo(end.x, end.y);
            ctx.strokeStyle = style.color;
            ctx.lineWidth = 6;
            ctx.stroke();
        }
        this.shared?.drawTerm(this, ctx, style);
    }
    replaceShare(share: ShareTerm): Term | boolean {
        if (share === this.shared) {
            return share;
        }
        return false;
    }
    copy(shares: Map<ShareTerm, ShareTerm>): VarTerm {
        let s = shares.get(this.shared) || null;
        if (s)
            return new VarTerm(s);
        return new VarTerm(this.shared);
    }
}
// Represents a sharing node, pointing to all the variables sharing it
class ShareTerm extends Term {
    label: string;
    body: Term | null;

    constructor(label: string) {
        super();
        this.label = label;
        this.body = null;
    }
    step(pos: Vec2) {
        super.step(pos);
        
        if (this.body) {
            this.body.step(pos);
        }
    }
    height(): number {
        if (this.body !== null)
            return this.body.height() + 2;
        return 0;
    }
    setOffset(height: number, shares: Map<ShareTerm, number>): [number, number][] {
        if (this.body === null) {
            return [[0, 0]];
        }
        var widths = this.body.setOffset(height + 2, shares);
        widths.unshift([0, 0], [0, 0]);
        this.body.offset.set(0, EDGE*2);

        console.log("SHR", widths);
        return widths;
    }
    drawTerm(parent: Term | null, ctx: CanvasRenderingContext2D, style: CSSStyleDeclaration) {
        if (parent) {
            const start = this.pos;
            const end = parent.pos;

            ctx.beginPath();
            ctx.moveTo(end.x, end.y);
            ctx.lineTo(end.x, start.y-RADIUS);
            ctx.strokeStyle = style.backgroundColor;
            ctx.lineWidth = 18;
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(start.x, start.y)

            if (parent instanceof VarTerm)
                ctx.arcTo(end.x, start.y, end.x, end.y, RADIUS);
            else 
                ctx.arcTo(start.x, end.y, end.x, end.y, RADIUS);

            ctx.lineTo(end.x, end.y);
            ctx.strokeStyle = style.color;
            ctx.lineWidth = 6;
            ctx.stroke();
        }

        this.body?.drawTerm(this, ctx, style);

        ctx.beginPath();
        ctx.rect(this.pos.x-RADIUS, this.pos.y-RADIUS, RADIUS*2, RADIUS*2);
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
    reduce(pos: Vec2): [Term, ShareTerm] | null {
        if (!this.body)
            return null;

        if (pos.sub(this.pos).lengthSqr() > INFLUENCE) {
            return null;
        }

        const shares = new Map<ShareTerm, ShareTerm>();
        const copied = this.body.copy(shares);

        return [copied, this];
    }
    replaceShare(share: ShareTerm): Term | boolean {
        if (share === this)
            return false;
        const res = this.body?.replaceShare(share) || false;
        if (res === true)
            return true;
        if (res) {
            this.body = res;
            return true;
        }
        return false;
    }
    copy(shares: Map<ShareTerm, ShareTerm>): ShareTerm {
        let s = shares.get(this) || null;
        if (s)
            return s;
        return this;
    }
}

class Graph {
    canvas: HTMLCanvasElement;
    root: Term | null;

    dragging: boolean;
    drag_start: Vec2;
    drag_last: Vec2;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.root = null;
        
        this.dragging = false;
        this.drag_start = new Vec2(0, 0);
        this.drag_last = new Vec2(0, 0);

        const ctx = expect(this.canvas.getContext("2d"));
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "40px 'TeX Gyre Adventor', sans-serif";

        console.log("Graph constructed");
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
    }
    reduce(pos: Vec2): boolean {
        const root = this.root?.reduce(pos) || null;
        if (root) {
            this.root = root[0];
            this.root.replaceShare(root[1]);
        }
        return (root !== null);
    }
    setOffset() {
        const map = new Map<ShareTerm, number>();
        this.root?.setOffset(0, map);
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
    scopes: Record<string, ShareTerm>;

    constructor() {
        this.pos = 0;
        this.tokens = [];
        this.scopes = {};
    }
    parse(text: string): Term | null {
        this.tokens = text.match(/[\\λ.()]|[A-Za-z']+/g) || [];
        this.pos = 0;

        console.log("Parse start");
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
            const prev = this.scopes[token];

            const v = new ShareTerm(token);
            this.scopes[token] = v;

            // Recursive call
            const body = this.parseAbs();
            const term = new AbsTerm(v, body);

            // Restore previous variable
            this.scopes[token] = prev;
            return term;

        } else if (token === '.') {
            return expect(this.parseApp());
        } else {
            throw new Error("An abstraction contains something wrong: " + token);
        }
    }
    parseVar(): Term {
        const token = this.pop();
        if (token in this.scopes) {
            const v = new VarTerm(this.scopes[token]);
            return v;
        }
        console.log("FREE VARIABLE: ", token);
        return new ShareTerm(token);
    }
}

function bind(ctx: Element, graph: Graph) { 
    const c = graph.canvas;

    c.addEventListener("pointerdown", e => {
        graph.dragging = true;
        graph.drag_start = graph.pageToCanvas(e);
        graph.drag_last = graph.drag_start;
    });
    c.addEventListener("pointerup", e => {
        const ctx = expect(graph.canvas.getContext("2d"));

        graph.dragging = false;
        const p = graph.pageToCanvas(e);
        const diff = p.sub(graph.drag_start);

        if (diff.lengthSqr() <= INFLUENCE) {
            const c = graph.canvasToWorld(p);
            if (graph.reduce(c))
                graph.setOffset();
        }
    });

    c.addEventListener("pointermove", e => {
        if (!graph.dragging)
            return;

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

    const input = expect(context.querySelector("textarea"), "no input element");
    const resetBtn = expect(context.querySelector(".buttons .reset"), "no button element");

    function resetCanvas() {
        const text = input.value;
        const parser = new Parser();
        graph.root = parser.parse(text);
        graph.setOffset();
    }

    resetBtn.addEventListener('click', resetCanvas);
    resetCanvas();

    function resizeInput() {
        input.style.height = "0px";   // reset so it can also shrink
        input.style.height = input.scrollHeight + 10 + "px";
    }

    input.addEventListener("input", resizeInput);
    resizeInput();
}

const context = document.getElementsByClassName("lc-sim")[0];
const canvas = expect(context.querySelector("canvas"));
const ctx = canvas.getContext("2d");
const graph = new Graph(canvas);
const parser = new Parser();
bind(context, graph);

requestAnimationFrame(() => graph.frame());

// (\n f x.n f(f x))(\f x.f(f(x)))

