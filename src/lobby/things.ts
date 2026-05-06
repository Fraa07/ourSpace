import { PERSON_H, PERSON_W, Rectangle, getCollisionSide } from "../common";

export class Arcade {
    rect: Rectangle;           // the walls rect (floor to top of walls)
    wallThickness: number;     // how thick the walls are
    collisionBoxes: Rectangle[];
    doorWidth: number;
    doorHeight: number;
    interiorColor: string;
    wallColor: string;
    wallSectionColor: string;

    // When a player is near the door, the walls become transparent
    private _revealed: boolean = false;

    constructor(rect: Rectangle, wallThickness: number) {
        this.rect = rect;
        this.wallThickness = wallThickness;
        this.doorWidth = PERSON_W * 4;
        this.doorHeight = PERSON_H * 1.3;
        this.interiorColor = "#373737";
        this.wallColor = "#9e9e9e";
        this.wallSectionColor = "#9e9e9e";

        this.collisionBoxes = this.buildCollisionBoxes();
    }

    private buildCollisionBoxes(): Rectangle[] {
        const t = this.wallThickness;
        const r = this.rect;
        const wallBottom = r.y + r.h;
        const doorLeft = r.x + r.w / 2 - this.doorWidth / 2;
        const doorRight = r.x + r.w / 2 + this.doorWidth / 2;

        return [
            { x: r.x, y: r.y, w: t, h: r.h }, // left wall
            { x: r.x, y: r.y, w: r.w, h: t }, // top wall
            { x: r.x + r.w - t, y: r.y, w: t, h: r.h }, // right wall
            { x: r.x, y: wallBottom - t, w: doorLeft - r.x, h: t }, // bottom-left (left of door)
            { x: doorRight, y: wallBottom - t, w: r.x + r.w - doorRight, h: t }, // bottom-right (right of door)
        ];
    }

    isPlayerInside(playerRect: Rectangle): boolean {
        const { x, y, w, h } = playerRect;
        const xBetween = x > this.rect.x && x < this.rect.x + this.rect.w;
        const yBetween = y > this.rect.y && y + PERSON_H < this.rect.y + this.rect.h;
        return xBetween && yBetween;
    }

    update(playerRect: Rectangle | null) {
        this._revealed = !!(playerRect && this.isPlayerInside(playerRect));
    }

    get revealed(): boolean {
        return this._revealed;
    }
    drawSign(ctx: CanvasRenderingContext2D) {
        const w = this.rect.w * 0.45;
        const h = this.rect.w * 0.12;
        const x = this.rect.x + (this.rect.w - w) / 2;
        const y = this.rect.y + this.rect.h * 0.9 - this.doorHeight - h;

        const spacing = h * 0.1;

        ctx.fillStyle = "#101010";
        ctx.fillRect(x, y, w, h);

        const letterCount = 6;
        let letterX = x + spacing;
        const letterY = y + spacing;
        const letterW = (w - (letterCount+1)*spacing) / letterCount;
        const letterH = h - 2*spacing;
        const thickness = letterW * 0.15;
        ctx.fillStyle = "#cb0000";
        // A
        ctx.fillRect(letterX, letterY, thickness, letterH);
        ctx.fillRect(letterX + letterW - thickness, letterY, thickness, letterH);
        ctx.fillRect(letterX, letterY, letterW, thickness);
        ctx.fillRect(letterX, letterY + letterH*0.6, letterW, thickness);

        const smallLetterH = letterH * 0.5;
        const smallLetterY = letterY + letterH - smallLetterH;
        // r
        letterX += letterW + spacing;
        const rExtraH = smallLetterY * 0.07;
        ctx.fillRect(letterX, smallLetterY - rExtraH, thickness, smallLetterH + rExtraH);
        ctx.fillRect(letterX, smallLetterY, letterW, thickness);
        ctx.fillRect(letterX + letterW - thickness, smallLetterY, thickness, smallLetterY * 0.1);

        // c
        letterX += letterW + spacing;
        ctx.fillRect(letterX, smallLetterY, thickness, smallLetterH);
        ctx.fillRect(letterX, smallLetterY, letterW, thickness);
        ctx.fillRect(letterX, smallLetterY + smallLetterH - thickness, letterW, thickness);

        // a
        letterX += letterW + spacing;
        ctx.fillRect(letterX, smallLetterY, letterW, thickness);
        ctx.fillRect(letterX + letterW - thickness, smallLetterY, thickness, smallLetterH);
        ctx.fillRect(letterX, smallLetterY + smallLetterH - thickness, letterW, thickness);
        ctx.fillRect(letterX, smallLetterY + smallLetterH*0.5, thickness, smallLetterH*0.5);
        ctx.fillRect(letterX, smallLetterY + smallLetterH*0.5 - thickness, letterW, thickness);

        // d
        letterX += letterW + spacing;
        ctx.fillRect(letterX, smallLetterY, thickness, smallLetterH);
        ctx.fillRect(letterX, smallLetterY, letterW, thickness);
        ctx.fillRect(letterX, smallLetterY + smallLetterH - thickness, letterW, thickness);
        ctx.fillRect(letterX + letterW - thickness, letterY, thickness, letterH);

        // e
        letterX += letterW + spacing;
        ctx.fillRect(letterX, smallLetterY + smallLetterH - thickness, letterW, thickness);
        ctx.fillRect(letterX, smallLetterY, thickness, smallLetterH);
        ctx.fillRect(letterX, smallLetterY, letterW, thickness);
        ctx.fillRect(letterX + letterW - thickness, smallLetterY, thickness, smallLetterH*0.5);
        ctx.fillRect(letterX, smallLetterY + smallLetterH*0.5, letterW, thickness);
    }

    draw(ctx: CanvasRenderingContext2D) {
        const r = this.rect;
        const wallBottom = r.y + r.h;
        const doorCenter = r.x + r.w / 2;
        const doorLeft = doorCenter - this.doorWidth / 2;
        const doorRight = doorCenter + this.doorWidth / 2;

        ctx.fillStyle = this.interiorColor;
        ctx.fillRect(r.x, r.y, r.w, r.h);

        const doorY = wallBottom - this.doorHeight;

        if (!this._revealed) {
            ctx.fillStyle = this.wallColor;
            ctx.fillRect(r.x, r.y, r.w, r.h);
            
            this.drawSign(ctx);

            // +door
            ctx.fillStyle = "#75bedb";
            ctx.fillRect(doorLeft, doorY, this.doorWidth, this.doorHeight);

            const frameThickness = this.doorWidth * 0.05;
            ctx.fillStyle = "#6d5656";
            ctx.fillRect(doorLeft, doorY, frameThickness, this.doorHeight);
            ctx.fillRect(doorCenter - frameThickness, doorY, frameThickness, this.doorHeight);
            ctx.fillRect(doorCenter, doorY, frameThickness, this.doorHeight);
            ctx.fillRect(doorRight - frameThickness, doorY, frameThickness, this.doorHeight);
            ctx.fillRect(doorLeft, doorY, this.doorWidth, frameThickness);
            ctx.fillRect(doorLeft, doorY + this.doorHeight - frameThickness, this.doorWidth, frameThickness);
            // -door
        }
        else {
            ctx.fillStyle = this.wallSectionColor;
            for (const box of this.collisionBoxes) {
                ctx.fillRect(box.x, box.y, box.w, box.h);
            }
        }
    }
}