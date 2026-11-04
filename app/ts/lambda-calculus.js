"use strict";
const RADIUS = 25;
const EDGE = 50;
const SPEED = 1 / 32;
function expect(value, msg = "unexpected null type") {
    if (value == null)
        throw new Error(msg);
    return value;
}
class Vec2 {
    x;
    y;
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
    set(x, y) {
        this.x = x;
        this.y = y;
    }
    copy() {
        const v = new Vec2(this.x, this.y);
        return v;
    }
    addAssign(other) {
        this.x += other.x;
        this.y += other.y;
        return this;
    }
    invertAssign() {
        this.x = -this.x;
        this.y = -this.y;
        return this;
    }
    add(other) {
        var v = this.copy();
        return v.addAssign(other);
    }
    subAssign(other) {
        this.x -= other.x;
        this.y -= other.y;
        return this;
    }
    sub(other) {
        var v = this.copy();
        return v.subAssign(other);
    }
    multAssign(val) {
        this.x *= val;
        this.y *= val;
        return this;
    }
    lengthSqr() {
        return this.x * this.x + this.y * this.y;
    }
}
class Term {
    pos;
    offset;
    constructor() {
        this.pos = new Vec2(0, 0);
        this.offset = new Vec2(0, 0);
    }
    // Move a Term towards pos + offset
    step(pos) {
        pos.addAssign(this.offset);
        this.pos.subAssign(this.pos.sub(pos).multAssign(SPEED));
    }
    // Returns a list of max widths from the left and right of this Term for every height
    // Includes itself, which will always be [0, 0]
    setOffset() {
        return [[0, 0]];
    }
    drawTerm(parent, ctx, style) {
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = style.backgroundColor;
        ctx.fill();
        ctx.strokeStyle = style.borderTopColor;
        ctx.stroke();
    }
    reduce(pos) {
        return null;
    }
}
// Represents an abstraction Term
class AbsTerm extends Term {
    var;
    body;
    constructor(shr, body) {
        super();
        this.var = shr;
        this.body = body;
    }
    step(pos) {
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
    setOffset() {
        var widths = [[0, 0]];
        if (this.body) {
            const right = this.body.setOffset();
            var shift = -Infinity;
            for (var i = 0; i < right.length; i++) {
                shift = Math.max(shift, -right[i][0]);
            }
            shift += EDGE;
            for (var i = 0; i < right.length; i++) {
                const l = right[i][0] + shift;
                const r = right[i][1] + shift;
                widths.push([l, r]);
            }
            this.body.offset.set(shift, EDGE);
        }
        widths.push([0, 0]);
        if (this.var) {
            this.var.offset.set(0, widths.length * EDGE);
            this.var.visited = false;
            const left = this.var.setOffset();
            for (var i = 0; i < left.length; i++) {
                widths.push(left[i]);
            }
        }
        console.log("ABS", widths);
        return widths;
    }
    drawTerm(parent, ctx, style) {
        ctx.strokeStyle = style.border;
        ctx.lineWidth = 6;
        if (parent) {
            const start = this.pos.add(new Vec2(0, -RADIUS));
            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(parent.pos.x, parent.pos.y);
            ctx.stroke();
        }
        this.body?.drawTerm(this, ctx, style);
        if (this.var) {
            this.var.visited = false;
            this.var.drawTerm(this, ctx, style);
        }
        super.drawTerm(this, ctx, style);
        ctx.strokeStyle = style.color;
        ctx.lineWidth = 3;
        ctx.strokeText("λ", this.pos.x, this.pos.y);
    }
    reduce(pos) {
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
    func;
    arg;
    constructor(func, arg) {
        super();
        this.func = func;
        this.arg = arg;
    }
    step(pos) {
        super.step(pos);
        if (this.func)
            this.func.step(pos.copy());
        if (this.arg)
            this.arg.step(pos);
    }
    setOffset() {
        const left = this.func?.setOffset() ?? [];
        const right = this.arg?.setOffset() ?? [];
        const min_height = Math.min(left.length, right.length);
        // Find the widest distance between the trees, at equal levels
        var shift = 0;
        for (var i = 0; i < min_height; i++) {
            const current = left[i][1] - right[i][0];
            shift = Math.max(shift, current);
        }
        // Includes padding and shift from center
        shift = shift / 2;
        if (min_height > 0) {
            shift += EDGE;
        }
        // build width graph, first from both sides...
        var widths = [[0, 0]];
        for (var i = 0; i < min_height; i++) {
            const l = left[i][0] - shift;
            const r = right[i][1] + shift;
            widths.push([l, r]);
        }
        // Then complete whichever branch was longer
        for (var i = min_height; i < left.length; i++) {
            const l = left[i][0] - shift;
            const r = left[i][1] - shift;
            widths.push([l, r]);
        }
        for (var i = min_height; i < right.length; i++) {
            const l = right[i][0] + shift;
            const r = right[i][1] + shift;
            widths.push([l, r]);
        }
        // Set offsets of kids
        if (this.func)
            this.func.offset.set(-shift, EDGE);
        if (this.arg)
            this.arg.offset.set(shift, EDGE);
        console.log("APP", widths);
        return widths;
    }
    drawTerm(parent, ctx, style) {
        ctx.strokeStyle = style.border;
        ctx.lineWidth = 6;
        if (parent) {
            const start = this.pos.add(new Vec2(0, -RADIUS));
            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(parent.pos.x, parent.pos.y);
            ctx.stroke();
        }
        this.func?.drawTerm(this, ctx, style);
        this.arg?.drawTerm(this, ctx, style);
        super.drawTerm(this, ctx, style);
        ctx.strokeStyle = style.color;
        ctx.lineWidth = 3;
        ctx.strokeText("O", this.pos.x, this.pos.y);
    }
    reduce(pos) {
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
    label;
    body;
    visited;
    constructor(label) {
        super();
        this.label = label;
        this.body = null;
        this.visited = true;
    }
    step(pos) {
        if (this.visited)
            return;
        this.visited = true;
        super.step(pos);
        if (this.body) {
            this.body.step(pos);
        }
    }
    setOffset() {
        if (this.visited)
            return [[0, 0]];
        this.visited = true;
        if (this.body === null) {
            return [[0, 0]];
        }
        var widths = this.body.setOffset();
        widths.unshift([0, 0]);
        this.body.offset.set(0, EDGE);
        console.log("SHR", widths);
        return widths;
    }
    drawTerm(parent, ctx, style) {
        ctx.strokeStyle = style.border;
        ctx.lineWidth = 6;
        if (parent) {
            const start = this.pos;
            const end = parent.pos;
            const mid = new Vec2(end.x, start.y);
            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(mid.x, mid.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();
        }
        if (this.visited) {
            return;
        }
        this.visited = true;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.rect(this.pos.x - RADIUS, this.pos.y - RADIUS, RADIUS * 2, RADIUS * 2);
        ctx.fillStyle = style.backgroundColor;
        ctx.fill();
        ctx.strokeStyle = style.borderTopColor;
        ctx.stroke();
        ctx.strokeStyle = style.color;
        ctx.lineWidth = 3;
        ctx.strokeText(this.label, this.pos.x, this.pos.y);
        this.body?.drawTerm(this, ctx, style);
    }
    // NOTE: This can get called multiple times in a single cycle, so reduction checking isnt O(n)
    // im not sure how to fix it. options include:
    //     the term tracks the parents, or number of parents - hard to do, would be unreliable
    //     external utility tracks all share nodes - data doubling, not good
    //     the term tracks its left-most parent - ehhhh
    reduce(pos) {
        if (!this.body)
            return null;
        // TODO: implement a copy method, which will create a copy of the entire subtree and return it
        // This will create a copy even for the last shared body, but thats fiiine, its fine
        return null;
    }
}
class Graph {
    canvas;
    root;
    dragging;
    drag_start;
    offset;
    constructor(canvas) {
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
        this.root?.drawTerm(null, ctx, styles);
    }
    step() {
        this.root?.step(new Vec2(0, 0));
    }
    reduce(pos) {
        const root = this.root?.reduce(pos) || null;
        if (root)
            this.root = root;
        return (root instanceof Term);
    }
    setOffset() {
        this.root?.setOffset();
    }
    frame() {
        this.draw();
        this.step();
        requestAnimationFrame(() => this.frame());
    }
    toWorld(e) {
        const rect = this.canvas.getBoundingClientRect();
        const sx = this.canvas.width / rect.width;
        const sy = this.canvas.height / rect.height;
        const x = (e.clientX - rect.left) * sx;
        const y = (e.clientY - rect.top) * sy;
        return new Vec2(x, y);
    }
}
class Parser {
    pos;
    tokens;
    scopes;
    constructor() {
        this.pos = 0;
        this.tokens = [];
        this.scopes = {};
    }
    parse(text) {
        this.tokens = text.match(/[\\λ.()]|[A-Za-z']+/g) || [];
        this.pos = 0;
        console.log("Parse start");
        return this.parseApp();
    }
    isVar(t) {
        return t !== undefined && /^[A-Za-z']+$/.test(t);
    }
    isLambda(t) {
        return t === "\\" || t === "λ";
    }
    pop() {
        const token = this.tokens[this.pos];
        this.pos++;
        return token;
    }
    // Parses a chain of applications, including only one Term
    parseApp() {
        var left = null;
        var right = null;
        while (true) {
            const token = this.tokens[this.pos];
            if (this.isVar(token)) {
                right = this.parseVar();
            }
            else if (this.isLambda(token)) {
                this.pop(); // Spend the lambda
                right = this.parseAbs();
            }
            else if (token == '(') {
                this.pop(); // Spend the opening bracket
                right = this.parseApp();
                this.pop(); // Spend the closing bracket
            }
            else if (token == ')' || token == undefined) {
                return expect(left);
            }
            else {
                throw new Error("Application contains something wrong: " + token);
            }
            if (left) {
                left = new AppTerm(left, right);
            }
            else {
                left = right;
            }
        }
    }
    // Parses an abstraction. can parse the shortform of it too
    parseAbs() {
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
        }
        else if (token == '.') {
            return this.parseApp();
        }
        else {
            throw new Error("An abstraction contains something wrong: " + token);
        }
    }
    parseVar() {
        const token = this.pop();
        if (token in this.scopes) {
            return this.scopes[token];
        }
        console.log("FREE VARIABLE: ", token);
        return new ShareTerm(token);
    }
}
function bind(ctx, graph) {
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
        input.style.height = "0px"; // reset so it can also shrink
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
