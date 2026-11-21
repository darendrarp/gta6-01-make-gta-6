// Cars: a procedural low-poly body (box body, cabin, four spinning wheels,
// headlights and taillights), arcade driving physics (accelerate, brake/reverse,
// speed-scaled steering, handbrake slide) and circle collision against buildings
// and other cars. Police cars get a light bar whose red/blue lamps flash.

import * as THREE from 'three';
import { CAR } from './config.js';

const BODY_COLORS = [0xc0392b, 0x2980b9, 0xf1c40f, 0x27ae60, 0x8e44ad, 0xe67e22, 0x95a5a6, 0x2c3e50, 0xecf0f1, 0x16a085, 0xd35400, 0x7f8c8d];

export function makeCarMesh(colorHex, police) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: police ? 0xf5f5f5 : colorHex, roughness: 0.35, metalness: 0.5 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.6, metalness: 0.2 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.3), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.55, 2.1), police ? bodyMat : darkMat);
  cabin.position.set(0, 1.08, -0.25);
  cabin.castShadow = true;
  group.add(body, cabin);
  if (police) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.3, 4.32), new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.5 }));
    stripe.position.y = 0.62;
    group.add(stripe);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.position.set(x, 0.36, z);
    group.add(wheel);
    wheels.push(wheel);
  }
  const lampMat = (c) => new THREE.MeshBasicMaterial({ color: c });
  for (const x of [-0.7, 0.7]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.08), lampMat(0xfff6c9));
    head.position.set(x, 0.62, 2.16);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.08), lampMat(0xff2a2a));
    tail.position.set(x, 0.62, -2.16);
    group.add(tail);
  }
  let lampL = null;
  let lampR = null;
  if (police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.16, 0.5), darkMat);
    bar.position.set(0, 1.42, -0.25);
    group.add(bar);
    lampL = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.4), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    lampL.position.set(-0.42, 1.5, -0.25);
    lampR = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.4), new THREE.MeshBasicMaterial({ color: 0x2040ff }));
    lampR.position.set(0.42, 1.5, -0.25);
    group.add(lampL, lampR);
  }
  return { group, wheels, lampL, lampR };
}

/** A car in the world: mesh, position/heading/speed, kind and driving state. */
export function createCar(scene, { x, z, heading, color, police = false, kind = 'parked' }) {
  const { group, wheels, lampL, lampR } = makeCarMesh(color, police);
  group.position.set(x, 0, z);
  group.rotation.y = heading;
  scene.add(group);
  return {
    mesh: group, wheels, lampL, lampR,
    pos: { x, z },
    heading,
    speed: 0,
    kind, // 'parked' | 'traffic' | 'police' | 'player'
    police,
    stolen: false,
    sirenPhase: Math.random() * 10,
    // Traffic AI state (only used by traffic cars).
    axis: 'x', dir: 1, lane: 0, turning: null,
    // Police AI state.
    stuckTimer: 0,
    ramCooldown: 0, // seconds until this car can hurt the player by ramming again
    flash: 0,
  };
}

export function removeCar(scene, car) {
  scene.remove(car.mesh);
}

/** Spin wheels and flash the light bar; call every frame for every visible car. */
export function animateCar(car, dt, time) {
  const spin = (car.speed / 0.36) * dt;
  for (const wheel of car.wheels) wheel.rotation.x += spin;
  if (car.police && car.lampL && car.lampR) {
    car.flash += dt;
    const on = Math.floor(car.flash * 4) % 2 === 0;
    car.lampL.visible = on;
    car.lampR.visible = !on;
  }
}

/**
 * Arcade drive step: throttle -1..1, steer -1..1, handbrake bool. Moves the car,
 * resolves building collisions (speed lost + crash strength returned) and
 * car-to-car bumps against `others`. Returns crash strength 0..1.
 */
export function driveCar(car, throttle, steer, handbrake, dt, city, others) {
  const maxF = car.topSpeed ?? CAR.maxSpeed; // tuned cars run faster (garage.js)
  const maxR = CAR.reverseSpeed;
  if (throttle > 0) car.speed += CAR.accel * throttle * dt;
  else if (throttle < 0) {
    if (car.speed > 0.5) car.speed -= CAR.brake * dt;
    else car.speed += CAR.accel * 0.55 * throttle * dt;
  }
  car.speed -= car.speed * CAR.drag * dt * (handbrake ? 4 : 1);
  car.speed = Math.max(-maxR, Math.min(maxF, car.speed));
  if (Math.abs(car.speed) < 0.05 && throttle === 0) car.speed = 0;

  const speedFactor = Math.min(1, Math.abs(car.speed) / 8);
  const steerScale = 1 / (1 + Math.abs(car.speed) * 0.045);
  car.heading += steer * CAR.turnRate * steerScale * speedFactor * dt * (car.speed < 0 ? -1 : 1) * (handbrake ? 1.5 : 1);

  const nx = car.pos.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.pos.z + Math.cos(car.heading) * car.speed * dt;
  const before = { x: car.pos.x, z: car.pos.z };
  car.pos.x = nx;
  car.pos.z = nz;
  let crash = 0;
  if (city.resolveCircle(car.pos, CAR.radius)) {
    const moved = Math.hypot(car.pos.x - before.x, car.pos.z - before.z);
    const wanted = Math.hypot(nx - before.x, nz - before.z);
    crash = Math.min(1, Math.abs(car.speed) / 22) * (wanted > 0.001 ? 1 - moved / wanted : 1);
    car.speed *= 0.35;
  }
  // Bumps against other cars: push apart, trade a little speed.
  for (const other of others) {
    if (other === car) continue;
    const dx = car.pos.x - other.pos.x;
    const dz = car.pos.z - other.pos.z;
    const d2 = dx * dx + dz * dz;
    const min = CAR.radius * 2 - 0.4;
    if (d2 >= min * min || d2 < 1e-6) continue;
    const d = Math.sqrt(d2);
    const push = (min - d) / 2;
    const ux = dx / d;
    const uz = dz / d;
    car.pos.x += ux * push;
    car.pos.z += uz * push;
    if (other.kind !== 'parked') {
      other.pos.x -= ux * push;
      other.pos.z -= uz * push;
    }
    const rel = Math.abs(car.speed - other.speed);
    if (rel > 4) crash = Math.max(crash, Math.min(1, rel / 24));
    car.speed *= 0.6;
  }
  car.mesh.position.set(car.pos.x, 0, car.pos.z);
  car.mesh.rotation.y = car.heading;
  return crash;
}

export function carColor(rng) {
  return BODY_COLORS[Math.floor(rng() * BODY_COLORS.length)];
}
