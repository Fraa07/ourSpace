import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';
import { WebSocketServer } from 'ws';

import {
    Person, TICK_FREQUENCY,
    ServerUpdateMsg, ServerInitMsg, ServerExitMsg, ClientMsg
} from "./common";

type IncomingMessage = {
    clientId: string,
    payload: ClientMsg
};

const SERVER_PORT = process.env.OURSPACE_SERVER_PORT || 4242;

let httpServer = http.createServer();
if (process.env.OURSPACE_HTTPS_ENABLED) {
    const serverConfig = {
        key: fs.readFileSync(process.env.OURSPACE_HTTPS_KEY),
        cert: fs.readFileSync(process.env.OURSPACE_HTTPS_CERT)
    };
    httpServer = https.createServer(serverConfig)
}

const indexHTMLFile = fs.readFileSync('build/public/index.html');
const indexJSFile = fs.readFileSync('build/public/index.js');
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

const wsServer = new WebSocketServer({ server: httpServer })

console.log("Server ws in ascolto sulla porta " + SERVER_PORT);

let people: Record<string, Person> = {};
let idCounter: number = 0;

let incomingMessages: IncomingMessage[] = []; 

wsServer.on("connection", (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    console.log("Nuova connessione da " + clientIp);

    idCounter+= 1;
    const id = idCounter + '';
    ws.id = id;
    const initMessage: ServerInitMsg = {
        kind: "init",
        yourId: id,
        people: people
    };
    ws.send(JSON.stringify(initMessage));

    ws.on("message", async data => {
        const payload = JSON.parse(data);

        incomingMessages.push({
            clientId: ws.id,
            payload: payload
        });
    });

    ws.on("close", data => {
        console.log("Client disconnesso: " + clientIp);
        delete people[ws.id];
        const exitMessage: ServerExitMsg = {
            kind: "exit",
            id: ws.id
        };
        const exitMessageString = JSON.stringify(exitMessage);
        wsServer.clients.forEach(socket => socket.send(exitMessageString));
    });
});


function tick(){
    const messages = incomingMessages;
    incomingMessages = [];
    const updatedPeople: Record<string, Person> = {};

    messages.forEach(message => {
        const clientId: string = message.clientId;
        const payload: ClientMsg = message.payload;
        if (payload.kind === "init") {
            const newPerson = {
                x: 0,
                y: 0,
                speed: 5,
                character: payload.character,
            };
            people[clientId] = newPerson;
            updatedPeople[clientId] = newPerson;
        }
        else if (payload.kind === "move") {
            const person = people[clientId]
            person.x = payload.x 
            person.y = payload.y
            updatedPeople[clientId] = person;
        }
    });
    const updateMessage: ServerUpdateMsg = {
        kind: "update",
        people: updatedPeople
    };
    const updateMessageString = JSON.stringify(updateMessage);
    wsServer.clients.forEach(
        socket => socket.send(updateMessageString)
    );
}

setInterval(tick, 1000/TICK_FREQUENCY)
if (httpServer) httpServer.listen(SERVER_PORT, () => {
    console.log('Server https in ascolto sulla porta ' + SERVER_PORT);
});