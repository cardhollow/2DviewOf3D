
"use strict";

const LEVEL_FOLDER = "./levels/";
const MAX_LEVEL_SCAN = 10000;
const Z_SPEED = 3;
const GRAVITY = 22;
const MOVE_SPEED = 5;
const JUMP_SPEED = 8;
const PLAYER_WIDTH = 0.45;
const PLAYER_HEIGHT = 0.9;
const PLAYER_DEPTH = 0.7;
const COLLISION_EPSILON = 0.025;

const mainmenu = document.getElementById("main");
const settingsMenu = document.getElementById("settingsmenu");
const levelsElement = document.getElementById("levels");
const gameElement = document.getElementById("game");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const loading = document.getElementById("loading");
const zInfo = document.getElementById("zInfo");
const backButton = document.getElementById("back");

const useKeyMap = {
    left: "a",
    right: "d",
    forward: "w",
    backward: "s",
    jump: " "
};

const keyNames = {
    left: "Move Left",
    right: "Move Right",
    forward: "Move Forward",
    backward: "Move Backward",
    jump: "Jump"
};

let width = 1;
let height = 1;
let dpr = 1;
let currentLevel = 0;
let model = null;
let sliceZ = 0;
let zoom = 1;
let keys = {};
let lastTime = 0;
let grounded = false;
let currentSegments = [];
let currentLoops = [];

let player = {
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0
};



































































































let levelTransitioning = false;





document.addEventListener("keydown",function(event) {
    const key = event.key.toLowerCase();

    keys[key] = true;

    if (key === " " || key === "arrowleft" || key === "arrowright" || key === "a" || key === "d" || key === "w" || key === "s") {
        event.preventDefault();
    }
});

document.addEventListener("keyup",function(event) {
    keys[event.key.toLowerCase()] = false;
});

window.addEventListener("blur",function() {
    keys = {};
});

backButton.addEventListener("click",function() {
    gameElement.style.display = "none";
    levelsElement.style.display = "grid";
    model = null;
    currentLevel = 0;
    currentSegments = [];
    currentLoops = [];
    levelTransitioning = false;
});

window.addEventListener("resize",resizeCanvas);

resizeCanvas();
requestAnimationFrame(animate);
