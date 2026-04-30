import { createDefaultIKArm, createDefaultInputState, createDefaultTransform, EntityId, GameMode, GameState, IKArm, IKChain, InputState, ObjectPool, Transform, WorldManager } from './ecs';

export interface Vec2 {
	x: number;
	y: number;
}

export class VerletPoint {
	constructor(
		public x: number,
		public y: number,
		public prevX: number = x,
		public prevY: number = y,
		public ax: number = 0,
		public ay: number = 0,
		public invMass: number = 1,
		public radius: number = 6
	) {}
}

export class VerletStick {
	constructor(
		public a: number,
		public b: number,
		public restLength: number,
		public stiffness: number
	) {}
}

export interface AABB {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
}

export interface Platform {
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface SweepHit {
	hit: boolean;
	t: number;
	nx: number;
	ny: number;
}

export type BodyControlMode = 'controlled' | 'ragdoll';

const WORLD_LEFT = -980;
const WORLD_RIGHT = 980;
const WORLD_TOP = -520;
const WORLD_BOTTOM = 380;
const FLOOR_Y = 320;

const BODY_OFFSETS: Vec2[] = [
	{ x: 0, y: -52 },
	{ x: 0, y: -40 },
	{ x: 0, y: -24 },
	{ x: 0, y: 0 },
	{ x: -18, y: -16 },
	{ x: -34, y: 4 },
	{ x: 18, y: -16 },
	{ x: 34, y: 4 },
	{ x: -8, y: 36 },
	{ x: 8, y: 36 }
];

const BODY_RADII = [10, 7, 8, 8, 6, 5, 6, 5, 6, 6];
const BODY_STICKS: Array<[number, number, number]> = [
	[0, 1, 0.95],
	[1, 2, 0.95],
	[2, 3, 0.96],
	[2, 4, 0.92],
	[4, 5, 0.92],
	[2, 6, 0.92],
	[6, 7, 0.92],
	[3, 8, 0.95],
	[3, 9, 0.95]
];

export class VerletBody {
	readonly points: VerletPoint[] = [];
	readonly sticks: VerletStick[] = [];
	mode: BodyControlMode = 'controlled';
	grounded = false;
	facing: 1 | -1 = 1;
	walkPhase = 0;
	scale = 1;
	controllerX = 0;
	controllerY = 0;
	controllerVX = 0;
	controllerVY = 0;
	rootIndex = 3;
	headIndex = 0;
	neckIndex = 1;
	chestIndex = 2;
	pelvisIndex = 3;
	leftShoulderIndex = 2;
	leftElbowIndex = 4;
	leftHandIndex = 5;
	rightShoulderIndex = 2;
	rightElbowIndex = 6;
	rightHandIndex = 7;
	leftFootIndex = 8;
	rightFootIndex = 9;

	constructor(originX = 0, originY = 0, scale = 1) {
		for (let i = 0; i < BODY_OFFSETS.length; i++) {
			const p = BODY_OFFSETS[i];
			this.points.push(new VerletPoint(originX + p.x * scale, originY + p.y * scale, originX + p.x * scale, originY + p.y * scale, 0, 0, 1, BODY_RADII[i] * scale));
		}
		for (const [a, b, stiffness] of BODY_STICKS) {
			this.sticks.push(new VerletStick(a, b, this.distanceBetweenIndices(a, b), stiffness));
		}
		this.scale = scale;
	}

	reset(originX: number, originY: number, scale = this.scale): this {
		this.scale = scale;
		this.mode = 'controlled';
		for (let i = 0; i < this.points.length; i++) {
			const offset = BODY_OFFSETS[i];
			const px = originX + offset.x * scale;
			const py = originY + offset.y * scale;
			const point = this.points[i];
			point.x = px;
			point.y = py;
			point.prevX = px;
			point.prevY = py;
			point.ax = 0;
			point.ay = 0;
			point.invMass = 1;
			point.radius = BODY_RADII[i] * scale;
		}
		for (let i = 0; i < this.sticks.length; i++) {
			const stick = this.sticks[i];
			stick.restLength = this.distanceBetweenIndices(stick.a, stick.b);
		}
		this.grounded = false;
		this.facing = 1;
		this.walkPhase = 0;
		this.controllerX = originX;
		this.controllerY = originY;
		this.controllerVX = 0;
		this.controllerVY = 0;
		return this;
	}

	setRagdoll(): void {
		this.mode = 'ragdoll';
	}

	setControlled(): void {
		this.mode = 'controlled';
	}

	translate(dx: number, dy: number): void {
		for (const point of this.points) {
			point.x += dx;
			point.y += dy;
			point.prevX += dx;
			point.prevY += dy;
		}
	}

	applyImpulseToPoint(index: number, impulseX: number, impulseY: number): void {
		const point = this.points[index];
		if (!point || point.invMass <= 0) return;
		point.prevX -= impulseX * point.invMass;
		point.prevY -= impulseY * point.invMass;
	}

	applyImpulse(impulseX: number, impulseY: number, indices: number[] = [this.pelvisIndex, this.chestIndex]): void {
		for (const index of indices) {
			this.applyImpulseToPoint(index, impulseX, impulseY);
		}
	}

	private distanceBetweenIndices(a: number, b: number): number {
		const pa = BODY_OFFSETS[a];
		const pb = BODY_OFFSETS[b];
		const dx = (pb.x - pa.x) * this.scale;
		const dy = (pb.y - pa.y) * this.scale;
		return Math.hypot(dx, dy);
	}
}

export function createVerletBodyPool(initialSize = 4): ObjectPool<VerletBody> {
	return new ObjectPool(
		() => new VerletBody(0, 0, 1),
		(body) => body.reset(0, 0, 1),
		initialSize
	);
}

export function solveTwoBoneIK(root: Vec2, target: Vec2, lenA: number, lenB: number, bendSign: 1 | -1) {
	const dx = target.x - root.x;
	const dy = target.y - root.y;
	const distance = Math.hypot(dx, dy);
	const minDistance = Math.abs(lenA - lenB) + 1e-6;
	const maxDistance = lenA + lenB - 1e-6;
	const clampedDistance = Math.min(Math.max(distance, minDistance), maxDistance);
	const baseAngle = Math.atan2(dy, dx);

	let cosElbow = (lenA * lenA + lenB * lenB - clampedDistance * clampedDistance) / (2 * lenA * lenB);
	cosElbow = clamp(cosElbow, -1, 1);
	const elbowInnerAngle = Math.acos(cosElbow);

	let cosShoulder = (lenA * lenA + clampedDistance * clampedDistance - lenB * lenB) / (2 * lenA * clampedDistance);
	cosShoulder = clamp(cosShoulder, -1, 1);
	const shoulderOffset = Math.acos(cosShoulder);

	const shoulderAngle = baseAngle - bendSign * shoulderOffset;
	const elbowAngle = shoulderAngle + bendSign * (Math.PI - elbowInnerAngle);

	const joint = {
		x: root.x + Math.cos(shoulderAngle) * lenA,
		y: root.y + Math.sin(shoulderAngle) * lenA
	};

	const end = {
		x: joint.x + Math.cos(elbowAngle) * lenB,
		y: joint.y + Math.sin(elbowAngle) * lenB
	};

	return {
		shoulderAngle,
		elbowAngle: elbowInnerAngle,
		joint,
		end
	};
}

export function applyArmIK(body: VerletBody, arm: IKChain, targetX: number, targetY: number): void {
	if (!arm.enabled) return;
	const root = body.points[arm.shoulderIndex];
	const solution = solveTwoBoneIK(root, { x: targetX, y: targetY }, arm.upperLength, arm.lowerLength, arm.bendSign);

	const elbow = body.points[arm.elbowIndex];
	const hand = body.points[arm.handIndex];

	elbow.x = solution.joint.x;
	elbow.y = solution.joint.y;
	elbow.prevX = elbow.x;
	elbow.prevY = elbow.y;
	elbow.ax = 0;
	elbow.ay = 0;

	hand.x = solution.end.x;
	hand.y = solution.end.y;
	hand.prevX = hand.x;
	hand.prevY = hand.y;
	hand.ax = 0;
	hand.ay = 0;
}

export function createArmChain(body: VerletBody, shoulderIndex: number, elbowIndex: number, handIndex: number, bendSign: 1 | -1): IKChain {
	const shoulder = body.points[shoulderIndex];
	const elbow = body.points[elbowIndex];
	const hand = body.points[handIndex];
	return {
		shoulderIndex,
		elbowIndex,
		handIndex,
		upperLength: Math.hypot(elbow.x - shoulder.x, elbow.y - shoulder.y),
		lowerLength: Math.hypot(hand.x - elbow.x, hand.y - elbow.y),
		bendSign,
		targetX: hand.x,
		targetY: hand.y,
		enabled: true
	};
}

export function createDefaultBodyTransform(body: VerletBody): Transform {
	const chest = body.points[body.chestIndex];
	const pelvis = body.points[body.pelvisIndex];
	return {
		x: chest.x,
		y: chest.y,
		rotation: Math.atan2(chest.y - pelvis.y, chest.x - pelvis.x),
		scaleX: 1,
		scaleY: 1,
		vx: 0,
		vy: 0,
		lean: 0,
		width: 48,
		height: 96
	};
}

export function spawnBiomechanicalEntity(world: WorldManager, bodyPool: ObjectPool<VerletBody>, spawnX: number, spawnY: number, controlled = true): EntityId {
	const entity = world.createEntity(controlled ? ['ragdoll', 'player'] : ['ragdoll']);
	const body = bodyPool.acquire();
	body.reset(spawnX, spawnY, 1);
	const transform = createDefaultBodyTransform(body);
	const input = createDefaultInputState();
	const arms = createDefaultIKArm();
	arms.left = createArmChain(body, body.leftShoulderIndex, body.leftElbowIndex, body.leftHandIndex, -1);
	arms.right = createArmChain(body, body.rightShoulderIndex, body.rightElbowIndex, body.rightHandIndex, 1);
	world.addComponent(entity, 'VerletBody', body);
	world.addComponent(entity, 'Transform', transform);
	world.addComponent(entity, 'InputState', input);
	world.addComponent(entity, 'IKArm', arms);
	return entity;
}

export function releaseBiomechanicalEntity(world: WorldManager, bodyPool: ObjectPool<VerletBody>, entity: EntityId): void {
	const body = world.getComponent<VerletBody>(entity, 'VerletBody');
	if (body) {
		bodyPool.release(body);
	}
	world.destroyEntity(entity);
}

export function sweptAabb(moving: AABB, velocityX: number, velocityY: number, target: AABB): SweepHit {
	let xEntry: number;
	let yEntry: number;
	let xExit: number;
	let yExit: number;

	if (velocityX > 0) {
		xEntry = (target.minX - moving.maxX) / velocityX;
		xExit = (target.maxX - moving.minX) / velocityX;
	} else if (velocityX < 0) {
		xEntry = (target.maxX - moving.minX) / velocityX;
		xExit = (target.minX - moving.maxX) / velocityX;
	} else {
		xEntry = Number.NEGATIVE_INFINITY;
		xExit = Number.POSITIVE_INFINITY;
	}

	if (velocityY > 0) {
		yEntry = (target.minY - moving.maxY) / velocityY;
		yExit = (target.maxY - moving.minY) / velocityY;
	} else if (velocityY < 0) {
		yEntry = (target.maxY - moving.minY) / velocityY;
		yExit = (target.minY - moving.maxY) / velocityY;
	} else {
		yEntry = Number.NEGATIVE_INFINITY;
		yExit = Number.POSITIVE_INFINITY;
	}

	const entry = Math.max(xEntry, yEntry);
	const exit = Math.min(xExit, yExit);

	if (entry > exit || entry < 0 || entry > 1) {
		return { hit: false, t: 1, nx: 0, ny: 0 };
	}

	if (xEntry > yEntry) {
		return { hit: true, t: entry, nx: velocityX > 0 ? -1 : 1, ny: 0 };
	}

	return { hit: true, t: entry, nx: 0, ny: velocityY > 0 ? -1 : 1 };
}

export class VerletPhysicsSystem {
	constructor(
		private readonly platforms: Platform[],
		private readonly options: {
			gravityY: number;
			iterations: number;
			substeps: number;
			walkForce: number;
			airForce: number;
			jumpVelocity: number;
			bounce: number;
			groundFriction: number;
		} = {
			gravityY: 2200,
			iterations: 8,
			substeps: 2,
			walkForce: 860,
			airForce: 360,
			jumpVelocity: 860,
			bounce: 0.05,
			groundFriction: 0.15
		}
	) {}

	update(world: WorldManager, dt: number): void {
		const globalEntity = world.getGlobalEntity();
		if (globalEntity !== null) {
			const gameState = world.getComponent<GameState>(globalEntity, 'GameState');
			if (gameState && gameState.mode !== GameMode.PLAYING) return;
		}

		const entities = world.query(['VerletBody', 'Transform']);
		for (const entity of entities) {
			const body = world.getComponent<VerletBody>(entity, 'VerletBody');
			const transform = world.getComponent<Transform>(entity, 'Transform');
			if (!body || !transform) continue;
			const input = world.getComponent<InputState>(entity, 'InputState');
			const arms = world.getComponent<IKArm>(entity, 'IKArm');
			if (body.mode === 'controlled') {
				this.stepControlledEntity(body, transform, input, arms, dt);
			} else {
				this.stepRagdollEntity(body, transform, input, arms, dt);
			}
		}
	}

	private stepControlledEntity(body: VerletBody, transform: Transform, input: InputState | undefined, arms: IKArm | undefined, dt: number): void {
		const moveX = input?.moveX ?? 0;
		const wantsJump = input?.jump ?? false;
		const accel = body.grounded ? this.options.walkForce : this.options.airForce;
		const friction = body.grounded ? 0.82 : 0.94;

		if (Math.abs(moveX) > 0.001) {
			body.controllerVX += moveX * accel * dt;
			body.facing = moveX > 0 ? 1 : -1;
		} else {
			body.controllerVX *= friction;
		}

		body.controllerVX = clamp(body.controllerVX, -this.options.walkForce, this.options.walkForce);

		if (wantsJump && body.grounded) {
			body.controllerVY = -this.options.jumpVelocity;
			body.grounded = false;
		}

		body.controllerVY += this.options.gravityY * dt;
		if (body.controllerVY > this.options.jumpVelocity * 1.75) {
			body.controllerVY = this.options.jumpVelocity * 1.75;
		}

		const previousX = body.controllerX;
		const previousY = body.controllerY;
		let nextX = previousX + body.controllerVX * dt;
		let nextY = previousY + body.controllerVY * dt;

		const boundsXMin = WORLD_LEFT + 38 * body.scale;
		const boundsXMax = WORLD_RIGHT - 38 * body.scale;
		nextX = clamp(nextX, boundsXMin, boundsXMax);

		let landedOnPlatform = false;
		let bestHitTime: number | null = null;
		const bodyBox: AABB = {
			minX: previousX - 18 * body.scale,
			minY: previousY - 48 * body.scale,
			maxX: previousX + 18 * body.scale,
			maxY: previousY + 48 * body.scale
		};
		const dx = nextX - previousX;
		const dy = nextY - previousY;

		for (const platform of this.platforms) {
			const platformBox: AABB = {
				minX: platform.x - platform.w / 2,
				minY: platform.y - platform.h / 2,
				maxX: platform.x + platform.w / 2,
				maxY: platform.y + platform.h / 2
			};
			const hit = sweptAabb(bodyBox, dx, dy, platformBox);
			if (!hit.hit) continue;

			const impactX = previousX + dx * hit.t;
			const impactY = previousY + dy * hit.t;
			if (hit.ny < 0) {
				const landingY = platformBox.minY - 48 * body.scale;
				if (bestHitTime === null || hit.t < bestHitTime) {
					bestHitTime = hit.t;
					landedOnPlatform = true;
					nextX = impactX;
					nextY = landingY;
					body.controllerVY = 0;
				}
			} else if (hit.nx !== 0) {
				nextX = impactX;
				body.controllerVX = 0;
			}
		}

		if (!landedOnPlatform) {
			const groundY = FLOOR_Y - 48 * body.scale;
			if (nextY >= groundY) {
				nextY = groundY;
				body.controllerVY = 0;
				body.grounded = true;
			} else {
				body.grounded = false;
			}
		} else {
			body.grounded = true;
		}

		const shiftX = nextX - body.controllerX;
		const shiftY = nextY - body.controllerY;
		body.controllerX = nextX;
		body.controllerY = nextY;
		if (shiftX !== 0 || shiftY !== 0) {
			body.translate(shiftX, shiftY);
		}

		body.walkPhase += Math.abs(body.controllerVX) * dt * 0.03 + Math.abs(moveX) * dt * 6;

		if (input && arms) {
			arms.left.targetX = input.aimX;
			arms.left.targetY = input.aimY;
			arms.right.targetX = input.aimX;
			arms.right.targetY = input.aimY;
			applyArmIK(body, arms.left, input.aimX, input.aimY);
			applyArmIK(body, arms.right, input.aimX, input.aimY);
		}

		const chest = body.points[body.chestIndex];
		const pelvis = body.points[body.pelvisIndex];
		transform.x = body.controllerX;
		transform.y = body.controllerY;
		transform.vx = body.controllerVX;
		transform.vy = body.controllerVY;
		transform.rotation = Math.atan2(chest.y - pelvis.y, chest.x - pelvis.x);
		transform.lean = clamp(body.controllerVX / this.options.walkForce * 0.22, -0.35, 0.35);
	}

	private stepRagdollEntity(body: VerletBody, transform: Transform, input: InputState | undefined, arms: IKArm | undefined, dt: number): void {
		const subDt = dt / this.options.substeps;
		for (let substep = 0; substep < this.options.substeps; substep++) {
			const moveX = input?.moveX ?? 0;
			if (input?.jump && body.grounded) {
				body.applyImpulse(0, -this.options.jumpVelocity, [body.pelvisIndex, body.chestIndex]);
				body.grounded = false;
			}

			body.walkPhase += Math.abs(moveX) * subDt * 9;
			const horizontalImpulse = body.grounded ? this.options.walkForce : this.options.airForce;
			const lateral = moveX * horizontalImpulse * subDt;
			if (lateral !== 0) {
				body.applyImpulse(lateral, 0, [body.pelvisIndex, body.chestIndex]);
			}

			for (const point of body.points) {
				point.ay += this.options.gravityY;
			}

			this.integrate(body, subDt);
			this.resolveSweptCollisions(body);
			for (let i = 0; i < this.options.iterations; i++) {
				this.solveSticks(body);
				this.solvePointPlatforms(body);
			}
			this.constrainToWorld(body);

			if (input && arms) {
				arms.left.targetX = input.aimX;
				arms.left.targetY = input.aimY;
				arms.right.targetX = input.aimX;
				arms.right.targetY = input.aimY;
				applyArmIK(body, arms.left, input.aimX, input.aimY);
				applyArmIK(body, arms.right, input.aimX, input.aimY);
			}
		}

		const chest = body.points[body.chestIndex];
		const pelvis = body.points[body.pelvisIndex];
		transform.x = chest.x;
		transform.y = chest.y;
		transform.vx = (chest.x - chest.prevX) / dt;
		transform.vy = (chest.y - chest.prevY) / dt;
		transform.rotation = Math.atan2(chest.y - pelvis.y, chest.x - pelvis.x);
		transform.lean = clamp((chest.x - pelvis.x) / 80, -0.35, 0.35);
		body.facing = transform.lean >= 0 ? 1 : -1;
	}

	private integrate(body: VerletBody, dt: number): void {
		const dtSq = dt * dt;
		for (const point of body.points) {
			if (point.invMass <= 0) continue;
			const velocityX = (point.x - point.prevX) * 0.995;
			const velocityY = (point.y - point.prevY) * 0.995;
			point.prevX = point.x;
			point.prevY = point.y;
			point.x += velocityX + point.ax * dtSq;
			point.y += velocityY + point.ay * dtSq;
			point.ax = 0;
			point.ay = 0;
		}
	}

	private solveSticks(body: VerletBody): void {
		for (const stick of body.sticks) {
			const a = body.points[stick.a];
			const b = body.points[stick.b];
			const dx = b.x - a.x;
			const dy = b.y - a.y;
			const distance = Math.hypot(dx, dy);
			if (distance <= 1e-6) continue;
			const diff = (distance - stick.restLength) / distance;
			const inverseMassA = a.invMass;
			const inverseMassB = b.invMass;
			const totalInverseMass = inverseMassA + inverseMassB;
			if (totalInverseMass <= 0) continue;
			const correction = stick.stiffness * diff;
			const offsetX = dx * correction;
			const offsetY = dy * correction;
			a.x += offsetX * (inverseMassA / totalInverseMass);
			a.y += offsetY * (inverseMassA / totalInverseMass);
			b.x -= offsetX * (inverseMassB / totalInverseMass);
			b.y -= offsetY * (inverseMassB / totalInverseMass);
		}
	}

	private resolveSweptCollisions(body: VerletBody): void {
		const root = body.points[body.pelvisIndex];
		const previousX = root.prevX;
		const previousY = root.prevY;
		const displacementX = root.x - previousX;
		const displacementY = root.y - previousY;
		if (Math.abs(displacementX) < 1e-8 && Math.abs(displacementY) < 1e-8) return;

		const halfWidth = 22 * body.scale;
		const halfHeight = 48 * body.scale;
		const moving: AABB = {
			minX: previousX - halfWidth,
			minY: previousY - halfHeight,
			maxX: previousX + halfWidth,
			maxY: previousY + halfHeight
		};

		for (const platform of this.platforms) {
			const platformBox: AABB = {
				minX: platform.x - platform.w / 2,
				minY: platform.y - platform.h / 2,
				maxX: platform.x + platform.w / 2,
				maxY: platform.y + platform.h / 2
			};
			const hit = sweptAabb(moving, displacementX, displacementY, platformBox);
			if (!hit.hit) continue;

			const impactX = previousX + displacementX * hit.t;
			const impactY = previousY + displacementY * hit.t;
			const shiftX = impactX - root.x;
			const shiftY = impactY - root.y;
			body.translate(shiftX, shiftY);

			for (const point of body.points) {
				if (hit.nx !== 0) {
					const vx = point.x - point.prevX;
					point.prevX = point.x + vx * this.options.bounce;
				}
				if (hit.ny !== 0) {
					const vy = point.y - point.prevY;
					point.prevY = point.y + vy * this.options.bounce;
					point.prevX = point.x - (point.x - point.prevX) * this.options.groundFriction;
				}
			}

			if (hit.ny < 0) {
				body.grounded = true;
			}
		}
	}

	private solvePointPlatforms(body: VerletBody): void {
		let grounded = false;
		for (const point of body.points) {
			for (const platform of this.platforms) {
				const left = platform.x - platform.w / 2;
				const right = platform.x + platform.w / 2;
				const top = platform.y - platform.h / 2;
				if (point.x < left - point.radius || point.x > right + point.radius) continue;
				const currentBottom = point.y + point.radius;
				const movingDownwardOrSettled = point.y >= point.prevY;
				const overlapsFromAbove = point.y <= top && currentBottom >= top;
				const penetratesWhileFalling = currentBottom >= top && movingDownwardOrSettled;
				if (overlapsFromAbove || penetratesWhileFalling) {
					point.y = top - point.radius;
					const vy = point.y - point.prevY;
					point.prevY = point.y + vy * this.options.bounce;
					point.prevX = point.x - (point.x - point.prevX) * this.options.groundFriction;
					grounded = true;
				}
			}
		}
		body.grounded = grounded;
	}

	private constrainToWorld(body: VerletBody): void {
		const root = body.points[body.pelvisIndex];
		const minX = WORLD_LEFT + 42 * body.scale;
		const maxX = WORLD_RIGHT - 42 * body.scale;
		const minY = WORLD_TOP + 60 * body.scale;
		const maxY = WORLD_BOTTOM - 36 * body.scale;

		let shiftX = 0;
		let shiftY = 0;
		if (root.x < minX) shiftX = minX - root.x;
		else if (root.x > maxX) shiftX = maxX - root.x;
		if (root.y < minY) shiftY = minY - root.y;
		else if (root.y > maxY) shiftY = maxY - root.y;

		if (shiftX !== 0 || shiftY !== 0) {
			body.translate(shiftX, shiftY);
			for (const point of body.points) {
				if (shiftX !== 0) point.prevX = point.x;
				if (shiftY !== 0) point.prevY = point.y;
			}
			if (shiftY < 0) {
				body.grounded = true;
			}
		}
	}
}

export function drawVerletBody(ctx: CanvasRenderingContext2D, body: VerletBody, name?: string): void {
	const p = body.points;
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';

	drawBone(ctx, p[0], p[1], 6.6, '#11151f', '#efe0c4');
	drawBone(ctx, p[1], p[2], 7.2, '#11151f', '#ddc9aa');
	drawBone(ctx, p[2], p[3], 8.8, '#10131a', '#d9c6a8');
	drawBone(ctx, p[2], p[4], 5.8, '#11151f', '#f0e2c7');
	drawBone(ctx, p[4], p[5], 5.2, '#11151f', '#f0e2c7');
	drawBone(ctx, p[2], p[6], 5.8, '#11151f', '#d9c1a6');
	drawBone(ctx, p[6], p[7], 5.2, '#11151f', '#d9c1a6');
	drawBone(ctx, p[3], p[8], 6.4, '#10131a', '#c2aa8f');
	drawBone(ctx, p[3], p[9], 6.4, '#10131a', '#b49c85');

	ctx.fillStyle = '#f2e5ca';
	ctx.beginPath();
	ctx.arc(p[0].x, p[0].y, p[0].radius, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = '#11151f';
	ctx.lineWidth = 2;
	ctx.stroke();

	drawJoint(ctx, p[1].x, p[1].y, p[1].radius);
	drawJoint(ctx, p[2].x, p[2].y, p[2].radius);
	drawJoint(ctx, p[3].x, p[3].y, p[3].radius);
	drawJoint(ctx, p[4].x, p[4].y, p[4].radius);
	drawJoint(ctx, p[5].x, p[5].y, p[5].radius);
	drawJoint(ctx, p[6].x, p[6].y, p[6].radius);
	drawJoint(ctx, p[7].x, p[7].y, p[7].radius);
	drawJoint(ctx, p[8].x, p[8].y, p[8].radius);
	drawJoint(ctx, p[9].x, p[9].y, p[9].radius);

	if (name) {
		ctx.fillStyle = '#f8eedf';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'bottom';
		ctx.font = 'bold 14px Georgia';
		ctx.fillText(name, p[2].x, p[0].y - 18);
	}
}

function drawJoint(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
	ctx.fillStyle = '#11151f';
	ctx.beginPath();
	ctx.arc(x, y, r, 0, Math.PI * 2);
	ctx.fill();
}

function drawBone(ctx: CanvasRenderingContext2D, a: Vec2, b: Vec2, width: number, outlineColor: string, fillColor: string): void {
	ctx.strokeStyle = outlineColor;
	ctx.lineWidth = width;
	ctx.beginPath();
	ctx.moveTo(a.x, a.y);
	ctx.lineTo(b.x, b.y);
	ctx.stroke();
	ctx.strokeStyle = fillColor;
	ctx.lineWidth = Math.max(1, width - 2.6);
	ctx.beginPath();
	ctx.moveTo(a.x, a.y);
	ctx.lineTo(b.x, b.y);
	ctx.stroke();
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}
