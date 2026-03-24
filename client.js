const playground = document.getElementById('playground');
const ctx = playground.getContext("2d");

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

let me = {
    x: 0,
    y: 0,
    speed: 5,
    character: 'normalGuy'
};
let others = []; // TODO riempire con i dati che arrivano dal server

const personW = 40;
const personH = 120;

function draw() {
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

        others.forEach(p => drawPerson(p.x, p.y, personW, personH, p.character));
        drawPerson(me.x, me.y, personW, personH, me.character);
    ctx.restore();

    requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

function drawPerson(x, y, w, h, style) {
    const drawFunction = characters[style];
    drawFunction(x, y, w, h, style);
}

const socket = new WebSocket(`ws://localhost:4242`);
socket.addEventListener("message", async event => {
    // TODO aggiornare lo stato in base ai messaggi del server
});

// TODO spostare la gestione dei movimenti sul server
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

const characters = {
    normalGuy: drawNormalGuy,
}
function draw11(x, y, w, h, style = {}) {
    ctx.save();

    // move origin (x=0, y=0) to the person center
    ctx.translate(x, y);
    const startX = -w/2;
    const startY = -h/2;


    // +head
    const headH = h * 0.3;

    ctx.beginPath();
    ctx.fillStyle = style.skinColor || "#d3baa5";
    ctx.rect(startX, startY, w, headH);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = "#151514";
    ctx.rect(startX , startY - headH/5 ,w, headH/2);
    ctx.fill();

    const eyeW = w * 0.25;
    const eyeH = headH * 0.18;
    const eyeY = startY + headH * 0.45;
    const leftEyeX = startX + w * 0.22;
    const rightEyeX = startX + w * 0.64;

    ctx.beginPath();
    ctx.fillStyle = "#ffffff";
    ctx.rect(leftEyeX, eyeY, eyeW, eyeH);
    ctx.rect(rightEyeX, eyeY, eyeW, eyeH);
    ctx.fill();

    const pupilW = eyeW * 0.45;
    const pupilH = eyeH * 0.85;
    const pupilY = eyeY + eyeH * 0.08;

    ctx.beginPath();
    ctx.fillStyle = "#1f1f1f";
    ctx.rect(leftEyeX + eyeW * 0.28, pupilY, pupilW, pupilH);
    ctx.rect(rightEyeX + eyeW * 0.28, pupilY, pupilW, pupilH);
    ctx.fill();
    // -head

    // hat
    const hatTopY = startY - headH * 0.32;
    const hatTopH = headH * 0.32;
    const hatBandY = hatTopY + hatTopH;
    const hatBandH = headH * 0.14;
    const brimY = hatBandY + hatBandH;
    const brimH = headH * 0.12;

    ctx.beginPath();
    ctx.fillStyle = "#1a2b6d";
    ctx.rect(startX - w * 0.08, hatTopY, w * 1.16, hatTopH);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = "#0f1d50";
    ctx.rect(startX - w * 0.04, hatBandY, w * 1.08, hatBandH);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = "#121212";
    ctx.rect(startX - w * 0.14, brimY, w * 1.28, brimH);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = "#d6b64c";
    ctx.rect(startX + w * 0.44, hatBandY + hatBandH * 0.1, w * 0.12, hatBandH * 0.8);
    ctx.fill();
    

    // +body
    const bodyStartY = startY + headH;
    const bodyH = h * 0.35;
    const armLen = 0.4 * w;

    ctx.beginPath();
    ctx.fillStyle = "#04097f";
    ctx.rect(startX, bodyStartY, w, bodyH); // body
    ctx.rect(startX - armLen, bodyStartY, armLen, 0.35*bodyH); // left arm
    ctx.rect(startX + w, bodyStartY, armLen, 0.35*bodyH); // right arm
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = "#d3baa5";
    ctx.rect(startX - armLen, bodyStartY + 0.35*bodyH, armLen, 0.70*bodyH); // left arm
    ctx.rect(startX + w, bodyStartY + 0.35*bodyH, armLen, 0.70*bodyH); // right arm
    ctx.fill();


    const batonW = w * 0.11;
    const batonH = bodyH * 0.95;
    const batonX = startX - armLen * 0.55;
    const batonY = bodyStartY + bodyH * 0.70;

    ctx.beginPath();
    ctx.fillStyle = "#1a1a1a";
    ctx.rect(batonX, batonY, batonW, batonH); // manganello
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = "#0a0a0a";
    ctx.rect(batonX - batonW * 0.15, batonY + batonH * 0.78, batonW * 1.3, batonH * 0.18); // impugnatura
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = "#303030";
    ctx.rect(batonX, batonY, batonW, batonH * 0.08); // punta
    ctx.fill();

    const handX = startX + w + armLen * 0.9;
    const handY = bodyStartY + bodyH * 0.90;
    const gunW = w * 0.58;
    const gunH = bodyH * 0.22;

    ctx.save();
    ctx.translate(handX, handY);

    ctx.beginPath();
    ctx.fillStyle = "#2f2f2f";
    ctx.rect(-gunW * 0.20, -gunH * 1.05, gunW, gunH * 0.62); // slide
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = "#1d1d1d";
    ctx.rect(-gunW * 0.17, -gunH * 0.70, gunW * 0.70, gunH * 0.55); // frame
    ctx.rect(-gunW * 0.02, -gunH * 0.18, gunW * 0.22, gunH * 0.95); // grip
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = "#161616";
    ctx.rect(gunW * 0.50, -gunH * 1.05, gunW * 0.12, gunH * 0.24); // muzzle
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = "#0f0f0f";
    ctx.rect(gunW * 0.14, -gunH * 0.15, gunW * 0.15, gunH * 0.22); // trigger guard
    ctx.fill();

    ctx.restore();
    // -body

    // +legs
    const legH = h - headH - bodyH;
    const legStartY = bodyStartY + bodyH;
    const legW = w * 0.35;

    ctx.beginPath();
    ctx.fillStyle = "#100712";
    ctx.rect(startX, legStartY, w, legH/3); // top
    ctx.rect(startX, legStartY, legW, legH); // left leg
    ctx.rect(startX + w - legW, legStartY, legW, legH); // right leg
    ctx.fill();
    // -legs

    const beltH = Math.max(3, h * 0.03);

    ctx.beginPath();
    ctx.fillStyle = "#4e402f";
    ctx.rect(startX, legStartY, w, beltH);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = "#a0a0a0";
    ctx.rect(startX + w * 0.42, legStartY, w * 0.16, beltH);
    ctx.fill();

    // +bounding box
    ctx.beginPath();
    ctx.rect(startX, startY, w, h);
    ctx.strokeStyle = "#f620ef";
    ctx.stroke();
    /*
    */
    // -bounding box

    ctx.restore();
}

function drawPersona6(x, y, w, h, style = {}) {
    ctx.save();

    ctx.translate(x, y);
    const startX = -w/2;
    const startY = -h/2;

    // ================= HEAD =================
    const headH = h * 0.3;

    // faccia
    ctx.fillStyle = "#eaa66e";
    ctx.fillRect(startX, startY, w, headH);

    // capelli (base)
    ctx.fillStyle = "#f4c542";
    ctx.fillRect(startX, startY, w, headH * 0.25);

    // ciuffo laterale (più caratteristico)
    ctx.fillRect(startX + w*0.5, startY - headH*0.15, w*0.6, headH*0.25);

    // occhi
    ctx.fillStyle = "#000";
    const eyeSize = w * 0.08;
    ctx.fillRect(startX + w*0.25, startY + headH*0.45, eyeSize, eyeSize);
    ctx.fillRect(startX + w*0.65, startY + headH*0.45, eyeSize, eyeSize);

    // ================= BODY =================
    const bodyStartY = startY + headH;
    const bodyH = h * 0.35;
    const armLen = 0.4 * w;

    // giacca
    ctx.fillStyle = "#1c1f3a";
    ctx.fillRect(startX, bodyStartY, w, bodyH);

    // maniche
    ctx.fillRect(startX - armLen, bodyStartY, armLen, bodyH * 0.85);
    ctx.fillRect(startX + w, bodyStartY, armLen, bodyH * 0.85);

    // camicia (centro)
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(startX + w*0.4, bodyStartY, w*0.2, bodyH * 0.4);

    // cravatta
    ctx.fillStyle = "#c51d1d";
    ctx.fillRect(startX + w*0.45, bodyStartY, w*0.1, bodyH * 0.7);

    // ================= LEGS =================
    const legH = h - headH - bodyH;
    const legStartY = bodyStartY + bodyH;
    const legW = w * 0.35;

    ctx.fillStyle = "#111";
    ctx.fillRect(startX, legStartY, legW, legH);
    ctx.fillRect(startX + w - legW, legStartY, legW, legH);


    ctx.restore();
}



function drawNormalGuy(x, y, w, h, style = {}) {
    ctx.save();

    // move origin (x=0, y=0) to the person center
    ctx.translate(x, y);
    const startX = -w/2;
    const startY = -h/2;


    // +head
    const headH = h * 0.3;

    ctx.beginPath();
    ctx.fillStyle = style.skinColor || "#eaa66e";
    ctx.rect(startX, startY, w, headH);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = "#151514";
    ctx.rect(startX, startY, w, headH/4);
    ctx.fill();
    // -head

    // +body
    const bodyStartY = startY + headH;
    const bodyH = h * 0.35;
    const armLen = 0.4 * w;

    ctx.beginPath();
    ctx.fillStyle = "#04097f";
    ctx.rect(startX, bodyStartY, w, bodyH); // body
    ctx.rect(startX - armLen, bodyStartY, armLen, 0.35*bodyH); // left arm
    ctx.rect(startX + w, bodyStartY, armLen, 0.35*bodyH); // right arm
    ctx.fill();
    // -body

    // +legs
    const legH = h - headH - bodyH;
    const legStartY = bodyStartY + bodyH;
    const legW = w * 0.35;

    ctx.beginPath();
    ctx.fillStyle = "#100712";
    ctx.rect(startX, legStartY, w, legH/3); // top
    ctx.rect(startX, legStartY, legW, legH); // left leg
    ctx.rect(startX + w - legW, legStartY, legW, legH); // right leg
    ctx.fill();
    // -legs

    // +bounding box
    ctx.beginPath();
    ctx.rect(startX, startY, w, h);
    ctx.strokeStyle = "#f620ef";
    ctx.stroke();
    /*
    */
    // -bounding box

    ctx.restore();
}

function drawPersonaggio10(x, y, w, h, style = {}) {
    ctx.save();

    ctx.translate(x, y);
    const startX = -w / 2;
    const startY = -h / 2;

    const headH = h * 0.34;
    const bodyH = h * 0.36;
    const legH = h - headH - bodyH;

    const headW = w * 0.92;
    const bodyW = w * 0.82;
    const eyeW = w * 0.12;
    const eyeH = h * 0.09;
    const armW = w * 0.18;
    const armH = h * 0.1;

    const alienRed = style.mainColor || "#d61f2d";
    const alienDark = style.shadowColor || "#7c0e16";
    const alienLight = style.highlightColor || "#ff6b6b";
    const alienEye = "#dff8ff";
    const pupil = "#0b1a1d";

    const headCx = 0;
    const headCy = startY + headH * 0.48;

    ctx.fillStyle = alienDark;
    ctx.beginPath();
    ctx.ellipse(headCx - w * 0.18, startY - h * 0.06, w * 0.06, h * 0.16, -0.45, 0, Math.PI * 2);
    ctx.ellipse(headCx + w * 0.18, startY - h * 0.06, w * 0.06, h * 0.16, 0.45, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = alienDark;
    ctx.lineWidth = Math.max(2, Math.min(w, h) * 0.06);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(headCx - w * 0.12, startY - h * 0.01);
    ctx.quadraticCurveTo(headCx - w * 0.26, startY - h * 0.18, headCx - w * 0.31, startY - h * 0.3);
    ctx.moveTo(headCx + w * 0.12, startY - h * 0.01);
    ctx.quadraticCurveTo(headCx + w * 0.26, startY - h * 0.18, headCx + w * 0.31, startY - h * 0.3);
    ctx.stroke();

    ctx.fillStyle = alienRed;
    ctx.beginPath();
    ctx.ellipse(headCx, headCy, headW / 2, headH / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = alienLight;
    ctx.beginPath();
    ctx.ellipse(headCx - w * 0.12, headCy - h * 0.06, w * 0.14, h * 0.1, -0.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = alienEye;
    ctx.beginPath();
    ctx.ellipse(headCx - w * 0.18, headCy - h * 0.02, eyeW, eyeH, -0.15, 0, Math.PI * 2);
    ctx.ellipse(headCx + w * 0.18, headCy - h * 0.02, eyeW, eyeH, 0.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = pupil;
    ctx.beginPath();
    ctx.ellipse(headCx - w * 0.16, headCy - h * 0.01, eyeW * 0.35, eyeH * 0.5, -0.08, 0, Math.PI * 2);
    ctx.ellipse(headCx + w * 0.16, headCy - h * 0.01, eyeW * 0.35, eyeH * 0.5, 0.08, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = alienDark;
    ctx.beginPath();
    ctx.ellipse(headCx, headCy + h * 0.1, w * 0.08, h * 0.028, 0, 0, Math.PI * 2);
    ctx.fill();

    const bodyTop = startY + headH * 0.8;
    ctx.fillStyle = alienRed;
    ctx.beginPath();
    ctx.ellipse(0, bodyTop + bodyH * 0.48, bodyW / 2, bodyH / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = alienDark;
    ctx.beginPath();
    ctx.ellipse(-w * 0.5, bodyTop + bodyH * 0.4, armW, armH, -0.35, 0, Math.PI * 2);
    ctx.ellipse(w * 0.5, bodyTop + bodyH * 0.4, armW, armH, 0.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = alienRed;
    ctx.beginPath();
    ctx.ellipse(-w * 0.55, bodyTop + bodyH * 0.42, armW * 0.72, armH * 0.72, -0.1, 0, Math.PI * 2);
    ctx.ellipse(w * 0.55, bodyTop + bodyH * 0.42, armW * 0.72, armH * 0.72, 0.1, 0, Math.PI * 2);
    ctx.fill();

    const legTop = bodyTop + bodyH * 0.8;
    const legW = w * 0.22;
    const footW = w * 0.16;
    const footH = h * 0.06;

    ctx.fillStyle = alienDark;
    ctx.beginPath();
    ctx.ellipse(-w * 0.17, legTop + legH * 0.46, legW, legH * 0.52, 0.05, 0, Math.PI * 2);
    ctx.ellipse(w * 0.17, legTop + legH * 0.46, legW, legH * 0.52, -0.05, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = alienRed;
    ctx.beginPath();
    ctx.ellipse(-w * 0.19, legTop + legH * 0.42, legW * 0.75, legH * 0.42, 0.05, 0, Math.PI * 2);
    ctx.ellipse(w * 0.19, legTop + legH * 0.42, legW * 0.75, legH * 0.42, -0.05, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = alienDark;
    ctx.beginPath();
    ctx.ellipse(-w * 0.2, startY + h * 0.49, footW, footH, 0, 0, Math.PI * 2);
    ctx.ellipse(w * 0.2, startY + h * 0.49, footW, footH, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}