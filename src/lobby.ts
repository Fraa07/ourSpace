import { Person, ClientMsg, ClientInitMsg, ServerMsg, mod, OutgoingServerMsg, IncomingClientMsg, ServerUpdateMsg } from './common';

const EPSILON = 0.000001;

const worldW = 1000, worldH = 600;
const worldBounds = {
    top: -worldH/2,
    left: -worldW/2,
    bottom: worldH/2,
    right: worldW/2,
};

const personW = 40;
const personH = 120;

//////////////////////
////// SERVER ////////
//////////////////////

export class LobbyServer {
    public people: Record<string, Person>;
    public resetMessages: OutgoingServerMsg[];

    constructor() {
        this.people = {};
        this.resetMessages = [];
    }

    clientConnected(id: string) {
        this.resetMessages.push({
            clientId: id,
            payload: {
                kind: 'reset',
                people: this.people,
            }
        });
    }

    clientClosed(id: string) {
        delete this.people[id];
    }

    tick(incomingMessages: IncomingClientMsg[], dt: number): OutgoingServerMsg[] {
        let messages: OutgoingServerMsg[] = [];
        const updatedPeople: Record<string, Person> = {};

        incomingMessages.forEach(message => {
            const clientId: string = message.clientId;
            const payload: ClientMsg = message.payload;
            if (payload.kind === "init") {
                const newPerson = {
                    x: 0,
                    y: 0,
                    speed: 5,
                    character: payload.character,
                };
                this.people[clientId] = newPerson;
                updatedPeople[clientId] = newPerson;
            }
            else if (payload.kind === "move") {
                const person = this.people[clientId]
                person.x = payload.x 
                person.y = payload.y
                updatedPeople[clientId] = person;
            }
        });

        // mandiamo i messaggi "reset" ai nuovi client
        this.resetMessages.forEach(msg => messages.push(msg));
        this.resetMessages = [];

        // mandiamo il messaggio "update" a tutti i client
        const updateMessage: ServerUpdateMsg = {
            kind: "update",
            people: updatedPeople
        };
        messages.push({ payload: updateMessage });

        return messages;
    }
}

//////////////////////
////// CLIENT ////////
//////////////////////

import { getCharacterDrawFunction, getCharacterNames } from './client/characters';
import { UserInput } from './client/user-input';
// gestione dello zoom
const ZOOM_MIN = 0.1, ZOOM_MAX = 4, ZOOM_SPEED = 0.035;

type ClientPerson = Person & {
    xTarget?: number;
    yTarget?: number;
};

export class LobbyClient {
    public userInput: any;

    public myId: string | null;
    public people: Record<string, ClientPerson>;
    public prevX: number = 0;
    public prevY: number = 0;
    public camera: { x: number, y: number, zoom: number };

    public characterNames: string[];
    public selectedCharacterIndex: number;

    public drawLeftBtn: any;
    public drawRightBtn: any;
    public drawOkBtn: any;

    public initMessage: ClientInitMsg | null = null;

    constructor(userInput: UserInput) {
        this.userInput = userInput;
        this.myId = null;
        this.camera = { x: 0, y: 0, zoom: 1.0 };
        this.people = {};

        this.characterNames = getCharacterNames();
        this.selectedCharacterIndex = 0;

        this.drawLeftBtn = this.createButton('<', () => {
            this.selectedCharacterIndex = mod(this.selectedCharacterIndex + 1, this.characterNames.length);
        });
        this.drawRightBtn = this.createButton('>', () => {
            this.selectedCharacterIndex = mod(this.selectedCharacterIndex - 1, this.characterNames.length);
        });
        this.drawOkBtn = this.createButton('ok', () => {
            this.initMessage = {
                kind: "init",
                character: this.characterNames[this.selectedCharacterIndex]
            }
        }, { main: "#58a515" });

        // TODO move this to UserInput
        window.addEventListener('wheel', (event) => {
            event.preventDefault();
            
            if (event.deltaY > 0) {
                this.camera.zoom *= (1 - ZOOM_SPEED);
            } else {
                this.camera.zoom *= (1 + ZOOM_SPEED);
            }

            this.camera.zoom = Math.min(Math.max(ZOOM_MIN, this.camera.zoom), ZOOM_MAX);
        }, { passive: false });
    }

    draw(ctx: CanvasRenderingContext2D, dt: number) {
        const { screenW, screenH, xMoveDirection, yMoveDirection } = this.userInput;
        const me = this.getMe();
        if (me) { // LOBBY
            // gestione movimento
            me.x += xMoveDirection * me.speed;
            me.y += yMoveDirection * me.speed;

            // controllo che il giocatore non esca dallo spazio di gioco
            if (me.y - personH/2 < worldBounds.top) me.y = worldBounds.top + personH/2 + EPSILON;
            if (me.y + personH/2 > worldBounds.bottom) me.y = worldBounds.bottom - personH/2 - EPSILON;
            if (me.x - personW/2 < worldBounds.left) me.x = worldBounds.left + personW/2 + EPSILON;
            if (me.x + personW/2 > worldBounds.right) me.x = worldBounds.right - personW/2 - EPSILON;

            // la camera segue il giocatore
            this.camera.x = me.x;
            this.camera.y = me.y;

            // pulisci lo schermo
            ctx.beginPath();
            ctx.rect(0, 0, screenW, screenH);
            ctx.fillStyle = "#000";
            ctx.fill();

            ctx.save(); // sistema di coordinate world-space
                ctx.translate(screenW/2, screenH/2); // centra lo schermo
                ctx.scale(this.camera.zoom, this.camera.zoom); // applica lo zoom
                ctx.translate(-this.camera.x, -this.camera.y); // sposta relativamente alla camera

                // disegna lo sfondo del "mondo" (campo da gioco)
                ctx.beginPath();
                ctx.rect(worldBounds.left, worldBounds.top, worldW, worldH);
                ctx.fillStyle = "#58a515";
                ctx.fill();

                // disegna le persone
                Object.entries(this.people).forEach(([id, person]) => {
                    if (id !== this.myId && person.xTarget) {
                        person.x += (person.xTarget - person.x) * 0.3;
                        person.y += (person.yTarget - person.y) * 0.3;
                    }
                    const drawPerson = getCharacterDrawFunction(person.character);
                    drawPerson(ctx, person.x, person.y, personW, personH);
                });
            ctx.restore();
        } else { // CHARACTER SELECT
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
                this.drawRightBtn({ x: side/2 - btnWidth - btnSpacing, y: -btnHeight/2, w: btnWidth, h: btnHeight }, ctx);
                this.drawLeftBtn({ x: -side/2 + btnSpacing, y: -btnHeight/2, w: btnWidth, h: btnHeight }, ctx);

                const characterName = this.characterNames[this.selectedCharacterIndex];
                const characterH = side * 0.6;
                const characterW = characterH * personW / personH;
                const drawPerson = getCharacterDrawFunction(characterName);
                drawPerson(ctx, 0, 0, characterW, characterH);

                const okBtnW = side * 0.4;
                const okBtnH = side * 0.1;
                this.drawOkBtn({ x: -okBtnW/2, y: side/2 - okBtnH - btnSpacing, w: okBtnW, h: okBtnH }, ctx);

            ctx.restore();
        }
    }

    handleMessage(message: ServerMsg) {
        if (message.kind === "init") {
            this.myId = message.yourId;
        }
        if (message.kind === "reset") {
            this.people = message.people;
        }
        else if (message.kind === "update") {
            Object.entries(message.people).forEach(entry => {
                const id: string = entry[0];
                const updatedPerson: any = entry[1];
                if (id !== this.myId) {
                    const personToUpdate = this.people[id];
                    if (personToUpdate) {
                        personToUpdate.xTarget = updatedPerson.x;
                        personToUpdate.yTarget = updatedPerson.y;
                    }
                }
                if (!this.people[id]) this.people[id] = updatedPerson;
            });
        }
        else if (message.kind === "exit") {
            delete this.people[message.id];
        }
    }

    flushMessages(): ClientMsg[] {
        const messages: ClientMsg[] = [];

        if (this.initMessage) {
            messages.push(this.initMessage);
            this.initMessage = null;
        }

        const me = this.getMe();
        if (me) {
            const distX = Math.abs(me.x - this.prevX)
            const distY = Math.abs(me.y - this.prevY)
            if (distX > EPSILON || distY > EPSILON) {
                this.prevX = me.x
                this.prevY = me.y
                messages.push({
                    kind: "move",
                    x: me.x, 
                    y: me.y
                });
            }
        }

        return messages;
    }

    getMe(): Person | null {
        return this.myId ? this.people[this.myId] : null;
    }

    createButton(text: string, onclick, colors: any = {}) {
        const { canvas, screenW, screenH } = this.userInput;

        // +state
        let rect = { x: 0, y: 0, w: 0, h: 0 };
        let isPressed = false;
        // -state

        // +click_handling
        const getPointerPos = (e) => {
            const bounds = canvas.getBoundingClientRect();
            return {
                x: e.clientX - bounds.left - screenW/2,
                y: e.clientY - bounds.top - screenH/2
            };
        };
        const isInside = (pos) => {
            return pos.x >= rect.x && pos.x <= rect.x + rect.w &&
                pos.y >= rect.y && pos.y <= rect.y + rect.h;
        };
        canvas.addEventListener('pointerdown', (e) => {
            if (isInside(getPointerPos(e))) {
                isPressed = true;
            }
        });
        canvas.addEventListener('pointerup', (e) => {
            if (isPressed && isInside(getPointerPos(e))) {
                onclick();
            }
            isPressed = false;
        });
        canvas.addEventListener('pointercancel', () => isPressed = false);
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
} 

