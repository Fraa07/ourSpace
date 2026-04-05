import { mod, Player, smoothChange } from './common';
import { IncomingMsg, OutgoingMsg } from './server';
import { Button, TextInput } from './client/ui-elements';
import { GameServer } from './games/game';
import { GuessGameServer } from './games/guess';

const PERSON_SPEED = 300;

type Person = Player & {
    x: number;
    y: number;
};

// +messaggi
type ServerInitMsg = {
    kind: "init";
    yourId: string;
    people: Record<string, Person>;
};

type ServerNameIsTakenMsg = {
    kind: "nameIsTaken";
};

type ServerUpdateMsg = {
    kind: "update";
    people: Record<string, Person>;
};

type ServerExitMsg = {
    kind: "exit";
    id: string;
};

type LobbyServerMsg =
    | ServerInitMsg
    | ServerNameIsTakenMsg
    | ServerUpdateMsg 
    | ServerExitMsg
    | GameStartedMsg
    | GameMsg;

type ClientInitMsg = {
    kind: "init";
    name: string;
    character: string;
};

type ClientMoveMsg = {
    kind: "move";
    x: number;
    y: number;
};

type ClientStartGameMsg = {
    kind: "startGame";
    gameName: string;
};

type LobbyClientMsg = 
    | ClientInitMsg 
    | ClientStartGameMsg 
    | ClientMoveMsg
    | GameMsg;

type GameMsg = {
    kind: "game";
    gameId: string;
    data: any;
};

type GameStartedMsg = {
    kind: "gameStarted";
    gameId: string;
    gameName: string;
    players: Record<string, Player>;
};



// -messaggi


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
    public outgoingMessages: OutgoingMsg[];
    public currentGame: GameServer | null = null;
    public currentGameId: string | null = null;
    private gameIdCounter: number = 0;

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

    tick(incomingMessages: IncomingMsg[], dt: number): OutgoingMsg[] {
        const messages: OutgoingMsg[] = [];
        const updatedPeople: Record<string, Person> = {};
        
        // Add any pending outgoing messages
        messages.push(...this.outgoingMessages);
        this.outgoingMessages = [];

        // Separate lobby messages from game messages
        const lobbyMessages: IncomingMsg[] = [];
        const gameMessages: IncomingMsg[] = [];
        
        incomingMessages.forEach(message => {
            if (message.payload.kind === "game") {
                gameMessages.push(message);
            } else {
                lobbyMessages.push(message);
            }
        });
        
        // +lobby
        lobbyMessages.forEach(message => {
            const clientId: string = message.clientId;
            const payload: LobbyClientMsg = message.payload;

            if (payload.kind === "init") {
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
            else if (payload.kind === "startGame") {
                // only one game at a time, for now
                if (!this.currentGame) {
                    const gameStartedMessage = this.startGame(payload.gameName);
                    if (gameStartedMessage) messages.push(gameStartedMessage);
                }
            }
        });

        // mandiamo il messaggio "update" a tutti i client
        const updateMessage: ServerUpdateMsg = {
            kind: "update",
            people: updatedPeople
        };
        messages.push({ payload: updateMessage });
        // -lobby
        
        // +game
        if (this.currentGame && this.currentGameId) {
            // Extract game data from GameMsg wrapper
            const unwrappedGameMessages: IncomingMsg[] = gameMessages.map(msg => ({
                clientId: msg.clientId,
                payload: (msg.payload as GameMsg).data
            }));
            
            const gameOutgoingMessages = this.currentGame.tick(unwrappedGameMessages, dt);
            // Wrap game messages in GameMsg
            gameOutgoingMessages.forEach(m => {
                messages.push({
                    clientId: m.clientId,
                    payload: {
                        kind: "game",
                        gameId: this.currentGameId,
                        data: m.payload
                    }
                });
            });
            
            if (this.currentGame.isFinished()) {
                this.currentGame = null;
                this.currentGameId = null;
            }
        }
        // -game

        return messages;
    }
    
    private startGame(gameName: string): OutgoingMsg | null {
        if (gameName === 'guess')
            this.currentGame = new GuessGameServer();
        // else if (gameName === 'pong')
        //     currentGame = new PongGameServer();

        if (!this.currentGame) return null;

        this.gameIdCounter += 1;
        this.currentGameId = this.gameIdCounter + '';
        const players = this.getPlayers();
        this.currentGame.init(players);
        
        return {
            payload: {
                kind: "gameStarted",
                gameId: this.currentGameId,
                gameName: gameName,
                players: players
            }
        };
    }
    
    private getPlayers(): Record<string, Player> {
        const players = {};
        Object.entries(this.people).forEach(([id, person]) => {
            const { name, character } = person;
            players[id] = { name, character };
        })
        return players;
    }
}

//////////////////////
////// CLIENT ////////
//////////////////////

import { getCharacterDrawFunction, getCharacterNames } from './client/characters';
import { UserInput } from './client/user-input';
import { GameClient } from './games/game';
import { GuessGameClient } from './games/guess';

type ClientPerson = Person & {
    xTarget: number;
    yTarget: number;
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

    public startGameBtn: Button;

    public initMessage: ClientInitMsg | null = null;
    public startGameMessage: ClientStartGameMsg | null = null;
    
    public currentGame: GameClient | null = null;
    public currentGameId: string | null = null;

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
            if (this.getMe()) return;
            const name = this.nameInput.getValue() || '';
            if (name.length) {
                this.initMessage = {
                    kind: "init",
                    name: name,
                    character: this.characterNames[this.selectedCharacterIndex]
                }
            }
            else alert("insert a nickname")
        });
        this.okBtn.setColors({ main: "#58a515" })

        this.startGameBtn = new Button('start game', userInput, () => {
            this.startGameMessage = {
                kind: 'startGame',
                gameName: 'guess'
            }
        });
    }

    draw(ctx: CanvasRenderingContext2D, dt: number) {
        if (this.currentGame) {
            this.currentGame.draw(ctx, dt);
        } else {
            const me = this.getMe();
            if (me) this.drawLobby(ctx, me, dt);
            else    this.drawCharacterSelect(ctx);
        }
    }

    drawLobby(ctx: CanvasRenderingContext2D, me: ClientPerson, dt: number) {
        const {
            screenW, screenH, zoom,
            xMoveDirection, yMoveDirection
        } = this.userInput;

        // gestione movimento
        me.xTarget = me.xTarget + xMoveDirection * dt * PERSON_SPEED;
        me.yTarget = me.yTarget + yMoveDirection * dt * PERSON_SPEED;

        // controllo che il giocatore non esca dallo spazio di gioco
        if (me.yTarget - personH/2 < worldBounds.top) me.yTarget = worldBounds.top + personH/2 + EPSILON;
        if (me.yTarget + personH/2 > worldBounds.bottom) me.yTarget = worldBounds.bottom - personH/2 - EPSILON;
        if (me.xTarget - personW/2 < worldBounds.left) me.xTarget = worldBounds.left + personW/2 + EPSILON;
        if (me.xTarget + personW/2 > worldBounds.right) me.xTarget = worldBounds.right - personW/2 - EPSILON;

        // la camera segue il giocatore
        this.camera.x = me.x;
        this.camera.y = me.y;
        this.camera.zoom = zoom;

        // pulisci lo schermo
        ctx.beginPath();
        ctx.rect(0, 0, screenW, screenH);
        ctx.fillStyle = "#000";
        ctx.fill();

        ctx.save();

        ctx.translate(screenW/2, screenH/2); // centra lo schermo
        ctx.scale(this.camera.zoom, this.camera.zoom); // applica lo zoom
        ctx.translate(-this.camera.x, -this.camera.y); // sposta relativamente alla camera

        // disegna lo sfondo del "mondo" (campo da gioco)
        ctx.beginPath();
        ctx.rect(worldBounds.left, worldBounds.top, worldW, worldH);
        ctx.fillStyle = "#58a515";
        ctx.fill();

        // sposta le persone e disegnale
        Object.values(this.people).forEach((person) => {
            if (person.xTarget)
                person.x = smoothChange(person.x, person.xTarget, dt, 0.05);
            if (person.yTarget)
                person.y = smoothChange(person.y, person.yTarget, dt, 0.05);

            const drawPerson = getCharacterDrawFunction(person.character);
            drawPerson(ctx, person.x, person.y, personW, personH, );
            this.drawPersonName(ctx, person);
        });

        ctx.restore();
        this.startGameBtn.draw(ctx, screenW - 110, 10, 100, 30);
    }

    drawPersonName(ctx: CanvasRenderingContext2D, person: Person) {
        const fontSize = Math.floor(personH * 0.15);
        const nameY = person.y - personH/2 - fontSize - personH*0.08;
        ctx.font = `${fontSize}px Arial`;
        const nameWidth = ctx.measureText(person.name).width;
        const padding = 4;

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
    }

    drawCharacterSelect(ctx: CanvasRenderingContext2D) {
        const { screenW, screenH } = this.userInput;
        const side = Math.min(screenH, screenW);

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

    handleMessage(message: LobbyServerMsg) {
        if (message.kind === "gameStarted") {
            if (this.currentGame) return;
            this.currentGame = new GuessGameClient(this.userInput, this.myId!);
            this.currentGame.init(message.players);
            this.currentGameId = message.gameId;
        }
        else if (message.kind === "game") {
            if (this.currentGame && message.gameId === this.currentGameId) {
                this.currentGame.handleMessage(message.data);
            }
        }
        else if (message.kind === "init") {
            this.myId = message.yourId;
            const clientPeople = message.people as Record<string, ClientPerson>;
            Object.values(clientPeople).forEach(person => {
                person.xTarget = person.x;
                person.yTarget = person.y;
            });
            this.people = clientPeople;
        }
        else if (message.kind === "nameIsTaken") {
            alert("nickname is already taken");
        }
        else if (message.kind === "update") {
            const updateMsg = message;
            Object.entries(updateMsg.people as Record<string, Person>).forEach(entry => {
                const id: string = entry[0];
                const updatedPerson: Person = entry[1];
                if (id !== this.myId) {
                    const personToUpdate = this.people[id];
                    if (personToUpdate) {
                        personToUpdate.xTarget = updatedPerson.x;
                        personToUpdate.yTarget = updatedPerson.y;
                    }
                }
                if (!this.people[id]) {
                    const clientPerson = updatedPerson as ClientPerson;
                    clientPerson.xTarget = clientPerson.x;
                    clientPerson.yTarget = clientPerson.y;
                    this.people[id] = clientPerson;
                }
            });
        }
        else if (message.kind === "exit") {
            delete this.people[message.id];
        }
    }

    flushMessages(): any[] {
        const messages: any[] = [];

        if (this.initMessage) {
            messages.push(this.initMessage);
            this.initMessage = null;
        }
        if (this.startGameMessage) {
            messages.push(this.startGameMessage);
            this.startGameMessage = null;
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
        
        if (this.currentGame) {
            if (this.currentGame.isFinished()) {
                this.currentGame = null;
                this.currentGameId = null;
            }
            else {
                const gameMessages = this.currentGame.flushMessages();
                gameMessages.forEach((message) => {
                    messages.push({
                        kind: "game",
                        gameId: this.currentGameId!,
                        data: message
                    });
                })
            }
        }

        return messages;
    }

    getMe(): ClientPerson | null {
        return this.myId ? this.people[this.myId] : null;
    }
} 
