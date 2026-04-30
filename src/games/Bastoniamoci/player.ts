import { Player } from '../../common';

export type NetPlayer = Player & {
	x: number;
	y: number;
	vx: number;
	vy: number;
	aimX: number;
	aimY: number;
	lean: number;
	onGround: boolean;
};

type Vec2 = { x: number; y: number };

const BODY_LENGTH = 54;
const SHOULDER_OFFSET = 14;
const UPPER_ARM = 22;
const LOWER_ARM = 22;
const UPPER_LEG = 24;
const LOWER_LEG = 24;

export function drawStickman(ctx: CanvasRenderingContext2D, player: NetPlayer, aimTarget: Vec2) {
	const facing = aimTarget.x >= player.x ? 1 : -1;
	const speed = Math.min(1, Math.abs(player.vx) / 420);
	const walkPhase = player.x * 0.03 + player.vx * 0.01;
	const bounce = player.onGround ? Math.sin(walkPhase * 2) * 1.8 * speed : 0;

	const hip = { x: player.x, y: player.y - 10 + bounce };
	const chest = { x: player.x + player.lean * 10, y: player.y - BODY_LENGTH + bounce };
	const neck = { x: chest.x, y: chest.y - 10 };
	const head = { x: neck.x, y: neck.y - 14 };

	const shoulderFront = { x: chest.x + facing * SHOULDER_OFFSET, y: chest.y - 2 };
	const shoulderBack = { x: chest.x - facing * SHOULDER_OFFSET * 0.65, y: chest.y - 2 };
	const handTarget = { x: aimTarget.x, y: aimTarget.y };
	const supportTarget = { x: chest.x + facing * 8, y: chest.y + 6 };
	const frontArm = solve2BoneIK(shoulderFront, handTarget, UPPER_ARM, LOWER_ARM, facing > 0);
	const backArm = solve2BoneIK(shoulderBack, supportTarget, UPPER_ARM, LOWER_ARM, facing < 0);

	const stride = player.onGround ? Math.sin(walkPhase) * 10 * speed : 0;
	const kneeLift = player.onGround ? Math.max(0, Math.sin(walkPhase * 2)) * 6 * speed : 8;
	const footFront = { x: hip.x + facing * (10 + stride), y: hip.y + 42 - kneeLift };
	const footBack = { x: hip.x - facing * (10 + stride), y: hip.y + 42 - Math.max(0, -Math.sin(walkPhase * 2)) * 6 * speed };
	const legFront = solve2BoneIK(hip, footFront, UPPER_LEG, LOWER_LEG, facing > 0);
	const legBack = solve2BoneIK(hip, footBack, UPPER_LEG, LOWER_LEG, facing < 0);

	ctx.lineCap = 'round';

	drawBone(ctx, shoulderFront, frontArm.joint, 6.6, '#11151f', '#f0e4c8');
	drawBone(ctx, frontArm.joint, frontArm.end, 5.2, '#11151f', '#f0e4c8');
	drawBone(ctx, shoulderBack, backArm.joint, 5.8, '#11151f', '#d0c2a4');
	drawBone(ctx, backArm.joint, backArm.end, 4.8, '#11151f', '#d0c2a4');

	drawBone(ctx, chest, hip, 8.4, '#10131a', '#d8cbb1');
	drawBone(ctx, hip, legFront.joint, 6.8, '#10131a', '#bba78e');
	drawBone(ctx, legFront.joint, legFront.end, 6.2, '#10131a', '#bba78e');
	drawBone(ctx, hip, legBack.joint, 6.8, '#10131a', '#a78f78');
	drawBone(ctx, legBack.joint, legBack.end, 6.2, '#10131a', '#a78f78');

	ctx.fillStyle = '#1f2431';
	ctx.beginPath();
	ctx.ellipse(chest.x, chest.y, 9, 12, player.lean * 0.4, 0, Math.PI * 2);
	ctx.fill();

	ctx.fillStyle = '#efe2c7';
	ctx.beginPath();
	ctx.arc(head.x, head.y, 13, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = '#11151f';
	ctx.lineWidth = 2;
	ctx.stroke();

	const aimAngle = Math.atan2(handTarget.y - frontArm.end.y, handTarget.x - frontArm.end.x);
	drawGun(ctx, frontArm.end, aimAngle, facing);

	drawHand(ctx, backArm.end, '#c9b497');
	drawFoot(ctx, legFront.end, walkPhase, true, player.onGround);
	drawFoot(ctx, legBack.end, walkPhase, false, player.onGround);

	drawJoint(ctx, shoulderFront.x, shoulderFront.y, 4.8);
	drawJoint(ctx, shoulderBack.x, shoulderBack.y, 4.5);
	drawJoint(ctx, frontArm.joint.x, frontArm.joint.y, 4.2);
	drawJoint(ctx, backArm.joint.x, backArm.joint.y, 4.1);
	drawJoint(ctx, hip.x, hip.y, 5.6);
	drawJoint(ctx, legFront.joint.x, legFront.joint.y, 4.6);
	drawJoint(ctx, legBack.joint.x, legBack.joint.y, 4.6);

	ctx.fillStyle = '#f8eedf';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'bottom';
	ctx.font = 'bold 14px Georgia';
	ctx.fillText(player.name, player.x, player.y - 78);
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

function line(ctx: CanvasRenderingContext2D, a: Vec2, b: Vec2) {
	ctx.beginPath();
	ctx.moveTo(a.x, a.y);
	ctx.lineTo(b.x, b.y);
	ctx.stroke();
}

export function drawJoint(ctx: CanvasRenderingContext2D, x: number, y: number, r = 4.2) {
	ctx.fillStyle = '#11151f';
	ctx.beginPath();
	ctx.arc(x, y, r, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = '#6d6254';
	ctx.beginPath();
	ctx.arc(x - r * 0.18, y - r * 0.16, r * 0.42, 0, Math.PI * 2);
	ctx.fill();
}

export function drawBone(ctx: CanvasRenderingContext2D, a: Vec2, b: Vec2, width: number, outlineColor: string, fillColor: string) {
	ctx.strokeStyle = outlineColor;
	ctx.lineWidth = width;
	line(ctx, a, b);
	ctx.strokeStyle = fillColor;
	ctx.lineWidth = Math.max(1, width - 2.8);
	line(ctx, a, b);
}

export function drawHand(ctx: CanvasRenderingContext2D, p: Vec2, color: string) {
	ctx.fillStyle = '#12151f';
	ctx.beginPath();
	ctx.arc(p.x, p.y, 4.8, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = color;
	ctx.beginPath();
	ctx.arc(p.x - 0.5, p.y - 0.7, 2.8, 0, Math.PI * 2);
	ctx.fill();
}

export function drawFoot(ctx: CanvasRenderingContext2D, p: Vec2, phase: number, right: boolean, grounded: boolean) {
	const sway = grounded ? Math.sin(phase + (right ? 0 : Math.PI)) * 0.08 : 0.18;
	ctx.save();
	ctx.translate(p.x, p.y + 2);
	ctx.rotate(sway);
	ctx.fillStyle = '#11151f';
	ctx.beginPath();
	ctx.ellipse(0, 0, 8.5, 4.1, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = '#5f5462';
	ctx.beginPath();
	ctx.ellipse(-1.2, -0.5, 5.2, 1.9, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();
}

export function solve2BoneIK(root: Vec2, target: Vec2, lenA: number, lenB: number, bendLeft: boolean) {
	const toTargetX = target.x - root.x;
	const toTargetY = target.y - root.y;
	const dist = Math.hypot(toTargetX, toTargetY);
	const clampedDist = clamp(dist, 2, lenA + lenB - 0.001);
	const baseAngle = Math.atan2(toTargetY, toTargetX);
	const cosA = clamp((lenA * lenA + clampedDist * clampedDist - lenB * lenB) / (2 * lenA * clampedDist), -1, 1);
	const offset = Math.acos(cosA) * (bendLeft ? -1 : 1);
	const angleA = baseAngle - offset;

	const joint = {
		x: root.x + Math.cos(angleA) * lenA,
		y: root.y + Math.sin(angleA) * lenA
	};

	const endDir = Math.atan2(target.y - joint.y, target.x - joint.x);
	const end = {
		x: joint.x + Math.cos(endDir) * lenB,
		y: joint.y + Math.sin(endDir) * lenB
	};

	return { joint, end };
}

function drawGun(ctx: CanvasRenderingContext2D, hand: Vec2, angle: number, facing: number) {
	ctx.save();
	ctx.translate(hand.x, hand.y);
	ctx.rotate(angle);
	ctx.fillStyle = '#10131a';
	ctx.fillRect(0, -3.4, 24, 6.8);
	ctx.fillRect(8, -8, 7, 12);
	ctx.fillRect(-5, 1.5, 7, 10);
	ctx.fillStyle = '#e8cf7d';
	ctx.fillRect(22, -1.2, 5, 2.4);
	ctx.restore();
}
