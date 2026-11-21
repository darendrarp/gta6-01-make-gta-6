// The screenshot scenes behind ?shot=chase|street|coast|combat|mission|start|race|night.
// Each one stages the real game — a real car, real police, a real mission —
// then plays it forward with a scripted pilot for a fixed number of steps, so
// the frame is what a short game really looks like and the same seed always
// gives the same frame. main.js runs the steps, renders, and sets
// window.__shotReady.

import { addWanted, hurtCop } from './police.js';
import { scarePeds } from './pedestrians.js';
import { jumpToMission } from './missions.js';
import { enterCar } from './player.js';
import { startStreetRace } from './races.js';
import { setTimeOfDay } from './environment.js';

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/** A fake input object with the same interface as the real one. */
function makePilot(forward, strafe) {
  return {
    jumpQueued: false,
    forward: () => forward,
    strafe: typeof strafe === 'function' ? strafe : () => strafe,
    run: () => false,
    handbrake: () => false,
    isFiring: () => false,
    takeMouse: () => ({ dx: 0, dy: 0 }),
    takeActions: () => 0,
  };
}

function putPlayerInCar(G, x, z, heading, speed) {
  const car = G.cars.find((c) => c.kind === 'parked') || G.cars[0];
  car.pos.x = x;
  car.pos.z = z;
  car.heading = heading;
  car.speed = speed;
  car.mesh.position.set(x, 0, z);
  car.mesh.rotation.y = heading;
  enterCar(G.player, car);
  return car;
}

function stageChase(G) {
  // Cover shot: driving east on 36th with three stars and police on the tail,
  // mid Package Run so the objective shows.
  G.money = 1250;
  jumpToMission(G.missions, 1, 1);
  const car = putPlayerInCar(G, -60, 39.4, Math.PI / 2, 18);
  addWanted(G.police, 3, 0);
  G.cameraRig.setFixed({ yaw: -Math.PI / 2, pitch: 0.32, distance: 12 });
  return {
    steps: 240,
    pilot: makePilot(1, () => clamp((39.4 - car.pos.z) * 0.2, -1, 1)),
    midways: [
      {
        at: 30,
        fn() {
          // Pull the freshly spawned police cars into the chase behind the player.
          G.police.cars.forEach((cop, i) => {
            cop.pos.x = car.pos.x - 13 - i * 9;
            cop.pos.z = 39.4 + (i % 2 === 0 ? 3.2 : -3.2);
            cop.heading = Math.PI / 2;
            cop.speed = 20;
            cop.mesh.position.set(cop.pos.x, 0, cop.pos.z);
            cop.mesh.rotation.y = cop.heading;
          });
        },
      },
      {
        at: 239,
        fn() {
          // Final frame: full health (the chase has been ramming the player),
          // two police cars VISIBLE ahead of the player, traffic for depth,
          // and two pedestrians on the south sidewalk (bottom-right of frame).
          G.player.health = 100;
          const lead = G.police.cars[0];
          if (lead) {
            // Same direction and speed as the player: it stays ~14 units
            // ahead at capture time instead of closing head-on into the
            // flank car (43 u/s closing speed ate the gap in ~0.3 s).
            lead.pos.x = car.pos.x + 14;
            lead.pos.z = 33.5;
            lead.heading = Math.PI / 2;
            lead.speed = 26;
            lead.mesh.position.set(lead.pos.x, 0, lead.pos.z);
            lead.mesh.rotation.y = lead.heading;
          }
          const flank = G.police.cars[1];
          if (flank) {
            flank.pos.x = car.pos.x + 2;
            flank.pos.z = 33.5;
            flank.heading = Math.PI / 2;
            flank.speed = 22;
            flank.mesh.position.set(flank.pos.x, 0, flank.pos.z);
            flank.mesh.rotation.y = flank.heading;
          }
          const t = G.cars.filter((c) => c.kind === 'traffic');
          if (t[0]) {
            t[0].pos.x = car.pos.x + 40;
            t[0].pos.z = 39.4;
            t[0].heading = Math.PI / 2;
            t[0].speed = 12;
            t[0].mesh.position.set(t[0].pos.x, 0, t[0].pos.z);
            t[0].mesh.rotation.y = t[0].heading;
          }
          if (t[1]) {
            t[1].pos.x = car.pos.x + 55;
            t[1].pos.z = 33.5;
            t[1].heading = -Math.PI / 2;
            t[1].speed = 12;
            t[1].mesh.position.set(t[1].pos.x, 0, t[1].pos.z);
            t[1].mesh.rotation.y = t[1].heading;
          }
          const p0 = G.peds[0];
          if (p0) {
            p0.pos.x = car.pos.x + 10;
            p0.pos.z = 46.2;
            p0.mesh.position.set(p0.pos.x, 0, p0.pos.z);
          }
          const p1 = G.peds[1];
          if (p1) {
            p1.pos.x = car.pos.x + 25;
            p1.pos.z = 46.2;
            p1.mesh.position.set(p1.pos.x, 0, p1.pos.z);
          }
        },
      },
    ],
  };
}

function stageStreet(G) {
  // On foot downtown: tall towers, traffic and pedestrians, first mission up.
  G.money = 650;
  jumpToMission(G.missions, 0, 0);
  G.player.pos.x = 36;
  G.player.pos.z = 44;
  G.player.heading = Math.PI * 0.85;
  G.player.mesh.position.set(36, 0, 44);
  G.cameraRig.setFixed({ yaw: Math.PI / 4, pitch: 0.24, distance: 9 });
  return {
    steps: 180,
    pilot: makePilot(0, 0),
    midways: [
      {
        at: 179,
        fn() {
          // Three traffic cars and four pedestrians in the camera's view for
          // the final frame: the street reads alive instead of empty.
          const t = G.cars.filter((c) => c.kind === 'traffic');
          const placeCar = (c, x, z, heading, speed) => {
            if (!c) return;
            c.pos.x = x; c.pos.z = z; c.heading = heading; c.speed = speed;
            c.mesh.position.set(x, 0, z); c.mesh.rotation.y = heading;
          };
          placeCar(t[0], 10, 36, Math.PI / 2, 12);    // east on 36th (old)
          placeCar(t[1], 32.6, 20, Math.PI, 12);      // north on 36th Ave
          placeCar(t[2], -6, 32.6, -Math.PI / 2, 12); // west on 36th, far
          const placePed = (p, x, z) => {
            if (!p) return;
            p.pos.x = x; p.pos.z = z;
            p.mesh.position.set(x, 0, z); p.mesh.rotation.y = p.heading;
          };
          placePed(G.peds[0], 28, 30);   // corner (old)
          placePed(G.peds[1], 20, 46.2); // south sidewalk of 36th
          placePed(G.peds[2], 8, 46.2);  // south sidewalk, further west
          placePed(G.peds[3], 25.8, 12); // west sidewalk of 36th Ave
        },
      },
    ],
  };
}

function stageCoast(G) {
  // Golden-hour drive up the coast road, ocean on the right, timer running.
  G.money = 1250;
  jumpToMission(G.missions, 3, 0);
  const car = putPlayerInCar(G, 300, 40, Math.PI, 17);
  // The car drives north (-z is north on the minimap); the camera sits
  // behind it looking north, angled east so the ocean reads on the right —
  // the water sits just outside the frame at a smaller angle.
  G.cameraRig.setFixed({ yaw: -0.5, pitch: 0.26, distance: 11 });
  return {
    steps: 200,
    pilot: makePilot(1, () => clamp((300 - car.pos.x) * 0.2, -1, 1)),
    midways: [
      {
        at: 199,
        fn() {
          // Final frame: two cars on the coast road and three people on the
          // sand, so the beach reads inhabited instead of empty.
          // Parked cars, not traffic: traffic wraps to a random city lane
          // whenever |x| > 274, and the coast road sits at x = 300 — traffic
          // placed here respawns away in the very next step. Parked cars are
          // never stepped, so they hold their staged spots.
          const parked = G.cars.filter((c) => c.kind === 'parked' && c !== car);
          const placeCar = (c, x, z, heading) => {
            if (!c) return;
            c.pos.x = x; c.pos.z = z; c.heading = heading; c.speed = 0;
            c.mesh.position.set(x, 0, z); c.mesh.rotation.y = heading;
          };
          placeCar(parked[0], 303.4, car.pos.z - 20, Math.PI); // north, ahead
          placeCar(parked[1], 296.6, car.pos.z - 32, 0);       // south, oncoming
          const placePed = (p, x, z) => {
            if (!p) return;
            p.pos.x = x; p.pos.z = z;
            p.mesh.position.set(x, 0, z);
          };
          placePed(G.peds[0], 312, car.pos.z - 8);  // beach, right of frame
          placePed(G.peds[1], 318, car.pos.z - 18);
          placePed(G.peds[2], 309, car.pos.z - 28);
        },
      },
    ],
  };
}

function stageCombat(G) {
  // Shootout outside the police station: pistol drawn, one cop down, the
  // rest closing in, peds fleeing. Combat exists in the game but no current
  // screenshot shows any of it.
  G.money = 850;
  jumpToMission(G.missions, 2, 0);
  G.player.armed = true;
  G.player.ammo = 24;
  G.player.pos.x = -36;
  G.player.pos.z = -44;
  G.player.heading = Math.PI;
  G.player.mesh.position.set(-36, 0, -44);
  addWanted(G.police, 3, 0);
  G.cameraRig.setFixed({ yaw: 0, pitch: 0.26, distance: 9 });
  return {
    steps: 150,
    pilot: makePilot(0, 0),
    midways: [
      {
        at: 60,
        fn() {
          // Pull two police cars into the road ahead of the player.
          const c0 = G.police.cars[0];
          if (c0) {
            c0.pos.x = -39.4; c0.pos.z = -60; c0.heading = Math.PI; c0.speed = 20;
            c0.mesh.position.set(c0.pos.x, 0, c0.pos.z);
            c0.mesh.rotation.y = c0.heading;
          }
          const c1 = G.police.cars[1];
          if (c1) {
            c1.pos.x = -32.6; c1.pos.z = -68; c1.heading = 0; c1.speed = 18;
            c1.mesh.position.set(c1.pos.x, 0, c1.pos.z);
            c1.mesh.rotation.y = c1.heading;
          }
        },
      },
      {
        at: 149,
        fn() {
          G.player.health = 100;
          // One cop down in the open, shot where he fell: impact sparks
          // still hang in the air when the frame is taken. Six units ahead
          // of the player so the prone body reads clearly at this angle.
          const down = G.police.cops[0];
          if (down) {
            down.pos.x = -34; down.pos.z = -50;
            down.mesh.position.set(-34, 0, -50);
            hurtCop(down, 100);
            G.combat.spawnSparks({ x: -34, y: 1.2, z: -50 }, 0xff4444);
          }
          // Two more cops closing in on foot, visible mid-frame.
          const c1 = G.police.cops[1];
          if (c1) { c1.pos.x = -38; c1.pos.z = -52; c1.mesh.position.set(-38, 0, -52); }
          const c2 = G.police.cops[2];
          if (c2) { c2.pos.x = -32; c2.pos.z = -58; c2.mesh.position.set(-32, 0, -58); }
          // Peds in the street, fleeing the gunfire.
          const p0 = G.peds[0];
          if (p0) { p0.pos.x = -28; p0.pos.z = -50; p0.mesh.position.set(-28, 0, -50); }
          const p1 = G.peds[1];
          if (p1) { p1.pos.x = -44; p1.pos.z = -58; p1.mesh.position.set(-44, 0, -58); }
          scarePeds(G.peds, -36, -50, 30);
        },
      },
    ],
  };
}

function stageNight(G) {
  // Night drive east on 36th at 23:00 — dark blue sky, moon and stars,
  // streetlights warm against it — mid Night Shift so the new collect
  // objective shows. The camera sits nearly level so the sky fills the top
  // of the frame instead of the road.
  G.money = 1450;
  setTimeOfDay(G.environment, 23);
  jumpToMission(G.missions, 4, 0);
  const car = putPlayerInCar(G, -60, 39.4, Math.PI / 2, 18);
  // Bright paint for the night frame: the seeded parked car is dark navy,
  // and a dark car under moonlight reads as nothing but taillights. White,
  // not yellow — yellow paint under blue moonlight renders dark olive,
  // while white reflects the moonlight as pale blue-grey. The body is the
  // first mesh of the car group; its material is per-car.
  car.mesh.children[0].material.color.setHex(0xecf0f1);
  G.cameraRig.setFixed({ yaw: -Math.PI / 2, pitch: -0.1, distance: 12 });
  return {
    steps: 240,
    pilot: makePilot(1, () => clamp((39.4 - car.pos.z) * 0.2, -1, 1)),
    midways: [
      {
        at: 239,
        fn() {
          // Final frame: two traffic cars ahead with headlights on, and two
          // pedestrians on the south sidewalk — the night street reads alive.
          const t = G.cars.filter((c) => c.kind === 'traffic');
          if (t[0]) {
            t[0].pos.x = car.pos.x + 38;
            t[0].pos.z = 39.4;
            t[0].heading = Math.PI / 2;
            t[0].speed = 12;
            t[0].mesh.position.set(t[0].pos.x, 0, t[0].pos.z);
            t[0].mesh.rotation.y = t[0].heading;
          }
          if (t[1]) {
            t[1].pos.x = car.pos.x + 52;
            t[1].pos.z = 33.5;
            t[1].heading = -Math.PI / 2;
            t[1].speed = 12;
            t[1].mesh.position.set(t[1].pos.x, 0, t[1].pos.z);
            t[1].mesh.rotation.y = t[1].heading;
          }
          const p0 = G.peds[0];
          if (p0) {
            p0.pos.x = car.pos.x + 12;
            p0.pos.z = 46.2;
            p0.mesh.position.set(p0.pos.x, 0, p0.pos.z);
          }
          const p1 = G.peds[1];
          if (p1) {
            p1.pos.x = car.pos.x + 26;
            p1.pos.z = 46.2;
            p1.mesh.position.set(p1.pos.x, 0, p1.pos.z);
          }
        },
      },
    ],
  };
}

function stageRace(G) {
  // Street race up the coast road: the player and the rival launch from the
  // start arch side by side, the cyan checkpoint gate ahead. The pilot holds
  // the west lane (x = 296.6) so the rival keeps the east lane beside it.
  G.money = 1250;
  const car = putPlayerInCar(G, 296.6, 200, Math.PI, 0);
  startStreetRace(G.races, G.player);
  // Camera behind the player looking north, angled east so the rival reads
  // on the right of the frame and the ocean behind it.
  G.cameraRig.setFixed({ yaw: -0.45, pitch: 0.34, distance: 12 });
  return {
    steps: 150,
    pilot: makePilot(1, () => clamp((296.6 - car.pos.x) * 0.2, -1, 1)),
    midways: [
      {
        at: 149,
        fn() {
          // Final frame: the rival pinned beside the player — a photo
          // finish in the making. The rival cruises at 21 against the
          // player's 27, so without this it drifts out of the frame.
          // Nearly alongside: any further back and it falls off the right
          // edge of the frame at this camera angle.
          const rival = G.races.rival;
          if (rival) {
            rival.pos.x = car.pos.x + 6.8;
            rival.pos.z = car.pos.z + 2;
            rival.heading = Math.PI;
            rival.speed = 21;
            rival.mesh.position.set(rival.pos.x, 0, rival.pos.z);
            rival.mesh.rotation.y = rival.heading;
          }
        },
      },
    ],
  };
}

function stageMission(G) {
  // On foot on the road to the garage, the beacon straight ahead.
  G.money = 450;
  jumpToMission(G.missions, 0, 1);
  G.player.pos.x = -180;
  G.player.pos.z = -182;
  G.player.heading = Math.PI;
  G.player.mesh.position.set(-180, 0, -182);
  G.cameraRig.setFixed({ yaw: 0, pitch: 0.3, distance: 9 });
  return { steps: 120, pilot: makePilot(0, 0) };
}

function stageStart(G) {
  // Title screen over a high view of the city at golden hour.
  G.cameraRig.setFixed({ yaw: 0.7, pitch: 0.5, distance: 150 });
  return { steps: 90, pilot: makePilot(0, 0), title: true };
}

/** Stage the named scene; unknown names fall back to the street scene. */
export function stageShot(name, G) {
  if (name === 'chase') return stageChase(G);
  if (name === 'coast') return stageCoast(G);
  if (name === 'combat') return stageCombat(G);
  if (name === 'mission') return stageMission(G);
  if (name === 'start') return stageStart(G);
  if (name === 'race') return stageRace(G);
  if (name === 'night') return stageNight(G);
  return stageStreet(G);
}
