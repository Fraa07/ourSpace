import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { WebSocketServer } from 'ws';

import {
    TICK_FREQUENCY
} from "./common";
import { LobbyServer } from './lobby';

export type IncomingMsg = {
    clientId: string,
    payload: any;
};

export type OutgoingMsg = {
    clientId?: string; // if no clientId, message is broadcast
    payload: any
};


const SERVER_PORT = process.env.OURSPACE_SERVER_PORT || 4242;
const PUBLIC_FOLDER = process.env.OURSPACE_PUBLIC_FOLDER || 'build/public';

// Creiamo un server http o https
let httpServer = http.createServer();
if (process.env.OURSPACE_HTTPS_ENABLED) {
    const serverConfig = {
        key: fs.readFileSync(process.env.OURSPACE_HTTPS_KEY),
        cert: fs.readFileSync(process.env.OURSPACE_HTTPS_CERT)
    };
    httpServer = https.createServer(serverConfig)
    console.log("Using https");
}

// Serviamo i file del client, usando il server appena creato
const indexHTMLFile = fs.readFileSync(path.join(PUBLIC_FOLDER, 'index.html'));
const indexJSFile = fs.readFileSync(path.join(PUBLIC_FOLDER, 'index.js'));
httpServer.on('request', (req, res) => {
    if (req.method === 'GET' && req.url === '/' || req.url === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(indexHTMLFile);
    }
    else if (req.method === 'GET' && req.url === '/index.js') {
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        res.end(indexJSFile);
    }
    else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
    }
});

// Creiamo un server WebSocket
const wsServer = new WebSocketServer({ server: httpServer })
console.log("Server ws in ascolto sulla porta " + SERVER_PORT);

////////////////////////
////// WS SERVER ///////
////////////////////////

let idCounter: number = 0;
let incomingMessages: IncomingMsg[] = []; 

wsServer.on("connection", (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    console.log("Nuova connessione da " + clientIp);
    req.socket.setNoDelay(true);

    idCounter+= 1;
    const id = idCounter + '';
    ws.id = id;
    lobby.clientConnected(id);

    // Mettiamo i messaggi in arrivo dai client in una coda
    ws.on("message", data => {
        try {
            const payload = JSON.parse(data);
            console.log(payload);

            incomingMessages.push({
                clientId: ws.id,
                payload: payload
            });
        } catch (e) {} // se il messaggio non e' in JSON, non lo consideriamo
    });

    // Segnaliamo l'uscita di un client a tutti gli altri
    ws.on("close", data => {
        console.log("Client disconnesso: " + clientIp);
        lobby.clientClosed(id);
    });
});

const lobby = new LobbyServer();

let lastTickTime = Date.now();
function tick(){
    const now = Date.now();
    const dt = (now - lastTickTime) / 1000;
    lastTickTime = now;

    const messages = incomingMessages;
    incomingMessages = [];
    const outgoingMessages = lobby.tick(messages, dt);

    outgoingMessages.forEach(message => {
        const messageString = JSON.stringify(message.payload);
        wsServer.clients.forEach(socket => {
            if (socket.id === message.clientId) socket.send(messageString);
            else if (!message.clientId) socket.send(messageString);
        })
    });
}
setInterval(tick, 1000/TICK_FREQUENCY)

if (httpServer) httpServer.listen(SERVER_PORT, () => {
    console.log('Server http in ascolto sulla porta ' + SERVER_PORT);
});