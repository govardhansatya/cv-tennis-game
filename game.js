// TennisGame: ball physics, AI paddle, scoring and difficulty levels for a
// top-down webcam-controlled tennis/pong hybrid. Rendering + physics only —
// menu/calibration UI and input source live in main.js.

export const LEVELS = {
  easy: { label: 'Easy', ballSpeed: 220, speedIncrement: 8, aiMaxSpeed: 140, aiReactionLag: 0.045, aiError: 46 },
  medium: { label: 'Medium', ballSpeed: 280, speedIncrement: 12, aiMaxSpeed: 220, aiReactionLag: 0.09, aiError: 26 },
  hard: { label: 'Hard', ballSpeed: 340, speedIncrement: 16, aiMaxSpeed: 300, aiReactionLag: 0.16, aiError: 13 },
  pro: { label: 'Pro', ballSpeed: 400, speedIncrement: 22, aiMaxSpeed: 380, aiReactionLag: 0.28, aiError: 4 },
};

export const COURT_WIDTH = 400;
export const COURT_HEIGHT = 600;

const PADDLE_WIDTH = 84;
const PADDLE_HEIGHT = 12;
const PLAYER_Y = COURT_HEIGHT - 28;
const AI_Y = 28;
const BALL_RADIUS = 8;
const WIN_SCORE = 11;
const SERVE_DELAY = 0.8;

export class TennisGame {
  constructor(ctx, levelKey) {
    this.ctx = ctx;
    this.setLevel(levelKey);
    this.reset();
  }

  setLevel(levelKey) {
    this.level = LEVELS[levelKey] || LEVELS.easy;
  }

  reset() {
    this.playerX = COURT_WIDTH / 2;
    this.aiX = COURT_WIDTH / 2;
    this.aiTargetX = COURT_WIDTH / 2;
    this.scores = { player: 0, ai: 0 };
    this.winner = null;
    this._serve(Math.random() < 0.5 ? 1 : -1);
  }

  _serve(direction) {
    this.serveTimer = SERVE_DELAY;
    this.ball = {
      x: COURT_WIDTH / 2,
      y: COURT_HEIGHT / 2,
      vx: (Math.random() * 2 - 1) * 80,
      vy: direction * this.level.ballSpeed,
    };
  }

  get isOver() {
    return this.winner !== null;
  }

  // playerNormX: 0..1 horizontal position, or null to hold the paddle still.
  update(dt, playerNormX) {
    if (this.winner) return;

    if (playerNormX !== null && playerNormX !== undefined) {
      const targetX = playerNormX * COURT_WIDTH;
      this.playerX = clamp(targetX, PADDLE_WIDTH / 2, COURT_WIDTH - PADDLE_WIDTH / 2);
    }

    if (this.serveTimer > 0) {
      this.serveTimer -= dt;
      this._updateAI(dt);
      return;
    }

    const b = this.ball;
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    if (b.x - BALL_RADIUS < 0) {
      b.x = BALL_RADIUS;
      b.vx *= -1;
    } else if (b.x + BALL_RADIUS > COURT_WIDTH) {
      b.x = COURT_WIDTH - BALL_RADIUS;
      b.vx *= -1;
    }

    this._checkPaddleHit(this.playerX, PLAYER_Y, 1);
    this._checkPaddleHit(this.aiX, AI_Y, -1);

    if (b.y < 0) {
      this._point('player');
    } else if (b.y > COURT_HEIGHT) {
      this._point('ai');
    }

    this._updateAI(dt);
  }

  _checkPaddleHit(paddleX, paddleY, expectedVySign) {
    const b = this.ball;
    if (Math.sign(b.vy) !== expectedVySign) return;

    const withinY = Math.abs(b.y - paddleY) < PADDLE_HEIGHT / 2 + BALL_RADIUS;
    const withinX = Math.abs(b.x - paddleX) < PADDLE_WIDTH / 2 + BALL_RADIUS;
    if (withinY && withinX) {
      b.vy = -b.vy;
      const speed = Math.min(Math.hypot(b.vx, b.vy) + this.level.speedIncrement, 900);
      const angle = Math.atan2(b.vy, b.vx);
      b.vx = Math.cos(angle) * speed;
      b.vy = Math.sin(angle) * speed;
      // Nudge horizontal direction based on where it hit the paddle.
      const offset = (b.x - paddleX) / (PADDLE_WIDTH / 2);
      b.vx += offset * 120;
      b.y = paddleY + (expectedVySign * -1) * (PADDLE_HEIGHT / 2 + BALL_RADIUS + 1);
    }
  }

  _point(who) {
    this.scores[who]++;
    if (this.scores[who] >= WIN_SCORE) {
      this.winner = who;
      return;
    }
    this._serve(who === 'player' ? -1 : 1);
  }

  _updateAI(dt) {
    const targetRaw = this.ball.x + (Math.random() * 2 - 1) * this.level.aiError;
    const lag = clamp(this.level.aiReactionLag, 0.01, 1);
    this.aiTargetX += (targetRaw - this.aiTargetX) * Math.min(1, lag * dt * 60);
    const desired = clamp(this.aiTargetX, PADDLE_WIDTH / 2, COURT_WIDTH - PADDLE_WIDTH / 2);
    const maxStep = this.level.aiMaxSpeed * dt;
    const delta = clamp(desired - this.aiX, -maxStep, maxStep);
    this.aiX += delta;
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, COURT_WIDTH, COURT_HEIGHT);

    ctx.fillStyle = '#0b2e13';
    ctx.fillRect(0, 0, COURT_WIDTH, COURT_HEIGHT);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(4, 4, COURT_WIDTH - 8, COURT_HEIGHT - 8);
    ctx.beginPath();
    ctx.setLineDash([10, 10]);
    ctx.moveTo(4, COURT_HEIGHT / 2);
    ctx.lineTo(COURT_WIDTH - 4, COURT_HEIGHT / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(this.playerX - PADDLE_WIDTH / 2, PLAYER_Y - PADDLE_HEIGHT / 2, PADDLE_WIDTH, PADDLE_HEIGHT);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(this.aiX - PADDLE_WIDTH / 2, AI_Y - PADDLE_HEIGHT / 2, PADDLE_WIDTH, PADDLE_HEIGHT);

    ctx.fillStyle = '#f7f7f7';
    ctx.beginPath();
    ctx.arc(this.ball.x, this.ball.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${this.scores.ai}`, COURT_WIDTH / 2, AI_Y + 60);
    ctx.fillText(`${this.scores.player}`, COURT_WIDTH / 2, PLAYER_Y - 40);
  }
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
