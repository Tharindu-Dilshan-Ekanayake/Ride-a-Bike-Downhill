---
canDie: true
hasScore: true
---

# Bike Hill Rush: Boxity integration

Ride a bike down a mountain road: steer through the bends, hop logs, smash crates, launch
off ramps and flip, collect coins, and save your boost for the hills. A ride ends when you
crash (a bail: you fly off the bike), run out of speed on a hill, reach the bottom, or press
END. There are no lives and nothing is lost: you always ride again. Coins buy faster bikes
(24 of them; every hill on the road needs a particular bike - each one crests exactly one
more, and boost only gets you back to your bike's own top speed), Boost and Income upgrades,
and passes; every bike can also be tuned part by part (tires, suspension, gears - five levels
each) at the GARAGE in the lobby. Rebirth resets Coins, bikes, parts and upgrades for a
permanent Coin multiplier. Frost Ridge, the second mountain, opens once you reach the bottom
of Pine Peak (portal, or the WORLDS menu). Other players in your room ride the same
road and are drawn on it live.

The road is generated from a seed in `shared/track.js`, so the client and the server build
exactly the same one: the server checks every ride against it (`shared/logic.js applyRide`).

## Leaderboards

Scores are reported by the **game server**, never by the client
(`server/src/bloxityLeaderboards.js`, `BLOXITY_LEADERBOARDS`). Every ~20 s and when a
player leaves, each pod sends the changed scores of its verified players to
`POST {api}/v1/leaderboards/hosted/{BLOXITY_GAME_ID}/report` as `legion_<userId>`.

| Board      | Label            | Score                                | Format  |
|------------|------------------|--------------------------------------|---------|
| `rebirths` | Rebirths         | `profile.rebirths`                   | number  |
| `wins`     | Total Coins      | `profile.stats.totalWins`            | compact |
| `distance` | Longest Ride (m) | `floor(profile.stats.bestDistance)`  | compact |
| `playtime` | Minutes Played   | `floor(profile.stats.playtime / 60)` | number  |

All four are `order: desc`, `mode: best`, `reset: none`. (The ids are the platform's; the
Coins field is still called `wins` in the code.)

## Rides and anti-cheat

The client sends `rideStart`, ~10 Hz `ridePos { m, x, h, r, s }` (only stored for others to
watch, kept to the road) and `rideEnd { distance, time, finished, crashed, coins: [indices],
flips, smashed, pads, flew, bounces, topSpeed }`. The server measures the ride's time itself
and holds the result to what the equipped bike could physically do in it
(`track.maxRideSpeed`), pays each coin index once and only within the distance ridden, caps
flips, and only counts a finish if the time allows it.

## Gems purchases

Boxity's purchase webhook goes to `POST /api/gems/webhook` on the game server. It is
recorded in the database by `transactionId` (idempotent) and applied exactly once by the
pod the buyer plays on. Unknown skus are answered 400 so Boxity refunds them.

| Sku             | Grants                                      |
|-----------------|---------------------------------------------|
| `coins_small`   | 10 full rides' worth of Coins (grows with you) |
| `coins_big`     | 60 full rides' worth of Coins               |
| `potion_bundle` | 3 x2 Coins + 3 Turbo potions                |
| `wins_x2`       | x2 Coins pass                               |
| `magnet`        | Coin Magnet pass                            |
| `big_tank`      | Big Boost Tank pass (+1 s boost)            |

## Rewarded ads

The client sends `adReward { placement, rewardToken }`; the server verifies the token
with `POST {api}/v1/ads/reward/verify` before granting anything. Placements:
`wins-potion` (x2 Coins potion) and `turbo-potion` (Turbo potion), 3 min cooldown each.

## Open Rooms

Each pod reports its rooms every 2 s to `POST {MATCHMAKER_REPORT_URL}/{BLOXITY_GAME_ID}/rooms`
(`server/src/legionRoomReporter.js`, installed after `listen()`), so they show under
"Open Rooms" on the game page. The client joins `?roomId=` at launch and falls back to
normal matchmaking if that room is gone or full.

## Avatars

`client/src/game/PlayerAvatar.jsx` + `avatarRig.js` draw every slot of the Bloxity avatar,
posed by `client/src/game/playerPose.js`: walking in the lobby, seated on the bike
(pedalling, tucking, leaning) during a ride, tumbling after a bail.

## Server environment

| Variable                | Purpose                                                       |
|-------------------------|---------------------------------------------------------------|
| `BLOXITY_REPORT_TOKEN`  | Token for leaderboard and room reports (none set = no reports) |
| `MATCHMAKER_REPORT_URL` | Where the Open Rooms reporter posts (injected by Boxity hosting) |
| `BLOXITY_GAME_ID`       | Hosted game id for reports (default `ride-a-bike-downhill`)    |
| `LEGION_WEBHOOK_SECRET` | Must match the webhook's `x-legion-webhook-secret` header     |
| `MONGODB_URI`           | Shared database for profiles and Gems grants (SQLite without) |
| `BLOXITY_API_URL` etc.  | Platform URLs; production defaults (`server/src/bloxityEnv.js`) |
