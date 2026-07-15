# CV Tennis

A fully offline, webcam-controlled tennis game. Move left and right in
front of your camera to steer your paddle and rally against an AI opponent.

No ML models, no CDN scripts, no network calls at play time — motion
tracking is done with plain frame-differencing on downsampled canvas pixels,
and the only server is a zero-dependency static file server using Node's
built-in `http` module.

## Run it

```
node serve.js
```

Then open `http://localhost:8080` in a browser. A local server is required
(rather than opening `index.html` directly) because `getUserMedia` needs a
secure context, and `file://` doesn't reliably qualify.

No `npm install` needed — `serve.js` uses only Node's built-in `http`/`fs`
modules.

## Playing

1. Pick a level: **Easy**, **Medium**, **Hard**, or **Pro**.
2. Allow camera access when prompted. On the calibration screen, step left
   and right until the red dot tracks you smoothly, then tap **Start
   Match** whenever you're ready (there's no rush, and no fixed timer).
3. Once the rally starts, move left/right to keep the ball in play. First
   to 11 points wins.
4. No camera, or permission denied? The game automatically falls back to
   mouse movement or the left/right arrow keys — fully playable either way.

## Levels

Each level tunes ball speed, how much the ball speeds up per rally, and the
AI paddle's max speed / reaction lag / aim error:

| Level  | Ball speed | AI speed | AI accuracy |
|--------|-----------|----------|--------------|
| Easy   | Slow      | Slow     | Loose        |
| Medium | Moderate  | Moderate | Decent       |
| Hard   | Fast      | Fast     | Sharp        |
| Pro    | Very fast | Very fast| Near-perfect |

## Troubleshooting

- **Paddle jittery or unresponsive**: improve lighting and stand where your
  movement is clearly visible against the background; the tracker looks for
  frame-to-frame brightness changes, so a static, evenly-lit background
  works best.
- **Camera permission blocked**: check your browser's site settings for
  `localhost:8080` and allow camera access, or just play with mouse/arrow
  keys — no camera required.
- **Nothing loads**: make sure `node serve.js` is still running and you're
  visiting `http://localhost:8080`, not opening `index.html` as a file.
