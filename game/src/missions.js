// The story: Kai Marlow, broke and new in Solbrisa, runs jobs for Vera "Vex"
// Delgado, the fixer who owns the garage on the south side. Four missions chain
// in order; each step shows an objective on the HUD, a marker on the minimap
// and a light beacon in the world. Completing one pays cash and starts the next.

import * as THREE from 'three';
import { DINER, GARAGE, HIDEOUT, LOOKOUT, MARINA } from './config.js';

const MISSIONS = [
  {
    name: 'First Wheels',
    brief: 'Vex: "Welcome to Solbrisa, kid. First rule — wheels are free if nobody\'s looking. Bring me a car."',
    reward: 300,
    steps: [
      { text: 'Steal a car — walk up to a parked car and press E', type: 'enterCar' },
      { text: "Drive to Vex's Garage", type: 'goto', target: GARAGE, radius: 10 },
    ],
  },
  {
    name: 'Package Run',
    brief: 'Vex: "A package is waiting at the Marina Pier. Pick it up, run it to the Southside Diner. No detours."',
    reward: 500,
    steps: [
      { text: 'Pick up the package at the Marina Pier', type: 'goto', target: MARINA, radius: 10 },
      { text: 'Deliver the package to the Southside Diner', type: 'goto', target: DINER, radius: 10, wantedOnStart: 2, alert: 'The cops are onto the drop — lose them or outrun them!' },
    ],
  },
  {
    name: 'Lose the Heat',
    brief: 'Vex: "You\'re hot, kid. Three stars and every unit in the city. Go quiet until it blows over."',
    reward: 400,
    steps: [
      { text: 'Lose the cops — stay out of sight until the heat drops', type: 'loseWanted', wantedOnStart: 3 },
    ],
  },
  {
    name: 'Coast Getaway',
    brief: 'Vex: "One last job. The lookout on the coast road, ninety seconds, then vanish to the hideout. Go."',
    reward: 800,
    steps: [
      { text: 'Reach the Coast Lookout in 90 seconds', type: 'timed', target: LOOKOUT, radius: 12, time: 90 },
      { text: "Reach Vex's Hideout", type: 'goto', target: HIDEOUT, radius: 10 },
    ],
  },
];

function makeBeacon(scene) {
  const group = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.5, 2.1, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 30;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.4, 3.4, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.12;
  const arrow = new THREE.Mesh(
    new THREE.ConeGeometry(0.8, 2.2, 4),
    new THREE.MeshBasicMaterial({ color: 0xffd166 }),
  );
  arrow.rotation.x = Math.PI;
  arrow.position.y = 7;
  group.add(beam, ring, arrow);
  group.visible = false;
  scene.add(group);
  return { group, ring, arrow };
}

export function createMissions(scene, startIndex) {
  const beacon = makeBeacon(scene);
  return {
    scene,
    beacon,
    index: Math.min(startIndex, MISSIONS.length - 1),
    step: 0,
    active: startIndex < MISSIONS.length,
    timer: 0,
    bannerAt: 0,
    completed: startIndex,
  };
}

export function currentMission(missions) {
  return missions.active ? MISSIONS[missions.index] : null;
}

export function currentStep(missions) {
  const m = currentMission(missions);
  return m ? m.steps[missions.step] : null;
}

export function missionTarget(missions) {
  const step = currentStep(missions);
  return step && step.target ? step.target : null;
}

function placeBeacon(missions) {
  const target = missionTarget(missions);
  if (!target) {
    missions.beacon.group.visible = false;
    return;
  }
  missions.beacon.group.visible = true;
  missions.beacon.group.position.set(target.x, 0, target.z);
}

function beginStep(missions, addWanted, now) {
  const step = currentStep(missions);
  if (!step) return null;
  if (step.wantedOnStart) addWanted(step.wantedOnStart, now);
  if (step.type === 'timed') missions.timer = step.time;
  placeBeacon(missions);
  return step.alert || null;
}

/** Start (or resume) the current mission; returns its brief text. */
export function startMission(missions, addWanted, now) {
  const m = currentMission(missions);
  if (!m) return null;
  missions.step = 0;
  beginStep(missions, addWanted, now);
  return m.brief;
}

/** Jump straight to a mission/step (screenshot staging); places the beacon. */
export function jumpToMission(missions, index, step) {
  missions.index = Math.min(index, MISSIONS.length - 1);
  missions.step = step;
  missions.active = true;
  const s = currentStep(missions);
  if (s && s.type === 'timed') missions.timer = s.time;
  placeBeacon(missions);
}

/**
 * One mission step. `events` is filled with {type:'step'|'complete'|'failed',
 * ...} for the HUD and the save. Returns the events array.
 */
export function stepMissions(missions, player, policeLevel, dt, addWanted, now) {
  const events = [];
  const step = currentStep(missions);
  if (!missions.active || !step) return events;
  // Animate the beacon.
  if (missions.beacon.group.visible) {
    missions.beacon.arrow.position.y = 7 + Math.sin(now * 2.2) * 0.8;
    missions.beacon.ring.rotation.z += dt * 0.6;
  }
  const pos = player.onFoot ? player.pos : player.car.pos;
  let done = false;
  if (step.type === 'goto' || step.type === 'timed') {
    if (step.type === 'timed') {
      missions.timer -= dt;
      if (missions.timer <= 0) {
        missions.timer = step.time;
        events.push({ type: 'failed', text: 'Too slow! The clock resets — try again.' });
        return events;
      }
    }
    const d = Math.hypot(step.target.x - pos.x, step.target.z - pos.z);
    if (d < step.radius) done = true;
  } else if (step.type === 'enterCar') {
    if (!player.onFoot) done = true;
  } else if (step.type === 'loseWanted') {
    if (policeLevel === 0) done = true;
  }
  if (!done) return events;
  missions.step += 1;
  const mission = currentMission(missions);
  if (missions.step >= mission.steps.length) {
    events.push({ type: 'complete', mission, reward: mission.reward });
    missions.completed += 1;
    missions.index += 1;
    missions.step = 0;
    if (missions.index >= MISSIONS.length) {
      missions.active = false;
      missions.beacon.group.visible = false;
    } else {
      const alert = beginStep(missions, addWanted, now);
      events.push({ type: 'next', mission: currentMission(missions), alert });
    }
  } else {
    const alert = beginStep(missions, addWanted, now);
    events.push({ type: 'step', step: currentStep(missions), alert });
  }
  return events;
}

export function missionCount() {
  return MISSIONS.length;
}

export function missionNames() {
  return MISSIONS.map((m) => m.name);
}
