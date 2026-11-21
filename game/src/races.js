// Street racing: a checkpoint sprint up the coast road against an AI rival.
// Drive into the start arch at the south end of the coast road and press R.
// The rival drives the same checkpoints at a fixed cruise, so a clean run
// wins and a crash costs the race. First across the finish line takes $600.

import * as THREE from 'three';
import { RACE } from './config.js';
import { createCar, driveCar, removeCar } from './vehicles.js';

function checkerTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  for (let x = 0; x < 16; x++) {
    for (let y = 0; y < 2; y++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#111111' : '#f5f5f5';
      ctx.fillRect(x * 16, y * 16, 16, 16);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeStartArch(scene) {
  const group = new THREE.Group();
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  for (const x of [RACE.start.x - 6, RACE.start.x + 6]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 6.5, 6), poleMat);
    pole.position.set(x, 3.25, RACE.start.z);
    group.add(pole);
  }
  const banner = new THREE.Mesh(
    new THREE.BoxGeometry(12.4, 1.1, 0.25),
    new THREE.MeshBasicMaterial({ map: checkerTexture() }),
  );
  banner.position.set(RACE.start.x, 6.4, RACE.start.z);
  group.add(banner);
  scene.add(group);
  return group;
}

function makeGate(scene) {
  const group = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.5, 2.1, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 30;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.4, 3.4, 32),
    new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.12;
  group.add(beam, ring);
  group.visible = false;
  scene.add(group);
  return { group, ring };
}

/** Build the race system: the start arch stands on the coast road, the
 *  checkpoint gate waits hidden until a race starts. */
export function createRaces(scene) {
  return {
    scene,
    arch: makeStartArch(scene),
    gate: makeGate(scene),
    active: false,
    rival: null,
    playerIndex: 0,
    rivalIndex: 0,
    timer: 0,
    rivalStuck: 0,
  };
}

/** True when the player is driving inside the start zone with no race running. */
export function raceNearStart(races, player) {
  if (races.active || player.onFoot || !player.car) return false;
  return Math.hypot(player.car.pos.x - RACE.start.x, player.car.pos.z - RACE.start.z) < RACE.startRadius;
}

/** The player's next checkpoint (minimap + beacon target), or null. */
export function raceTarget(races) {
  if (!races.active) return null;
  return RACE.checkpoints[races.playerIndex] || null;
}

/** The HUD objective line while a race is running. */
export function raceObjective(races) {
  if (!races.active) return '';
  const ahead = races.rivalIndex > races.playerIndex;
  return `Checkpoint ${Math.min(races.playerIndex + 1, RACE.checkpoints.length)}/${RACE.checkpoints.length} — beat the rival!${ahead ? ' Rival leads!' : ''}`;
}

/** Line both cars up at the arch and start the clock. Needs the player driving. */
export function startStreetRace(races, player) {
  if (races.active || player.onFoot || !player.car) return false;
  const car = player.car;
  car.pos.x = RACE.start.x - 3.4;
  car.pos.z = RACE.start.z;
  car.heading = Math.PI;
  car.speed = 0;
  car.mesh.position.set(car.pos.x, 0, car.pos.z);
  car.mesh.rotation.y = car.heading;
  races.rival = createCar(races.scene, {
    x: RACE.start.x + 3.4, z: RACE.start.z, heading: Math.PI,
    color: 0xff2d78, kind: 'rival',
  });
  races.active = true;
  races.playerIndex = 0;
  races.rivalIndex = 0;
  races.timer = 0;
  races.rivalStuck = 0;
  races.gate.group.visible = true;
  races.gate.group.position.set(RACE.checkpoints[0].x, 0, RACE.checkpoints[0].z);
  return true;
}

function finishRace(races, event) {
  if (races.rival) {
    removeCar(races.scene, races.rival);
    races.rival = null;
  }
  races.active = false;
  races.gate.group.visible = false;
  return event;
}

/** Call off a running race (busted, wasted, or the player stepped out). */
export function abortRace(races) {
  if (!races.active) return;
  finishRace(races, { type: 'raceAborted' });
}

/**
 * One race step. Drives the rival toward its next checkpoint, advances both
 * cars through the gates, and returns events for the HUD and the save.
 */
export function stepRaces(races, player, dt, city, allCars) {
  const events = [];
  if (!races.active) return events;
  races.timer += dt;
  races.gate.ring.rotation.z += dt * 0.8;

  // The player stepped out of the car: the race is off.
  if (player.onFoot || !player.car) {
    events.push(finishRace(races, { type: 'raceAborted' }));
    return events;
  }

  // Rival AI: pure pursuit of its next checkpoint at a fixed cruise, with a
  // stuck nudge if a building or a bump pins it.
  const rival = races.rival;
  if (rival && races.rivalIndex < RACE.checkpoints.length) {
    const wp = RACE.checkpoints[races.rivalIndex];
    const wantHeading = Math.atan2(wp.x - rival.pos.x, wp.z - rival.pos.z);
    let dh = wantHeading - rival.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, dh * 2.2));
    const throttle = rival.speed < RACE.rivalCruise ? 1 : 0;
    driveCar(rival, throttle, steer, false, dt, city, allCars);
    if (Math.abs(rival.speed) < 1) {
      races.rivalStuck += dt;
      if (races.rivalStuck > 1.5) {
        rival.heading += Math.PI * 0.5;
        races.rivalStuck = 0;
      }
    } else {
      races.rivalStuck = 0;
    }
    if (Math.hypot(wp.x - rival.pos.x, wp.z - rival.pos.z) < RACE.checkpointRadius) {
      races.rivalIndex += 1;
    }
  }

  // Player checkpoints: pass them in order.
  const next = RACE.checkpoints[races.playerIndex];
  if (next && Math.hypot(next.x - player.car.pos.x, next.z - player.car.pos.z) < RACE.checkpointRadius) {
    races.playerIndex += 1;
    const following = RACE.checkpoints[races.playerIndex];
    if (following) {
      races.gate.group.position.set(following.x, 0, following.z);
      events.push({ type: 'raceCheckpoint', index: races.playerIndex, total: RACE.checkpoints.length });
    }
  }

  // First across the finish line wins. The player is checked first: a photo
  // finish on the same step goes to the player.
  if (races.playerIndex >= RACE.checkpoints.length) {
    events.push(finishRace(races, { type: 'raceWon', reward: RACE.reward, time: races.timer }));
    return events;
  }
  if (races.rivalIndex >= RACE.checkpoints.length) {
    events.push(finishRace(races, { type: 'raceLost', time: races.timer }));
    return events;
  }
  return events;
}
