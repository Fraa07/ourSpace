import { ServerMsg, ClientMsg, TICK_FREQUENCY } from '../common';
import { UserInput } from './user-input';
import { LobbyClient } from '../lobby';

const playground = document.getElementById('playground') as HTMLCanvasElement;
const ctx: CanvasRenderingContext2D = playground.getContext("2d")!;

export const userInput = new UserInput(playground);
export const lobby = new LobbyClient(userInput);

function draw() {
    lobby.draw(ctx, 0);
    requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
const wsHost = window.location.host;
const wsConnectionString = `${wsProtocol}://${wsHost}`;
export const socket = new WebSocket(wsConnectionString);

socket.addEventListener("message", async event => {
    const incomingMessage: ServerMsg = JSON.parse(event.data);
    lobby.handleMessage(incomingMessage);
});

setInterval(() => {
    lobby.flushMessages().forEach((message: ClientMsg) =>{
        socket.send(JSON.stringify(message));
    })
}, 1000/TICK_FREQUENCY);
