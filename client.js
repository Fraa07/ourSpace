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
