// Kai Marlow, the player: a low-poly walker with swing-limb animation, WASD
// movement relative to the camera, run and jump, and E to steal the nearest car
// (or step out of the one being driven). The mesh hides while driving.

import * as THREE from 'three';
import { CAR, PLAYER } from './config.js';

/** A simple low-poly person: legs, torso, arms, head. Shared by player and peds. */
export function makePersonMesh(jacket, pants, skin) {
  const group = new THREE.Group();
  const jacketMat = new THREE.MeshLambertMaterial({ color: jacket });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pants });
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), jacketMat);
  torso.position.y = 1.08;
  torso.castShadow = true;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.32), skinMat);
  head.position.y = 1.68;
  head.castShadow = true;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.26), pantsMat);
  legL.position.set(-0.16, 0.36, 0);
  const legR = legL.clone();
  legR.position.x = 0.16;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.2), jacketMat);
  armL.position.set(-0.42, 1.08, 0);
  const armR = armL.clone();
  armR.position.x = 0.42;
  group.add(torso, head, legL, legR, armL, armR);
  // Pivot the limbs at the hip/shoulder by shifting geometry up front: store
  // the parts and animate their rotation around an offset origin instead.
  legL.geometry = legL.geometry.clone();
  legL.geometry.translate(0, -0.36, 0);
  legL.position.y = 0.72;
  legR.geometry = legR.geometry.clone();
  legR.geometry.translate(0, -0.36, 0);
  legR.position.y = 0.72;
  armL.geometry = armL.geometry.clone();
  armL.geometry.translate(0, -0.31, 0);
  armL.position.y = 1.38;
  armR.geometry = armR.geometry.clone();
  armR.geometry.translate(0, -0.31, 0);
  armR.position.y = 1.38;
  return { group, legL, legR, armL, armR, torso, head };
}

function swingLimbs(parts, phase, amount) {
  const s = Math.sin(phase) * amount;
  parts.legL.rotation.x = s;
  parts.legR.rotation.x = -s;
  parts.armL.rotation.x = -s * 0.8;
  parts.armR.rotation.x = s * 0.8;
}

export function createPlayer(scene, spawn) {
  const parts = makePersonMesh(0x1f8a70, 0x2c3e50, 0xc68642);
  parts.group.position.set(spawn.x, 0, spawn.z);
  scene.add(parts.group);
  return {
    parts,
    mesh: parts.group,
    pos: { x: spawn.x, z: spawn.z },
    y: 0,
    vy: 0,
    vel: { x: 0, z: 0 },
    heading: Math.PI,
    onFoot: true,
    car: null,
    walkPhase: 0,
    health: 100,
    armed: false,
    ammo: 12,
    lastShot: 0,
    down: false,
  };
}

/** On-foot step: move relative to camera yaw, jump, collide, animate. */
export function stepPlayerOnFoot(player, input, camYaw, dt, city) {
  const fwd = input.forward();
  const str = input.strafe();
  const speed = input.run() ? PLAYER.runSpeed : PLAYER.walkSpeed;
  // Camera-relative wish direction: camera forward on the ground is
  // (-sin yaw, -cos yaw) and camera right is (cos yaw, -sin yaw).
  const sin = Math.sin(camYaw);
  const cos = Math.cos(camYaw);
  let wx = -sin * fwd + cos * str;
  let wz = -cos * fwd - sin * str;
  const len = Math.hypot(wx, wz);
  if (len > 0.01) {
    wx /= len;
    wz /= len;
    player.vel.x += (wx * speed - player.vel.x) * Math.min(1, dt * 10);
    player.vel.z += (wz * speed - player.vel.z) * Math.min(1, dt * 10);
    const target = Math.atan2(wx, wz);
    let diff = target - player.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    player.heading += diff * Math.min(1, dt * 12);
  } else {
    player.vel.x -= player.vel.x * Math.min(1, dt * PLAYER.friction);
    player.vel.z -= player.vel.z * Math.min(1, dt * PLAYER.friction);
  }
  player.pos.x += player.vel.x * dt;
  player.pos.z += player.vel.z * dt;
  city.resolveCircle(player.pos, PLAYER.radius);
  // Jump + gravity.
  if (player.y <= 0 && input.jumpQueued) {
    player.vy = PLAYER.jumpSpeed;
    input.jumpQueued = false;
  }
  player.vy -= PLAYER.gravity * dt;
  player.y += player.vy * dt;
  if (player.y <= 0) {
    player.y = 0;
    player.vy = 0;
  }
  const moving = Math.hypot(player.vel.x, player.vel.z);
  player.walkPhase += dt * (4 + moving * 1.4);
  swingLimbs(player.parts, player.walkPhase, Math.min(0.7, moving / 9));
  player.mesh.position.set(player.pos.x, player.y, player.pos.z);
  player.mesh.rotation.y = player.heading;
  return moving;
}

/** Nearest car within enter range of the player (parked or traffic, not police). */
export function nearestEnterableCar(player, cars) {
  let best = null;
  let bestD = CAR.enterRange;
  for (const car of cars) {
    if (car.police || car.kind === 'player') continue;
    const d = Math.hypot(car.pos.x - player.pos.x, car.pos.z - player.pos.z);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

export function enterCar(player, car) {
  player.onFoot = false;
  player.car = car;
  car.kind = 'player';
  car.speed = 0;
  player.mesh.visible = false;
  player.vel.x = 0;
  player.vel.z = 0;
}

export function exitCar(player, city) {
  const car = player.car;
  if (!car) return;
  car.kind = 'parked';
  car.speed = 0;
  player.car = null;
  player.onFoot = true;
  // Step out on the driver's side, clear of the car and buildings.
  const side = car.heading + Math.PI / 2;
  player.pos.x = car.pos.x + Math.sin(side) * 2.6;
  player.pos.z = car.pos.z + Math.cos(side) * 2.6;
  city.resolveCircle(player.pos, PLAYER.radius);
  player.y = 0;
  player.vy = 0;
  player.mesh.visible = true;
  player.mesh.position.set(player.pos.x, 0, player.pos.z);
}

export function playerSpeed(player) {
  if (!player.onFoot && player.car) return Math.abs(player.car.speed);
  return Math.hypot(player.vel.x, player.vel.z);
}
