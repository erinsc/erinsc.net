import { Graph, AppTerm, AbsTerm, ShareTerm, VarTerm } from "./lc-graph.js";
import { INFLUENCE } from "./lc-graph.js";
function expect(value, msg = "unexpected null type") {
    if (value == null)
        throw new Error(msg);
    return value;
}
class State {
    constructor(tokens) {
        this.pos = 0;
        this.tokens = tokens;
    }
}
class Parser {
    constructor() {
        this.shares = new Map();
        this.shorthands = {
            "TRUE": "\\t f.t",
            "FALSE": "\\t f.f",
            "NOT": "\\b t f.b f t",
            "AND": "\\a b.a b a",
            "OR": "\\a b.a a b",
            "XOR": "\\a b.a (NOT b) b",
            "0": "\\f x.x",
            "1": "\\f x.f x",
            "2": "\\f x.f(f x)",
            "3": "\\f x.f(f(f x))",
            "4": "\\f x.f(f(f(f x)))",
            "5": "\\f x.f(f(f(f(f x))))",
            "6": "\\f x.f(f(f(f(f(f x)))))",
            "7": "\\f x.f(f(f(f(f(f(f x))))))",
            "8": "\\f x.f(f(f(f(f(f(f(f x)))))))",
            "9": "\\f x.f(f(f(f(f(f(f(f(f x))))))))",
            "INC": "\\n.\\f x.n f (f x)",
            "ADD": "\\a b.a INC b",
            "MULT": "\\a b.a (ADD b) 0",
            "EXP": "\\a b.b (MULT a) 1",
            "DEC": "\\n.n (\\h.\\g.g (h INC)) (\\g.0) (\\i.i)",
            "SUB": "\\a b.a DEC b"
        };
    }
    parse(text) {
        const state = new State(text.match(/[\\λ.()]|[0-9A-Za-z']+/g) || []);
        const root = this.parseApp(state);
        return root;
    }
    isVar(t) {
        return t !== undefined && /^[a-z']+$/.test(t);
    }
    isShorthand(t) {
        return t !== undefined && /^[0-9A-Z']+$/.test(t);
    }
    isLambda(t) {
        return t === "\\" || t === "λ";
    }
    pop(state) {
        const token = state.tokens[state.pos];
        state.pos++;
        return token;
    }
    // Parses a chain of applications, including only one Term
    parseApp(state) {
        var left = null;
        var right = null;
        while (true) {
            const token = state.tokens[state.pos];
            if (this.isVar(token)) {
                right = this.parseVar(state);
            }
            else if (this.isShorthand(token)) {
                this.pop(state); // Spend the shorthand
                if (this.shorthands[token] === undefined) {
                    throw new Error("Shorthand is not defined: " + token);
                }
                right = this.parse(this.shorthands[token]);
            }
            else if (this.isLambda(token)) {
                this.pop(state); // Spend the lambda
                right = this.parseAbs(state);
            }
            else if (token === '(') {
                this.pop(state); // Spend the opening bracket
                right = this.parseApp(state);
                this.pop(state); // Spend the closing bracket
            }
            else if (token === ')' || token === undefined) {
                return left;
            }
            else {
                throw new Error("Application contains something wrong: " + token);
            }
            if (left) {
                if (right)
                    left = new AppTerm(left, right);
            }
            else {
                left = right;
            }
        }
    }
    // Parses an abstraction. can parse the shortform of it too
    parseAbs(state) {
        const token = this.pop(state);
        if (this.isVar(token)) {
            // In case the variable name already exists, pop out temporarily
            const prev = this.shares.get(token);
            const v = new ShareTerm(token);
            this.shares.set(token, v);
            // Recursive call
            const body = this.parseAbs(state);
            const term = new AbsTerm(v, body);
            // Restore previous variable
            if (prev)
                this.shares.set(token, prev);
            else
                this.shares.delete(token);
            return term;
        }
        else if (token === '.') {
            return expect(this.parseApp(state));
        }
        else {
            throw new Error("An abstraction contains something wrong: " + token);
        }
    }
    parseVar(state) {
        const token = this.pop(state);
        const shr = this.shares.get(token);
        if (shr) {
            const v = new VarTerm(shr);
            return v;
        }
        return new ShareTerm(token);
    }
}
const visibility = new Map();
function bind(ctx) {
    const canvas = expect(ctx.querySelector("canvas"));
    const graph = new Graph(canvas);
    const c = graph.canvas;
    // TODO: create camera focusing thing
    c.addEventListener("pointerdown", e => {
        graph.dragging = true;
        graph.drag_start = graph.pageToCanvas(e);
        graph.drag_last = graph.drag_start;
    });
    function canvasStopMoving(e) {
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
        graph.tracking = false;
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
    const resetBtnElem = ctx.querySelector(".buttons .reset");
    const errorLine = expect(ctx.querySelector(".error"), "no error line");
    function resetCanvas() {
        const text = input.value;
        const parser = new Parser();
        try {
            graph.root = parser.parse(text);
            graph.setOffset();
            graph.fitBounds();
            graph.tracking = true;
            errorLine.textContent = "";
        }
        catch (e) {
            errorLine.textContent = e;
        }
    }
    if (resetBtnElem) {
        const resetBtn = resetBtnElem;
        resetBtn.addEventListener('click', resetCanvas);
    }
    input.addEventListener("keydown", e => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            resetCanvas();
        }
    });
    resetCanvas();
    function resizeInput() {
        input.style.height = "0px"; // reset so it can also shrink
        input.style.height = input.scrollHeight + 10 + "px";
    }
    input.addEventListener("input", resizeInput);
    resizeInput();
    let autoTimer = null;
    let autoDelay = 1000;
    const autoBtnElem = ctx.querySelector(".buttons .auto");
    if (autoBtnElem) {
        const autoBtn = autoBtnElem; // Hack to prevent the typescript type checker from complaining
        function autoReduce() {
            if (autoBtn.getAttribute('aria-pressed') !== 'true')
                return;
            if (!graph.reduce(null)) {
                autoBtn.setAttribute('aria-pressed', 'false');
                return;
            }
            graph.fitBounds();
            autoTimer = window.setTimeout(autoReduce, autoDelay);
        }
        autoBtn.addEventListener('click', () => {
            const reversed = autoBtn.getAttribute('aria-pressed') === 'true';
            autoBtn.setAttribute('aria-pressed', (!reversed).toString());
            if (!reversed) {
                graph.tracking = true;
                autoReduce();
            }
        });
    }
    const fastBtnElem = ctx.querySelector(".buttons .fast");
    if (fastBtnElem) {
        const fastBtn = fastBtnElem;
        fastBtn.addEventListener('click', () => {
            const reversed = fastBtn.getAttribute('aria-pressed') === 'true';
            fastBtn.setAttribute('aria-pressed', (!reversed).toString());
            autoDelay = reversed ? 1000 : 10;
        });
    }
    const examples = expect(ctx.querySelector(".examples"), "no examples select");
    examples.addEventListener("change", () => {
        input.value = examples.value;
        resetCanvas();
        resizeInput();
    });
    watch(graph);
}
const context = document.getElementsByClassName("lc-sim");
for (var i = 0; i < context.length; i++) {
    bind(context[i]);
}
function updateActiveCanvi() {
    let best = null;
    let bestRatio = 0;
    for (const [graph, vis] of visibility) {
        if (vis > bestRatio) {
            best = graph;
            bestRatio = vis;
        }
    }
    for (const graph of visibility.keys()) {
        if (graph === best)
            graph.start();
        else
            graph.stop();
    }
}
function watch(graph) {
    visibility.set(graph, 0);
    const obv = new IntersectionObserver(entries => {
        for (const entry of entries) {
            visibility.set(graph, entry.intersectionRatio);
        }
        updateActiveCanvi();
    }, { threshold: [0, 0.25, 0.5, 0.75, 1.0] });
    obv.observe(graph.canvas);
}
