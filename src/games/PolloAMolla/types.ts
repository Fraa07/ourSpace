// ============================================================
// types.ts — PolloAMolla
// BREAKING CHANGE: roomIndex rimosso dal player.
// Il giocatore ora ha una Y assoluta nel mondo continuo (worldY).
// X rimane relativa alla larghezza del mondo (0..ROOM.width).
// ============================================================

export type PlatformKind = "solid" | "oneWay" | "slope";
export type SlopeDirection = "upRight" | "upLeft";

export type MovingPlatform = {
  axis: "x" | "y";
  distance: number;
  seconds: number;
  phase?: number;
};

export type Platform = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: PlatformKind;
  slope?: SlopeDirection;
  moving?: MovingPlatform;
};

export type PositionedPlatform = Platform & {
  baseX: number;
  baseY: number;
};

export type MapSection = {
  id: number;
  name: string;
  worldYBottom: number;
  height: number;
  colors: { top: string; bottom: string };
  spawn?: { x: number; y: number };
  platforms: Platform[];
};

export type PlayerInput = {
  moveDirectionX: number;
  moveDirectionY: number;
  jumpHeld: boolean;
  flyEnabled: boolean;
};

export type JumpPlayer = {
  x: number;
  y: number;
  vx: number;
  vy: number;

  onGround: boolean;
  facing: -1 | 1;

  isCharging: boolean;
  chargeSeconds: number;

  coyoteSeconds: number;
  jumpBufferSeconds: number;
  bufferedChargeSeconds: number;
  bufferedRelease: boolean;
  bufferedDirection: -1 | 0 | 1;

  previousJumpHeld: boolean;
  groundPlatformId: string | null;
  landedSeconds: number;

  fallStartY: number | null;
  isFalling: boolean;

  screenShakeSeconds: number;
  screenShakeIntensity: number;
};

export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
};
