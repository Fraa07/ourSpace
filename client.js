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

function drawPersonaggio8(x, y, w, h, style = {}) {
    ctx.save();

    // Sposta l'origine al centro del personaggio
    ctx.translate(x, y);
    const startX = -w / 2;
    const startY = -h / 2;

    // Proporzioni molto squadrate (stile "cubettoso")
    const headSize = h * 0.35; 
    const bodyH = h * 0.40;
    const legH = h - headSize - bodyH;

    // Colori personalizzabili o di default
    const skin = style.skinColor || "#ffccaa";
    const shirt = style.shirtColor || "#e74c3c";
    const pants = style.pantsColor || "#2980b9";

    // +Testa (Un blocco unico)
    ctx.fillStyle = skin;
    ctx.fillRect(startX, startY, w, headSize);

    // Occhi (quadrati, in pieno stile pixel-art)
    ctx.fillStyle = "#111111";
    ctx.fillRect(startX + w * 0.15, startY + headSize * 0.3, w * 0.25, w * 0.25); // Occhio sx
    ctx.fillRect(startX + w * 0.6, startY + headSize * 0.3, w * 0.25, w * 0.25);  // Occhio dx

    // Bocca (una fessura rettangolare)
    ctx.fillStyle = "#882222";
    ctx.fillRect(startX + w * 0.35, startY + headSize * 0.7, w * 0.3, w * 0.1);
    // -Testa

    // +Corpo (Maglietta)
    const bodyStartY = startY + headSize;
    ctx.fillStyle = shirt;
    ctx.fillRect(startX, bodyStartY, w, bodyH);

    // Braccia (rettangoli rigidi attaccati ai lati)
    const armW = w * 0.35;
    ctx.fillStyle = shirt; // Maniche
    ctx.fillRect(startX - armW, bodyStartY, armW, bodyH * 0.7); // Braccio sx
    ctx.fillRect(startX + w, bodyStartY, armW, bodyH * 0.7);    // Braccio dx

    // Mani (quadrate)
    ctx.fillStyle = skin;
    ctx.fillRect(startX - armW, bodyStartY + bodyH * 0.7, armW, bodyH * 0.25);
    ctx.fillRect(startX + w, bodyStartY + bodyH * 0.7, armW, bodyH * 0.25);
    // -Corpo

    // +Gambe (Pantaloni)
    const legStartY = bodyStartY + bodyH;
    const legW = w * 0.45;
    
    ctx.fillStyle = pants;
    ctx.fillRect(startX, legStartY, legW, legH); // Gamba sx
    ctx.fillRect(startX + w - legW, legStartY, legW, legH); // Gamba dx
    
    // Spazio tra le gambe (per dare l'effetto di due gambe separate se il background è un altro colore, 
    // ma qui disegniamo i blocchi separati, quindi lasciamo uno spiraglio al centro)
    ctx.clearRect(startX + legW, legStartY, w - (legW * 2), legH); 
    // -Gambe

    // +Bounding box (Trasparente, per il debug)
    ctx.beginPath();
    ctx.rect(startX, startY, w, h);
    ctx.strokeStyle = "rgba(255, 255, 0, 0.4)"; // Giallo per distinguerlo dagli altri
    ctx.stroke();
    // -Bounding box

    ctx.restore();
}
