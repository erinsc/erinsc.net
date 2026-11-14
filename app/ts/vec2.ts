export class Vec2 {
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
