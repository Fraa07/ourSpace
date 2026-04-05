export const TICK_FREQUENCY = 20; // ticks per second
export const PERSON_W = 40;
export const PERSON_H = 120;

export type Player = {
    name: string;
    character: string;
}

export type Rectangle = {
    x: number; // x position of the top left corner
    y: number; // y position of the top left corner
    w: number; // width
    h: number; // height
}

export const mod = (n: number, m: number) => ((n % m) + m) % m;

export const smoothChange = (from: number, to: number, dt: number, halfLife: number): number => {
    return to + (from - to) * Math.pow(2, -dt / halfLife)
}

