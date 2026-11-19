// The screenshot scenes behind ?shot=chase|street|coast|mission|start. Each one
// stages the real game — a real car, real police, a real mission — then plays
// it forward with a scripted pilot for a fixed number of steps, so the frame is
// what a short game really looks like and the same seed always gives the same
// frame. main.js runs the steps, renders, and sets window.__shotReady.

import { addWanted } from './police.js';
import { jumpToMission } from './missions.js';
import { enterCar } from './player.js';

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
          // and one police car head-on in the far lane so the chase is visible
          // ahead of the player, not just behind the camera.
          G.player.health = 100;
          const lead = G.police.cars[0];
          if (lead) {
            lead.pos.x = car.pos.x + 24;
            lead.pos.z = 33.5;
            lead.heading = -Math.PI / 2;
            lead.speed = 18;
            lead.mesh.position.set(lead.pos.x, 0, lead.pos.z);
            lead.mesh.rotation.y = lead.heading;
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
          // Put one traffic car and one pedestrian in the camera's view for
          // the final frame: the car crossing on 36th, the ped on the corner.
          const t = G.cars.find((c) => c.kind === 'traffic');
          if (t) {
            t.pos.x = 10;
            t.pos.z = 36;
            t.heading = Math.PI / 2;
            t.speed = 12;
            t.mesh.position.set(10, 0, 36);
            t.mesh.rotation.y = t.heading;
          }
          const ped = G.peds[0];
          if (ped) {
            ped.pos.x = 28;
            ped.pos.z = 30;
            ped.heading = Math.PI * 0.75;
            ped.mesh.position.set(28, 0, 30);
            ped.mesh.rotation.y = ped.heading;
          }
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
  if (name === 'mission') return stageMission(G);
  if (name === 'start') return stageStart(G);
  return stageStreet(G);
}
