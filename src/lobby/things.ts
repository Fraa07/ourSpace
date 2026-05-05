import { Rectangle, getCollisionSide } from "../common";

// How close a player needs to be to the door center to "enter"
const ENTER_THRESHOLD = 30;

function rectsOverlap(a: Rectangle, b: Rectangle): boolean {
    return (
        a.x < b.x + b.w &&
        a.x + a.w > b.x &&
        a.y < b.y + b.h &&
        a.y + a.h > b.y
    );
}

export class Building {
    rect: Rectangle;           // the walls rect (floor to top of walls)
    wallThickness: number;     // how thick the walls are
    collisionBoxes: Rectangle[];
    doorWidth: number;
    interiorColor: string;
    wallColor: string;

    // When a player is near the door, the walls become transparent
    private _revealed: boolean = false;

    constructor(rect: Rectangle, wallThickness: number = 6) {
        this.rect = rect;
        this.wallThickness = wallThickness;
        this.doorWidth = 80;
        this.interiorColor = "#c8b88a";
        this.wallColor = "#c67b4a";

        this.collisionBoxes = this.buildCollisionBoxes();
    }

    /**
     * Five collision boxes:
     *   - left wall (full height)
     *   - top wall (full width)
     *   - right wall (full height)
     *   - bottom-left wall segment (from left edge to door's left edge)
     *   - bottom-right wall segment (from door's right edge to right edge)
     */
    private buildCollisionBoxes(): Rectangle[] {
        const t = this.wallThickness;
        const r = this.rect;
        const wallBottom = r.y + r.h;
        const doorLeft = r.x + r.w / 2 - this.doorWidth / 2;
        const doorRight = r.x + r.w / 2 + this.doorWidth / 2;

        return [
            // left wall
            { x: r.x, y: r.y, w: t, h: r.h },
            // top wall
            { x: r.x, y: r.y, w: r.w, h: t },
            // right wall
            { x: r.x + r.w - t, y: r.y, w: t, h: r.h },
            // bottom-left (left of door)
            { x: r.x, y: wallBottom - t, w: doorLeft - r.x, h: t },
            // bottom-right (right of door)
            { x: doorRight, y: wallBottom - t, w: r.x + r.w - doorRight, h: t },
        ];
    }

    /**
     * Check whether a player is standing in the door opening.
     */
    isPlayerAtDoor(playerRect: Rectangle): boolean {
        const doorRect: Rectangle = {
            x: this.rect.x + this.rect.w / 2 - this.doorWidth / 2,
            y: this.rect.y + this.rect.h - ENTER_THRESHOLD,
            w: this.doorWidth,
            h: ENTER_THRESHOLD,
        };
        return rectsOverlap(playerRect, doorRect);
    }

    /**
     * Update the revealed/hidden state based on player position.
     */
    update(playerRect: Rectangle | null) {
        this._revealed = !!(playerRect && this.isPlayerAtDoor(playerRect));
    }

    get revealed(): boolean {
        return this._revealed;
    }

    draw(ctx: CanvasRenderingContext2D) {
        const r = this.rect;
        const wallBottom = r.y + r.h;
        const doorLeft = r.x + r.w / 2 - this.doorWidth / 2;
        const doorRight = r.x + r.w / 2 + this.doorWidth / 2;
        const t = this.wallThickness;

        // Interior floor (always underneath)
        ctx.fillStyle = this.interiorColor;
        ctx.fillRect(r.x, r.y, r.w, r.h);

        // Interior detail when revealed
        if (this._revealed) {
            ctx.fillStyle = "#8b6b4a";
            ctx.fillRect(r.x + r.w * 0.3, r.y + r.h * 0.4, r.w * 0.4, r.h * 0.2);
            ctx.globalAlpha = 0.3;
        }

        // Walls
        ctx.fillStyle = this.wallColor;
        ctx.fillRect(r.x, r.y, t, r.h);                 // left
        ctx.fillRect(r.x, r.y, r.w, t);                   // top
        ctx.fillRect(r.x + r.w - t, r.y, t, r.h);         // right
        ctx.fillRect(r.x, wallBottom - t, doorLeft - r.x, t);   // bottom-left
        ctx.fillRect(doorRight, wallBottom - t, r.x + r.w - doorRight, t); // bottom-right

        ctx.globalAlpha = 1.0;

        // Door frame
        const doorHeight = 60;
        const doorY = wallBottom - doorHeight;
        ctx.strokeStyle = "#5a3a1a";
        ctx.lineWidth = 3;
        ctx.strokeRect(doorLeft, doorY, this.doorWidth, doorHeight);

        ctx.fillStyle = "#8b5e3c";
        ctx.fillRect(doorLeft + 2, doorY + 2, this.doorWidth - 4, doorHeight - 4);

        ctx.fillStyle = "#d4af37";
        ctx.beginPath();
        ctx.arc(doorRight - 8, doorY + doorHeight / 2, 3, 0, Math.PI * 2);
        ctx.fill();
    }
}