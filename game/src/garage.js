// Vex's Garage: a working garage, not just a mission marker. Drive into
// the yard (the circle around the garage sign) and press G to store the car
// you are driving — it parks in a slot by the sign and becomes yours. On
// foot next to a stored car, G repaints it ($150). Driving in the yard, T
// tunes the engine ($400, +4 top speed, three levels). Stored cars stay in
// the world until the page reloads.

import * as THREE from 'three';
import { CAR, GARAGE } from './config.js';
import { exitCar } from './player.js';

export const GARAGE_YARD_RADIUS = 14;
export const GARAGE_SLOTS = [
  { x: -180, z: -200 },
  { x: -180, z: -194 },
  { x: -180, z: -188 },
];
export const PAINT_PALETTE = [0xe74c3c, 0x3498db, 0xf1c40f, 0x2ecc71, 0x9b59b6, 0x1abc9c, 0xecf0f1, 0xff2d78];
export const REPAINT_COST = 150;
export const TUNE_COST = 400;
export const TUNE_MAX_LEVEL = 3;
export const TUNE_SPEED_GAIN = 4;

// Painted slot pads on the road by the garage sign, so the three stored
// cars have somewhere visible to sit.
function slotPads(scene) {
  for (const slot of GARAGE_SLOTS) {
    const edge = new THREE.Mesh(
      new THREE.PlaneGeometry(3.8, 5.6),
      new THREE.MeshBasicMaterial({ color: 0xf1c40f }),
    );
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(slot.x, 0.02, slot.z);
    const pad = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 5.2),
      new THREE.MeshBasicMaterial({ color: 0x2f333a }),
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(slot.x, 0.03, slot.z);
    scene.add(edge, pad);
  }
}

export function createGarage(scene, city) {
  slotPads(scene);
  // A warm work lamp over the slots: Vex's yard stays lit after dark, so
  // the stored cars and the crew read at night instead of going black.
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.14, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 }),
  );
  pole.position.set(-174, 4, -194);
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.25, 0.5),
    new THREE.MeshBasicMaterial({ color: 0xffe6a8 }),
  );
  head.position.set(-174, 8, -194);
  const lamp = new THREE.PointLight(0xffc98a, 70, 45, 2);
  lamp.position.set(-174, 8, -194);
  scene.add(pole, head, lamp);
  return { scene, city, slots: [null, null, null], lamp };
}

/** True when the player (or their car) is inside the garage yard. */
export function garageNear(garage, player) {
  const target = player.onFoot ? player.pos : player.car.pos;
  return Math.hypot(target.x - GARAGE.x, target.z - GARAGE.z) < GARAGE_YARD_RADIUS;
}

/** How many cars are stored in the garage. */
export function garageOwnedCount(garage) {
  return garage.slots.filter(Boolean).length;
}

/** One-line garage summary for the HUD. */
export function garageStatus(garage) {
  const n = garageOwnedCount(garage);
  return `Garage: ${n}/3 cars stored`;
}

/**
 * Store the car the player is driving in the first free slot and step out
 * beside it. Returns {ok, slot?} or {ok:false, reason}.
 */
export function storeCurrentCar(garage, player) {
  if (player.onFoot || !player.car) return { ok: false, reason: 'You need to be driving to store a car.' };
  const slotIndex = garage.slots.findIndex((s) => s === null);
  if (slotIndex === -1) return { ok: false, reason: 'Garage full — 3 cars max.' };
  const car = player.car;
  const slot = GARAGE_SLOTS[slotIndex];
  car.pos.x = slot.x;
  car.pos.z = slot.z;
  car.heading = Math.PI;
  car.speed = 0;
  car.mesh.position.set(slot.x, 0, slot.z);
  car.mesh.rotation.y = Math.PI;
  car.owned = true;
  // Remember where the current paint sits in the palette so the first
  // repaint always changes the colour (-1 when it is not a palette colour).
  car.paintIndex = PAINT_PALETTE.indexOf(car.mesh.children[0].material.color.getHex());
  garage.slots[slotIndex] = car;
  if (garage.city) exitCar(player, garage.city);
  else {
    car.kind = 'parked';
    player.car = null;
    player.onFoot = true;
    player.pos.x = slot.x - 2.6;
    player.pos.z = slot.z;
    player.mesh.visible = true;
    player.mesh.position.set(player.pos.x, 0, player.pos.z);
  }
  return { ok: true, slot: slotIndex };
}

/** The stored car nearest the player on foot (within reach), or null. */
export function garageRepaintTarget(garage, player) {
  if (!player.onFoot) return null;
  let best = null;
  let bestD = 4.5;
  for (const car of garage.slots) {
    if (!car) continue;
    const d = Math.hypot(car.pos.x - player.pos.x, car.pos.z - player.pos.z);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

/**
 * Repaint the stored car nearest the player, cycling the paint palette.
 * Returns {ok, cost, color} or {ok:false, reason}; the caller deducts the money.
 */
export function repaintNearestOwned(garage, player, money) {
  const car = garageRepaintTarget(garage, player);
  if (!car) return { ok: false, reason: 'No stored car nearby.' };
  if (money < REPAINT_COST) return { ok: false, reason: `Repaint costs $${REPAINT_COST}.` };
  car.paintIndex = (((car.paintIndex ?? -1) + 1) % PAINT_PALETTE.length);
  const hex = PAINT_PALETTE[car.paintIndex];
  car.mesh.children[0].material.color.setHex(hex);
  car.paint = hex;
  return { ok: true, cost: REPAINT_COST, color: hex };
}

/**
 * Tune the car the player is driving: +4 top speed per level, three levels
 * max. Returns {ok, cost, level, topSpeed} or {ok:false, reason}; the
 * caller deducts the money.
 */
export function tuneCurrentCar(garage, player, money) {
  if (player.onFoot || !player.car) return { ok: false, reason: 'Drive into the yard to tune.' };
  const car = player.car;
  const level = car.tuneLevel ?? 0;
  if (level >= TUNE_MAX_LEVEL) return { ok: false, reason: `Already fully tuned (${TUNE_MAX_LEVEL}/${TUNE_MAX_LEVEL}).` };
  if (money < TUNE_COST) return { ok: false, reason: `Tuning costs $${TUNE_COST}.` };
  car.tuneLevel = level + 1;
  car.topSpeed = (car.topSpeed ?? CAR.maxSpeed) + TUNE_SPEED_GAIN;
  return { ok: true, cost: TUNE_COST, level: car.tuneLevel, topSpeed: car.topSpeed };
}
