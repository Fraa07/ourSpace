import { Person, ClientMsg, ClientInitMsg, ServerMsg, mod, OutgoingServerMsg, IncomingClientMsg, ServerUpdateMsg } from './common';
import { Button, TextInput } from './client/ui-elements';

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
    public outgoingMessages: OutgoingServerMsg[];

    constructor() {
        this.people = {};
        this.outgoingMessages = [];
    }

    clientConnected(id: string) {
        this.outgoingMessages.push({
            clientId: id,
            payload: {
                kind: 'init',
                yourId: id,
                people: this.people
            }
        });
    }

    clientClosed(id: string) {
        delete this.people[id];
        this.outgoingMessages.push({
            payload: {
                kind: 'exit',
                id: id,
            }
        });
    }

    tick(incomingMessages: IncomingClientMsg[], dt: number): OutgoingServerMsg[] {
        const messages: OutgoingServerMsg[] = this.outgoingMessages;
        this.outgoingMessages = [];

        const updatedPeople: Record<string, Person> = {};
        incomingMessages.forEach(message => {
            const clientId: string = message.clientId;
            const payload: ClientMsg = message.payload;
            if (payload.kind === "init") {
                // TODO optimisable
                if (Object.values(this.people).find(p => p.name === payload.name)) {
                    this.outgoingMessages.push({
                        clientId: clientId,
                        payload: {
                            kind: 'nameIsTaken'
                        }
                    })
                }
                else {
                    const newPerson: Person = {
                        x: 0,
                        y: 0,
                        speed: 5,
                        name: payload.name,
                        character: payload.character,
                    };
                    this.people[clientId] = newPerson;
                    updatedPeople[clientId] = newPerson;
                }
            }
            else if (payload.kind === "move") {
                const person = this.people[clientId]
                person.x = payload.x 
                person.y = payload.y
                updatedPeople[clientId] = person;
            }
        });
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

    public leftBtn: Button;
    public rightBtn: Button;
    public okBtn: Button;
    public nameInput: TextInput;

    public initMessage: ClientInitMsg | null = null;

    constructor(userInput: UserInput) {
        this.userInput = userInput;
        this.myId = null;
        this.camera = { x: 0, y: 0, zoom: 1.0 };
        this.people = {};

        this.characterNames = getCharacterNames();
        this.selectedCharacterIndex = 0;

        this.nameInput = new TextInput(userInput, 'nickname');

        this.leftBtn = new Button('<', userInput, () => {
            this.selectedCharacterIndex = mod(this.selectedCharacterIndex + 1, this.characterNames.length);
        });
        this.rightBtn = new Button('>', userInput, () => {
            this.selectedCharacterIndex = mod(this.selectedCharacterIndex - 1, this.characterNames.length);
        });
        this.okBtn = new Button('ok', userInput, () => {
            const name = this.nameInput.getValue() || '';
            if (name.length) {
                this.initMessage = {
                    kind: "init",
                    name: name,
                    character: this.characterNames[this.selectedCharacterIndex]
                }
            }
        });
        this.okBtn.setColors({ main: "#58a515" })
    }

    draw(ctx: CanvasRenderingContext2D, dt: number) {
        const {
            screenW, screenH, zoom,
            xMoveDirection, yMoveDirection
        } = this.userInput;

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
            this.camera.zoom = zoom;

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
                    // +personName
                    const fontSize = Math.floor(personH * 0.15);
                    const nameY = person.y - personH/2 - fontSize - personH*0.08;
                    ctx.font = `${fontSize}px Arial`;
                    const nameWidth = ctx.measureText(person.name).width;
                    const padding = 4;

                    // Draw a semi-transparent black background pill
                    ctx.fillStyle = "rgba(0, 0, 0, 0.5)"; 
                    ctx.fillRect(
                        person.x - (nameWidth / 2) - padding, 
                        nameY - padding, 
                        nameWidth + (padding * 2), 
                        fontSize + (padding * 2)
                    );
                    ctx.textAlign = "center";
                    ctx.textBaseline = "top";
                    ctx.lineWidth = 4;
                    ctx.fillStyle = "#eeeeee";
                    ctx.fillText(person.name, person.x, nameY);
                    // -personName
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

                // personaggio
                const characterName = this.characterNames[this.selectedCharacterIndex];
                const characterH = side * 0.5;
                const characterW = characterH * personW / personH;
                const drawPerson = getCharacterDrawFunction(characterName);
                drawPerson(ctx, 0, 0, characterW, characterH);

                const padding = borderWidth + 5;

                // input nickname
                const nameInputW = side * 0.7;
                const nameInputH = side * 0.1;
                this.nameInput.draw(ctx, -nameInputW/2, -side/2 + padding, nameInputW, nameInputH);

                // bottoni
                const btnWidth = side * 0.1;
                const btnHeight = side  * 0.4;
                this.rightBtn.draw(ctx, side/2 - btnWidth - padding, -btnHeight/2, btnWidth, btnHeight);
                this.leftBtn.draw(ctx, -side/2 + padding, -btnHeight/2, btnWidth, btnHeight);
                const okBtnW = side * 0.4;
                const okBtnH = side * 0.1;
                this.okBtn.draw(ctx, -okBtnW/2, side/2 - okBtnH - padding, okBtnW, okBtnH);

            ctx.restore();
        }
    }

    handleMessage(message: ServerMsg) {
        if (message.kind === "init") {
            this.myId = message.yourId;
            this.people = message.people;
        }
        else if (message.kind === "nameIsTaken") {
            alert("nickname is already taken");
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
} 

