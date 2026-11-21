// The story: Kai Marlow, broke and new in Solbrisa, runs jobs for Vera "Vex"
// Delgado, the fixer who owns the garage on the south side. Ten missions
// chain in order; each step shows an objective on the HUD, a marker on the
// minimap and a light beacon in the world. Completing one pays cash and
// starts the next. Step types: enterCar, goto, timed, loseWanted, collect
// (pick up N drops in order — or recruit the crew, one member per drop)
// and survive (hold a wanted level for T seconds).

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
  {
    name: 'Night Shift',
    brief: 'Vex: "Three cash drops around the city, all waiting. Grab them before the other crew does — then bring it all home."',
    reward: 700,
    steps: [
      { text: 'Collect the 3 cash drops (Marina, Diner, Hideout)', type: 'collect', targets: [MARINA, DINER, HIDEOUT], radius: 10 },
      { text: "Bring the cash to Vex's Garage", type: 'goto', target: GARAGE, radius: 10 },
    ],
  },
  {
    name: 'Heat Wave',
    brief: 'Vex: "Time to make some noise. Three stars, thirty seconds — show the whole city you own these streets. My crew keeps the heat coming if it cools off."',
    reward: 600,
    steps: [
      { text: 'Hold 3 stars for 30 seconds — stay visible', type: 'survive', wanted: 3, time: 30, wantedOnStart: 3 },
      { text: 'Now go quiet — lose the cops', type: 'loseWanted' },
    ],
  },
  {
    name: 'Coast Sprint',
    brief: 'Vex: "The coast road, three checkpoints, no mercy. The lookout, the marina, then home. Fastest run in Solbrisa — make it yours."',
    reward: 900,
    steps: [
      { text: 'Checkpoint 1: Coast Lookout in 75 seconds', type: 'timed', target: LOOKOUT, radius: 12, time: 75 },
      { text: 'Checkpoint 2: Marina Pier in 75 seconds', type: 'timed', target: MARINA, radius: 12, time: 75 },
      { text: "Checkpoint 3: Vex's Hideout", type: 'goto', target: HIDEOUT, radius: 10 },
    ],
  },
  {
    name: 'The Crew Gathers',
    brief: 'Vex: "Time to build a crew, kid. Rook drives, Mira watches, Dante hits. Pick them up — Marina, Diner, Hideout — then bring them home."',
    reward: 700,
    steps: [
      { text: 'Recruit the crew — Rook at the Marina, Mira at the Diner, Dante at the Hideout', type: 'collect', targets: [MARINA, DINER, HIDEOUT], radius: 10, recruit: ['rook', 'mira', 'dante'] },
      { text: "Bring the crew to Vex's Garage", type: 'goto', target: GARAGE, radius: 10 },
    ],
  },
  {
    name: 'Roadblock Run',
    brief: 'Vex: "Four stars, kid. SPD roadblocks on every road out, Air One overhead. Make the lookout — then vanish."',
    reward: 1000,
    steps: [
      { text: 'Reach the Coast Lookout in 90 seconds — roadblocks ahead', type: 'timed', target: LOOKOUT, radius: 12, time: 90, wantedOnStart: 4, alert: 'Roadblocks ahead — Air One is tracking you!' },
      { text: 'Lose the cops — stay out of sight until the heat drops', type: 'loseWanted' },
    ],
  },
  {
    name: 'The Big Score',
    brief: 'Vex: "The harbor vault run. Three drops, five stars, one clean getaway. This is the job that makes us legends."',
    reward: 1500,
    steps: [
      { text: 'Hit the three vault drops (Marina, Lookout, Diner)', type: 'collect', targets: [MARINA, LOOKOUT, DINER], radius: 10, wantedOnStart: 3 },
      { text: 'Hold 5 stars for 30 seconds — the whole city is watching', type: 'survive', wanted: 5, time: 30 },
      { text: "Vanish to Vex's Hideout in 90 seconds", type: 'timed', target: HIDEOUT, radius: 10, time: 90 },
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
    collectIndex: 0, // which drop a 'collect' step is pointing at
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
  if (!step) return null;
  // A collect step points at its next uncollected drop.
  if (step.type === 'collect') return step.targets[Math.min(missions.collectIndex, step.targets.length - 1)] || null;
  return step.target || null;
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
  if (step.type === 'timed' || step.type === 'survive') missions.timer = step.time;
  if (step.type === 'collect') missions.collectIndex = 0;
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
  if (s && (s.type === 'timed' || s.type === 'survive')) missions.timer = s.time;
  if (s && s.type === 'collect') missions.collectIndex = 0;
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
  } else if (step.type === 'collect') {
    // Visit each drop in order; the beacon and minimap follow the next one.
    const target = step.targets[missions.collectIndex];
    if (target) {
      const d = Math.hypot(target.x - pos.x, target.z - pos.z);
      if (d < (step.radius || 10)) {
        missions.collectIndex += 1;
        placeBeacon(missions);
        // Every drop reports, including the last one — a 'recruit' step
        // signs one crew member per drop, and the last member counts too.
        events.push({ type: 'collected', index: missions.collectIndex, total: step.targets.length, recruit: step.recruit?.[missions.collectIndex - 1] });
        if (missions.collectIndex >= step.targets.length) done = true;
      }
    } else {
      done = true;
    }
  } else if (step.type === 'survive') {
    // The clock only runs while the heat is on — but the heat is the
    // mission's own doing: if the cops lose the player and the level
    // drops, Vex's crew makes noise and brings a star back within
    // seconds, so the mission can never soft-lock on a lost star.
    if (policeLevel < (step.wanted || 1)) {
      if (now - (missions._heatAt || -99) > 2) {
        missions._heatAt = now;
        addWanted(1, now);
      }
    } else {
      missions.timer -= dt;
    }
    if (missions.timer <= 0) done = true;
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
