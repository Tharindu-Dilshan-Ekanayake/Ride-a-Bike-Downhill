# Bike Hill Rush (client)

React 19 + three.js (react-three-fiber) + zustand, built with Vite. The rules live in
`../shared` (shared with the server); this is the rendering, input and UI.

```bash
npm install
npm run dev          # local dev (needs the local Boxity stack; ?offline plays without a server)
npm run build        # production build to dist/
npm run lint
```

URL flags: `?offline` (play against the in-browser stand-in server, saves to localStorage),
`?debug` (exposes `window.__pp` and renderer stats on `window.__ppPerf`), `?perf` (dev only:
the r3f-perf overlay).

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Steer | A / D or ← / → | the arrow buttons |
| Boost | Shift | BOOST |
| Brake (lean back in the air) | S / ↓ | BRAKE |
| Jump (lean forward in the air) | Space (W / ↑ leans forward) | JUMP |
| Camera (chase / far / first person) | C or CAM | CAM |
| End ride | END | END |

In the lobby: walk with WASD / the joystick, walk into the START gate or press PLAY. Walk into
the GARAGE to tune your bikes; the WORLDS tile travels to Frost Ridge once Pine Peak is finished.

## Where things are

- `src/game/ride/` - the ride: `rideControl.js` (state machine, talks to the server),
  `ridePhysics.js` (bike physics on the road), `Ride.jsx` (the lazily loaded chunk: road
  chunks, obstacles, coins, scenery, your bike, chase camera), `trackMesh.js` (geometry),
  `bikeModels.js` (the 24 bikes), `windowed.js` (distance-windowed instancing).
- `src/game/world/` - the lobby (mountain top, START gate, bike shop, garage, portal, boards).
- `src/ui/ride/` - the ride HUD and the results screen; `src/ui/hud`, `src/ui/panels` - the
  lobby HUD and menus.
- `../shared/track.js` - the seeded road (centreline, hills, obstacles, ramps, coins) and the
  speed model; `../shared/balance.js` - every tunable number;
  `../scripts/balance-sim.mjs` - prints the pacing after a balance change.

## Performance

Quality presets (LOW / MEDIUM / HIGH) in `src/store/quality.js`; phones and ≤ 4-core
machines start on LOW and the FPS monitor drops presets / resolution under 45 FPS. No
physics engine (0 rigid bodies), no textures over 1024 px (512 px on LOW), everything
repeated is instanced, the road is built in 80 m chunks and drawn only within view
distance, props are windowed around the rider.
