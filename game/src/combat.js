// Combat: a hitscan pistol (Q to draw, click to fire, ammo pickups), a melee
// punch (F, or click unarmed), tracers and impact sparks. Pickups live in
// pickups.js; this file only spends the ammo.

import * as THREE from 'three';
import { COMBAT } from './config.js';
import { hurtPed, scarePeds } from './pedestrians.js';
import { hurtCop } from './police.js';

export function createCombat(scene) {
  const tracers = [];
  const sparks = [];
  const raycaster = new THREE.Raycaster();
  const tmpV = new THREE.Vector3();

  function spawnSparks(pos, colorHex) {
    const count = 10;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const vels = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y;
      positions[i * 3 + 2] = pos.z;
      vels.push(new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 5, (Math.random() - 0.5) * 6));
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(geo, new THREE.PointsMaterial({ color: colorHex, size: 0.18 }));
    scene.add(points);
    sparks.push({ points, vels, life: 0.4 });
  }

  function spawnTracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }));
    scene.add(line);
    tracers.push({ line, life: 0.07 });
  }

  return {
    spawnSparks,
    /** Fire one hitscan shot from the player toward the camera aim. Returns a report. */
    shoot(player, camera, peds, cops, cars, buildings, now) {
      if (player.ammo <= 0) return { fired: false, reason: 'empty' };
      if (now - player.lastShot < COMBAT.fireInterval) return { fired: false, reason: 'rate' };
      player.lastShot = now;
      player.ammo -= 1;
      raycaster.setFromCamera({ x: 0, y: 0 }, camera);
      raycaster.far = COMBAT.pistolRange;
      const from = player.mesh.position.clone();
      from.y = 1.5;
      // Test people and cars as spheres first (cheap), then buildings.
      let bestD = COMBAT.pistolRange;
      let hit = null;
      const dir = raycaster.ray.direction;
      const testSphere = (cx, cy, cz, r) => {
        tmpV.set(cx - from.x, cy - from.y, cz - from.z);
        const along = tmpV.dot(dir);
        if (along < 0 || along > bestD) return;
        const perp2 = tmpV.lengthSq() - along * along;
        if (perp2 < r * r) {
          bestD = along;
          return true;
        }
        return false;
      };
      for (const ped of peds) {
        if (ped.down > 0) continue;
        if (testSphere(ped.pos.x, 1.1, ped.pos.z, 0.9)) hit = { kind: 'ped', ped };
      }
      for (const cop of cops) {
        if (cop.down > 0) continue;
        if (testSphere(cop.pos.x, 1.1, cop.pos.z, 0.9)) hit = { kind: 'cop', cop };
      }
      for (const car of cars) {
        if (testSphere(car.pos.x, 0.8, car.pos.z, 2.2)) hit = { kind: 'car', car };
      }
      const wallHit = raycaster.intersectObject(buildings, false)[0];
      if (wallHit && wallHit.distance < bestD) {
        bestD = wallHit.distance;
        hit = { kind: 'wall' };
      }
      const end = from.clone().addScaledVector(dir, bestD);
      spawnTracer(from, end);
      spawnSparks(end, hit && hit.kind !== 'wall' ? 0xff4444 : 0xffd27a);
      if (!hit) return { fired: true, hit: null, end };
      if (hit.kind === 'ped') {
        const down = hurtPed(hit.ped, COMBAT.pistolDamage, player.pos.x, player.pos.z);
        scarePeds(peds, hit.ped.pos.x, hit.ped.pos.z, 25);
        return { fired: true, hit, down, end };
      }
      if (hit.kind === 'cop') {
        const down = hurtCop(hit.cop, COMBAT.pistolDamage);
        return { fired: true, hit, down, end };
      }
      if (hit.kind === 'car') {
        hit.car.speed *= 0.7;
        return { fired: true, hit, end };
      }
      return { fired: true, hit, end };
    },
    /** A punch in front of the player; returns what it hit, if anything. */
    melee(player, peds, cops) {
      const fx = Math.sin(player.heading);
      const fz = Math.cos(player.heading);
      let best = null;
      let bestD = COMBAT.meleeRange;
      const consider = (pos, target, kind) => {
        const dx = pos.x - player.pos.x;
        const dz = pos.z - player.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < bestD && (dx * fx + dz * fz) / (d || 1) > 0.3) {
          bestD = d;
          best = { kind, target };
        }
      };
      for (const ped of peds) if (ped.down <= 0) consider(ped.pos, ped, 'ped');
      for (const cop of cops) if (cop.down <= 0) consider(cop.pos, cop, 'cop');
      if (!best) return null;
      if (best.kind === 'ped') {
        hurtPed(best.target, COMBAT.meleeDamage, player.pos.x, player.pos.z);
        scarePeds(peds, best.target.pos.x, best.target.pos.z, 18);
      } else {
        hurtCop(best.target, COMBAT.meleeDamage);
      }
      return best;
    },
    /** Tracers and sparks: fade, fall and clean themselves up. */
    stepEffects(dt) {
      for (let i = tracers.length - 1; i >= 0; i--) {
        tracers[i].life -= dt;
        if (tracers[i].life <= 0) {
          scene.remove(tracers[i].line);
          tracers[i].line.geometry.dispose();
          tracers.splice(i, 1);
        }
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.life -= dt;
        const pos = s.points.geometry.attributes.position;
        for (let j = 0; j < s.vels.length; j++) {
          pos.array[j * 3] += s.vels[j].x * dt;
          pos.array[j * 3 + 1] += s.vels[j].y * dt;
          pos.array[j * 3 + 2] += s.vels[j].z * dt;
          s.vels[j].y -= 12 * dt;
        }
        pos.needsUpdate = true;
        if (s.life <= 0) {
          scene.remove(s.points);
          s.points.geometry.dispose();
          sparks.splice(i, 1);
        }
      }
    },
  };
}
