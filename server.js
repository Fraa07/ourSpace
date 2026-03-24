const fs = require('fs');
const https = require('https');
const { WebSocketServer } = require('ws');

const WEBSOCKET_PORT = 4242;

let httpsServer = null;
if (process.env.OURSPACE_HTTPS_ENABLED) {
    const serverConfig = {
        key: fs.readFileSync(process.env.OURSPACE_HTTPS_KEY),
        cert: fs.readFileSync(process.env.OURSPACE_HTTPS_CERT)
    };
    httpsServer = https.createServer({ port: WEBSOCKET_PORT })
}

const wsServer = httpsServer
    ? new WebSocketServer({ server: httpsServer })
    : new WebSocketServer({ port: WEBSOCKET_PORT });

console.log("Server ws in ascolto sulla porta " + WEBSOCKET_PORT);

let people = [];

wsServer.on("connection", (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    console.log("Nuova connessione da " + clientIp);

    ws.on("message", async data => {
        // TODO
    });

    ws.on("close", data => {
        console.log("Client disconnesso: " + clientIp);
    });
});

if (httpsServer) httpsServer.listen(() => {
    console.log('Server https in ascolto sulla porta ' + WEBSOCKET_PORT);
});