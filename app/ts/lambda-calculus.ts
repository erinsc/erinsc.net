const RADIUS = 32;
const EDGE = 128;
const SPEED = 1/32;

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
    // Returns a list of max widths from the left and right of this Term for every height
    setOffset(): [number, number][] {
        return [];
    }
    drawTerm(ctx: CanvasRenderingContext2D, style: CSSStyleDeclaration) {
        ctx.lineWidth = 6;

        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = style.backgroundColor;
        ctx.fill();

        ctx.strokeStyle = style.borderTopColor;
        ctx.stroke();
    }
    reduce(pos: Vec2): Term | null {
        return null;
    }
}
// Represents an abstraction Term
class AbsTerm extends Term {
    var: ShareTerm | null;
    body: Term | null;

    constructor() {
        super();
        this.var = null;
        this.body = null;
    }
    step(pos: Vec2) {
        super.step(pos);

        if (this.var) {
            this.var.visited = false;
            this.var.step(pos.copy());
        }
        if (this.body) {
            this.body.step(pos);
        }
    }
    // Body is shifted to the right by EDGE
    // Var is shifted all the way below the body
    setOffset(): [number, number][] {
        var widths: [number, number][] = [];

        const right = this.body?.setOffset() ?? [];

        if (this.var)
            this.var.visited = false;
        const left = this.var?.setOffset() ?? [];

        for(var i = 0; i < right.length; i++) {
            const l = right[i][0] + EDGE;
            const r = right[i][1] + EDGE;
            widths.push([l, r]);
        }
        widths.push([0, 0]);

        for(var i = 0; i < left.length; i++) {
            widths.push(left[i]);
        }
        // Set offsets of kids
        if (this.body) {
            this.body.offset.set(EDGE, EDGE);
            widths.push([0, EDGE]);
        }
        if (this.var)
            this.var.offset.set(0, widths.length * EDGE);
   
        return widths;
    }
    drawTerm(ctx: CanvasRenderingContext2D, style: CSSStyleDeclaration) {
        ctx.strokeStyle = style.border;
        ctx.lineWidth = 6;
        if (this.body) {
            ctx.beginPath();
            ctx.moveTo(this.pos.x, this.pos.y);
            ctx.lineTo(this.body.pos.x, this.body.pos.y);
            ctx.stroke();
        }
        if (this.var) {
            ctx.beginPath();
            ctx.moveTo(this.pos.x, this.pos.y);
            ctx.lineTo(this.var.pos.x, this.var.pos.y);
            ctx.stroke();
        }
            
        super.drawTerm(ctx, style);
        ctx.strokeStyle = style.color;
        ctx.lineWidth = 3;
        ctx.strokeText("λ", this.pos.x, this.pos.y);

        this.body?.drawTerm(ctx, style);
        if (this.var) {
            this.var.visited = false;
            this.var.drawTerm(ctx, style);
        }
    }
    reduce(pos: Vec2): Term | null {
        const body = this.body?.reduce(pos) || null;
        if (body) {
            this.body = body;
            return this;
        }
        return null;
    }
}
// Represents an application
class AppTerm extends Term {
    func: Term | null;
    arg: Term | null;

    constructor() {
        super();
        this.func = null;
        this.arg = null;
    }
    step(pos: Vec2) {
        super.step(pos);
        
        if (this.func)
            this.func.step(pos.copy());
        if (this.arg)
            this.arg.step(pos);
    }
    setOffset(): [number, number][] {
        const left = this.func?.setOffset() ?? [];
        const right = this.arg?.setOffset() ?? [];

        const min_height = Math.min(left.length, right.length);

        // Find the widest distance between the trees, at equal levels
        var shift = 0;
        for(var i = 0; i < min_height; i++) {
            const current = left[i][1] + right[i][0];
            shift = Math.max(shift, current);
        }
        // Includes padding and shift from center
        shift = shift / 2 + EDGE;

        // build width graph, first from both sides...
        var widths: [number, number][] = [];
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

        // NOTE: this is wrong. if either branch is not present, the width should be 0.
        // However its not a valid state for a branch to be missing in the first place, so it stays.
        widths.unshift([-shift, shift]);

        // Set offsets of kids
        if (this.func)
            this.func.offset.set(-shift, EDGE);
        if (this.arg)
            this.arg.offset.set(shift, EDGE);

        return widths;
    }
    drawTerm(ctx: CanvasRenderingContext2D, style: CSSStyleDeclaration) {
        ctx.strokeStyle = style.border;
        ctx.lineWidth = 6;
        if (this.func) {
            ctx.beginPath();
            ctx.moveTo(this.pos.x, this.pos.y);
            ctx.lineTo(this.func.pos.x, this.func.pos.y);
            ctx.stroke();
        }
        if (this.arg) {
            ctx.beginPath();
            ctx.moveTo(this.pos.x, this.pos.y);
            ctx.lineTo(this.arg.pos.x, this.arg.pos.y);
            ctx.stroke();
        }

        super.drawTerm(ctx, style);
        ctx.strokeStyle = style.color;
        ctx.lineWidth = 3;
        ctx.strokeText("O", this.pos.x, this.pos.y);

        this.func?.drawTerm(ctx, style);
        this.arg?.drawTerm(ctx, style);
    }
    reduce(pos: Vec2): Term | null {
        if (pos.sub(this.pos).lengthSqr() > RADIUS * RADIUS) {
            const func = this.func?.reduce(pos) || null;
            if (func) {
                this.func = func;
                return this;
            }
            const arg = this.arg?.reduce(pos) || null;
            if (arg) {
                this.arg = arg;
                return this;
            }
            return null;
        }

        if (!(this.func instanceof AbsTerm)) {
            return null;
        }
        if (!this.func.var || !this.func.body) {
            return null;
        }
        this.func.var.body = this.arg;

        return this.func.body;
    }
}
// Represents a variable, shared among multiple places
class ShareTerm extends Term {
    label: string;
    body: Term | null;
    visited: boolean;

    constructor(label: string) {
        super();
        this.label = label;
        this.body = null;
        this.visited = true;
    }
    step(pos: Vec2) {
        if (this.visited)
            return;
        this.visited = true;
        super.step(pos);
        
        if (this.body) {
            this.body.step(pos);
        }
    }
    setOffset(): [number, number][] {
        if (this.visited)
            return [];
        this.visited = true;
        if (this.body === null) {
            return [];
        }
        var widths = this.body.setOffset();
        widths.unshift([0, 0]);
        this.body.offset.set(0, EDGE);
        return widths;
    }
    drawTerm(ctx: CanvasRenderingContext2D, style: CSSStyleDeclaration) {
        ctx.strokeStyle = style.border;
        ctx.lineWidth = 6;
        if (this.body) {
            ctx.beginPath();
            ctx.moveTo(this.pos.x, this.pos.y);
            ctx.lineTo(this.body.pos.x, this.body.pos.y);
            ctx.stroke();
        }

        if (this.visited) {
            return;
        }
        this.visited = true;

        ctx.lineWidth = 6;

        ctx.beginPath();
        ctx.rect(this.pos.x-RADIUS, this.pos.y-RADIUS, RADIUS*2, RADIUS*2);
        ctx.fillStyle = style.backgroundColor;
        ctx.fill();

        ctx.strokeStyle = style.borderTopColor;
        ctx.stroke();

        ctx.strokeStyle = style.color;
        ctx.lineWidth = 3;
        ctx.strokeText(this.label, this.pos.x, this.pos.y);

        this.body?.drawTerm(ctx, style);
    }
    // NOTE: This can get called multiple times in a single cycle, so reduction checking isnt O(n)
    // im not sure how to fix it. options include:
    //     the term tracks the parents, or number of parents - hard to do, would be unreliable
    //     external utility tracks all share nodes - data doubling, not good
    //     the term tracks its left-most parent - ehhhh
    reduce(pos: Vec2): Term | null {
        if (!this.body)
            return null;

        // TODO: implement a copy method, which will create a copy of the entire subtree and return it
        // This will create a copy even for the last shared body, but thats fiiine, its fine
        return null;
    }
}

class Graph {
    canvas: HTMLCanvasElement;
    root: Term | null;

    dragging: boolean;
    drag_start: Vec2;
    offset: Vec2;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.root = null;
        
        this.dragging = false;
        this.drag_start = new Vec2(0, 0);
        this.offset = new Vec2(0, 0);

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

        this.root?.drawTerm(ctx, styles);
    }
    step() {
        this.root?.step(new Vec2(0, 0));
    }
    reduce(pos: Vec2): boolean {
        const root = this.root?.reduce(pos) || null;
        if (root)
            this.root = root;
        return (root instanceof Term);
    }
    frame() {
        this.draw();
        this.step();
        //console.log("Frame finished");
        requestAnimationFrame(() => this.frame());
    }
    toWorld(e: MouseEvent) {
        const rect = this.canvas.getBoundingClientRect();
        const sx = this.canvas.width / rect.width;
        const sy = this.canvas.height / rect.height;

        const x = (e.clientX - rect.left) * sx;
        const y = (e.clientY - rect.top) * sy;

        return new Vec2(x, y);
    }
}

function bind(graph: Graph) { 
    const c = graph.canvas;

    c.addEventListener("pointerdown", e => {
        graph.dragging = true;
        graph.drag_start = graph.toWorld(e);
        graph.offset = graph.drag_start;
    });
    c.addEventListener("pointerup", e => {
        graph.dragging = false;
        const end = graph.toWorld(e);
        const diff = end.sub(graph.drag_start);

        if (diff.lengthSqr() <= RADIUS * RADIUS) {
            graph.reduce(end);
        }
    });

    c.addEventListener("pointermove", e => {
        if (!graph.dragging)
            return;

        const ctx = expect(graph.canvas.getContext("2d"));
        const p = graph.toWorld(e);
        const zoom = ctx.getTransform().a;

        ctx.translate((p.x - graph.offset.x) / zoom, (p.y - graph.offset.y) / zoom);
        graph.offset = p;
    });
    c.addEventListener("wheel", e => {
        e.preventDefault(); 
        const ctx = expect(graph.canvas.getContext("2d"));
        const scale = 1 + Math.sign(-e.deltaY) / 10;

        const p = graph.toWorld(e);
        const w = ctx.getTransform().inverse().transformPoint(new DOMPoint(p.x, p.y));

        ctx.translate(w.x, w.y);
        ctx.scale(scale, scale);
        ctx.translate(-w.x, -w.y);
    }, { passive: false });
}

const context = document.getElementsByClassName("lc-sim")[0];
const canvas = expect(context.querySelector("canvas"));
const ctx = canvas.getContext("2d");
const graph = new Graph(canvas);
bind(graph);

const root = new AppTerm();

const func = new AbsTerm();
const arg =  new AbsTerm();
root.func = func;
root.arg = arg;

const shr = new ShareTerm("x");
const body = new AppTerm();
func.var = shr;
func.body = body;
body.func = shr;
body.arg = shr;

const shr2 = new ShareTerm("y");
arg.var = shr2;

graph.root = root;

root.setOffset();

requestAnimationFrame(() => graph.frame());