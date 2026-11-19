// Save/load through localStorage: money, missions completed and the current
// mission. Saved on mission completion, on busted/wasted, and when money changes.
// A missing or corrupt save starts a fresh game; nothing here ever throws.

import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return {
      money: Number.isFinite(data.money) ? data.money : 150,
      mission: Number.isInteger(data.mission) ? data.mission : 0,
      completed: Number.isInteger(data.completed) ? data.completed : 0,
    };
  } catch {
    return null;
  }
}

export function writeSave(data) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Storage can be off: the game still runs, progress just lasts one visit.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Ignore.
  }
}
