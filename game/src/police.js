// The heat: a 1–5 star wanted level, police cars that chase and ram, and foot
// cops who chase the player down and bust them. Crimes raise the level; staying
// out of every cop's sight lets it decay one star at a time.

import * as THREE from 'three';
import { COMBAT, HEALTH, POLICE } from './config.js';
import { animateCar, createCar, driveCar } from './vehicles.js';
import { makePersonMesh } from './player.js';

export function createPolice(scene) {
  return {
    scene,
    level: 0,
    unseenTimer: 0,
    hidden: false,
    cars: [],
    cops: [],
    bustTimer: 0,
    lastCrimeAt: 0,
  };
}

export function addWanted(police, amount, now) {
  if (amount <= 0) return;
  police.level = Math.min(5, police.level + amount);
  police.unseenTimer = 0;
  police.lastCrimeAt = now;
}

function spawnPoliceCar(police, player, rng) {
  // Appear on a road ahead of the player, facing them.
  const angle = rng() * Math.PI * 2;
  const dist = 55 + rng() * 30;
  const x = player.pos.x + Math.sin(angle) * dist;
  const z = player.pos.z + Math.cos(angle) * dist;
  const car = createCar(police.scene, {
    x: Math.max(-250, Math.min(250, x)),
    z: Math.max(-250, Math.min(250, z)),
    heading: Math.atan2(player.pos.x - x, player.pos.z - z),
    color: 0xffffff, police: true, kind: 'police',
  });
  police.cars.push(car);
  return car;
}

function spawnCop(police, player, rng) {
  const angle = rng() * Math.PI * 2;
  const dist = 18 + rng() * 14;
  const x = player.pos.x + Math.sin(angle) * dist;
  const z = player.pos.z + Math.cos(angle) * dist;
  const parts = makePersonMesh(0x1e3a8a, 0x1e293b, 0xc68642);
  parts.group.position.set(x, 0, z);
  police.scene.add(parts.group);
  const cop = {
    parts, mesh: parts.group,
    pos: { x, z },
    heading: Math.atan2(player.pos.x - x, player.pos.z - z),
    phase: rng() * 10,
    health: COMBAT.copHealth,
    down: 0,
    punchTimer: 0,
  };
  police.cops.push(cop);
  return cop;
}

function removeCop(police, cop) {
  police.scene.remove(cop.mesh);
  police.cops.splice(police.cops.indexOf(cop), 1);
}

function removePoliceCar(police, car) {
  police.scene.remove(car.mesh);
  police.cars.splice(police.cars.indexOf(car), 1);
}

/**
 * One police step. Returns 'busted' when the player is caught, else null.
 * `onEvent` receives {type:'ram', strength} / {type:'punch'} for sound/shake.
 */
export function stepPolice(police, player, dt, city, allCars, rng, now, onEvent) {
  const wantedCars = police.level === 0 ? 0 : Math.min(POLICE.maxCars, police.level + 1);
  const wantedCops = police.level === 0 || !player.onFoot ? 0 : Math.min(POLICE.maxCops, police.level + 1);

  while (police.cars.length < wantedCars) spawnPoliceCar(police, player, rng);
  while (police.cops.length < wantedCops) spawnCop(police, player, rng);
  while (police.cars.length > wantedCars) removePoliceCar(police, police.cars[police.cars.length - 1]);
  while (police.cops.length > wantedCops) removeCop(police, police.cops[police.cops.length - 1]);

  const target = player.onFoot ? player.pos : player.car.pos;
  const targetSpeed = player.onFoot ? Math.hypot(player.vel.x, player.vel.z) : Math.abs(player.car.speed);

  // Police cars: seek the player, steer around buildings, ram on contact.
  for (const car of police.cars) {
    const dx = target.x - car.pos.x;
    const dz = target.z - car.pos.z;
    const dist = Math.hypot(dx, dz);
    let wantHeading = Math.atan2(dx, dz);
    // Look ahead: if a building blocks the way, steer around it.
    const aheadX = car.pos.x + Math.sin(car.heading) * 9;
    const aheadZ = car.pos.z + Math.cos(car.heading) * 9;
    if (city.pointBlocked(aheadX, aheadZ, 2)) {
      const leftX = car.pos.x + Math.sin(car.heading - 0.9) * 9;
      const leftZ = car.pos.z + Math.cos(car.heading - 0.9) * 9;
      const rightX = car.pos.x + Math.sin(car.heading + 0.9) * 9;
      const rightZ = car.pos.z + Math.cos(car.heading + 0.9) * 9;
      const leftBlocked = city.pointBlocked(leftX, leftZ, 2);
      const rightBlocked = city.pointBlocked(rightX, rightZ, 2);
      wantHeading = car.heading + (leftBlocked && !rightBlocked ? 0.9 : !leftBlocked && rightBlocked ? -0.9 : 0.9);
    }
    let dh = wantHeading - car.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, dh * 2.2));
    const throttle = dist > 4 ? 1 : 0.4;
    const crash = driveCar(car, throttle, steer, false, dt, city, allCars);
    if (crash > 0.25) onEvent({ type: 'ram', strength: crash });
    // Ramming the player's car hurts and shakes — at most once per 0.8s per
    // police car. Without the cooldown a sustained ram drains the whole
    // health bar in under a second (the check runs every step while touching).
    if (!player.onFoot) {
      const pd = Math.hypot(car.pos.x - player.car.pos.x, car.pos.z - player.car.pos.z);
      car.ramCooldown = Math.max(0, car.ramCooldown - dt);
      if (pd < 4.4 && Math.abs(car.speed) > 6 && car.ramCooldown <= 0) {
        car.ramCooldown = 0.8;
        onEvent({ type: 'ram', strength: Math.min(1, Math.abs(car.speed) / 26) });
        player.health -= HEALTH.crashDiv * 0.4;
      }
    }
    // Stuck against a wall for a while: back up and turn around.
    if (Math.abs(car.speed) < 1 && dist > 12) {
      car.stuckTimer += dt;
      if (car.stuckTimer > 1.2) {
        car.heading += Math.PI * 0.7;
        car.stuckTimer = 0;
      }
    } else {
      car.stuckTimer = 0;
    }
    animateCar(car, dt, now);
  }

  // Foot cops: run the player down, punch up close, bust a slow player.
  let busted = false;
  for (const cop of [...police.cops]) {
    if (cop.down > 0) {
      cop.down -= dt;
      cop.mesh.rotation.x = -Math.PI / 2;
      cop.mesh.position.y = 0.25;
      if (cop.down <= 0) {
        cop.mesh.rotation.x = 0;
        cop.mesh.position.y = 0;
        cop.health = COMBAT.copHealth;
      }
      continue;
    }
    const dx = player.pos.x - cop.pos.x;
    const dz = player.pos.z - cop.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 90) {
      // Too far behind: re-deploy near the player.
      removeCop(police, cop);
      continue;
    }
    cop.heading = Math.atan2(dx, dz);
    const speed = dist > 2 ? POLICE.copSpeed : 0;
    cop.pos.x += Math.sin(cop.heading) * speed * dt;
    cop.pos.z += Math.cos(cop.heading) * speed * dt;
    city.resolveCircle(cop.pos, 0.6);
    cop.phase += dt * (5 + speed * 1.5);
    const s = Math.sin(cop.phase) * Math.min(0.65, speed / 10);
    cop.parts.legL.rotation.x = s;
    cop.parts.legR.rotation.x = -s;
    cop.parts.armL.rotation.x = -s * 0.8;
    cop.parts.armR.rotation.x = s * 0.8;
    cop.mesh.position.set(cop.pos.x, 0, cop.pos.z);
    cop.mesh.rotation.y = cop.heading;
    cop.punchTimer -= dt;
    if (dist < 2.2 && player.onFoot) {
      if (cop.punchTimer <= 0) {
        cop.punchTimer = 0.9;
        player.health -= HEALTH.copPunch;
        onEvent({ type: 'punch' });
      }
      if (targetSpeed < 2.5) {
        police.bustTimer += dt;
        if (police.bustTimer >= POLICE.bustTime) busted = true;
      }
    }
  }
  if (busted) police.bustTimer = 0;
  else if (!police.cops.some((c) => c.down <= 0 && Math.hypot(c.pos.x - player.pos.x, c.pos.z - player.pos.z) < POLICE.bustRange)) {
    police.bustTimer = Math.max(0, police.bustTimer - dt);
  }

  // Wanted decay: nobody in sight for a while drops one star.
  if (police.level > 0) {
    const nearest = Math.min(
      ...police.cars.map((c) => Math.hypot(c.pos.x - target.x, c.pos.z - target.z)),
      ...police.cops.map((c) => Math.hypot(c.pos.x - target.x, c.pos.z - target.z)),
      Infinity,
    );
    police.hidden = nearest > POLICE.decaySeenRange;
    if (police.hidden) {
      police.unseenTimer += dt;
      if (police.unseenTimer >= POLICE.decayDelay) {
        police.level -= 1;
        police.unseenTimer = 0;
      }
    } else {
      police.unseenTimer = 0;
    }
  } else {
    police.hidden = false;
  }

  return busted ? 'busted' : null;
}

/** Damage a cop; returns true when the hit knocks them down. */
export function hurtCop(cop, damage) {
  if (cop.down > 0) return false;
  cop.health -= damage;
  if (cop.health <= 0) {
    cop.down = 8;
    return true;
  }
  return false;
}

/** Distance to the nearest police unit (for the siren volume). */
export function nearestPoliceDistance(police, pos) {
  let best = Infinity;
  for (const c of police.cars) best = Math.min(best, Math.hypot(c.pos.x - pos.x, c.pos.z - pos.z));
  for (const c of police.cops) best = Math.min(best, Math.hypot(c.pos.x - pos.x, c.pos.z - pos.z));
  return best;
}

export function clearPolice(police) {
  police.level = 0;
  police.unseenTimer = 0;
  police.bustTimer = 0;
  while (police.cars.length > 0) removePoliceCar(police, police.cars[0]);
  while (police.cops.length > 0) removeCop(police, police.cops[0]);
}
