// SOLBRISA — boot and the one loop. The world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one); rendering, the camera, the HUD
// and the minimap update every animation frame. Screens: start, play, paused,
// busted/wasted. ?seed=N fixes the city; ?shot=name stages a screenshot scene
// (see shots.js) and sets window.__shotReady when it is framed.

import * as THREE from 'three';
import { CAR, COMBAT, DEFAULT_SEED, GARAGE, HEALTH, HOSPITAL, MONEY, PARKED, PEDS, PLAYER_SPAWN, POLICE_STATION, STEP, TRAFFIC } from './config.js';
import { createRandom } from './random.js';
import { ACT_CONFIRM, ACT_ENTER, ACT_FIRE, ACT_JUMP, ACT_MELEE, ACT_MUTE, ACT_PAUSE, ACT_WEAPON, createInput } from './input.js';
import { createAudio } from './audio.js';
import { clearSave, loadSave, writeSave } from './save.js';
import { buildCity } from './city.js';
import { animateCar, carColor, createCar, driveCar } from './vehicles.js';
import { createPlayer, enterCar, exitCar, nearestEnterableCar, playerSpeed, stepPlayerOnFoot } from './player.js';
import { createTraffic, stepTraffic } from './traffic.js';
import { createPedestrians, hurtPed, scarePeds, stepPedestrians } from './pedestrians.js';
import { addWanted, clearPolice, createPolice, nearestPoliceDistance, stepPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions, currentMission, currentStep, missionTarget, startMission, stepMissions } from './missions.js';
import { createHud } from './hud.js';
import { createMinimap } from './minimap.js';
import { createCameraRig } from './camera.js';
import { stageShot } from './shots.js';

window.__pageErrors = [];
window.addEventListener('error', (event) => window.__pageErrors.push(String(event.message || event.error)));

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : (shot ? DEFAULT_SEED : Math.floor(Math.random() * 4294967296));
const rng = createRandom(seed);

// Renderer, scene, camera.
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 3200);

// World and systems.
const city = buildCity(scene, createRandom(seed ^ 0x9e3779b9));
const player = createPlayer(scene, PLAYER_SPAWN);
const parkedCars = [];
for (let i = 0; i < PARKED.count; i++) {
  const spot = city.parkedSpots[i % city.parkedSpots.length];
  parkedCars.push(createCar(scene, { x: spot.x, z: spot.z, heading: spot.heading, color: carColor(rng), kind: 'parked' }));
}
const trafficCars = createTraffic(scene, rng, TRAFFIC.count);
const peds = createPedestrians(scene, rng, PEDS.count);
const police = createPolice(scene);
const combat = createCombat(scene);
const input = createInput();
const audio = createAudio();
const hud = createHud();
const minimap = createMinimap(document.getElementById('minimap'));
const cameraRig = createCameraRig(camera, city.buildingMesh);

// Save: money and mission progress carry between visits.
const save = loadSave();
const missions = createMissions(scene, save ? save.mission : 0);

const G = {
  scene, camera, renderer, city, player, peds, police, combat, missions,
  hud, minimap, cameraRig, audio, input, rng, seed,
  cars: [...parkedCars, ...trafficCars],
  money: save ? save.money : MONEY.start,
  time: 0,
  screen: 'start',
  shotMode: Boolean(shot),
  activeInput: input,
  playStart: 0,
  muted: false,
  endKind: null,
  lastCrashAt: -10, // game time of the last crash that hurt the player
};
player.health = HEALTH.max;
player.ammo = COMBAT.pistolAmmoStart;

// Pickups scattered on sidewalks: ammo, health and cash.
{
  const spots = [];
  let guard = 0;
  while (spots.length < 14 && guard++ < 200) {
    const x = (rng() * 2 - 1) * 240;
    const z = (rng() * 2 - 1) * 240;
    if (!city.pointBlocked(x, z, 3)) spots.push([x, z]);
  }
  const types = ['ammo', 'ammo', 'ammo', 'ammo', 'health', 'health', 'health', 'health', 'cash', 'cash', 'cash', 'cash', 'cash', 'cash'];
  spots.forEach(([x, z], i) => combat.spawnPickup(types[i % types.length], x, z));
}

function saveGame() {
  writeSave({ money: Math.floor(G.money), mission: missions.index, completed: missions.completed });
}

function lockPointer() {
  try {
    const p = canvas.requestPointerLock();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch {
    // Pointer lock can fail right after Esc (browser cooldown): the game
    // still plays; clicking the canvas locks it again.
  }
}

function crime(kind, amount) {
  const now = G.time;
  G._crimeAt = G._crimeAt || {};
  if (now - (G._crimeAt[kind] || -99) < 4) return;
  G._crimeAt[kind] = now;
  addWanted(police, amount, now);
}

function doShoot() {
  if (!player.onFoot || !player.armed) return;
  const allCars = [...G.cars, ...police.cars];
  const report = combat.shoot(player, camera, peds, police.cops, allCars, city.buildingMesh, G.time);
  if (!report.fired) {
    if (report.reason === 'empty') hud.logMessage('Out of ammo — find a green ammo box.');
    return;
  }
  audio.gunshot();
  cameraRig.addTrauma(0.1);
  crime('shoot', 1);
  scarePeds(peds, player.pos.x, player.pos.z, 30);
  if (report.hit && report.hit.kind === 'cop') {
    addWanted(police, 1, G.time);
    if (report.down) hud.logMessage('Cop down! The heat is on you.');
  } else if (report.hit && report.hit.kind === 'ped' && report.down) {
    hud.logMessage('Pedestrian down! Witnesses called the cops.');
  }
}

function doMelee() {
  if (!player.onFoot) return;
  const hit = combat.melee(player, peds, police.cops);
  if (!hit) return;
  audio.punch();
  cameraRig.addTrauma(0.06);
  if (hit.kind === 'ped') crime('assault', 1);
  else addWanted(police, 1, G.time);
}

function onPickup(type) {
  audio.pickup();
  if (type === 'ammo') {
    player.ammo = Math.min(COMBAT.pistolAmmoMax, player.ammo + 12);
    hud.logMessage('+12 pistol ammo');
  } else if (type === 'health') {
    player.health = Math.min(HEALTH.max, player.health + 40);
    hud.logMessage('+40 health');
  } else {
    G.money += MONEY.pickup;
    hud.logMessage(`+$${MONEY.pickup} found cash`);
    saveGame();
  }
}

function endGame(kind) {
  if (G.screen !== 'play') return;
  if (!player.onFoot) exitCar(player, city);
  const penalty = Math.floor(G.money * (kind === 'busted' ? MONEY.bustLoss : MONEY.wastedLoss));
  G.money = Math.max(0, G.money - penalty);
  G.endKind = kind;
  G.screen = 'end';
  hud.setEnd(kind, kind === 'busted'
    ? `The Solbrisa PD has you. You lost $${penalty} in fines and impound fees.`
    : `You flatlined on the streets of Solbrisa. The hospital kept $${penalty}.`);
  hud.showScreen('end');
  if (kind === 'busted') audio.busted();
  else audio.wasted();
  if (document.pointerLockElement) document.exitPointerLock();
  saveGame();
}

function respawn() {
  const spot = G.endKind === 'busted' ? POLICE_STATION : HOSPITAL;
  player.pos.x = spot.x;
  player.pos.z = spot.z;
  player.y = 0;
  player.vy = 0;
  player.health = HEALTH.max;
  player.mesh.position.set(spot.x, 0, spot.z);
  clearPolice(police);
  const step = currentStep(missions);
  if (step && step.type === 'timed') missions.timer = step.time;
  G.screen = 'play';
  hud.showScreen('play');
  hud.banner('Back on the streets', G.endKind === 'busted' ? 'Vex is waiting at the garage.' : 'Patch up and get back to work.', 4);
  lockPointer();
}

function startGame() {
  audio.unlock();
  G.screen = 'play';
  G.playStart = G.time;
  hud.showScreen('play');
  const mission = currentMission(missions);
  const brief = startMission(missions, (n, now) => addWanted(police, n, now), G.time);
  if (mission) hud.banner(mission.name, brief || '', 6);
  lockPointer();
}

function pauseGame() {
  if (G.screen !== 'play' || G.shotMode) return;
  G.screen = 'paused';
  hud.showScreen('pause');
  if (document.pointerLockElement) document.exitPointerLock();
}

function resumeGame() {
  if (G.screen !== 'paused') return;
  G.screen = 'play';
  hud.showScreen('play');
  lockPointer();
}

function stepGame(dt) {
  G.time += dt;
  const active = G.activeInput;
  const actions = active.takeActions();

  // NOTE: ACT_PAUSE / ACT_MUTE / ACT_CONFIRM are handled in the frame loop,
  // not here — stepGame only runs while playing.
  if (actions & ACT_JUMP) active.jumpQueued = true;
  if (actions & ACT_ENTER) {
    if (player.onFoot) {
      const car = nearestEnterableCar(player, G.cars);
      if (car) {
        enterCar(player, car);
        active.jumpQueued = false;
        if (!car.stolen) {
          car.stolen = true;
          addWanted(police, 1, G.time);
          hud.logMessage('You stole the car! Someone saw that.');
          scarePeds(peds, player.pos.x, player.pos.z, 20);
        }
      }
    } else {
      exitCar(player, city);
      active.jumpQueued = false;
    }
  }
  if (actions & ACT_WEAPON) {
    player.armed = !player.armed;
    hud.logMessage(player.armed ? 'Pistol drawn — click to fire.' : 'Pistol holstered.');
  }
  if (actions & ACT_MELEE) doMelee();
  if (actions & ACT_FIRE) {
    if (player.armed) doShoot();
    else doMelee();
  }
  if (active.isFiring() && player.armed && player.onFoot) doShoot();

  const allCars = [...G.cars, ...police.cars];
  if (player.onFoot) {
    stepPlayerOnFoot(player, active, cameraRig.yaw, dt, city);
  } else {
    const car = player.car;
    const crash = driveCar(car, active.forward(), -active.strafe(), active.handbrake(), dt, city, allCars);
    // Crash feedback at most twice a second: grinding along a wall holds
    // crash > 0.12 every step, and unthrottled it drains the health bar.
    if (crash > 0.12 && G.time - G.lastCrashAt > 0.5) {
      G.lastCrashAt = G.time;
      player.health -= crash * HEALTH.crashDiv;
      cameraRig.addTrauma(crash * 0.7);
      audio.crash(crash);
    }
    // Running a ped over is a crime — and they saw the car.
    for (const ped of peds) {
      if (ped.down > 0) continue;
      const d = Math.hypot(ped.pos.x - car.pos.x, ped.pos.z - car.pos.z);
      if (d < 2.4 && Math.abs(car.speed) > 6) {
        hurtPed(ped, 100, car.pos.x, car.pos.z);
        crime('hitped', 1);
        scarePeds(peds, ped.pos.x, ped.pos.z, 25);
        audio.crash(0.5);
        hud.logMessage('You hit a pedestrian!');
      }
    }
  }

  stepTraffic(trafficCars, dt, city, allCars, rng);
  const threats = [];
  if (!player.onFoot) threats.push({ x: player.car.pos.x, z: player.car.pos.z, speed: Math.abs(player.car.speed) });
  for (const c of police.cars) threats.push({ x: c.pos.x, z: c.pos.z, speed: Math.abs(c.speed) });
  stepPedestrians(peds, dt, city, rng, threats);

  const busted = stepPolice(police, player, dt, city, allCars, rng, G.time, (event) => {
    if (event.type === 'ram') {
      cameraRig.addTrauma(event.strength * 0.5);
      audio.crash(event.strength);
    } else if (event.type === 'punch') {
      audio.punch();
      cameraRig.addTrauma(0.15);
    }
  });

  combat.stepPickups(dt, player, G.time, onPickup);

  const events = stepMissions(missions, player, police.level, dt, (n, now) => addWanted(police, n, now), G.time);
  for (const event of events) {
    if (event.type === 'complete') {
      G.money += event.reward;
      hud.banner('Mission complete', `${event.mission.name} — +$${event.reward}`, 5);
      hud.logMessage(`Mission complete: ${event.mission.name} (+$${event.reward})`);
      audio.mission();
      saveGame();
    } else if (event.type === 'next') {
      hud.banner(event.mission.name, event.mission.brief, 6);
      hud.logMessage(`New mission: ${event.mission.name}`);
      if (event.alert) hud.logMessage(event.alert);
    } else if (event.type === 'step') {
      if (event.alert) hud.banner('Watch out', event.alert, 4);
      hud.logMessage(event.step.text);
    } else if (event.type === 'failed') {
      hud.banner('Too slow', event.text, 3);
    }
  }
  if (!missions.active && G.time > 1 && !G._freeRoamLogged) {
    G._freeRoamLogged = true;
    hud.banner('Solbrisa Legend', 'Every job done. The city is yours — free roam.', 6);
  }

  if (!G.shotMode) {
    if (busted) endGame('busted');
    else if (player.health <= 0) endGame('wasted');
  } else if (player.health < 1) {
    player.health = 1;
  }
}

function renderFrame(dt) {
  const driving = !player.onFoot;
  const targetPos = driving
    ? { x: player.car.pos.x, y: 0, z: player.car.pos.z }
    : { x: player.pos.x, y: player.y, z: player.pos.z };
  const targetHeading = driving ? player.car.heading : player.heading;
  const speedNorm = driving ? Math.abs(player.car.speed) / CAR.maxSpeed : playerSpeed(player) / 9;
  const mouse = G.activeInput.takeMouse();
  if (shot === 'start') {
    cameraRig.update(dt, { x: 0, y: 0, z: 0 }, 0, false, 0, mouse);
  } else {
    cameraRig.update(dt, targetPos, targetHeading, driving, speedNorm, mouse);
  }
  for (const car of G.cars) animateCar(car, dt, G.time);
  for (const car of police.cars) animateCar(car, dt, G.time);
  renderer.render(scene, camera);

  const step = currentStep(missions);
  const car = nearestEnterableCar(player, G.cars);
  hud.update(performance.now(), {
    money: G.money,
    health: Math.ceil(player.health),
    stars: police.level,
    hidden: police.hidden,
    driving,
    speedKmh: driving ? Math.abs(player.car.speed) * 3.6 : 0,
    missionName: missions.active && currentMission(missions) ? currentMission(missions).name : 'Free roam',
    objective: missions.active && step ? step.text : 'Solbrisa is yours. Explore, steal, survive.',
    timer: step && step.type === 'timed' ? missions.timer : null,
    prompt: player.onFoot && car ? 'Press E to steal the car' : driving ? 'E — exit car · Space — handbrake' : '',
    armed: player.armed,
    ammo: player.ammo,
    showHint: !G.shotMode && G.screen === 'play' && G.time - G.playStart < 25,
    muted: G.muted,
  });
  minimap.draw(G.time, player, missionTarget(missions), police, combat.pickups);
  const nearest = nearestPoliceDistance(police, targetPos);
  audio.update(dt, driving ? speedNorm : 0, police.level > 0 ? Math.max(0, 1 - nearest / 70) : 0);
}

// Buttons and screen wiring.
document.getElementById('start-button').addEventListener('click', () => { audio.click(); startGame(); });
document.getElementById('reset-button').addEventListener('click', () => { clearSave(); window.location.reload(); });
document.getElementById('resume-button').addEventListener('click', () => { audio.click(); resumeGame(); });
document.getElementById('restart-button').addEventListener('click', () => { window.location.reload(); });
document.getElementById('respawn-button').addEventListener('click', () => { audio.click(); respawn(); });
canvas.addEventListener('click', () => {
  if (G.screen === 'play' && !document.pointerLockElement && !G.shotMode) lockPointer();
});
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && G.screen === 'play' && !G.shotMode) {
    // Escape both exits the lock and queues ACT_PAUSE: consume the queued
    // bit so the frame loop does not immediately resume after this pause.
    G.activeInput.clearAction(ACT_PAUSE);
    pauseGame();
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && G.screen === 'play' && !G.shotMode) pauseGame();
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start screen info.
{
  const mission = currentMission(missions);
  hud.setStartInfo(save ? save.money : MONEY.start, mission ? mission.name : 'Free roam', Boolean(save));
  hud.showScreen('start');
}

// For playtests and screenshots: the live game state, and the shot flag.
window.__game = G;
window.__shotReady = false;

if (shot) {
  // Screenshot mode: stage the scene, play it forward, then flag readiness.
  const stage = stageShot(shot, G);
  G.activeInput = stage.pilot;
  G.screen = 'play';
  hud.showScreen(stage.title ? 'start' : 'play');
  if (stage.title) {
    hud.setStartInfo(G.money, currentMission(missions) ? currentMission(missions).name : 'Free roam', false);
  } else {
    G.playStart = 0;
  }
  for (let i = 0; i < stage.steps; i++) {
    if (stage.midways) for (const m of stage.midways) if (m.at === i) m.fn();
    stepGame(STEP);
  }
  let painted = 0;
  (function paint() {
    renderFrame(STEP);
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }());
  // Keep the world alive after the flag so a late screenshot still looks right.
  let last = performance.now();
  (function frame(nowMs) {
    requestAnimationFrame(frame);
    // Clamp both ways: a frame timestamp can predate module evaluation after
    // a long synchronous task (headless), which would otherwise drive dt
    // negative and corrupt the camera trauma and FOV easing.
    const dt = Math.max(0, Math.min(0.1, (nowMs - last) / 1000));
    last = nowMs;
    if (!stage.title) {
      G._acc = (G._acc || 0) + dt;
      let n = 0;
      while (G._acc >= STEP && n < 5) {
        stepGame(STEP);
        G._acc -= STEP;
        n += 1;
      }
      if (n === 5) G._acc = 0;
    }
    renderFrame(dt);
  }(performance.now()));
} else {
  // Normal play: fixed-step accumulator inside the animation frame.
  let last = performance.now();
  let acc = 0;
  (function frame(nowMs) {
    requestAnimationFrame(frame);
    const dt = Math.max(0, Math.min(0.1, (nowMs - last) / 1000));
    last = nowMs;
    // Screen-level actions live here, not in stepGame: the sim only runs
    // while playing, so a P pressed while paused (or Enter on the end
    // screen) would otherwise never be consumed and resume would be dead.
    const pending = G.activeInput.peekActions();
    if (pending & ACT_MUTE) {
      G.activeInput.clearAction(ACT_MUTE);
      G.muted = audio.toggleMute();
    }
    if (pending & ACT_PAUSE) {
      G.activeInput.clearAction(ACT_PAUSE);
      if (G.screen === 'play') pauseGame();
      else if (G.screen === 'paused') resumeGame();
    }
    if ((pending & ACT_CONFIRM) && G.screen === 'end') {
      G.activeInput.clearAction(ACT_CONFIRM);
      respawn();
    }
    if (G.screen === 'play') {
      acc += dt;
      let n = 0;
      while (acc >= STEP && n < 5) {
        stepGame(STEP);
        acc -= STEP;
        n += 1;
      }
      if (n === 5) acc = 0;
    }
    renderFrame(dt);
  }(performance.now()));
}
