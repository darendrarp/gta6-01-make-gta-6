// The Solbrisa Police Department answers the heat in tiers: patrol cars at
// one star, a full pursuit at two, roadblocks across the roads ahead at
// three, the Air One helicopter at four, and a full lockdown at five. The
// helicopter's spotlight keeps the player in sight, so the wanted level
// cannot decay while it is overhead. Roadblock cars live here, not in
// police.cars — stepPolice would cull them as ordinary pursuit units.

import * as THREE from 'three';
import { COAST_ROAD_X, POLICE, ROAD_CENTERS } from './config.js';
import { animateCar, createCar, removeCar } from './vehicles.js';
import { makePersonMesh } from './player.js';

export const SPD = { name: 'Solbrisa Police Department', callsign: 'SPD', airCallsign: 'Air One' };

export const DISPATCH_TIERS = [
  { level: 1, label: 'Patrol response', detail: 'One unit rolling to your last known position.' },
  { level: 2, label: 'Pursuit', detail: 'Multiple units in pursuit — they will ram.' },
  { level: 3, label: 'Roadblock protocol', detail: 'Roadblocks deploying on the roads ahead.' },
  { level: 4, label: 'Air unit', detail: 'Air One overhead — the helicopter keeps you in sight.' },
  { level: 5, label: 'Full lockdown', detail: 'Roadblocks and Air One — every unit in the city.' },
];

/** The dispatch label for a wanted level ('No heat' at 0). */
export function dispatchTier(level) {
  if (level <= 0) return 'No heat';
  const tier = DISPATCH_TIERS[Math.min(level, DISPATCH_TIERS.length) - 1];
  return `${tier.label} — ${level} star${level > 1 ? 's' : ''}`;
}

export function createDispatch(scene) {
  return {
    scene,
    roadblock: null, // {x, z, axis, cars, cops} — the one active roadblock
    heli: null, // {group, rotor, cone, light, target} — Air One
    heliPin: null, // {x, y, z} — screenshot staging holds the heli in frame
    lastTier: 0,
  };
}

function nearestRoad(value, extra) {
  const list = extra === undefined ? ROAD_CENTERS : [...ROAD_CENTERS, extra];
  let best = list[0];
  for (const c of list) if (Math.abs(c - value) < Math.abs(best - value)) best = c;
  return best;
}

// Where the next roadblock goes: 45 units ahead of the player along their
// heading, snapped onto the road axis (roads are axis-aligned; the coast
// road is a north-south road of its own at x = 300).
function roadblockAnchor(player) {
  const target = player.onFoot ? player.pos : player.car.pos;
  const heading = player.onFoot ? player.heading : player.car.heading;
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const aheadX = target.x + fx * 45;
  const aheadZ = target.z + fz * 45;
  if (Math.abs(fx) > Math.abs(fz)) {
    return { x: Math.max(-252, Math.min(252, aheadX)), z: nearestRoad(aheadZ), axis: 'x' };
  }
  return { x: nearestRoad(aheadX, COAST_ROAD_X), z: Math.max(-252, Math.min(252, aheadZ)), axis: 'z' };
}

function deployRoadblock(dispatch, player) {
  const anchor = roadblockAnchor(player);
  const target = player.onFoot ? player.pos : player.car.pos;
  const cars = [];
  const cops = [];
  // Two cars parked ACROSS the road, nose to tail, spanning most of its width.
  // The 2.9-unit offsets leave a gap too narrow for a car to thread (two
  // 1.9-radius circles need 3.8 to pass), so the middle is properly blocked.
  const spots = anchor.axis === 'x'
    ? [{ x: anchor.x, z: anchor.z - 2.9, heading: 0 }, { x: anchor.x, z: anchor.z + 2.9, heading: Math.PI }]
    : [{ x: anchor.x - 2.9, z: anchor.z, heading: Math.PI / 2 }, { x: anchor.x + 2.9, z: anchor.z, heading: -Math.PI / 2 }];
  for (const s of spots) {
    cars.push(createCar(dispatch.scene, {
      x: s.x, z: s.z, heading: s.heading, color: 0xffffff, police: true, kind: 'police',
    }));
  }
  // Two foot cops standing beside the cars, facing the way the player comes from.
  const copSpots = anchor.axis === 'x'
    ? [{ x: anchor.x - 5, z: anchor.z - 5.5 }, { x: anchor.x + 5, z: anchor.z + 5.5 }]
    : [{ x: anchor.x - 5.5, z: anchor.z - 5 }, { x: anchor.x + 5.5, z: anchor.z + 5 }];
  for (const s of copSpots) {
    const parts = makePersonMesh(0x1e3a8a, 0x1e293b, 0xc68642);
    parts.group.position.set(s.x, 0, s.z);
    parts.group.rotation.y = Math.atan2(target.x - s.x, target.z - s.z);
    dispatch.scene.add(parts.group);
    cops.push({ parts, mesh: parts.group, pos: { x: s.x, z: s.z } });
  }
  dispatch.roadblock = { x: anchor.x, z: anchor.z, axis: anchor.axis, cars, cops };
}

function removeRoadblock(dispatch) {
  const rb = dispatch.roadblock;
  if (!rb) return;
  for (const car of rb.cars) removeCar(dispatch.scene, car);
  for (const cop of rb.cops) dispatch.scene.remove(cop.mesh);
  dispatch.roadblock = null;
}

function makeHeliMesh() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.4, metalness: 0.3 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.5, metalness: 0.2 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.3, 4.4), bodyMat);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.4, 4.44), darkMat);
  stripe.position.y = -0.2;
  const nose = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 0.9, 1.0),
    new THREE.MeshStandardMaterial({ color: 0x9fd4ef, roughness: 0.15, metalness: 0.6 }),
  );
  nose.position.set(0, 0.15, 2.4);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 3.6), bodyMat);
  tail.position.set(0, 0.25, -3.8);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.1, 0.8), darkMat);
  fin.position.set(0, 0.7, -5.3);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.7, 6), darkMat);
  mast.position.y = 0.95;
  const rotor = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 0.06, 20), darkMat);
  rotor.position.y = 1.3;
  group.add(body, stripe, nose, tail, fin, mast, rotor);
  for (const x of [-0.9, 0.9]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 3.4), darkMat);
    skid.position.set(x, -0.95, 0);
    group.add(skid);
  }
  // Searchlight cone: apex at the helicopter, pooling on the street below.
  // Only switched on at night — in daylight the helicopter is the signal.
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(7, POLICE.heliAltitude, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff6c9, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false }),
  );
  cone.position.y = -POLICE.heliAltitude / 2;
  cone.visible = false;
  group.add(cone);
  const light = new THREE.SpotLight(0xfff2c0, 400, 140, 0.45, 0.6, 1.2);
  light.position.set(0, -0.6, 1.6);
  light.visible = false;
  group.add(light);
  return { group, rotor, cone, light, target: null };
}

function deployHeli(dispatch) {
  const heli = makeHeliMesh();
  heli.target = new THREE.Object3D();
  dispatch.scene.add(heli.target);
  heli.light.target = heli.target;
  dispatch.scene.add(heli.group);
  dispatch.heli = heli;
}

function removeHeli(dispatch) {
  const heli = dispatch.heli;
  if (!heli) return;
  dispatch.scene.remove(heli.group);
  dispatch.scene.remove(heli.target);
  dispatch.heli = null;
}

function stepHeli(dispatch, player, dt, now, isNight) {
  const heli = dispatch.heli;
  if (!heli) return;
  const target = player.onFoot ? player.pos : player.car.pos;
  heli.rotor.rotation.y += dt * 28;
  if (dispatch.heliPin) {
    // Screenshot staging: hold the helicopter exactly where the frame needs it.
    heli.group.position.set(dispatch.heliPin.x, dispatch.heliPin.y, dispatch.heliPin.z);
  } else {
    // Slow orbit above the player at altitude, nose toward them.
    const angle = now * 0.22;
    const x = target.x + Math.cos(angle) * POLICE.heliOrbitRadius;
    const z = target.z + Math.sin(angle) * POLICE.heliOrbitRadius;
    heli.group.position.set(x, POLICE.heliAltitude, z);
    heli.group.rotation.y = Math.atan2(target.x - x, target.z - z);
  }
  heli.target.position.set(target.x, 0, target.z);
  heli.cone.visible = isNight;
  heli.light.visible = isNight;
}

/**
 * One dispatch step, called after stepPolice. Spawns/removes the roadblock
 * and the air unit by wanted level and reports changes through onDispatch
 * ({type:'tier'|'roadblock'|'air', text, banner?}) for the HUD.
 */
export function stepDispatch(dispatch, police, player, city, dt, now, isNight, onDispatch) {
  const level = police.level;
  // Tier changes are announced once, as the heat rises or falls.
  if (level !== dispatch.lastTier) {
    if (level > 0) onDispatch({ type: 'tier', text: `SPD DISPATCH: ${dispatchTier(level)}` });
    else onDispatch({ type: 'tier', text: 'SPD DISPATCH: Heat is off — units standing down.' });
    dispatch.lastTier = level;
  }
  // Roadblock: deploy at 3 stars, hold while the heat is on, re-deploy ahead
  // when the player slips past it or outruns it, clear when the heat drops.
  if (level >= POLICE.roadblockMinLevel) {
    if (!dispatch.roadblock) {
      deployRoadblock(dispatch, player);
      onDispatch({ type: 'roadblock', banner: true, text: 'Roadblock protocol — units blocking the road ahead.' });
    } else {
      const target = player.onFoot ? player.pos : player.car.pos;
      const heading = player.onFoot ? player.heading : player.car.heading;
      const dist = Math.hypot(dispatch.roadblock.x - target.x, dispatch.roadblock.z - target.z);
      const along = (dispatch.roadblock.x - target.x) * Math.sin(heading)
        + (dispatch.roadblock.z - target.z) * Math.cos(heading);
      if (dist > 120 || along < -60) {
        removeRoadblock(dispatch);
        deployRoadblock(dispatch, player);
        onDispatch({ type: 'roadblock', text: 'Roadblock moved — units re-deploying ahead of you.' });
      }
    }
  } else if (dispatch.roadblock) {
    removeRoadblock(dispatch);
    onDispatch({ type: 'roadblock', text: 'Roadblock cleared.' });
  }
  // Air unit: Air One joins at 4 stars and its watch keeps the player in
  // sight — the wanted level cannot decay while it is overhead.
  if (level >= POLICE.airMinLevel) {
    if (!dispatch.heli) {
      deployHeli(dispatch);
      police.airWatch = true;
      onDispatch({ type: 'air', banner: true, text: 'Air One overhead — the helicopter keeps you in sight.' });
    }
  } else if (dispatch.heli) {
    removeHeli(dispatch);
    police.airWatch = false;
    onDispatch({ type: 'air', text: 'Air One standing down.' });
  }
  // Keep the roadblock's light bars flashing and the helicopter flying.
  if (dispatch.roadblock) for (const car of dispatch.roadblock.cars) animateCar(car, dt, now);
  if (dispatch.heli) stepHeli(dispatch, player, dt, now, isNight);
}

/** Stand everything down (respawn, new game): no roadblock, no helicopter. */
export function clearDispatch(dispatch) {
  removeRoadblock(dispatch);
  removeHeli(dispatch);
  dispatch.lastTier = 0;
  dispatch.heliPin = null;
}
