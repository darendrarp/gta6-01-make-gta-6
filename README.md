# gta6-01-make-gta-6

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/darendrarp/gta6-01-make-gta-6/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/darendrarp/gta6-01-make-gta-6/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**SOLBRISA** — a three.js open-world crime game set in the golden-hour coastal city of Solbrisa. You are Kai Marlow, a newcomer doing jobs for the fixer Vera "Vex" Delgado: steal cars, run packages, lose the cops, and outrun a 90-second getaway timer.

What's in the world:

- A procedural low-poly city — 7×7 block grid, 72 buildings with lit windows, palm-lined coast road, beach and ocean, marina, golden-hour sun, shadows and fog. Seeded, so `?seed=` rebuilds the same city.
- On foot (WASD + mouse-orbit camera, run, jump) and driving (steal any parked car with E, arcade handling, handbrake, collisions).
- Traffic cars on the road grid, pedestrians on the sidewalks who flee danger.
- A 1–5 star wanted system: police cars chase and ram, foot cops chase and punch, wanted decays when you stay hidden; busted or wasted costs you money and the mission restarts.
- SPD dispatch: the Solbrisa Police Department answers the heat in tiers — patrol response, pursuit, roadblocks parked across the roads ahead from 3 stars, the Air One helicopter from 4 stars (its spotlight keeps you in sight, so the heat never drops while it is overhead), and a full lockdown at 5 stars.
- Combat: pistol (hitscan, ammo, pickups) and melee.
- Ten story missions with HUD objectives, minimap markers and 3D beacons: First Wheels, Package Run, Lose the Heat, Coast Getaway, Night Shift (collect three cash drops), Heat Wave (hold three stars for 30 seconds), Coast Sprint (checkpoint chain), The Crew Gathers (recruit Rook, Mira and Dante), Roadblock Run (four stars to the Coast Lookout), The Big Score (three vault drops, five stars, one clean getaway).
- A crew to recruit: Rook the wheelman, Mira the lookout, Dante the muscle — they follow you on foot, wait while you drive, and show in the HUD crew panel.
- A working garage: drive into Vex's yard and press G to store a car (three slots by the sign), repaint a stored car on foot ($150), or press T to tune the engine ($400, +4 top speed, three levels).
- Street racing: drive into the start arch on the coast road and press R — a checkpoint sprint against an AI rival, first to the Coast Lookout wins $600.
- Day and night: press N to flip between golden hour and full night — dark sky, moon, stars and warm streetlights. The clock follows keyframed light, so every hour has its own look.
- Full HUD (health, money, stars, speedometer, objective), canvas minimap, start/pause/busted/wasted screens, localStorage saves, and synthesized WebAudio sound only (engine, sirens, gunshots — no audio files).

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080. No build step, no network requests at runtime — the game is plain static files under `game/` (three.js is vendored).

Screenshots are staged deterministically: `?shot=chase|race|garage|combat|street|coast|night|mission|start&seed=7`. Tier 3 (21 Nov 2026): ten missions, SPD dispatch (roadblocks + Air One helicopter), a recruitable crew, a working garage (store/repaint/tune), and a night garage frame replacing the night drive. Tier 2 (21 Nov 2026): three new missions, street racing and a day/night cycle; race + night frames replace street + coast. Tier 1 (21 Nov 2026): denser streets (30 traffic, 60 peds, 30 parked), police visible in the chase frame, and a new combat frame replacing the mission shot.

---

<sub>Entered on [make.fun](https://make.fun/?ref=y2d7dbzn&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
