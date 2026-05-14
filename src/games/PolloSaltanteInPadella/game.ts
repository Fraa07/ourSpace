import { IncomingMsg, OutgoingMsg } from '../../server';
import { GameClient, GameServer } from './../game';

const PLAYER_W = 0.1;
const PLAYER_H = 0.15;
const WINNING_SCORE = 100;
const MOVE_SPEED = 1.25;
const GRAVITY = 6.5;
const JUMP_VELOCITY = 2.4;
const MAX_FALL_SPEED = 4.5;
const PLAYER_SPRITE_URL = '/assets/Jump/PolloSaltante.png';
const FRAME_X = 0;
const FRAME_Y = 0;
const FRAME_WIDTH = 192;
const FRAME_HEIGHT = 192;
const BORDERS = {
    top: -1,
    bottom: 1,
    left: -2,
    right: 2
}
const BORDERS_W = Math.abs(BORDERS.right - BORDERS.left);
const BORDERS_H = Math.abs(BORDERS.top - BORDERS.bottom);
const GROUND_Y = BORDERS.bottom - PLAYER_H;

type JumpPlayer = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    onGround: boolean;
    moveDirectionX: number;
    jumpRequested: boolean;
};

function ensureJumpPlayer(player: JumpPlayer) {
    if (typeof player.vx !== 'number') player.vx = 0;
    if (typeof player.vy !== 'number') player.vy = 0;
    if (typeof player.onGround !== 'boolean') player.onGround = false;
    if (typeof player.moveDirectionX !== 'number') player.moveDirectionX = 0;
    if (typeof player.jumpRequested !== 'boolean') player.jumpRequested = false;
}

function applyJumpPhysics(player: JumpPlayer, moveDirectionX: number, jumpPressed: boolean, dt: number) {
    ensureJumpPlayer(player);

    player.moveDirectionX = moveDirectionX;
    player.vx = moveDirectionX * MOVE_SPEED;

    if (jumpPressed && player.onGround) {
        player.vy = -JUMP_VELOCITY;
        player.onGround = false;
    }

    player.vy += GRAVITY * dt;
    if (player.vy > MAX_FALL_SPEED) {
        player.vy = MAX_FALL_SPEED;
    }

    player.x += player.vx * dt;
    player.y += player.vy * dt;

    if (player.x < BORDERS.left) player.x = BORDERS.left;
    else if (player.x + PLAYER_W > BORDERS.right) player.x = BORDERS.right - PLAYER_W;

    if (player.y < BORDERS.top) {
        player.y = BORDERS.top;
        if (player.vy < 0) player.vy = 0;
    }

    if (player.y >= GROUND_Y) {
        player.y = GROUND_Y;
        player.vy = 0;
        player.onGround = true;
    }
}

export class PolloSaltanteInPadellaServer extends GameServer {

    private players: Record<string, JumpPlayer>;
    private leftScore: number;
    private rightScore: number;

    init(players) {
        this.players = players;
        this.leftScore = 0;
        this.rightScore = 0;

        let i = 0;
        const step = 0.08;
        let leftX = BORDERS.left + step;
        let rightX = BORDERS.right - step - PLAYER_W;
        Object.keys(players).forEach(id => {
            const player = players[id] as JumpPlayer;
            if (i % 2 === 0) {
                player.x = leftX;
                leftX += step;
            }
            else {
                player.x = rightX;
                rightX -= step;
            }
            player.y = GROUND_Y;
            player.vx = 0;
            player.vy = 0;
            player.onGround = true;
            player.moveDirectionX = 0;
            player.jumpRequested = false;
            i += 1;
        });
    }

    tick(incomingMessages: IncomingMsg[], dt: number): OutgoingMsg[] {
        incomingMessages.forEach(message => {
            const id = message.clientId;
            const payload = message.payload;

            if (payload.kind === 'move') {
                const player = this.players[id] as JumpPlayer;
                if (!player) return;

                player.moveDirectionX = payload.moveDirectionX ?? 0;
                player.jumpRequested = player.jumpRequested || payload.jump === true;
            }
        });

        Object.keys(this.players).forEach(id => {
            const player = this.players[id];
            const jumpPressed = player.jumpRequested;
            applyJumpPhysics(player, player.moveDirectionX, jumpPressed, dt);
            player.jumpRequested = false;
        });

        return [{
            payload: {
                players: this.players,
                leftScore: this.leftScore,
                rightScore: this.rightScore,
                ballPlayerCollision: false
            }
        }];
    }

    isFinished(): boolean {
        return false;
    }
}

import { UserInput } from '../../client/user-input';

export class PolloSaltanteInPadellaClient extends GameClient {
    private players = null;
    private leftScore = 0;
    private rightScore = 0;
    private previousMoveDirectionY = 0;
    private pendingJump = false;
    private playerSprite: HTMLImageElement | null = null;

    constructor(userInput: UserInput, myId: string) {
        super(userInput, myId);
    }

    async init(players) {
        // caricamento sprite
        await this.assets.loadImage('player', PLAYER_SPRITE_URL);
        this.playerSprite = this.assets.images.player;
        return Promise.resolve();
    }

    draw(ctx: CanvasRenderingContext2D, dt: number) {
        if (this.players === null) return;

        const { screenW, screenH, moveDirectionY, moveDirectionX } = this.userInput;

        const me = this.players[this.myId];
        const jumpPressed = moveDirectionY < 0 && this.previousMoveDirectionY >= 0;
        if (jumpPressed) {
            this.pendingJump = true;
        }
        this.previousMoveDirectionY = moveDirectionY;

        applyJumpPhysics(me, moveDirectionX, jumpPressed, dt);


        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, screenW, screenH);

        ctx.save();
        const scaleX = screenW / BORDERS_W;
        const scaleY = screenH / BORDERS_H;
        const scale = Math.min(scaleX, scaleY);
        ctx.translate(screenW / 2, screenH / 2); 
        ctx.scale(scale, scale);

        ctx.fillStyle = "#368622"; 
        ctx.fillRect(BORDERS.left, BORDERS.top, BORDERS_W, BORDERS_H);

        ctx.fillStyle = "#407c86";
        ctx.fillRect(BORDERS.left, BORDERS.top, BORDERS_W, BORDERS_H/1.5);

        // ritaglio frame
        const sprite = this.playerSprite;
        Object.keys(this.players).forEach(id => {
            const player = this.players[id];
            // rendering player
            if (sprite) {
                const previousSmoothing = ctx.imageSmoothingEnabled;
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(
                    sprite,
                    FRAME_X,
                    FRAME_Y,
                    FRAME_WIDTH,
                    FRAME_HEIGHT,
                    player.x,
                    player.y,
                    PLAYER_W,
                    PLAYER_H
                );
                ctx.imageSmoothingEnabled = previousSmoothing;
            }
        });


        ctx.restore();

        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.lineWidth = 0.01;
        ctx.font = `24px Arial`;
        ctx.fillStyle = "#eeeeee";
        const marginLR = 60;
        const marginTop = 20;
        ctx.fillText(this.leftScore+'/'+WINNING_SCORE, marginLR, marginTop);
        ctx.fillText(this.rightScore+'/'+WINNING_SCORE, screenW - marginLR, marginTop);
    }

    handleMessage(message: any) {
        if (this.players === null) {
            this.players = message.players;
        }
        else { // aggiorno solo la posizione degli altri giocatori
            Object.keys(message.players).forEach(id => {
                const newPlayer = message.players[id];
                if (id !== this.myId) {
                    this.players[id].x = newPlayer.x;
                    this.players[id].y = newPlayer.y;
                    this.players[id].vx = newPlayer.vx;
                    this.players[id].vy = newPlayer.vy;
                    this.players[id].onGround = newPlayer.onGround;
                }
            });
        }
        this.leftScore = message.leftScore;
        this.rightScore = message.rightScore;

        if (message.ballPlayerCollision) {
            const bumpSound = this.assets.sounds.bump;
            bumpSound.volume = 0.5;
            bumpSound.currentTime = 0;
            bumpSound.play().catch(err => console.log("Waiting for user interaction to play audio"));
        }
    }

    flushMessages(): any[] {
        if (this.players === null) return [];

        const messages = [{
            kind: 'move',
            moveDirectionX: this.userInput.moveDirectionX,
            jump: this.pendingJump
        }];

        this.pendingJump = false;
        return messages;
    }

    isFinished(): boolean {
        return this.leftScore  == WINNING_SCORE
            || this.rightScore == WINNING_SCORE;
    }
}
