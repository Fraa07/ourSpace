export type EntityId = number;

export interface ComponentStore<T> {
	add(entity: EntityId, value: T): void;
	get(entity: EntityId): T | undefined;
	has(entity: EntityId): boolean;
	remove(entity: EntityId): boolean;
	clear(): void;
	forEach(fn: (entity: EntityId, value: T, denseIndex: number) => void): void;
	entities(): readonly EntityId[];
	values(): readonly T[];
}

export class SparseSetComponentStore<T> implements ComponentStore<T> {
	private static readonly PAGE_BITS = 10;
	private static readonly PAGE_SIZE = 1 << SparseSetComponentStore.PAGE_BITS;
	private static readonly ABSENT = -1;

	private denseEntities: EntityId[] = [];
	private denseValues: T[] = [];
	private sparsePages: Int32Array[] = [];

	get size(): number {
		return this.denseEntities.length;
	}

	entities(): readonly EntityId[] {
		return this.denseEntities;
	}

	values(): readonly T[] {
		return this.denseValues;
	}

	add(entity: EntityId, value: T): void {
		const denseIndex = this.getDenseIndex(entity);
		if (denseIndex !== SparseSetComponentStore.ABSENT) {
			this.denseValues[denseIndex] = value;
			return;
		}

		const nextDenseIndex = this.denseEntities.length;
		this.denseEntities.push(entity);
		this.denseValues.push(value);
		this.setDenseIndex(entity, nextDenseIndex);
	}

	get(entity: EntityId): T | undefined {
		const denseIndex = this.getDenseIndex(entity);
		if (denseIndex === SparseSetComponentStore.ABSENT) return undefined;
		return this.denseValues[denseIndex];
	}

	has(entity: EntityId): boolean {
		return this.getDenseIndex(entity) !== SparseSetComponentStore.ABSENT;
	}

	remove(entity: EntityId): boolean {
		const denseIndex = this.getDenseIndex(entity);
		if (denseIndex === SparseSetComponentStore.ABSENT) return false;

		const lastIndex = this.denseEntities.length - 1;
		const lastEntity = this.denseEntities[lastIndex];

		this.denseEntities[denseIndex] = lastEntity;
		this.denseValues[denseIndex] = this.denseValues[lastIndex];

		this.setDenseIndex(lastEntity, denseIndex);
		this.setDenseIndex(entity, SparseSetComponentStore.ABSENT);

		this.denseEntities.pop();
		this.denseValues.pop();
		return true;
	}

	clear(): void {
		this.denseEntities.length = 0;
		this.denseValues.length = 0;
		this.sparsePages.length = 0;
	}

	forEach(fn: (entity: EntityId, value: T, denseIndex: number) => void): void {
		for (let i = 0; i < this.denseEntities.length; i++) {
			fn(this.denseEntities[i], this.denseValues[i], i);
		}
	}

	private getDenseIndex(entity: EntityId): number {
		if (entity < 0) return SparseSetComponentStore.ABSENT;
		const page = this.sparsePages[this.pageIndex(entity)];
		if (!page) return SparseSetComponentStore.ABSENT;
		return page[this.offsetInPage(entity)];
	}

	private setDenseIndex(entity: EntityId, denseIndex: number): void {
		const pageIndex = this.pageIndex(entity);
		let page = this.sparsePages[pageIndex];
		if (!page) {
			page = new Int32Array(SparseSetComponentStore.PAGE_SIZE);
			page.fill(SparseSetComponentStore.ABSENT);
			this.sparsePages[pageIndex] = page;
		}
		page[this.offsetInPage(entity)] = denseIndex;
	}

	private pageIndex(entity: EntityId): number {
		return Math.floor(entity / SparseSetComponentStore.PAGE_SIZE);
	}

	private offsetInPage(entity: EntityId): number {
		return entity % SparseSetComponentStore.PAGE_SIZE;
	}
}

export class ObjectPool<T> {
	private readonly pool: T[] = [];

	constructor(
		private readonly factory: () => T,
		private readonly reset: (value: T) => void = () => undefined,
		initialSize = 0
	) {
		this.prewarm(initialSize);
	}

	acquire(): T {
		return this.pool.pop() ?? this.factory();
	}

	release(value: T): void {
		this.reset(value);
		this.pool.push(value);
	}

	prewarm(count: number): void {
		while (this.pool.length < count) {
			this.pool.push(this.factory());
		}
	}

	clear(): void {
		this.pool.length = 0;
	}

	get size(): number {
		return this.pool.length;
	}
}

export enum GameMode {
	MAIN_MENU = 'MAIN_MENU',
	PLAYING = 'PLAYING',
	PAUSED = 'PAUSED'
}

export interface Transform {
	x: number;
	y: number;
	rotation: number;
	scaleX: number;
	scaleY: number;
	vx: number;
	vy: number;
	lean: number;
	width: number;
	height: number;
}

export interface InputState {
	moveX: number;
	moveY: number;
	jump: boolean;
	pause: boolean;
	confirm: boolean;
	back: boolean;
	screenX: number;
	screenY: number;
	aimX: number;
	aimY: number;
	mouseDown: boolean;
	mousePressed: boolean;
	mouseReleased: boolean;
}

export interface IKChain {
	shoulderIndex: number;
	elbowIndex: number;
	handIndex: number;
	upperLength: number;
	lowerLength: number;
	bendSign: 1 | -1;
	targetX: number;
	targetY: number;
	enabled: boolean;
}

export interface IKArm {
	left: IKChain;
	right: IKChain;
}

export interface GameState {
	mode: GameMode;
	previousMode: GameMode;
	queuedMode: GameMode | null;
	selectedMenuIndex: number;
	sceneRevision: number;
}

export interface VerletPointLike {
	x: number;
	y: number;
	prevX: number;
	prevY: number;
	ax: number;
	ay: number;
	invMass: number;
	radius: number;
}

export interface VerletStickLike {
	a: number;
	b: number;
	restLength: number;
	stiffness: number;
}

export interface VerletBody {
	readonly points: VerletPointLike[];
	readonly sticks: VerletStickLike[];
	grounded: boolean;
	facing: 1 | -1;
	walkPhase: number;
	scale: number;
	rootIndex: number;
	headIndex: number;
	neckIndex: number;
	chestIndex: number;
	pelvisIndex: number;
	leftShoulderIndex: number;
	leftElbowIndex: number;
	leftHandIndex: number;
	rightShoulderIndex: number;
	rightElbowIndex: number;
	rightHandIndex: number;
	leftFootIndex: number;
	rightFootIndex: number;
	translate(dx: number, dy: number): void;
	applyImpulseToPoint(index: number, impulseX: number, impulseY: number): void;
	applyImpulse(impulseX: number, impulseY: number, indices?: number[]): void;
	reset(originX: number, originY: number, scale?: number): this;
}

export function createDefaultTransform(x = 0, y = 0): Transform {
	return {
		x,
		y,
		rotation: 0,
		scaleX: 1,
		scaleY: 1,
		vx: 0,
		vy: 0,
		lean: 0,
		width: 48,
		height: 96
	};
}

export function createDefaultInputState(): InputState {
	return {
		moveX: 0,
		moveY: 0,
		jump: false,
		pause: false,
		confirm: false,
		back: false,
		screenX: 0,
		screenY: 0,
		aimX: 0,
		aimY: 0,
		mouseDown: false,
		mousePressed: false,
		mouseReleased: false
	};
}

export function createDefaultIKArm(): IKArm {
	return {
		left: {
			shoulderIndex: 2,
			elbowIndex: 4,
			handIndex: 5,
			upperLength: 24,
			lowerLength: 24,
			bendSign: -1,
			targetX: 0,
			targetY: 0,
			enabled: true
		},
		right: {
			shoulderIndex: 2,
			elbowIndex: 6,
			handIndex: 7,
			upperLength: 24,
			lowerLength: 24,
			bendSign: 1,
			targetX: 0,
			targetY: 0,
			enabled: true
		}
	};
}

export function createDefaultGameState(): GameState {
	return {
		mode: GameMode.MAIN_MENU,
		previousMode: GameMode.MAIN_MENU,
		queuedMode: null,
		selectedMenuIndex: 0,
		sceneRevision: 0
	};
}

export class WorldManager {
	private nextEntityId = 0;
	private freeList: EntityId[] = [];
	private aliveEntities = new Set<EntityId>();
	private signatures = new Map<EntityId, bigint>();
	private tags = new Map<EntityId, Set<string>>();
	private componentBits = new Map<string, bigint>();
	private componentStores = new Map<string, ComponentStore<unknown>>();
	private nextComponentBit = 0;
	private queryCache = new Map<string, EntityId[]>();
	private globalEntity: EntityId | null = null;

	createEntity(tags: string[] = []): EntityId {
		const entity = this.freeList.length > 0 ? this.freeList.pop()! : this.nextEntityId++;
		this.aliveEntities.add(entity);
		this.signatures.set(entity, 0n);
		if (tags.length > 0) {
			for (const tag of tags) {
				this.addTag(entity, tag);
			}
		}
		return entity;
	}

	destroyEntity(entity: EntityId): void {
		if (!this.aliveEntities.has(entity)) return;

		const signature = this.signatures.get(entity) ?? 0n;
		for (const [name, bit] of this.componentBits.entries()) {
			if ((signature & bit) !== 0n) {
				this.componentStores.get(name)?.remove(entity);
			}
		}

		this.tags.delete(entity);
		this.signatures.delete(entity);
		this.aliveEntities.delete(entity);
		this.freeList.push(entity);
		if (this.globalEntity === entity) {
			this.globalEntity = null;
		}
		this.invalidateQueries();
	}

	clearExceptTags(keepTags: string[] = []): void {
		const keep = new Set(keepTags);
		const toDestroy: EntityId[] = [];
		for (const entity of this.aliveEntities) {
			const entityTags = this.tags.get(entity);
			if (!entityTags) {
				toDestroy.push(entity);
				continue;
			}
			let preserve = false;
			for (const tag of entityTags) {
				if (keep.has(tag)) {
					preserve = true;
					break;
				}
			}
			if (!preserve) {
				toDestroy.push(entity);
			}
		}
		for (const entity of toDestroy) {
			this.destroyEntity(entity);
		}
	}

	destroyTagged(...tagNames: string[]): void {
		const targets = new Set<EntityId>();
		for (const tagName of tagNames) {
			const set = this.tagIndex.get(tagName);
			if (!set) continue;
			for (const entity of set) {
				targets.add(entity);
			}
		}
		for (const entity of targets) {
			this.destroyEntity(entity);
		}
	}

	addTag(entity: EntityId, tag: string): void {
		if (!this.aliveEntities.has(entity)) return;
		let entityTags = this.tags.get(entity);
		if (!entityTags) {
			entityTags = new Set<string>();
			this.tags.set(entity, entityTags);
		}
		entityTags.add(tag);
		let taggedEntities = this.tagIndex.get(tag);
		if (!taggedEntities) {
			taggedEntities = new Set<EntityId>();
			this.tagIndex.set(tag, taggedEntities);
		}
		taggedEntities.add(entity);
	}

	removeTag(entity: EntityId, tag: string): void {
		const entityTags = this.tags.get(entity);
		if (!entityTags) return;
		entityTags.delete(tag);
		const taggedEntities = this.tagIndex.get(tag);
		taggedEntities?.delete(entity);
	}

	hasTag(entity: EntityId, tag: string): boolean {
		return this.tags.get(entity)?.has(tag) ?? false;
	}

	registerComponent<T>(name: string, store: ComponentStore<T> = new SparseSetComponentStore<T>()): void {
		if (this.componentBits.has(name)) return;
		this.componentBits.set(name, 1n << BigInt(this.nextComponentBit++));
		this.componentStores.set(name, store as ComponentStore<unknown>);
	}

	addComponent<T>(entity: EntityId, name: string, value: T): void {
		if (!this.componentBits.has(name)) {
			this.registerComponent<T>(name);
		}
		this.componentStores.get(name)?.add(entity, value as never);
		const bit = this.componentBits.get(name);
		if (bit === undefined) return;
		const currentSignature = this.signatures.get(entity) ?? 0n;
		this.signatures.set(entity, currentSignature | bit);
		this.invalidateQueries();
	}

	getComponent<T>(entity: EntityId, name: string): T | undefined {
		return this.componentStores.get(name)?.get(entity) as T | undefined;
	}

	hasComponent(entity: EntityId, name: string): boolean {
		const bit = this.componentBits.get(name);
		if (bit === undefined) return false;
		return ((this.signatures.get(entity) ?? 0n) & bit) !== 0n;
	}

	removeComponent(entity: EntityId, name: string): boolean {
		const removed = this.componentStores.get(name)?.remove(entity) ?? false;
		if (!removed) return false;
		const bit = this.componentBits.get(name);
		if (bit !== undefined) {
			const currentSignature = this.signatures.get(entity) ?? 0n;
			this.signatures.set(entity, currentSignature & ~bit);
		}
		this.invalidateQueries();
		return true;
	}

	query(include: string[], exclude: string[] = []): EntityId[] {
		const includeMask = this.resolveMask(include, true);
		if (includeMask === null) return [];
		const excludeMask = this.resolveMask(exclude, false) ?? 0n;
		const cacheKey = `${includeMask.toString()}|${excludeMask.toString()}`;
		const cached = this.queryCache.get(cacheKey);
		if (cached && cached.length > 0) {
			return cached;
		}

		const results: EntityId[] = [];
		for (const entity of this.aliveEntities) {
			const signature = this.signatures.get(entity) ?? 0n;
			if ((signature & includeMask) !== includeMask) continue;
			if ((signature & excludeMask) !== 0n) continue;
			results.push(entity);
		}
		this.queryCache.set(cacheKey, results);
		return results;
	}

	ensureGlobalEntity(): EntityId {
		if (this.globalEntity !== null && this.aliveEntities.has(this.globalEntity)) {
			return this.globalEntity;
		}
		const entity = this.createEntity(['global']);
		this.globalEntity = entity;
		return entity;
	}

	getGlobalEntity(): EntityId | null {
		return this.globalEntity;
	}

	setGlobalEntity(entity: EntityId): void {
		this.globalEntity = entity;
		this.addTag(entity, 'global');
	}

	private tagIndex = new Map<string, Set<EntityId>>();

	private resolveMask(names: string[], strict: boolean): bigint | null {
		let mask = 0n;
		for (const name of names) {
			const bit = this.componentBits.get(name);
			if (bit === undefined) {
				if (strict) return null;
				continue;
			}
			mask |= bit;
		}
		return mask;
	}

	private invalidateQueries(): void {
		this.queryCache.clear();
	}
}

export function registerCoreComponents(world: WorldManager): void {
	world.registerComponent<Transform>('Transform');
	world.registerComponent<VerletBody>('VerletBody');
	world.registerComponent<InputState>('InputState');
	world.registerComponent<IKArm>('IKArm');
	world.registerComponent<GameState>('GameState');
}
