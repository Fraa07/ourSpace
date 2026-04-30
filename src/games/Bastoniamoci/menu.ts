import { Player, smoothChange } from '../../common';
import { IncomingMsg, OutgoingMsg } from '../../server';
import { GameClient, GameServer } from '../game';
import { UserInput } from '../../client/user-input';
import { drawStickman, NetPlayer } from './player';
import { EntityId, GameMode, GameState, InputState, Transform, WorldManager, createDefaultInputState, createDefaultTransform, registerCoreComponents } from './ecs';
import { MenuSystem } from './menu-system';
import { createVerletBodyPool, drawVerletBody, releaseBiomechanicalEntity, spawnBiomechanicalEntity, VerletBody, VerletPhysicsSystem } from './physics';

type ClientToServerMsg = {
	kind: 'state';
	x: number;
	y: number;
	vx: number;
	vy: number;
	aimX: number;
	aimY: number;
	lean: number;
	onGround: boolean;
};

type ServerToClientMsg = {
	players: Record<string, NetPlayer>;
};

type Vec2 = { x: number; y: number };
type Platform = { x: number; y: number; w: number; h: number };

const WORLD_LEFT = -980;
const WORLD_RIGHT = 980;
const WORLD_TOP = -520;
const WORLD_BOTTOM = 380;
const PLAYER_RADIUS = 18;
const GRAVITY = 2200;
const MOVE_SPEED = 470;
const AIR_CONTROL = 0.8;
const JUMP_SPEED = 860;
const CAMERA = {
	minZoom: 0.72,
	maxZoom: 1.0
};
const FLOOR_Y = 320;

const PLATFORMS: Platform[] = [
	{ x: 0, y: FLOOR_Y, w: 1760, h: 28 },
	{ x: -460, y: 140, w: 460, h: 18 },
	{ x: 430, y: 60, w: 420, h: 18 },
	{ x: -140, y: -120, w: 360, h: 18 },
	{ x: 250, y: -290, w: 300, h: 18 }
];

export class BastoniamociMenuServer extends GameServer {
	private players: Record<string, NetPlayer> = {};

	async init(players: Record<string, Player>): Promise<void> {
		this.players = {};
		const ids = Object.keys(players);

		ids.forEach((id, index) => {
			this.players[id] = {
				...players[id],
				x: -420 + index * 240,
				y: FLOOR_Y - PLAYER_RADIUS,
				vx: 0,
				vy: 0,
				aimX: 0,
				aimY: 0,
				lean: 0,
				onGround: true
			};
		});
	}

	tick(incomingMessages: IncomingMsg[], _dt: number): OutgoingMsg[] {
		incomingMessages.forEach((message) => {
			const payload = message.payload as ClientToServerMsg;
			if (!payload || payload.kind !== 'state') return;

			const player = this.players[message.clientId];
			if (!player) return;

			player.x = clamp(payload.x, WORLD_LEFT + PLAYER_RADIUS, WORLD_RIGHT - PLAYER_RADIUS);
			player.y = clamp(payload.y, WORLD_TOP + PLAYER_RADIUS, WORLD_BOTTOM - PLAYER_RADIUS);
			player.vx = payload.vx;
			player.vy = payload.vy;
			player.aimX = payload.aimX;
			player.aimY = payload.aimY;
			player.lean = clamp(payload.lean, -0.35, 0.35);
			player.onGround = payload.onGround;
		});

		return [{
			payload: {
				players: this.players
			} as ServerToClientMsg
		}];
	}

	isFinished(): boolean {
		return false;
	}
}

export class BastoniamociMenuClient extends GameClient {
	private players: Record<string, NetPlayer> = {};
	private localEntity: EntityId | null = null;
	private camera = { x: 0, y: 0, zoom: 1 };
	private localPlayerName = 'Player';
	private readonly world = new WorldManager();
	private readonly globalEntity: EntityId;
	private readonly bodyPool = createVerletBodyPool(8);
	private readonly physicsSystem = new VerletPhysicsSystem(PLATFORMS);
	private readonly menuSystem: MenuSystem;

	constructor(userInput: UserInput, myId: string) {
		super(userInput, myId);
		registerCoreComponents(this.world);
		this.globalEntity = this.world.ensureGlobalEntity();
		this.world.addComponent(this.globalEntity, 'Transform', createDefaultTransform(0, 0));
		this.world.addComponent(this.globalEntity, 'InputState', createDefaultInputState());
		this.menuSystem = new MenuSystem(this.world, this.userInput, this.globalEntity, {
			spawnGameplayScene: () => this.spawnGameplayScene(),
			cleanupGameplayScene: () => this.cleanupGameplayScene()
		});
	}

	async init(players: Record<string, Player>): Promise<void> {
		this.players = {};
		Object.entries(players).forEach(([id, player], index) => {
			this.players[id] = {
				...player,
				x: -420 + index * 240,
				y: FLOOR_Y - PLAYER_RADIUS,
				vx: 0,
				vy: 0,
				aimX: 0,
				aimY: 0,
				lean: 0,
				onGround: true
			};
		});
		this.localPlayerName = this.players[this.myId]?.name ?? 'Player';
		this.menuSystem.transitionTo(GameMode.MAIN_MENU);
		return Promise.resolve();
	}

	draw(ctx: CanvasRenderingContext2D, dt: number): void {
		const { screenW, screenH, mouseX, mouseY, zoom } = this.userInput;

		this.menuSystem.update(dt);
		this.syncLocalGameplayInput(mouseX, mouseY);
		this.physicsSystem.update(this.world, dt);

		const gameState = this.world.getComponent<GameState>(this.globalEntity, 'GameState');
		const localTransform = this.localEntity !== null ? this.world.getComponent<Transform>(this.localEntity, 'Transform') : null;
		const targetZoom = clamp(zoom, CAMERA.minZoom, CAMERA.maxZoom);

		if (localTransform && gameState?.mode === GameMode.PLAYING) {
			this.camera.x = smoothChange(this.camera.x, localTransform.x, dt, 0.16);
			this.camera.y = smoothChange(this.camera.y, localTransform.y, dt, 0.16);
		} else {
			this.camera.x = smoothChange(this.camera.x, 0, dt, 0.2);
			this.camera.y = smoothChange(this.camera.y, 0, dt, 0.2);
		}
		this.camera.zoom = smoothChange(this.camera.zoom, targetZoom, dt, 0.2);

		const background = ctx.createLinearGradient(0, 0, 0, screenH);
		background.addColorStop(0, '#090b14');
		background.addColorStop(0.55, '#15192a');
		background.addColorStop(1, '#06070d');
		ctx.fillStyle = background;
		ctx.fillRect(0, 0, screenW, screenH);
		this.drawBackdrop(ctx, screenW, screenH);

		ctx.save();
		ctx.translate(screenW / 2, screenH / 2);
		ctx.scale(this.camera.zoom, this.camera.zoom);
		ctx.translate(-this.camera.x, -this.camera.y);

		this.drawArena(ctx);

		Object.entries(this.players).forEach(([id, player]) => {
			if (this.localEntity !== null && id === this.myId) return;
			drawStickman(ctx, player, { x: player.aimX, y: player.aimY });
		});

		if (this.localEntity !== null) {
			const body = this.world.getComponent<VerletBody>(this.localEntity, 'VerletBody');
			if (body) {
				drawVerletBody(ctx, body, this.localPlayerName);
			}
		}

		ctx.restore();

		this.drawHUD(ctx, screenW, screenH);
		this.menuSystem.render(ctx);
	}

	handleMessage(message: ServerToClientMsg): void {
		Object.entries(message.players).forEach(([id, incoming]) => {
			const existing = this.players[id];
			if (!existing) {
				this.players[id] = { ...incoming };
				return;
			}

			existing.vx = incoming.vx;
			existing.vy = incoming.vy;
			existing.aimX = incoming.aimX;
			existing.aimY = incoming.aimY;
			existing.lean = incoming.lean;
			existing.onGround = incoming.onGround;
			existing.x = smoothChange(existing.x, incoming.x, 0.05, 0.12);
			existing.y = smoothChange(existing.y, incoming.y, 0.05, 0.12);
		});
	}

	flushMessages(): ClientToServerMsg[] {
		if (this.localEntity === null) return [];
		const gameState = this.world.getComponent<GameState>(this.globalEntity, 'GameState');
		if (!gameState || gameState.mode !== GameMode.PLAYING) return [];

		const transform = this.world.getComponent<Transform>(this.localEntity, 'Transform');
		const body = this.world.getComponent<VerletBody>(this.localEntity, 'VerletBody');
		const input = this.world.getComponent<InputState>(this.localEntity, 'InputState');
		if (!transform || !body || !input) return [];

		return [{
			kind: 'state',
			x: transform.x,
			y: transform.y,
			vx: transform.vx,
			vy: transform.vy,
			aimX: input.aimX,
			aimY: input.aimY,
			lean: transform.lean,
			onGround: body.grounded
		}];
	}

	isFinished(): boolean {
		return false;
	}

	private spawnGameplayScene(): void {
		const spawn = this.getSpawnPoint();
		this.localEntity = spawnBiomechanicalEntity(this.world, this.bodyPool, spawn.x, spawn.y, true);
	}

	private cleanupGameplayScene(): void {
		if (this.localEntity === null) return;
		releaseBiomechanicalEntity(this.world, this.bodyPool, this.localEntity);
		this.localEntity = null;
	}

	private syncLocalGameplayInput(mouseX: number, mouseY: number): void {
		if (this.localEntity === null) return;
		const input = this.world.getComponent<InputState>(this.localEntity, 'InputState');
		const transform = this.world.getComponent<Transform>(this.localEntity, 'Transform');
		const body = this.world.getComponent<VerletBody>(this.localEntity, 'VerletBody');
		if (!input || !transform || !body) return;

		const aim = this.screenToWorld(mouseX, mouseY);
		input.moveX = this.userInput.moveDirectionX;
		input.moveY = this.userInput.moveDirectionY;
		input.jump = this.userInput.moveDirectionY < 0;
		input.back = this.userInput.moveDirectionY > 0;
		input.pause = false;
		input.confirm = false;
		input.screenX = mouseX;
		input.screenY = mouseY;
		input.aimX = aim.x;
		input.aimY = aim.y;
		input.mouseDown = false;
		input.mousePressed = false;
		input.mouseReleased = false;

		transform.lean = clamp(transform.lean, -0.35, 0.35);
		if (!body.grounded) {
			transform.rotation = smoothChange(transform.rotation, Math.atan2(body.points[body.chestIndex].y - body.points[body.pelvisIndex].y, body.points[body.chestIndex].x - body.points[body.pelvisIndex].x), 0.016, 0.18);
		}
	}

	private getSpawnPoint(): Vec2 {
		const index = Object.keys(this.players).indexOf(this.myId);
		if (index >= 0) {
			return {
				x: -420 + index * 240,
				y: FLOOR_Y - PLAYER_RADIUS
			};
		}
		return {
			x: 0,
			y: FLOOR_Y - PLAYER_RADIUS
		};
	}

	private screenToWorld(screenX: number, screenY: number): Vec2 {
		const x = (screenX - this.userInput.screenW / 2) / this.camera.zoom + this.camera.x;
		const y = (screenY - this.userInput.screenH / 2) / this.camera.zoom + this.camera.y;
		return { x, y };
	}

	private drawBackdrop(ctx: CanvasRenderingContext2D, screenW: number, screenH: number) {
		const haze = ctx.createRadialGradient(screenW * 0.5, screenH * 0.35, 80, screenW * 0.5, screenH * 0.35, screenH * 0.9);
		haze.addColorStop(0, 'rgba(95, 128, 255, 0.14)');
		haze.addColorStop(0.45, 'rgba(40, 52, 98, 0.06)');
		haze.addColorStop(1, 'rgba(0, 0, 0, 0)');
		ctx.fillStyle = haze;
		ctx.fillRect(0, 0, screenW, screenH);

		ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
		for (let i = 0; i < 14; i++) {
			const x = (i * 143) % screenW;
			const y = (i * 73) % Math.floor(screenH * 0.45);
			ctx.fillRect(x, y, 2, 2);
		}
	}

	private drawArena(ctx: CanvasRenderingContext2D) {
		ctx.fillStyle = '#11131c';
		ctx.fillRect(WORLD_LEFT, WORLD_TOP, WORLD_RIGHT - WORLD_LEFT, WORLD_BOTTOM - WORLD_TOP);

		ctx.fillStyle = '#1d2030';
		ctx.fillRect(WORLD_LEFT, FLOOR_Y, WORLD_RIGHT - WORLD_LEFT, 160);

		ctx.strokeStyle = 'rgba(138, 214, 255, 0.18)';
		ctx.lineWidth = 2;
		for (let x = WORLD_LEFT; x <= WORLD_RIGHT; x += 120) {
			ctx.beginPath();
			ctx.moveTo(x, WORLD_TOP);
			ctx.lineTo(x, FLOOR_Y + 40);
			ctx.stroke();
		}

		PLATFORMS.forEach((platform, index) => {
			ctx.fillStyle = index === 0 ? '#18202e' : '#202537';
			ctx.fillRect(platform.x - platform.w / 2, platform.y - platform.h / 2, platform.w, platform.h);
			ctx.strokeStyle = '#8ad6ff';
			ctx.lineWidth = index === 0 ? 2 : 1.5;
			ctx.strokeRect(platform.x - platform.w / 2, platform.y - platform.h / 2, platform.w, platform.h);
			ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
			ctx.fillRect(platform.x - platform.w / 2 + 8, platform.y - platform.h / 2 + 3, platform.w - 16, 3);
		});

		ctx.fillStyle = '#0b0d14';
		ctx.fillRect(WORLD_LEFT, WORLD_BOTTOM - 6, WORLD_RIGHT - WORLD_LEFT, 6);
	}

	private drawHUD(ctx: CanvasRenderingContext2D, screenW: number, screenH: number) {
		ctx.fillStyle = 'rgba(7, 9, 16, 0.72)';
		ctx.fillRect(18, 18, 270, 76);
		ctx.fillStyle = '#eef2ff';
		ctx.font = 'bold 22px Georgia';
		ctx.textAlign = 'left';
		ctx.textBaseline = 'top';
		ctx.fillText('STICKFIGHT ARENA', 32, 30);
		ctx.font = '14px Arial';
		ctx.fillStyle = '#b7c0d8';
		ctx.fillText('A/D move  W jump  mouse aim', 32, 58);

		const aim = this.screenToWorld(this.userInput.mouseX, this.userInput.mouseY);
		const crosshairX = (aim.x - this.camera.x) * this.camera.zoom + screenW / 2;
		const crosshairY = (aim.y - this.camera.y) * this.camera.zoom + screenH / 2;
		ctx.strokeStyle = 'rgba(138, 214, 255, 0.95)';
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.arc(crosshairX, crosshairY, 10, 0, Math.PI * 2);
		ctx.stroke();
	}
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}
