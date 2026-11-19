// The city of Solbrisa, built procedurally from a seed: a 7x7 block grid with
// asphalt roads, sidewalks, instanced low-poly buildings with canvas window
// textures, palm trees and streetlights along the coast road, a beach and an
// ocean, golden-hour sun, shadows, fog and a gradient sky dome. Buildings are
// the only colliders; resolveCircle() pushes a circle out of them and the bounds.

import * as THREE from 'three';
import { BLOCK, BLOCK_CENTERS, BOUND, COAST_ROAD_X, HALF, PALETTE, PITCH, ROAD, ROAD_CENTERS, SAND_X, WATER_X } from './config.js';
import { intRange, pick, range } from './random.js';

function windowTexture(rng, litRatio) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#d9d9d9';
  ctx.fillRect(0, 0, 128, 256);
  const cols = 8;
  const rows = 20;
  const w = 128 / cols;
  const h = 256 / rows;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const lit = rng() < litRatio;
      ctx.fillStyle = lit ? '#ffd27a' : (rng() < 0.5 ? '#2b3542' : '#35424f');
      ctx.fillRect(x * w + 2, y * h + 2, w - 4, h - 4);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function signTexture(text, bg, fg) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 96);
  ctx.fillStyle = fg;
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 50);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function skyDome() {
  const geo = new THREE.SphereGeometry(1500, 24, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(PALETTE.skyTop) },
      horizon: { value: new THREE.Color(PALETTE.skyHorizon) },
    },
    vertexShader: 'varying vec3 vPos; void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 horizon; varying vec3 vPos; void main() { float t = clamp(normalize(vPos).y * 1.6 + 0.12, 0.0, 1.0); gl_FragColor = vec4(mix(horizon, top, t), 1.0); }',
  });
  return new THREE.Mesh(geo, mat);
}

function flatPlane(w, d, color, y) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshLambertMaterial({ color }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  mesh.receiveShadow = true;
  return mesh;
}

export function buildCity(scene, rng) {
  const colliders = [];
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  // Light, sky and fog: low warm sun in the west, golden haze on the horizon.
  scene.fog = new THREE.Fog(PALETTE.fog, 220, 1100);
  scene.add(skyDome());
  const hemi = new THREE.HemisphereLight(0xffd9b0, 0x5a4a3a, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(PALETTE.sun, 2.4);
  sun.position.set(-320, 200, -160);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -340;
  sun.shadow.camera.right = 340;
  sun.shadow.camera.top = 340;
  sun.shadow.camera.bottom = -340;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 1100;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);

  // Ground: one asphalt slab for the whole city; sidewalk squares on top leave
  // the roads as the gaps between them. Sand and ocean stretch east.
  const outer = flatPlane(3200, 3200, 0x7d7468, -0.05);
  scene.add(outer);
  const asphalt = flatPlane(HALF * 2 + ROAD, HALF * 2 + ROAD, PALETTE.road, 0);
  scene.add(asphalt);
  const sand = flatPlane(WATER_X - SAND_X + 40, 900, PALETTE.sand, 0.02);
  sand.position.x = (SAND_X + WATER_X) / 2 + 10;
  scene.add(sand);
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, 3200),
    new THREE.MeshStandardMaterial({ color: PALETTE.ocean, roughness: 0.25, metalness: 0.15 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(WATER_X + 700, 0.0, 0);
  scene.add(ocean);
  // Coast road strip over the sand.
  const coastRoad = flatPlane(12, HALF * 2 + ROAD, PALETTE.road, 0.03);
  coastRoad.position.x = COAST_ROAD_X;
  scene.add(coastRoad);

  // Sidewalk square per block.
  const sidewalkGeo = new THREE.PlaneGeometry(BLOCK + 8, BLOCK + 8);
  const sidewalkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  const sidewalks = new THREE.InstancedMesh(sidewalkGeo, sidewalkMat, BLOCK_CENTERS.length ** 2);
  let sw = 0;
  for (const bx of BLOCK_CENTERS) {
    for (const bz of BLOCK_CENTERS) {
      dummy.position.set(bx, 0.02, bz);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.updateMatrix();
      sidewalks.setMatrixAt(sw++, dummy.matrix);
    }
  }
  sidewalks.receiveShadow = true;
  scene.add(sidewalks);

  // Lane dashes along every road, skipping intersections. The plane is 0.5
  // wide and 3.2 long; rot = PI/2 lays the length along x (east-west roads),
  // rot = 0 lays it along z (north-south roads). Swapped once, the dashes
  // read as cross-bars — and one right under the chase camera looked like a
  // white slab floating on the road.
  const dashGeo = new THREE.PlaneGeometry(0.5, 3.2);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5f0dc });
  const dashPositions = [];
  for (const c of ROAD_CENTERS) {
    for (let t = -HALF; t <= HALF; t += 9) {
      const nearCrossing = ROAD_CENTERS.some((o) => Math.abs(t - o) < 11);
      if (!nearCrossing) {
        dashPositions.push([t, c, Math.PI / 2]);
        dashPositions.push([c, t, 0]);
      }
    }
  }
  const dashes = new THREE.InstancedMesh(dashGeo, dashMat, dashPositions.length);
  dashPositions.forEach(([x, z, rot], i) => {
    dummy.position.set(x, 0.03, z);
    dummy.rotation.set(-Math.PI / 2, 0, rot);
    dummy.updateMatrix();
    dashes.setMatrixAt(i, dummy.matrix);
  });
  scene.add(dashes);

  // Buildings: one or four per block; downtown blocks grow tall towers.
  const plots = [];
  for (const bx of BLOCK_CENTERS) {
    for (const bz of BLOCK_CENTERS) {
      const downtown = 1 - (Math.abs(bx) + Math.abs(bz)) / 432;
      const tower = downtown > 0.45 && rng() < 0.55;
      if (tower) {
        plots.push({ x: bx, z: bz, w: 44, d: 44, h: range(rng, 30, 34 + downtown * 34) });
      } else {
        const n = rng() < 0.5 ? 4 : 2;
        const offs = n === 4 ? [[-13, -13], [13, -13], [-13, 13], [13, 13]] : [[-13, 0], [13, 0]];
        for (const [ox, oz] of offs) {
          plots.push({
            x: bx + ox, z: bz + oz,
            w: n === 4 ? 22 : 24, d: n === 4 ? 22 : 44,
            h: range(rng, 8, 12 + downtown * 22),
          });
        }
      }
    }
  }
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  boxGeo.translate(0, 0.5, 0); // origin at the base, so scale.y = height
  const sideMat = new THREE.MeshLambertMaterial({ map: windowTexture(rng, 0.34) });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x4a4a52 });
  const buildings = new THREE.InstancedMesh(boxGeo, [sideMat, sideMat, roofMat, roofMat, sideMat, sideMat], plots.length);
  plots.forEach((p, i) => {
    dummy.position.set(p.x, 0, p.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(p.w, p.h, p.d);
    dummy.updateMatrix();
    buildings.setMatrixAt(i, dummy.matrix);
    buildings.setColorAt(i, color.setHex(pick(rng, PALETTE.building)));
    colliders.push({ minX: p.x - p.w / 2, maxX: p.x + p.w / 2, minZ: p.z - p.d / 2, maxZ: p.z + p.d / 2 });
  });
  buildings.castShadow = true;
  buildings.receiveShadow = true;
  scene.add(buildings);

  // Palm trees: trunks and six tilted frond blades each, all instanced.
  const palmSpots = [];
  for (let z = -250; z <= 250; z += 17) {
    if (rng() < 0.8) palmSpots.push([COAST_ROAD_X - 10 + range(rng, -1.5, 1.5), z + range(rng, -3, 3)]);
    if (rng() < 0.6) palmSpots.push([COAST_ROAD_X + 10 + range(rng, -1.5, 1.5), z + range(rng, -3, 3)]);
  }
  for (let i = 0; i < 26; i++) {
    const bx = pick(rng, BLOCK_CENTERS);
    const bz = pick(rng, BLOCK_CENTERS);
    palmSpots.push([bx + range(rng, -26, 26), bz + (rng() < 0.5 ? -29 : 29)]);
  }
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.32, 5.4, 6);
  trunkGeo.translate(0, 2.7, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: 0x8a6b4a }), palmSpots.length);
  const frondGeo = new THREE.BoxGeometry(0.5, 0.08, 3.6);
  frondGeo.translate(0, 0, 1.5);
  const fronds = new THREE.InstancedMesh(frondGeo, new THREE.MeshLambertMaterial({ color: 0x3f8f4f }), palmSpots.length * 6);
  palmSpots.forEach(([x, z], i) => {
    const lean = range(rng, -0.12, 0.12);
    dummy.position.set(x, 0, z);
    dummy.rotation.set(lean, rng() * Math.PI * 2, 0);
    dummy.scale.set(1, range(rng, 0.85, 1.25), 1);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    const topY = 5.4 * dummy.scale.y;
    for (let f = 0; f < 6; f++) {
      dummy.position.set(x, topY, z);
      dummy.rotation.set(-0.55, (f / 6) * Math.PI * 2 + rng() * 0.3, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      fronds.setMatrixAt(i * 6 + f, dummy.matrix);
    }
  });
  trunks.castShadow = true;
  fronds.castShadow = true;
  scene.add(trunks);
  scene.add(fronds);

  // Streetlights along the roads, alternating sides, warm heads already on.
  const lightSpots = [];
  for (const c of ROAD_CENTERS) {
    for (let t = -240; t <= 240; t += 48) {
      lightSpots.push([t, c + 8.6, 0]);
      lightSpots.push([c + 8.6, t, Math.PI / 2]);
    }
  }
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 7, 5);
  poleGeo.translate(0, 3.5, 0);
  const poles = new THREE.InstancedMesh(poleGeo, new THREE.MeshLambertMaterial({ color: 0x2c2f36 }), lightSpots.length);
  const headGeo = new THREE.BoxGeometry(1.6, 0.18, 0.5);
  const heads = new THREE.InstancedMesh(headGeo, new THREE.MeshBasicMaterial({ color: 0xffe6a8 }), lightSpots.length);
  lightSpots.forEach(([x, z, rot], i) => {
    dummy.position.set(x, 0, z);
    dummy.rotation.set(0, rot, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    poles.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, 7, z);
    dummy.updateMatrix();
    heads.setMatrixAt(i, dummy.matrix);
  });
  scene.add(poles);
  scene.add(heads);

  // Landmark signs: canvas-texture boards on poles at mission places. Each
  // board has two faces back to back so the text reads correctly from both
  // sides (a single double-sided plane reads mirrored from behind), and the
  // facing is fixed per sign so it faces the road it stands on.
  function addSign(text, x, z, rotY, bg, fg) {
    const group = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 6, 6), new THREE.MeshLambertMaterial({ color: 0x333333 }));
    pole.position.y = 3;
    const tex = signTexture(text, bg, fg);
    const geo = new THREE.PlaneGeometry(9, 1.7);
    const mat = new THREE.MeshBasicMaterial({ map: tex });
    const front = new THREE.Mesh(geo, mat);
    front.position.y = 6.4;
    const back = new THREE.Mesh(geo, mat);
    back.position.y = 6.4;
    back.rotation.y = Math.PI;
    group.add(pole, front, back);
    group.position.set(x, 0, z);
    group.rotation.y = rotY;
    scene.add(group);
  }
  addSign("VEX'S GARAGE", -176, -200, 0, '#1d2b53', '#ffd166');
  addSign('SOUTHSIDE DINER', -180, 196, 0, '#7f1d1d', '#fff7ed');
  addSign('SOLBRISA GENERAL', 36, 32, -Math.PI / 2, '#14532d', '#ffffff');
  addSign('MARINA PIER', 244, 176, Math.PI / 2, '#0c4a6e', '#bae6fd');

  // Marina pier + two boats at the water's edge.
  const pier = new THREE.Mesh(new THREE.BoxGeometry(30, 0.6, 5), new THREE.MeshLambertMaterial({ color: 0x9a7b52 }));
  pier.position.set(318, 0.5, 180);
  pier.castShadow = true;
  scene.add(pier);
  for (const [bx, bz, bc] of [[330, 168, 0xe8e8e8], [334, 196, 0xd94f4f]]) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(9, 1.6, 3.2), new THREE.MeshLambertMaterial({ color: bc }));
    hull.position.y = 0.8;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(4, 1.6, 2.6), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    cabin.position.set(-0.5, 2.4, 0);
    boat.add(hull, cabin);
    boat.position.set(bx, 0, bz);
    boat.rotation.y = range(rng, -0.2, 0.2);
    scene.add(boat);
  }

  // Parked-car spots: parallel to a road, clear of intersections. Only the
  // inner roads are used: a spot on an outer road (c = +/-252) would sit
  // 0.6 units from the world bound, inside the car's own collision radius,
  // and the car would spawn clamped against the wall. Headings face ALONG
  // the road (heading 0 moves +z, PI/2 moves +x).
  const parkedSpots = [];
  let guard = 0;
  const INNER_ROADS = ROAD_CENTERS.slice(1, -1);
  while (parkedSpots.length < 40 && guard++ < 400) {
    const axis = rng() < 0.5 ? 'x' : 'z';
    const c = pick(rng, INNER_ROADS);
    const t = range(rng, -240, 240);
    if (ROAD_CENTERS.some((o) => Math.abs(t - o) < 14)) continue;
    const side = rng() < 0.5 ? -1 : 1;
    const off = side * (ROAD / 2 - 2.6);
    parkedSpots.push(axis === 'x'
      ? { x: t, z: c + off, heading: side > 0 ? Math.PI / 2 : -Math.PI / 2 }
      : { x: c + off, z: t, heading: side > 0 ? Math.PI : 0 });
  }

  function pointBlocked(x, z, margin) {
    for (const c of colliders) {
      if (x > c.minX - margin && x < c.maxX + margin && z > c.minZ - margin && z < c.maxZ + margin) return true;
    }
    return false;
  }

  // Push a circle (x, z, radius) out of every building and the world bounds.
  // Mutates `pos` ({x, z}) in place; returns true when it hit something.
  function resolveCircle(pos, radius) {
    let hit = false;
    for (const c of colliders) {
      const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
      const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= radius * radius) continue;
      hit = true;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * radius;
        pos.z = cz + (dz / d) * radius;
      } else {
        // Centre inside the box: shove out along the smallest penetration.
        const pl = pos.x - c.minX + radius;
        const pr = c.maxX - pos.x + radius;
        const pt = pos.z - c.minZ + radius;
        const pb = c.maxZ - pos.z + radius;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) pos.x = c.minX - radius;
        else if (m === pr) pos.x = c.maxX + radius;
        else if (m === pt) pos.z = c.minZ - radius;
        else pos.z = c.maxZ + radius;
      }
    }
    if (pos.x < BOUND.minX + radius) { pos.x = BOUND.minX + radius; hit = true; }
    if (pos.x > BOUND.maxX - radius) { pos.x = BOUND.maxX - radius; hit = true; }
    if (pos.z < BOUND.minZ + radius) { pos.z = BOUND.minZ + radius; hit = true; }
    if (pos.z > BOUND.maxZ - radius) { pos.z = BOUND.maxZ - radius; hit = true; }
    return hit;
  }

  return { colliders, parkedSpots, buildingMesh: buildings, pointBlocked, resolveCircle };
}
