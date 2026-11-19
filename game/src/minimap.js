// The minimap: a small 2D canvas in the corner, top-down, showing the road
// grid, the beach and ocean, the player's arrow, the mission marker, police
// dots and nearby pickups. North is up; the map rotates nothing, the arrow does.

import { COAST_ROAD_X, HALF, ROAD_CENTERS, SAND_X, WATER_X } from './config.js';

const SIZE = 180;
// World x -280..340 and z -280..280 map onto the square.
const SCALE = SIZE / 620;
const OFF = 280;

function toMap(x, z) {
  return [(x + OFF) * SCALE, (z + OFF) * SCALE];
}

export function createMinimap(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = SIZE;
  canvas.height = SIZE;

  function drawBase() {
    ctx.fillStyle = '#20242b';
    ctx.fillRect(0, 0, SIZE, SIZE);
    // Ocean, then sand, on the east edge.
    ctx.fillStyle = '#2f7ea6';
    const [ox] = toMap(WATER_X, 0);
    ctx.fillRect(ox, 0, SIZE - ox, SIZE);
    ctx.fillStyle = '#e8d5a3';
    const [sx] = toMap(SAND_X, 0);
    ctx.fillRect(sx, 0, ox - sx, SIZE);
    // Blocks.
    ctx.fillStyle = '#3a3f47';
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        const [x, y] = toMap(-252 + i * 72 + 8, -252 + j * 72 + 8);
        ctx.fillRect(x, y, 56 * SCALE, 56 * SCALE);
      }
    }
    // Roads.
    ctx.strokeStyle = '#565d68';
    ctx.lineWidth = 16 * SCALE;
    for (const c of ROAD_CENTERS) {
      const [x] = toMap(c, 0);
      ctx.beginPath();
      ctx.moveTo(x, toMap(0, -HALF)[1]);
      ctx.lineTo(x, toMap(0, HALF)[1]);
      ctx.stroke();
      const [, y] = toMap(0, c);
      ctx.beginPath();
      ctx.moveTo(toMap(-HALF, 0)[0], y);
      ctx.lineTo(toMap(HALF, 0)[0], y);
      ctx.stroke();
    }
    ctx.strokeStyle = '#565d68';
    ctx.lineWidth = 12 * SCALE;
    const [cx] = toMap(COAST_ROAD_X, 0);
    ctx.beginPath();
    ctx.moveTo(cx, toMap(0, -HALF)[1]);
    ctx.lineTo(cx, toMap(0, HALF)[1]);
    ctx.stroke();
  }

  return {
    draw(now, player, missionTarget, police, pickups) {
      drawBase();
      // Pickups as small dots.
      for (const p of pickups) {
        if (p.taken > 0) continue;
        const [x, y] = toMap(p.x, p.z);
        ctx.fillStyle = p.type === 'health' ? '#ffffff' : p.type === 'ammo' ? '#4ade80' : '#fbbf24';
        ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
      }
      // Mission marker: pulsing yellow diamond.
      if (missionTarget) {
        const [x, y] = toMap(missionTarget.x, missionTarget.z);
        const r = 5 + Math.sin(now * 4) * 1.5;
        ctx.fillStyle = '#ffd166';
        ctx.beginPath();
        ctx.moveTo(x, y - r);
        ctx.lineTo(x + r, y);
        ctx.lineTo(x, y + r);
        ctx.lineTo(x - r, y);
        ctx.closePath();
        ctx.fill();
      }
      // Police: flashing blue/red dots.
      const flash = Math.floor(now * 3) % 2 === 0;
      ctx.fillStyle = flash ? '#3b82f6' : '#ef4444';
      for (const car of police.cars) {
        const [x, y] = toMap(car.pos.x, car.pos.z);
        ctx.beginPath();
        ctx.arc(x, y, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const cop of police.cops) {
        const [x, y] = toMap(cop.pos.x, cop.pos.z);
        ctx.beginPath();
        ctx.arc(x, y, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      // Player arrow, rotated by heading. Map y grows with world z.
      const pos = player.onFoot ? player.pos : player.car.pos;
      const heading = player.onFoot ? player.heading : player.car.heading;
      const [px, py] = toMap(pos.x, pos.z);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(Math.PI - heading);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(5, 6);
      ctx.lineTo(0, 3);
      ctx.lineTo(-5, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      // North tick.
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('N', SIZE / 2, 12);
    },
  };
}
