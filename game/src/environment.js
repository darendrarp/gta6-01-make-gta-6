// Day and night: the sky, sun, fog and streetlights follow the clock. The
// game opens at golden hour (18:00) — the light the whole city was built
// around — and N flips to full night (23:00): a dark blue sky, a moon, stars,
// dim blue moonlight and warm streetlights against it. setTimeOfDay() picks
// any hour; the keyframes below are interpolated between, so the light moves
// smoothly instead of snapping.

import * as THREE from 'three';
import { NIGHT } from './config.js';

// hour: sky top / horizon / fog / sun color+intensity+position / hemi
// sky+ground+intensity / night factor (0 = day, 1 = full night).
const KEYFRAMES = [
  {
    hour: 0,
    skyTop: 0x0a1626, skyHorizon: 0x1e3a5c, fog: 0x14263c,
    sun: 0x8fb4ff, sunIntensity: 1.0, sunPos: [-200, 420, 120],
    hemiSky: 0x2a3a5a, hemiGround: 0x1a1a26, hemiIntensity: 0.6, night: 1,
  },
  {
    hour: 6,
    skyTop: 0x3a6a9a, skyHorizon: 0xff9d7a, fog: 0xe8907a,
    sun: 0xffc890, sunIntensity: 1.6, sunPos: [-420, 120, -80],
    hemiSky: 0xffd9b0, hemiGround: 0x5a4a3a, hemiIntensity: 0.7, night: 0.15,
  },
  {
    hour: 12,
    skyTop: 0x2e7fc4, skyHorizon: 0x9fd4ef, fog: 0xbfe3f2,
    sun: 0xfff2d8, sunIntensity: 2.6, sunPos: [-120, 420, -60],
    hemiSky: 0xcfe8ff, hemiGround: 0x6a7a6a, hemiIntensity: 1.0, night: 0,
  },
  {
    // Golden hour — the exact light buildCity used before this system
    // existed, so the default hour changes nothing about the old look.
    hour: 18,
    skyTop: 0x2e5f8a, skyHorizon: 0xffb36b, fog: 0xf2a35e,
    sun: 0xffd9a0, sunIntensity: 2.4, sunPos: [-320, 200, -160],
    hemiSky: 0xffd9b0, hemiGround: 0x5a4a3a, hemiIntensity: 0.85, night: 0,
  },
  {
    hour: 22,
    skyTop: 0x0a1626, skyHorizon: 0x1e3a5c, fog: 0x14263c,
    sun: 0x8fb4ff, sunIntensity: 1.0, sunPos: [-200, 420, 120],
    hemiSky: 0x2a3a5a, hemiGround: 0x1a1a26, hemiIntensity: 0.6, night: 1,
  },
  {
    hour: 24,
    skyTop: 0x0a1626, skyHorizon: 0x1e3a5c, fog: 0x14263c,
    sun: 0x8fb4ff, sunIntensity: 1.0, sunPos: [-200, 420, 120],
    hemiSky: 0x2a3a5a, hemiGround: 0x1a1a26, hemiIntensity: 0.6, night: 1,
  },
];

const _a = new THREE.Color();
const _b = new THREE.Color();

function lerpColor(out, hexA, hexB, t) {
  return out.copy(_a.setHex(hexA)).lerp(_b.setHex(hexB), t);
}

function sample(hour) {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < KEYFRAMES.length - 2 && KEYFRAMES[i + 1].hour <= h) i += 1;
  const a = KEYFRAMES[i];
  const b = KEYFRAMES[i + 1];
  const t = Math.max(0, Math.min(1, (h - a.hour) / (b.hour - a.hour)));
  return { a, b, t };
}

function makeMoon(scene) {
  const moon = new THREE.Mesh(
    new THREE.CircleGeometry(34, 24),
    new THREE.MeshBasicMaterial({ color: 0xf4f1de, transparent: true, opacity: 0, fog: false }),
  );
  // Due east, over 36th Street: it hangs down the street canyon, clear of
  // the towers on either side, and over the ocean from the coast road.
  moon.position.set(600, 340, 40);
  moon.lookAt(0, 0, 0);
  scene.add(moon);
  return moon;
}

function makeStars(scene, rng) {
  const count = 260;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // Random point on the upper hemisphere, radius 1300.
    const u = rng();
    const v = rng();
    const theta = 2 * Math.PI * u;
    const y = 0.08 + v * 0.92;
    const r = Math.sqrt(1 - y * y);
    positions[i * 3] = Math.cos(theta) * r * 1300;
    positions[i * 3 + 1] = y * 1300;
    positions[i * 3 + 2] = Math.sin(theta) * r * 1300;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const stars = new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0xdde8ff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false,
  }));
  scene.add(stars);
  return stars;
}

/** Build the environment from the city's light rig; starts at golden hour. */
export function createEnvironment(scene, city, rng) {
  const env = {
    scene,
    city,
    hour: NIGHT.dayHour,
    cycling: false, // when true, the clock advances 1 game-hour per 120 s
    nightFactor: 0,
    moon: makeMoon(scene),
    stars: makeStars(scene, rng),
  };
  setTimeOfDay(env, NIGHT.dayHour);
  return env;
}

function applyTimeOfDay(env) {
  const { a, b, t } = sample(env.hour);
  const { sun, hemi, sky, headMat } = env.city.lights;
  const uniforms = sky.material.uniforms;
  lerpColor(uniforms.top.value, a.skyTop, b.skyTop, t);
  lerpColor(uniforms.horizon.value, a.skyHorizon, b.skyHorizon, t);
  lerpColor(env.scene.fog.color, a.fog, b.fog, t);
  lerpColor(sun.color, a.sun, b.sun, t);
  sun.intensity = a.sunIntensity + (b.sunIntensity - a.sunIntensity) * t;
  sun.position.set(
    a.sunPos[0] + (b.sunPos[0] - a.sunPos[0]) * t,
    a.sunPos[1] + (b.sunPos[1] - a.sunPos[1]) * t,
    a.sunPos[2] + (b.sunPos[2] - a.sunPos[2]) * t,
  );
  lerpColor(hemi.color, a.hemiSky, b.hemiSky, t);
  lerpColor(hemi.groundColor, a.hemiGround, b.hemiGround, t);
  hemi.intensity = a.hemiIntensity + (b.hemiIntensity - a.hemiIntensity) * t;
  env.nightFactor = a.night + (b.night - a.night) * t;
  // Moon and stars fade in with the dark; the streetlight heads warm up.
  env.moon.material.opacity = env.nightFactor * 0.95;
  env.stars.material.opacity = env.nightFactor * 0.9;
  headMat.color.setHex(env.nightFactor > 0.5 ? 0xfff3c4 : 0xffe6a8);
}

/** Set the clock to any hour (0–24) and apply its light immediately. */
export function setTimeOfDay(env, hour) {
  env.hour = ((hour % 24) + 24) % 24;
  applyTimeOfDay(env);
}

/** Flip between golden hour and full night; returns the new hour. */
export function toggleNight(env) {
  const night = env.nightFactor > 0.5;
  setTimeOfDay(env, night ? NIGHT.dayHour : NIGHT.nightHour);
  return env.hour;
}

/** True once the sky has gone properly dark. */
export function isNight(env) {
  return env.nightFactor > 0.5;
}

/** Advance the clock when cycling is on (off by default: screenshots and
 *  playtests need the light to stay put unless the player asks for night). */
export function stepEnvironment(env, dt) {
  if (!env.cycling) return;
  setTimeOfDay(env, env.hour + dt / 120);
}
