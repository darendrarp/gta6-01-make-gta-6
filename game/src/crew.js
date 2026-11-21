// The crew: Vex's people, recruited one by one in "The Crew Gathers" —
// Rook the wheelman, Mira the lookout, Dante the muscle. Recruited members
// follow Kai on foot, wait patiently while he drives, and catch up when he
// steps out nearby. The HUD shows who is with him.

import { makePersonMesh } from './player.js';

export const CREW_ROSTER = [
  { id: 'rook', name: 'Rook', role: 'Wheelman', jacket: 0xc0392b, pants: 0x2c3e50, skin: 0x8d5524 },
  { id: 'mira', name: 'Mira', role: 'Lookout', jacket: 0x8e44ad, pants: 0x1a1d22, skin: 0xe0ac69 },
  { id: 'dante', name: 'Dante', role: 'Muscle', jacket: 0x27ae60, pants: 0x34495e, skin: 0x6b4423 },
];

// Follow slots behind the player, in player-local space (x = right, z = behind).
const FOLLOW_SLOTS = [
  { x: -2.2, z: 2.8 },
  { x: 2.2, z: 2.8 },
  { x: 0, z: 5.2 },
];

const FOLLOW_FAR = 9; // speed when catching up
const FOLLOW_NEAR = 5.5; // speed when close
const CATCHUP_RANGE = 30; // a waiting member resumes when Kai steps out this close

export function createCrew(scene) {
  return { scene, members: [], anchor: null };
}

/**
 * Recruit a crew member by roster id. Spawns them near `near` ({x, z} —
 * the player's position at the pickup); returns the member, or null when
 * the id is unknown or already recruited.
 */
export function recruitCrewMember(crew, id, near) {
  const def = CREW_ROSTER.find((r) => r.id === id);
  if (!def) return null;
  if (crew.members.some((m) => m.id === id)) return null;
  const parts = makePersonMesh(def.jacket, def.pants, def.skin);
  const spot = near || crew.anchor || { x: 0, z: 0 };
  const index = crew.members.length;
  const offset = FOLLOW_SLOTS[index % FOLLOW_SLOTS.length];
  const x = spot.x + offset.x;
  const z = spot.z + offset.z;
  parts.group.position.set(x, 0, z);
  crew.scene.add(parts.group);
  const member = {
    id: def.id,
    name: def.name,
    role: def.role,
    parts,
    mesh: parts.group,
    pos: { x, z },
    heading: 0,
    phase: Math.random() * 10,
    waiting: false,
  };
  crew.members.push(member);
  return member;
}

/** One crew step: recruited members follow Kai on foot at their slots. */
export function stepCrew(crew, player, dt, city) {
  if (crew.members.length === 0) return;
  const anchor = player.onFoot ? player.pos : player.car.pos;
  crew.anchor = { x: anchor.x, z: anchor.z };
  // While Kai drives, the crew waits where they stand.
  if (!player.onFoot) {
    for (const m of crew.members) m.waiting = true;
    return;
  }
  const fx = Math.sin(player.heading);
  const fz = Math.cos(player.heading);
  // Right vector for a heading (sin h, cos h): (-cos h, sin h).
  const rx = -Math.cos(player.heading);
  const rz = Math.sin(player.heading);
  crew.members.forEach((m, i) => {
    // A waiting member only resumes once Kai steps out nearby.
    if (m.waiting && Math.hypot(player.pos.x - m.pos.x, player.pos.z - m.pos.z) > CATCHUP_RANGE) return;
    m.waiting = false;
    const slot = FOLLOW_SLOTS[i % FOLLOW_SLOTS.length];
    const tx = player.pos.x + rx * slot.x - fx * slot.z;
    const tz = player.pos.z + rz * slot.x - fz * slot.z;
    const dx = tx - m.pos.x;
    const dz = tz - m.pos.z;
    const dist = Math.hypot(dx, dz);
    const speed = dist > 6 ? FOLLOW_FAR : dist > 1.5 ? FOLLOW_NEAR : 0;
    if (speed > 0) {
      m.heading = Math.atan2(dx, dz);
      m.pos.x += Math.sin(m.heading) * speed * dt;
      m.pos.z += Math.cos(m.heading) * speed * dt;
      city.resolveCircle(m.pos, 0.6);
    }
    // Leg-swing walk animation, the same gait as the foot cops.
    m.phase += dt * (5 + speed * 1.5);
    const s = Math.sin(m.phase) * Math.min(0.65, speed / 10);
    m.parts.legL.rotation.x = s;
    m.parts.legR.rotation.x = -s;
    m.parts.armL.rotation.x = -s * 0.8;
    m.parts.armR.rotation.x = s * 0.8;
    m.mesh.position.set(m.pos.x, 0, m.pos.z);
    m.mesh.rotation.y = m.heading;
  });
}

/** How many crew members have been recruited. */
export function crewCount(crew) {
  return crew.members.length;
}

/** The recruited members' names, for the HUD crew panel ('' when alone). */
export function crewNames(crew) {
  return crew.members.map((m) => m.name).join(' • ');
}
