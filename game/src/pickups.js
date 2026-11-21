// Pickups: ammo boxes, health kits and cash scattered on the sidewalks.
// They bob and spin, grant their bonus on touch (on foot only), and respawn
// after 30 s. The minimap draws them as dots; combat.js no longer owns them.

import * as THREE from 'three';

const PICKUP_TYPES = {
  ammo: { color: 0x27ae60, size: 0.55 },
  health: { color: 0xe8e8e8, size: 0.55 },
  cash: { color: 0xf1c40f, size: 0.45 },
};

const SCATTER_TYPES = ['ammo', 'ammo', 'ammo', 'ammo', 'health', 'health', 'health', 'health', 'cash', 'cash', 'cash', 'cash', 'cash', 'cash'];

export function createPickups(scene) {
  const pickups = [];

  function makePickupMesh(type, x, z) {
    const def = PICKUP_TYPES[type];
    const group = new THREE.Group();
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(def.size, def.size, def.size),
      new THREE.MeshStandardMaterial({ color: def.color, emissive: def.color, emissiveIntensity: 0.35, roughness: 0.4 }),
    );
    box.castShadow = true;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 0.95, 24),
      new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    group.add(box, ring);
    group.position.set(x, 0.9, z);
    scene.add(group);
    return group;
  }

  return {
    pickups,
    /** Drop one pickup of a type at a spot. */
    spawnPickup(type, x, z) {
      pickups.push({ type, x, z, mesh: makePickupMesh(type, x, z), taken: 0 });
    },
    /** Pickups: bob, spin, grant on touch, respawn after 30 s. */
    stepPickups(dt, player, now, onPickup) {
      for (const p of pickups) {
        if (p.taken > 0) {
          p.taken -= dt;
          if (p.taken <= 0) p.mesh.visible = true;
          continue;
        }
        p.mesh.rotation.y += dt * 2;
        p.mesh.children[0].position.y = 0.15 + Math.sin(now * 2.4 + p.x) * 0.12;
        const d = Math.hypot(p.x - player.pos.x, p.z - player.pos.z);
        if (player.onFoot && d < 1.4) {
          p.taken = 30;
          p.mesh.visible = false;
          onPickup(p.type);
        }
      }
    },
  };
}

/** Scatter the starting set of 14 pickups on clear sidewalk spots. */
export function scatterPickups(pickups, city, rng) {
  const spots = [];
  let guard = 0;
  while (spots.length < SCATTER_TYPES.length && guard++ < 200) {
    const x = (rng() * 2 - 1) * 240;
    const z = (rng() * 2 - 1) * 240;
    if (!city.pointBlocked(x, z, 3)) spots.push([x, z]);
  }
  spots.forEach(([x, z], i) => pickups.spawnPickup(SCATTER_TYPES[i % SCATTER_TYPES.length], x, z));
}
