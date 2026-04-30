import { UserInput } from '../../client/user-input';
import { EntityId, GameMode, GameState, InputState, WorldManager, createDefaultGameState, createDefaultInputState } from './ecs';

export interface MenuButton {
	key: string;
	label: string;
	x: number;
	y: number;
	w: number;
	h: number;
	kind: 'primary' | 'secondary' | 'danger';
	action: () => void;
	hovered: boolean;
	selected: boolean;
}

export interface MenuSystemCallbacks {
	spawnGameplayScene: () => void;
	cleanupGameplayScene: () => void;
}

export class MenuSystem {
	private menuRootEntity: EntityId | null = null;
	private buttons: MenuButton[] = [];
	private pointerPressed = false;
	private pointerReleased = false;
	private pointerDown = false;
	private confirmPressed = false;
	private pausePressed = false;
	private lastMenuAxisY = 0;
	private disposed = false;
	private readonly handlePointerDown = (event: PointerEvent): void => {
		this.pointerDown = true;
		this.pointerPressed = true;
		event.preventDefault();
	};
	private readonly handlePointerUp = (event: PointerEvent): void => {
		this.pointerDown = false;
		this.pointerReleased = true;
		event.preventDefault();
	};
	private readonly handlePointerCancel = (): void => {
		this.pointerDown = false;
		this.pointerReleased = true;
	};
	private readonly handleKeyDown = (event: KeyboardEvent): void => {
		if (event.code === 'Enter' || event.code === 'Space') {
			this.confirmPressed = true;
			event.preventDefault();
		}
		if (event.code === 'Escape') {
			this.pausePressed = true;
			event.preventDefault();
		}
	};

	constructor(
		private readonly world: WorldManager,
		private readonly userInput: UserInput,
		private readonly globalEntity: EntityId,
		private readonly callbacks: MenuSystemCallbacks
	) {
		this.world.addComponent(this.globalEntity, 'GameState', createDefaultGameState());
		this.world.addComponent(this.globalEntity, 'InputState', createDefaultInputState());
		this.attachInputListeners();
		this.ensureMenuScene();
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		const canvas = this.userInput.canvas;
		canvas.removeEventListener('pointerdown', this.handlePointerDown);
		canvas.removeEventListener('pointerup', this.handlePointerUp);
		canvas.removeEventListener('pointercancel', this.handlePointerCancel);
		document.removeEventListener('keydown', this.handleKeyDown);
	}

	update(dt: number): void {
		const gameState = this.world.getComponent<GameState>(this.globalEntity, 'GameState');
		const input = this.world.getComponent<InputState>(this.globalEntity, 'InputState');
		if (!gameState || !input) return;

		input.screenX = this.userInput.mouseX;
		input.screenY = this.userInput.mouseY;
		input.mouseDown = this.pointerDown;
		input.mousePressed = this.pointerPressed;
		input.mouseReleased = this.pointerReleased;
		input.pause = this.pausePressed;
		input.confirm = this.confirmPressed;
		input.moveX = this.userInput.moveDirectionX;
		input.moveY = this.userInput.moveDirectionY;
		input.jump = this.userInput.moveDirectionY < 0;
		input.back = this.userInput.moveDirectionY > 0;

		this.buttons = this.buildButtons(gameState.mode);
		this.applyHoverState(input.screenX, input.screenY);
		this.handleMenuNavigation(gameState, input);

		if (this.pausePressed) {
			if (gameState.mode === GameMode.PLAYING) {
				this.transitionTo(GameMode.PAUSED);
			} else if (gameState.mode === GameMode.PAUSED) {
				this.transitionTo(GameMode.PLAYING);
			}
		}

		if (gameState.mode === GameMode.MAIN_MENU) {
			this.ensureMenuScene();
		}

		this.pointerPressed = false;
		this.pointerReleased = false;
		this.pausePressed = false;
		this.confirmPressed = false;
		input.pause = false;
		input.confirm = false;
	}

	render(ctx: CanvasRenderingContext2D): void {
		const gameState = this.world.getComponent<GameState>(this.globalEntity, 'GameState');
		if (!gameState) return;
		renderMenu(ctx, gameState.mode, this.buttons, this.userInput);
	}

	transitionTo(nextMode: GameMode): void {
		const gameState = this.world.getComponent<GameState>(this.globalEntity, 'GameState');
		if (!gameState || gameState.mode === nextMode) return;

		const previousMode = gameState.mode;
		gameState.previousMode = previousMode;
		gameState.mode = nextMode;
		gameState.queuedMode = null;
		gameState.selectedMenuIndex = 0;
		gameState.sceneRevision += 1;

		if (nextMode === GameMode.MAIN_MENU) {
			this.callbacks.cleanupGameplayScene();
			this.destroyMenuScene();
			this.ensureMenuScene();
			return;
		}

		if (nextMode === GameMode.PLAYING) {
			if (previousMode === GameMode.MAIN_MENU) {
				this.destroyMenuScene();
				this.callbacks.cleanupGameplayScene();
				this.callbacks.spawnGameplayScene();
			}
			return;
		}

		if (nextMode === GameMode.PAUSED) {
			this.destroyMenuScene();
		}
	}

	private attachInputListeners(): void {
		const canvas = this.userInput.canvas;
		canvas.addEventListener('pointerdown', this.handlePointerDown);
		canvas.addEventListener('pointerup', this.handlePointerUp);
		canvas.addEventListener('pointercancel', this.handlePointerCancel);
		document.addEventListener('keydown', this.handleKeyDown);
	}

	private ensureMenuScene(): void {
		if (this.menuRootEntity !== null && this.world.hasTag(this.menuRootEntity, 'menu')) {
			return;
		}
		this.destroyMenuScene();
		this.menuRootEntity = this.world.createEntity(['menu']);
	}

	private destroyMenuScene(): void {
		if (this.menuRootEntity === null) return;
		this.world.destroyEntity(this.menuRootEntity);
		this.menuRootEntity = null;
	}

	private buildButtons(mode: GameMode): MenuButton[] {
		if (mode === GameMode.MAIN_MENU) {
			return [
				{
					key: 'play',
					label: 'PLAY',
					x: 0,
					y: 0,
					w: 320,
					h: 60,
					kind: 'primary',
					action: () => this.transitionTo(GameMode.PLAYING),
					hovered: false,
					selected: false
				},
				{
					key: 'reload',
					label: 'RELOAD',
					x: 0,
					y: 0,
					w: 320,
					h: 60,
					kind: 'secondary',
					action: () => window.location.reload(),
					hovered: false,
					selected: false
				}
			];
		}

		if (mode === GameMode.PAUSED) {
			return [
				{
					key: 'resume',
					label: 'RESUME',
					x: 0,
					y: 0,
					w: 340,
					h: 60,
					kind: 'primary',
					action: () => this.transitionTo(GameMode.PLAYING),
					hovered: false,
					selected: false
				},
				{
					key: 'menu',
					label: 'MAIN MENU',
					x: 0,
					y: 0,
					w: 340,
					h: 60,
					kind: 'secondary',
					action: () => this.transitionTo(GameMode.MAIN_MENU),
					hovered: false,
					selected: false
				}
			];
		}

		return [
			{
				key: 'pause',
				label: 'PAUSE',
				x: 0,
				y: 0,
				w: 150,
				h: 42,
				kind: 'secondary',
				action: () => this.transitionTo(GameMode.PAUSED),
				hovered: false,
				selected: false
			}
		];
	}

	private applyHoverState(mouseX: number, mouseY: number): void {
		const state = this.world.getComponent<GameState>(this.globalEntity, 'GameState');
		if (!state) return;
		const canvasW = this.userInput.screenW;
		const canvasH = this.userInput.screenH;
		const layout = this.layoutButtons(state.mode, canvasW, canvasH);
		const buttons = this.buttons;

		for (let i = 0; i < buttons.length; i++) {
			const button = buttons[i];
			const slot = layout[i];
			button.x = slot.x;
			button.y = slot.y;
			button.w = slot.w;
			button.h = slot.h;
			button.hovered = mouseX >= button.x && mouseX <= button.x + button.w && mouseY >= button.y && mouseY <= button.y + button.h;
			button.selected = i === state.selectedMenuIndex;
		}
	}

	private layoutButtons(mode: GameMode, canvasW: number, canvasH: number): Array<{ x: number; y: number; w: number; h: number }> {
		if (mode === GameMode.PLAYING) {
			return [
				{ x: canvasW - 188, y: 24, w: 150, h: 42 }
			];
		}

		const width = mode === GameMode.PAUSED ? 340 : 320;
		const startY = mode === GameMode.PAUSED ? canvasH * 0.5 - 26 : canvasH * 0.5 - 56;
		return this.buttons.map((_, index) => ({
			x: canvasW * 0.5 - width * 0.5,
			y: startY + index * 76,
			w: width,
			h: 60
		}));
	}

	private handleMenuNavigation(gameState: GameState, input: InputState): void {
		if (gameState.mode === GameMode.PLAYING) {
			const pauseButton = this.buttons[0];
			if (pauseButton && ((this.pointerPressed && pauseButton.hovered) || (this.confirmPressed && pauseButton.selected))) {
				this.transitionTo(GameMode.PAUSED);
				return;
			}
			gameState.selectedMenuIndex = 0;
			return;
		}

		if (input.moveY !== 0 && input.moveY !== this.lastMenuAxisY) {
			const direction = input.moveY > 0 ? 1 : -1;
			const buttons = this.buttons;
			if (buttons.length > 0) {
				gameState.selectedMenuIndex = (gameState.selectedMenuIndex + direction + buttons.length) % buttons.length;
			}
		}
		this.lastMenuAxisY = input.moveY;

		if (this.pointerPressed) {
			const hoveredIndex = this.buttons.findIndex((button) => button.hovered);
			if (hoveredIndex >= 0) {
				gameState.selectedMenuIndex = hoveredIndex;
				this.buttons[hoveredIndex].action();
				return;
			}
		}

		if (this.confirmPressed) {
			const selectedButton = this.buttons[gameState.selectedMenuIndex];
			if (selectedButton) {
				selectedButton.action();
			}
		}
	}

	private confirmOnButton(key: string): boolean {
		const button = this.buttons.find((candidate) => candidate.key === key);
		if (!button) return false;
		return button.hovered || button.selected;
	}
}

export function renderMenu(ctx: CanvasRenderingContext2D, mode: GameMode, buttons: MenuButton[], userInput: UserInput): void {
	const canvasW = userInput.screenW;
	const canvasH = userInput.screenH;
	const selectedIndex = Math.max(0, buttons.findIndex((button) => button.selected));

	if (mode === GameMode.MAIN_MENU) {
		ctx.fillStyle = '#090b14';
		ctx.fillRect(0, 0, canvasW, canvasH);
		const background = ctx.createRadialGradient(canvasW * 0.5, canvasH * 0.32, 60, canvasW * 0.5, canvasH * 0.32, canvasH * 0.95);
		background.addColorStop(0, 'rgba(120, 150, 255, 0.20)');
		background.addColorStop(0.52, 'rgba(36, 44, 76, 0.08)');
		background.addColorStop(1, 'rgba(0, 0, 0, 0)');
		ctx.fillStyle = background;
		ctx.fillRect(0, 0, canvasW, canvasH);
	} else if (mode === GameMode.PAUSED) {
		ctx.fillStyle = 'rgba(6, 8, 12, 0.72)';
		ctx.fillRect(0, 0, canvasW, canvasH);
	} else {
		ctx.fillStyle = 'rgba(0, 0, 0, 0.0)';
	}

	ctx.save();
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';

	if (mode !== GameMode.PLAYING) {
		ctx.fillStyle = '#eef2ff';
		ctx.font = 'bold 46px Georgia';
		ctx.fillText(mode === GameMode.MAIN_MENU ? 'STICK FIGHT' : 'PAUSED', canvasW * 0.5, canvasH * 0.22);
		ctx.fillStyle = '#9ca7c2';
		ctx.font = '18px Arial';
		ctx.fillText(mode === GameMode.MAIN_MENU ? 'Biomechanical ragdoll ECS demo' : 'Press Esc or Resume', canvasW * 0.5, canvasH * 0.22 + 44);
	}

	for (let i = 0; i < buttons.length; i++) {
		const button = buttons[i];
		const isSelected = i === selectedIndex;
		drawButton(ctx, button, isSelected);
	}

	if (mode === GameMode.PLAYING) {
		const button = buttons[0];
		drawButton(ctx, button, button.hovered || button.selected);
	}

	ctx.restore();
}

function drawButton(ctx: CanvasRenderingContext2D, button: MenuButton, selected: boolean): void {
	const fillByKind: Record<MenuButton['kind'], string> = {
		primary: '#2c6bed',
		secondary: '#1b2230',
		danger: '#8b2330'
	};
	const hoverBoost = button.hovered || selected ? 0.12 : 0;
	ctx.save();
	ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
	ctx.shadowBlur = 24;
	ctx.shadowOffsetY = 8;
	ctx.fillStyle = tint(fillByKind[button.kind], hoverBoost);
	ctx.strokeStyle = selected ? '#ffffff' : 'rgba(255,255,255,0.18)';
	ctx.lineWidth = selected ? 3 : 1.5;
	roundRect(ctx, button.x, button.y, button.w, button.h, 14);
	ctx.fill();
	ctx.stroke();
	ctx.shadowBlur = 0;
	ctx.fillStyle = '#f2f6ff';
	ctx.font = 'bold 20px Arial';
	ctx.fillText(button.label, button.x + button.w * 0.5, button.y + button.h * 0.5 + 1);
	ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
	const radius = Math.min(r, w * 0.5, h * 0.5);
	ctx.beginPath();
	ctx.moveTo(x + radius, y);
	ctx.lineTo(x + w - radius, y);
	ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
	ctx.lineTo(x + w, y + h - radius);
	ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
	ctx.lineTo(x + radius, y + h);
	ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
	ctx.lineTo(x, y + radius);
	ctx.quadraticCurveTo(x, y, x + radius, y);
	ctx.closePath();
}

function tint(color: string, amount: number): string {
	const hex = color.replace('#', '');
	const r = parseInt(hex.slice(0, 2), 16);
	const g = parseInt(hex.slice(2, 4), 16);
	const b = parseInt(hex.slice(4, 6), 16);
	const mix = (value: number) => Math.min(255, Math.round(value + (255 - value) * amount));
	return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}
