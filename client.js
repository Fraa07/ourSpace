const playgorund = document.getElementById('playground');
const ctx = playground.getContext("2d");

let W = 0, H = 0; // larghezza ed altezza del canvas
function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    playground.width = W;
    playground.height = H;
}
resize();
window.addEventListener('resize', resize);

let me = {
    x: W/2,
    y: H/2,
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

    // pulisci lo sfondo
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.fillStyle = "#58a515";
    ctx.fill();

    others.forEach(p => drawPerson(p.x, p.y, personW, personH, p.character));
    drawPerson(me.x, me.y, personW, personH, me.character);

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

const characters = {
    normalGuy: drawNormalGuy,
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
