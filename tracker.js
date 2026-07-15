// CameraTracker: tracks the player's horizontal position in front of the
// webcam using background-subtraction on downsampled canvas pixels. No ML
// model, no network fetch — genuinely offline motion tracking.
//
// Tracking work (video draw + getImageData + pixel diff) is throttled to
// its own low-frequency cadence (~20Hz) independent of the render loop, so
// the expensive synchronous canvas readback never drags down the 60fps
// game rendering. Uses a slow-adapting background average rather than raw
// frame-to-frame differencing — much less sensitive to sensor noise and
// keeps tracking the player even while they're briefly still, not just
// while actively moving.
export class CameraTracker {
  constructor({
    sampleWidth = 64,
    sampleHeight = 48,
    diffThreshold = 22,
    minMovingPixels = 20,
    processIntervalMs = 20, // ~50Hz tracking cadence
    bgAlpha = 0.03,
    deadzone = 0.008,
  } = {}) {
    this.sampleWidth = sampleWidth;
    this.sampleHeight = sampleHeight;
    this.diffThreshold = diffThreshold;
    this.minMovingPixels = minMovingPixels;
    this.processIntervalMs = processIntervalMs;
    this.bgAlpha = bgAlpha;
    this.deadzone = deadzone;

    this.video = document.createElement('video');
    this.video.autoplay = true;
    this.video.playsInline = true;
    this.video.muted = true;

    this.sampleCanvas = document.createElement('canvas');
    this.sampleCanvas.width = sampleWidth;
    this.sampleCanvas.height = sampleHeight;
    this.sampleCtx = this.sampleCanvas.getContext('2d', { willReadFrequently: true });

    this.bg = null; // Float32Array background grayscale average
    this.smoothedX = 0.5;
    this.hasSample = false;
    this.stream = null;
    this.ready = false;
    this.lastProcessTime = 0;
  }

  // Resolves once the camera is streaming, or rejects if unavailable/denied.
  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 30 } },
      audio: false,
    });
    this.video.srcObject = this.stream;
    await this.video.play();
    this.ready = true;
    this.bg = null;
    this.hasSample = false;
    this.lastProcessTime = 0;
  }

  stop() {
    if (this.stream) {
      for (const track of this.stream.getTracks()) track.stop();
      this.stream = null;
    }
    this.ready = false;
    this.bg = null;
    this.hasSample = false;
  }

  // Resets the background model so the next few frames re-learn the scene.
  // Call this if the player steps away or lighting changes mid-session.
  recalibrate() {
    this.bg = null;
    this.hasSample = false;
  }

  // Call once per animation frame with the rAF timestamp `now` (ms). Internally
  // throttled — most calls are cheap no-ops between processing ticks.
  update(now = performance.now()) {
    if (!this.ready || this.video.readyState < 2) return;
    if (now - this.lastProcessTime < this.processIntervalMs) return;
    this.lastProcessTime = now;

    const w = this.sampleWidth;
    const h = this.sampleHeight;
    // Mirror the draw horizontally so tracking math matches the mirrored
    // preview the player sees (moving right on screen = paddle moves right).
    this.sampleCtx.save();
    this.sampleCtx.translate(w, 0);
    this.sampleCtx.scale(-1, 1);
    this.sampleCtx.drawImage(this.video, 0, 0, w, h);
    this.sampleCtx.restore();

    const frame = this.sampleCtx.getImageData(0, 0, w, h);
    const gray = new Float32Array(w * h);
    for (let i = 0, p = 0; i < frame.data.length; i += 4, p++) {
      gray[p] = frame.data[i] * 0.299 + frame.data[i + 1] * 0.587 + frame.data[i + 2] * 0.114;
    }

    if (!this.bg) {
      this.bg = gray;
      return;
    }

    let sumX = 0;
    let count = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const diff = Math.abs(gray[idx] - this.bg[idx]);
        if (diff > this.diffThreshold) {
          sumX += x;
          count++;
        }
        // Slow-adapting background average (simple running background subtraction).
        this.bg[idx] += (gray[idx] - this.bg[idx]) * this.bgAlpha;
      }
    }

    if (count >= this.minMovingPixels) {
      const rawX = sumX / count / w; // normalized 0..1
      const delta = rawX - this.smoothedX;
      if (Math.abs(delta) > this.deadzone) {
        // Adaptive blend: snap quickly toward real/large movement, stay
        // gentle on small jitter so the dot doesn't feel laggy when you
        // actually move but still doesn't twitch when you're mostly still.
        const alpha = Math.abs(delta) > 0.04 ? 0.8 : 0.5;
        this.smoothedX += delta * alpha;
      }
      this.hasSample = true;
    }
    // else: hold last known smoothedX rather than snapping around.
  }

  // Normalized 0..1 horizontal position, or null if camera never produced
  // a usable sample (unavailable/denied/no motion detected yet).
  getX() {
    if (!this.ready || !this.hasSample) return null;
    return this.smoothedX;
  }

  isAvailable() {
    return this.ready;
  }
}
