// Pedestrians: low-poly walkers strolling the sidewalks, turning at
// intersections, and fleeing when a gunshot rings out or a fast car bears down
// on them. A hit ped falls over, then gets up and runs.

import * as THREE from 'three';
import { PEDS, ROAD_CENTERS } from './config.js';
import { makePersonMesh } from './player.js';
import { pick, range } from './random.js';

const JACKETS = [0xd94f4f, 0x4f8ad9, 0x4fd98a, 0xd9c24f, 0x9b4fd9, 0x4fd9d2, 0xe8e8e8, 0x333333];
const PANTS = [0x2c3e50, 0x5d4037, 0x37474f, 0x4a6741, 0x1a1a2e];
const SKINS = [0xc68642, 0x8d5524, 0xffdbac, 0xf1c27d, 0xe0ac69];
const WALK_OFF = 10.2; // sidewalk offset from the road centre

function randomSidewalkSpot(rng) {
  const axis = rng() < 0.5 ? 'x' : 'z';
  const road = pick(rng, ROAD_CENTERS);
  const side = rng() < 0.5 ? -1 : 1;
  const t = range(rng, -250, 250);
  return axis === 'x'
    ? { x: t, z: road + side * WALK_OFF, axis, dir: rng() < 0.5 ? -1 : 1 }
    : { x: road + side * WALK_OFF, z: t, axis, dir: rng() < 0.5 ? -1 : 1 };
}

export function createPedestrians(scene, rng, count) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const spot = randomSidewalkSpot(rng);
    const parts = makePersonMesh(pick(rng, JACKETS), pick(rng, PANTS), pick(rng, SKINS));
    parts.group.position.set(spot.x, 0, spot.z);
    scene.add(parts.group);
    peds.push({
      parts,
      mesh: parts.group,
      pos: { x: spot.x, z: spot.z },
      axis: spot.axis,
      dir: spot.dir,
      lane: spot.axis === 'x' ? spot.z : spot.x,
      speed: range(rng, PEDS.walkMin, PEDS.walkMax),
      heading: spot.axis === 'x' ? (spot.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (spot.dir > 0 ? 0 : Math.PI),
      phase: rng() * 10,
      health: 50,
      down: 0, // seconds left lying down
      flee: 0, // seconds left fleeing
      fleeDir: { x: 0, z: 0 },
    });
  }
  return peds;
}

/** Make every ped near (x, z) run away from it. */
export function scarePeds(peds, x, z, radius) {
  for (const ped of peds) {
    if (ped.down > 0) continue;
    const dx = ped.pos.x - x;
    const dz = ped.pos.z - z;
    const d = Math.hypot(dx, dz);
    if (d < radius && d > 0.01) {
      ped.flee = 3.5;
      ped.fleeDir = { x: dx / d, z: dz / d };
    }
  }
}

function swing(parts, phase, amount) {
  const s = Math.sin(phase) * amount;
  parts.legL.rotation.x = s;
  parts.legR.rotation.x = -s;
  parts.armL.rotation.x = -s * 0.8;
  parts.armR.rotation.x = s * 0.8;
}

export function stepPedestrians(peds, dt, city, rng, threats) {
  for (const ped of peds) {
    if (ped.down > 0) {
      ped.down -= dt;
      ped.mesh.rotation.x = -Math.PI / 2;
      ped.mesh.position.y = 0.25;
      if (ped.down <= 0) {
        ped.mesh.rotation.x = 0;
        ped.mesh.position.y = 0;
        ped.flee = 4;
        ped.fleeDir = { x: Math.sin(ped.heading + Math.PI), z: Math.cos(ped.heading + Math.PI) };
        ped.health = 50;
      }
      continue;
    }
    // Fast cars are scary too.
    if (ped.flee <= 0) {
      for (const t of threats) {
        const d = Math.hypot(t.x - ped.pos.x, t.z - ped.pos.z);
        if (d < 9 && t.speed > 12) {
          ped.flee = 2.5;
          ped.fleeDir = { x: (ped.pos.x - t.x) / (d || 1), z: (ped.pos.z - t.z) / (d || 1) };
        }
      }
    }
    let speed = ped.speed;
    if (ped.flee > 0) {
      ped.flee -= dt;
      speed = PEDS.fleeSpeed;
      ped.pos.x += ped.fleeDir.x * speed * dt;
      ped.pos.z += ped.fleeDir.z * speed * dt;
      ped.heading = Math.atan2(ped.fleeDir.x, ped.fleeDir.z);
    } else {
      const t = ped.axis === 'x' ? ped.pos.x : ped.pos.z;
      // Turn at intersections sometimes.
      const cross = ROAD_CENTERS.find((c) => Math.abs(c - t) < 1.0);
      if (cross !== undefined && rng() < 0.006) {
        const newAxis = ped.axis === 'x' ? 'z' : 'x';
        const newDir = rng() < 0.5 ? -1 : 1;
        const side = ped.axis === 'x' ? Math.sign(ped.pos.z - cross) || 1 : Math.sign(ped.pos.x - cross) || 1;
        ped.axis = newAxis;
        ped.dir = newDir;
        if (newAxis === 'x') ped.pos.z = cross + side * WALK_OFF;
        else ped.pos.x = cross + side * WALK_OFF;
        ped.heading = newAxis === 'x' ? (newDir > 0 ? Math.PI / 2 : -Math.PI / 2) : (newDir > 0 ? 0 : Math.PI);
      }
      if (ped.axis === 'x') ped.pos.x += ped.dir * speed * dt;
      else ped.pos.z += ped.dir * speed * dt;
      // Bounce off the city edge.
      const tt = ped.axis === 'x' ? ped.pos.x : ped.pos.z;
      if (tt > 255 || tt < -255) {
        ped.dir *= -1;
        ped.heading += Math.PI;
      }
    }
    city.resolveCircle(ped.pos, 0.55);
    ped.phase += dt * (5 + speed * 1.6);
    swing(ped.parts, ped.phase, Math.min(0.65, 0.25 + speed * 0.08));
    ped.mesh.position.set(ped.pos.x, 0, ped.pos.z);
    ped.mesh.rotation.y = ped.heading;
  }
}

/** Damage a ped; returns true when the hit knocks them down. */
export function hurtPed(ped, damage, fromX, fromZ) {
  if (ped.down > 0) return false;
  ped.health -= damage;
  if (ped.health <= 0) {
    ped.down = 6;
    ped.flee = 0;
    return true;
  }
  ped.flee = 3;
  const dx = ped.pos.x - fromX;
  const dz = ped.pos.z - fromZ;
  const d = Math.hypot(dx, dz) || 1;
  ped.fleeDir = { x: dx / d, z: dz / d };
  return false;
}
