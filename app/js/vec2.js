export class Vec2 {
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
