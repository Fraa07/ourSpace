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
    x: W / 2,
    y: H / 2,
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
    normalGuy: drawNormalGuy
};

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
    ctx.rect(startX + w, bodyStartY, armLen, 0.35*bodyH); // left arm
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

function drawPersona7(x, y, w, h, style = {}) {
    ctx.save();
    ctx.translate(x, y);

    const startX = -w / 2;
    const startY = -h / 2;

    // pulsazione neon
    const time = Date.now() / 1000;
    const glow = 0.5 + 0.5 * Math.sin(time * 3);
    const neon = `rgba(0, 255, 200, ${0.6 + 0.4 * glow})`;
    const neonSolid = "#00ffc8";
    const darkBase = "#0f0f23";
    const darkMid = "#16213e";
    const darkHood = "#1a1a2e";

    // ombra a terra
    ctx.beginPath();
    ctx.ellipse(0, startY + h + 4, w * 0.7, 6, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0, 255, 200, ${0.15 + 0.1 * glow})`;
    ctx.fill();

    // === SCIARPA / MANTELLO che pende dietro ===
    ctx.beginPath();
    ctx.fillStyle = "#2d1b4e";
    ctx.moveTo(startX + w * 0.2, startY + h * 0.28);
    ctx.lineTo(startX - w * 0.15, startY + h * 0.75);
    ctx.lineTo(startX + w * 0.05, startY + h * 0.7);
    ctx.lineTo(startX + w * 0.35, startY + h * 0.32);
    ctx.closePath();
    ctx.fill();

    // === TESTA - CAPPUCCIO ===
    const headH = h * 0.28;

    // cappuccio (triangolo arrotondato)
    ctx.beginPath();
    ctx.moveTo(startX - 6, startY + headH + 2);
    ctx.quadraticCurveTo(startX + w / 2, startY - 18, startX + w + 6, startY + headH + 2);
    ctx.closePath();
    ctx.fillStyle = darkHood;
    ctx.fill();

    // visiera / maschera
    ctx.beginPath();
    ctx.roundRect(startX + w * 0.08, startY + headH * 0.3, w * 0.84, headH * 0.5, 4);
    ctx.fillStyle = darkBase;
    ctx.fill();

    // occhi luminosi
    const eyeY = startY + headH * 0.52;
    const eyeW = w * 0.14;
    const eyeH = w * 0.06;

    ctx.shadowColor = neonSolid;
    ctx.shadowBlur = 15 + 8 * glow;

    // occhio sinistro
    ctx.beginPath();
    ctx.ellipse(startX + w * 0.3, eyeY, eyeW, eyeH, -0.15, 0, Math.PI * 2);
    ctx.fillStyle = neonSolid;
    ctx.fill();

    // occhio destro
    ctx.beginPath();
    ctx.ellipse(startX + w * 0.7, eyeY, eyeW, eyeH, 0.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;

    // === CORPO CORAZZATO ===
    const bodyStartY = startY + headH;
    const bodyH = h * 0.37;
    const armLen = 0.45 * w;

    // corpo principale
    ctx.beginPath();
    ctx.fillStyle = darkMid;
    ctx.rect(startX, bodyStartY, w, bodyH);
    ctx.fill();

    // piastre armatura
    ctx.fillStyle = "#1e2d50";
    ctx.fillRect(startX + 3, bodyStartY + 3, w - 6, bodyH * 0.45);

    // V neon sul petto
    ctx.shadowColor = neonSolid;
    ctx.shadowBlur = 10 * glow;
    ctx.strokeStyle = neon;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(startX + w * 0.1, bodyStartY + bodyH * 0.08);
    ctx.lineTo(startX + w * 0.5, bodyStartY + bodyH * 0.45);
    ctx.lineTo(startX + w * 0.9, bodyStartY + bodyH * 0.08);
    ctx.stroke();

    // linea orizzontale cintura
    ctx.beginPath();
    ctx.moveTo(startX + 4, bodyStartY + bodyH * 0.7);
    ctx.lineTo(startX + w - 4, bodyStartY + bodyH * 0.7);
    ctx.stroke();

    // cerchio energia al centro cintura
    ctx.beginPath();
    ctx.arc(startX + w / 2, bodyStartY + bodyH * 0.7, 4, 0, Math.PI * 2);
    ctx.fillStyle = neonSolid;
    ctx.fill();

    ctx.shadowBlur = 0;

    // braccia
    ctx.fillStyle = darkHood;
    ctx.fillRect(startX - armLen, bodyStartY + bodyH * 0.05, armLen, bodyH * 0.3);
    ctx.fillRect(startX + w, bodyStartY + bodyH * 0.05, armLen, bodyH * 0.3);

    // bande neon sulle braccia
    ctx.shadowColor = neonSolid;
    ctx.shadowBlur = 6 * glow;
    ctx.fillStyle = neon;
    ctx.fillRect(startX - armLen * 0.65, bodyStartY + bodyH * 0.08, armLen * 0.15, bodyH * 0.24);
    ctx.fillRect(startX + w + armLen * 0.5, bodyStartY + bodyH * 0.08, armLen * 0.15, bodyH * 0.24);

    // mani
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#222";
    ctx.fillRect(startX - armLen - 3, bodyStartY + bodyH * 0.05, 6, bodyH * 0.3);
    ctx.fillRect(startX + w + armLen - 3, bodyStartY + bodyH * 0.05, 6, bodyH * 0.3);

    // === SPADA ENERGETICA ===
    const swordX = startX + w + armLen + 2;
    const swordHandleTop = bodyStartY + bodyH * 0.05;

    // impugnatura
    ctx.fillStyle = "#555";
    ctx.fillRect(swordX - 2, swordHandleTop, 4, bodyH * 0.3);

    // guardia
    ctx.fillStyle = "#888";
    ctx.fillRect(swordX - 6, swordHandleTop - 2, 12, 4);

    // lama energia
    ctx.shadowColor = "#ff0050";
    ctx.shadowBlur = 14 + 6 * glow;
    const bladeGrad = ctx.createLinearGradient(0, swordHandleTop - headH, 0, swordHandleTop);
    bladeGrad.addColorStop(0, `rgba(255, 0, 80, ${0.3 + 0.2 * glow})`);
    bladeGrad.addColorStop(1, "#ff0050");
    ctx.strokeStyle = bladeGrad;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(swordX, swordHandleTop - 2);
    ctx.lineTo(swordX, swordHandleTop - headH * 1.2);
    ctx.stroke();

    // nucleo lama (bianco)
    ctx.strokeStyle = `rgba(255, 200, 220, ${0.6 + 0.4 * glow})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(swordX, swordHandleTop - 2);
    ctx.lineTo(swordX, swordHandleTop - headH * 1.2);
    ctx.stroke();

    ctx.shadowBlur = 0;

    // === GAMBE ===
    const legH = h - headH - bodyH;
    const legStartY = bodyStartY + bodyH;
    const legW = w * 0.35;

    // parte alta gambe
    ctx.fillStyle = darkBase;
    ctx.fillRect(startX, legStartY, w, legH * 0.25);

    // gamba sinistra
    ctx.fillRect(startX, legStartY, legW, legH);
    // gamba destra
    ctx.fillRect(startX + w - legW, legStartY, legW, legH);

    // ginocchiere neon
    ctx.shadowColor = neonSolid;
    ctx.shadowBlur = 5 * glow;
    ctx.fillStyle = neon;
    ctx.fillRect(startX + legW * 0.2, legStartY + legH * 0.4, legW * 0.6, 3);
    ctx.fillRect(startX + w - legW + legW * 0.2, legStartY + legH * 0.4, legW * 0.6, 3);
    ctx.shadowBlur = 0;

    // stivali
    ctx.fillStyle = darkMid;
    ctx.fillRect(startX - 3, legStartY + legH * 0.78, legW + 6, legH * 0.22);
    ctx.fillRect(startX + w - legW - 3, legStartY + legH * 0.78, legW + 6, legH * 0.22);

    // suole neon
    ctx.shadowColor = neonSolid;
    ctx.shadowBlur = 4 * glow;
    ctx.fillStyle = neon;
    ctx.fillRect(startX - 3, legStartY + legH - 2, legW + 6, 2);
    ctx.fillRect(startX + w - legW - 3, legStartY + legH - 2, legW + 6, 2);
    ctx.shadowBlur = 0;

    ctx.restore();
}
