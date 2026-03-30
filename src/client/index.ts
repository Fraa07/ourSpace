import { Person, ServerMsg, ClientInitMsg, ClientMoveMsg, mod, TICK_FREQUENCY } from '../common';
import { getCharacterDrawFunction, getCharacterNames } from './characters';

type ClientPerson = Person & {
    xTarget?: number;
    yTarget?: number;
};

const playground = document.getElementById('playground') as HTMLCanvasElement;
const ctx: CanvasRenderingContext2D = playground.getContext("2d")!;

let screenW = 0, screenH = 0; // larghezza ed altezza del canvas
const worldW = 1000, worldH = 600; // larghezza ed altezza dello spazio di gioco
const worldBounds = {
    top: -worldH/2,
    left: -worldW/2,
    bottom: worldH/2,
    right: worldW/2,
};
const camera = { x: 0, y: 0, zoom: 1.0 };

function resize() {
    screenW = window.innerWidth;
    screenH = window.innerHeight;
    playground.width = screenW;
    playground.height = screenH;
}
resize();
window.addEventListener('resize', resize);

export let myId: string | null = null;
export let people: Record<string, ClientPerson> = {};

const personW = 40;
const personH = 120;

function createButton(text: string, onclick, colors: any = {}) {
    // +state
    let rect = { x: 0, y: 0, w: 0, h: 0 };
    let isPressed = false;
    // -state

    // +click_handling
    const getPointerPos = (e) => {
        const bounds = playground.getBoundingClientRect();
        return {
            x: e.clientX - bounds.left - screenW/2,
            y: e.clientY - bounds.top - screenH/2
        };
    };
    const isInside = (pos) => {
        return pos.x >= rect.x && pos.x <= rect.x + rect.w &&
               pos.y >= rect.y && pos.y <= rect.y + rect.h;
    };
    playground.addEventListener('pointerdown', (e) => {
        if (isInside(getPointerPos(e))) {
            isPressed = true;
        }
    });
    playground.addEventListener('pointerup', (e) => {
        if (isPressed && isInside(getPointerPos(e))) {
            onclick();
        }
        isPressed = false;
    });
    playground.addEventListener('pointercancel', () => isPressed = false);
    window.addEventListener('pointerup', () => isPressed = false);
    // -click_handling

    const drawButton = (newRect, ctx) => {
        rect = newRect; 

        const mainColor = colors.main || "#d18800";
        const textColor = colors.text || "#e6e6e6";
        const shadowColor = colors.shadow || "#161616";

        const { x, y, w, h } = rect;
        const shadowOffset = Math.min(w, h) * 0.07;
        const pushOffset = isPressed ? shadowOffset * 0.5 : 0;

        // ombra
        ctx.beginPath();
        ctx.rect(x + shadowOffset, y + shadowOffset, w, h);
        ctx.fillStyle = shadowColor;
        ctx.fill();

        // bottone
        ctx.beginPath();
        ctx.rect(x + pushOffset, y + pushOffset, w, h);
        ctx.fillStyle = mainColor;
        ctx.fill();

        // testo
        ctx.fillStyle = textColor;
        ctx.font = `bold ${Math.floor(Math.min(w, h) * 0.5)}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, x + w / 2 + pushOffset, y + h / 2 + pushOffset);
    }

    return drawButton;
}


const characterNames = getCharacterNames();
let selectedCharacterIdx = 0;

const drawLeftBtn = createButton('<', () => {
    selectedCharacterIdx = mod(selectedCharacterIdx + 1, characterNames.length);
});
const drawRightBtn = createButton('>', () => {
    selectedCharacterIdx = mod(selectedCharacterIdx - 1, characterNames.length);
});
const drawOkBtn = createButton('ok', () => {
    const initMessage: ClientInitMsg = {
        kind: "init",
        character: characterNames[selectedCharacterIdx]
    }
    socket.send(JSON.stringify(initMessage))
    
}, { main: "#58a515" });


function draw() {
    const me = myId ? people[myId]:null;
    if (me) {
        // gestione movimento
        if (goingUp) me.y -= me.speed;
        if (goingLeft) me.x -= me.speed;
        if (goingDown) me.y += me.speed;
        if (goingRight) me.x += me.speed;

        // controllo che il giocatore non esca dallo spazio di gioco
        if (me.y - personH/2 < worldBounds.top) me.y = worldBounds.top + personH/2;
        if (me.y + personH/2 > worldBounds.bottom) me.y = worldBounds.bottom - personH/2;
        if (me.x - personW/2 < worldBounds.left) me.x = worldBounds.left + personW/2;
        if (me.x + personW/2 > worldBounds.right) me.x = worldBounds.right - personW/2;

        // la camera segue il giocatore
        camera.x = me.x;
        camera.y = me.y;

        // pulisci lo schermo
        ctx.beginPath();
        ctx.rect(0, 0, screenW, screenH);
        ctx.fillStyle = "#000";
        ctx.fill();

        ctx.save(); // sistema di coordinate world-space
            ctx.translate(screenW/2, screenH/2); // centra lo schermo
            ctx.scale(camera.zoom, camera.zoom); // applica lo zoom
            ctx.translate(-camera.x, -camera.y); // sposta relativamente alla camera

            // disegna lo sfondo del "mondo" (campo da gioco)
            ctx.beginPath();
            ctx.rect(worldBounds.left, worldBounds.top, worldW, worldH);
            ctx.fillStyle = "#58a515";
            ctx.fill();

            Object.entries(people).forEach(([id, person]) => {
                if (id !== myId && person.xTarget) {
                    person.x += (person.xTarget - person.x) * 0.3;
                    person.y += (person.yTarget - person.y) * 0.3;
                }
                drawPerson(ctx, person.x, person.y, personW, personH, person.character);
            });
        ctx.restore();
    } else {
        let side = Math.min(screenH, screenW);
        ctx.save();
            ctx.translate(screenW/2, screenH/2); // centra lo schermo

            const borderWidth = 20;
            ctx.beginPath();
            ctx.rect(-side/2, -side/2, side, side);
            ctx.clip();
            ctx.strokeStyle = "#161616";
            ctx.lineWidth = borderWidth;
            ctx.fillStyle = "#acabab";
            ctx.fill();
            ctx.stroke();

            const btnWidth = side * 0.1;
            const btnHeight = side  * 0.4;
            const btnSpacing = borderWidth + 5;
            drawRightBtn({ x: side/2 - btnWidth - btnSpacing, y: -btnHeight/2, w: btnWidth, h: btnHeight }, ctx);
            drawLeftBtn({ x: -side/2 + btnSpacing, y: -btnHeight/2, w: btnWidth, h: btnHeight }, ctx);

            const characterName = characterNames[selectedCharacterIdx];
            const characterH = side * 0.6;
            const characterW = characterH * personW / personH;
            drawPerson(ctx, 0, 0, characterW, characterH, characterName);

            const okBtnW = side * 0.4;
            const okBtnH = side * 0.1;
            drawOkBtn({ x: -okBtnW/2, y: side/2 - okBtnH - btnSpacing, w: okBtnW, h: okBtnH }, ctx);

        ctx.restore();
    }
    requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

function drawPerson(ctx: CanvasRenderingContext2D, x, y, w, h, characterName) {
    const drawFunction = getCharacterDrawFunction(characterName);
    drawFunction(ctx, x, y, w, h, characterName);
}

const socket = new WebSocket(`ws://localhost:4242`);
socket.addEventListener("message", async event => {
    const message: ServerMsg = JSON.parse(event.data);
    if (message.kind === "init") {
        myId = message.yourId;
        people = message.people;
    }
    else if (message.kind === "update") {
        Object.entries(message.people).forEach(entry => {
            const id: string = entry[0];
            const updatedPerson: any = entry[1];
            if (id !== myId) {
                const personToUpdate = people[id];
                if (personToUpdate) {
                    personToUpdate.xTarget = updatedPerson.x;
                    personToUpdate.yTarget = updatedPerson.y;
                }
            }
            if (!people[id]) people[id] = updatedPerson;
        });
    }
    else if (message.kind === "exit") {
        delete people[message.id];
    }
});


let goingUp = false;
let goingLeft = false;
let goingDown = false;
let goingRight = false;

document.addEventListener("keydown", (event) => {
    if (event.code == "KeyW") goingUp = true;
    else if (event.code == "KeyA") goingLeft = true;
    else if (event.code == "KeyS") goingDown = true;
    else if (event.code == "KeyD") goingRight = true;
});
document.addEventListener("keyup", (event) => {
    if (event.code == "KeyW") goingUp = false;
    else if (event.code == "KeyA") goingLeft = false;
    else if (event.code == "KeyS") goingDown = false;
    else if (event.code == "KeyD") goingRight = false;
});
let prevX = 0;
let prevY = 0;
const EPSILON = 0.000001;
setInterval(() => {
    const me = myId ? people[myId] : null
    if (me) {
        const distX = Math.abs(me.x - prevX)
        const distY = Math.abs(me.y - prevY)
        if (distX > EPSILON || distY > EPSILON) {
            prevX = me.x
            prevY = me.y
            const moveMessage: ClientMoveMsg = {
                kind: "move",
                x: me.x, 
                y: me.y
            };
            socket.send(JSON.stringify(moveMessage));
        }
    }
}, 1000/TICK_FREQUENCY);

// gestione dello zoom
const minZoom = 0.1, maxZoom = 4;
const zoomSpeed = 0.035;
window.addEventListener('wheel', (event) => {
    event.preventDefault();
    
    if (event.deltaY > 0) {
        camera.zoom *= (1 - zoomSpeed);
    } else {
        camera.zoom *= (1 + zoomSpeed);
    }

    camera.zoom = Math.min(Math.max(minZoom, camera.zoom), maxZoom);
}, { passive: false });
