// Traffic: AI cars cruising the road grid in their lanes. Each car drives
// straight along one road; at an intersection it sometimes turns onto the
// crossing road with a smooth eased turn. Cars slow for the car ahead and
// wrap around when they leave the city.

import { HALF, ROAD_CENTERS, TRAFFIC } from './config.js';
import { carColor, createCar, driveCar } from './vehicles.js';
import { pick, range } from './random.js';

const LANE = 3.4; // offset from the road centre for right-hand lanes

function randomLaneCar(scene, rng) {
  const axis = rng() < 0.5 ? 'x' : 'z';
  const road = pick(rng, ROAD_CENTERS);
  const dir = rng() < 0.5 ? -1 : 1;
  const t = range(rng, -HALF + 20, HALF - 20);
  const x = axis === 'x' ? t : road + dir * LANE;
  const z = axis === 'x' ? road + dir * LANE : t;
  const heading = axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
  const car = createCar(scene, { x, z, heading, color: carColor(rng), kind: 'traffic' });
  car.axis = axis;
  car.dir = dir;
  car.lane = road;
  car.cruise = range(rng, TRAFFIC.speedMin, TRAFFIC.speedMax);
  return car;
}

function nearestCrossing(t) {
  let best = ROAD_CENTERS[0];
  for (const c of ROAD_CENTERS) if (Math.abs(c - t) < Math.abs(best - t)) best = c;
  return best;
}

export function createTraffic(scene, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i++) cars.push(randomLaneCar(scene, rng));
  return cars;
}

/** One traffic step: lane driving, intersection turns, car-ahead slowing. */
export function stepTraffic(cars, dt, city, allCars, rng) {
  for (const car of cars) {
    const t = car.axis === 'x' ? car.pos.x : car.pos.z;
    // Car ahead on the same lane: ease off.
    let target = car.cruise;
    for (const other of allCars) {
      if (other === car || other.kind === 'parked') continue;
      const ahead = car.axis === 'x'
        ? (other.pos.x - car.pos.x) * car.dir
        : (other.pos.z - car.pos.z) * car.dir;
      const side = car.axis === 'x'
        ? Math.abs(other.pos.z - car.pos.z)
        : Math.abs(other.pos.x - car.pos.x);
      if (ahead > 0 && ahead < 12 && side < 3) target = Math.min(target, Math.max(0, (ahead - 5) * 1.2));
    }
    // Intersection turn decision.
    if (!car.turning) {
      const cross = nearestCrossing(t);
      if (Math.abs(t - cross) < 1.2 && rng() < TRAFFIC.turnChance) {
        const newDir = rng() < 0.5 ? -1 : 1;
        const newAxis = car.axis === 'x' ? 'z' : 'x';
        const from = { x: car.pos.x, z: car.pos.z };
        const to = newAxis === 'x'
          ? { x: car.pos.x, z: cross + newDir * LANE }
          : { x: cross + newDir * LANE, z: car.pos.z };
        const toHeading = newAxis === 'x' ? (newDir > 0 ? Math.PI / 2 : -Math.PI / 2) : (newDir > 0 ? 0 : Math.PI);
        car.turning = { from, to, fromHeading: car.heading, toHeading, progress: 0, newAxis, newDir, lane: cross };
      }
    }
    if (car.turning) {
      const turn = car.turning;
      turn.progress += dt * 1.4;
      const p = Math.min(1, turn.progress);
      const e = p * p * (3 - 2 * p);
      car.pos.x = turn.from.x + (turn.to.x - turn.from.x) * e;
      car.pos.z = turn.from.z + (turn.to.z - turn.from.z) * e;
      let dh = turn.toHeading - turn.fromHeading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      car.heading = turn.fromHeading + dh * e;
      car.speed = car.cruise * 0.55;
      if (p >= 1) {
        car.axis = turn.newAxis;
        car.dir = turn.newDir;
        car.lane = turn.lane;
        car.turning = null;
      }
    } else {
      // Drive straight: steer gently back onto the lane line.
      const lanePos = car.axis === 'x' ? car.pos.z : car.pos.x;
      const err = car.lane + car.dir * LANE - lanePos;
      const wantHeading = car.axis === 'x'
        ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2)
        : (car.dir > 0 ? 0 : Math.PI);
      let dh = wantHeading - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      // Lane correction: a car off its lane line steers back toward it. The
      // sign flips with direction because heading grows clockwise from above.
      const steer = Math.max(-1, Math.min(1, dh * 2 - err * 0.06 * car.dir));
      const throttle = car.speed < target ? 1 : 0;
      driveCar(car, throttle, steer, false, dt, city, allCars);
    }
    car.mesh.position.set(car.pos.x, 0, car.pos.z);
    car.mesh.rotation.y = car.heading;
    // Wrap: leaving the city respawns the car on a fresh random lane.
    if (Math.abs(car.pos.x) > HALF + 14 || Math.abs(car.pos.z) > HALF + 14) {
      const fresh = randomLaneCar(car.mesh.parent, rng);
      car.pos.x = fresh.pos.x;
      car.pos.z = fresh.pos.z;
      car.heading = fresh.heading;
      car.axis = fresh.axis;
      car.dir = fresh.dir;
      car.lane = fresh.lane;
      car.cruise = fresh.cruise;
      car.turning = null;
      car.mesh.parent.remove(fresh.mesh);
    }
  }
}
