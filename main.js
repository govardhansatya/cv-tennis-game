import { CameraTracker } from './tracker.js';
import { TennisGame, COURT_WIDTH, COURT_HEIGHT } from './game.js';

const screens = {
  menu: document.getElementById('menuScreen'),
  calibrate: document.getElementById('calibrateScreen'),
  game: document.getElementById('gameScreen'),
  gameOver: document.getElementById('gameOverScreen'),
};
const hud = document.getElementById('hud');
const levelLabel = document.getElementById('levelLabel');
const controlModeLabel = document.getElementById('controlModeLabel');
const calibrateStatus = document.getElementById('calibrateStatus');
const previewVideo = document.getElementById('previewVideo');
const previewMarker = document.getElementById('previewMarker');
const gameCanvas = document.getElementById('gameCanvas');
const gameOverTitle = document.getElementById('gameOverTitle');
const gameOverScore = document.getElementById('gameOverScore');
const startMatchBtn = document.getElementById('startMatchBtn');
const calibrateBackBtn = document.getElementById('calibrateBackBtn');

const tracker = new CameraTracker();
const ctx = gameCanvas.getContext('2d');
let game = null;
let controlMode = 'camera'; // 'camera' | 'fallback'
let paused = false;
let rafId = null;
let calibrationRafId = null;
let lastTime = 0;
let currentLevel = 'easy';

// --- Fallback input (mouse / arrow keys) ---
let fallbackNormX = 0.5;
const keysHeld = { left: false, right: false };
const FALLBACK_KEY_SPEED = 1.4; // normalized units per second

gameCanvas.addEventListener('mousemove', (e) => {
  const rect = gameCanvas.getBoundingClientRect();
  fallbackNormX = clamp01((e.clientX - rect.left) / rect.width);
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') keysHeld.left = true;
  if (e.key === 'ArrowRight') keysHeld.right = true;
});
window.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft') keysHeld.left = false;
  if (e.key === 'ArrowRight') keysHeld.right = false;
});

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function showScreen(name) {
  for (const key of Object.keys(screens)) {
    screens[key].classList.toggle('hidden', key !== name);
  }
}

// --- Menu ---
document.querySelectorAll('.level-btn').forEach((btn) => {
  btn.addEventListener('click', () => startLevel(btn.dataset.level));
});

async function startLevel(level) {
  currentLevel = level;
  showScreen('calibrate');
  calibrateStatus.textContent = 'Requesting camera access…';

  try {
    await tracker.start();
    controlMode = 'camera';
    previewVideo.srcObject = tracker.stream;
    previewMarker.width = 320;
    previewMarker.height = 240;
    runCalibration();
  } catch (err) {
    controlMode = 'fallback';
    calibrateStatus.textContent = 'Camera unavailable — using mouse / arrow-key control instead.';
    setTimeout(enterGame, 1200);
  }
}

function runCalibration() {
  const markerCtx = previewMarker.getContext('2d');
  startMatchBtn.classList.remove('hidden');

  function frame(now) {
    tracker.update(now);
    const x = tracker.getX();
    markerCtx.clearRect(0, 0, previewMarker.width, previewMarker.height);
    if (x !== null) {
      markerCtx.fillStyle = '#ff4d4d';
      markerCtx.beginPath();
      markerCtx.arc(x * previewMarker.width, previewMarker.height / 2, 10, 0, Math.PI * 2);
      markerCtx.fill();
      calibrateStatus.textContent = 'Tracking you — move around, then tap Start when it looks right.';
    } else {
      calibrateStatus.textContent = 'Move left and right so we can see you…';
    }
    calibrationRafId = requestAnimationFrame(frame);
  }
  calibrationRafId = requestAnimationFrame(frame);
}

startMatchBtn.addEventListener('click', enterGame);
calibrateBackBtn.addEventListener('click', backToMenu);

function enterGame() {
  if (calibrationRafId) {
    cancelAnimationFrame(calibrationRafId);
    calibrationRafId = null;
  }
  startMatchBtn.classList.add('hidden');
  paused = false;
  fallbackNormX = 0.5;
  game = new TennisGame(ctx, currentLevel);
  hud.classList.remove('hidden');
  levelLabel.textContent = `Level: ${game.level.label}`;
  controlModeLabel.textContent = controlMode === 'camera' ? 'Camera control' : 'Mouse / arrow-key control';
  pauseBtn.textContent = 'Pause';
  showScreen('game');
  lastTime = performance.now();
  rafId = requestAnimationFrame(loop);
}

function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  if (!paused) {
    let playerNormX;
    if (controlMode === 'camera') {
      tracker.update(now);
      playerNormX = tracker.getX();
      if (playerNormX === null) playerNormX = fallbackNormX; // camera lost mid-game
    } else {
      if (keysHeld.left) fallbackNormX = clamp01(fallbackNormX - FALLBACK_KEY_SPEED * dt);
      if (keysHeld.right) fallbackNormX = clamp01(fallbackNormX + FALLBACK_KEY_SPEED * dt);
      playerNormX = fallbackNormX;
    }

    game.update(dt, playerNormX);
  }

  game.draw();

  if (game.isOver) {
    endGame();
    return;
  }

  rafId = requestAnimationFrame(loop);
}

function endGame() {
  cancelAnimationFrame(rafId);
  const won = game.winner === 'player';
  gameOverTitle.textContent = won ? 'You win!' : 'AI wins!';
  gameOverScore.textContent = `Final score — You: ${game.scores.player}  ·  AI: ${game.scores.ai}`;
  showScreen('gameOver');
}

const pauseBtn = document.getElementById('pauseBtn');
pauseBtn.addEventListener('click', () => {
  paused = !paused;
  pauseBtn.textContent = paused ? 'Resume' : 'Pause';
});

document.getElementById('quitBtn').addEventListener('click', backToMenu);
document.getElementById('changeLevelBtn').addEventListener('click', backToMenu);

document.getElementById('replayBtn').addEventListener('click', () => {
  showScreen('game');
  enterGame();
});

function backToMenu() {
  if (rafId) cancelAnimationFrame(rafId);
  if (calibrationRafId) cancelAnimationFrame(calibrationRafId);
  if (tracker.isAvailable()) tracker.stop();
  startMatchBtn.classList.add('hidden');
  hud.classList.add('hidden');
  showScreen('menu');
}
