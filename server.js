const { WebSocketServer } = require('ws');

const port = 4242;
const server = new WebSocketServer({ port });

console.log("Server ws in ascolto su ws://localhost:"+port);

let people = [];

server.on("connection", (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    console.log("Nuova connessione da " + clientIp);

    ws.on("message", async data => {
        // TODO
    });

    ws.on("close", data => {
        console.log("Client disconnesso: " + clientIp);
    });
});