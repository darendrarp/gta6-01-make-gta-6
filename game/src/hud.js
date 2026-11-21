// The HUD and the screens, all DOM over the WebGL canvas: health bar, money,
// wanted stars, speedometer, mission objective, contextual prompts, a message
// log, a big centre banner, and the start / pause / busted / wasted screens.
// main.js calls showScreen() and update() — this file owns no game logic.

export function createHud() {
  const $ = (id) => document.getElementById(id);
  const els = {
    hud: $('hud'),
    healthFill: $('health-fill'),
    money: $('money'),
    stars: $('stars'),
    heatNote: $('heat-note'),
    speedo: $('speedo'),
    speedValue: $('speed-value'),
    missionName: $('mission-name'),
    objective: $('objective'),
    timer: $('mission-timer'),
    crew: $('crew'),
    hint: $('hint'),
    prompt: $('prompt'),
    crosshair: $('crosshair'),
    ammo: $('ammo'),
    banner: $('banner'),
    bannerTitle: $('banner-title'),
    bannerText: $('banner-text'),
    log: $('log'),
    startScreen: $('start-screen'),
    pauseScreen: $('pause-screen'),
    endScreen: $('end-screen'),
    endTitle: $('end-title'),
    endText: $('end-text'),
    startMoney: $('start-money'),
    startMission: $('start-mission'),
    muteNote: $('mute-note'),
  };
  let bannerUntil = 0;
  let lastMoney = -1;
  let lastStars = -1;
  let lastObjective = '';
  let lastHealth = -1;

  function starText(level) {
    let out = '';
    for (let i = 0; i < 5; i++) out += i < level ? '★' : '☆';
    return out;
  }

  return {
    els,
    showScreen(name) {
      els.startScreen.style.display = name === 'start' ? 'flex' : 'none';
      els.pauseScreen.style.display = name === 'pause' ? 'flex' : 'none';
      els.endScreen.style.display = name === 'end' ? 'flex' : 'none';
      els.hud.style.display = name === 'play' || name === 'pause' ? 'block' : 'none';
    },
    setStartInfo(money, missionName, hasSave) {
      els.startMoney.textContent = hasSave ? `Continue — $${money} in your pocket` : `You arrive in Solbrisa with $${money} and no friends.`;
      els.startMission.textContent = hasSave ? `Next job: ${missionName}` : 'First job: First Wheels';
    },
    setEnd(kind, text) {
      els.endTitle.textContent = kind === 'busted' ? 'BUSTED' : 'WASTED';
      els.endTitle.style.color = kind === 'busted' ? '#60a5fa' : '#ef4444';
      els.endText.textContent = text;
    },
    banner(title, text, seconds = 4) {
      els.bannerTitle.textContent = title;
      els.bannerText.textContent = text;
      els.banner.style.display = 'block';
      bannerUntil = performance.now() + seconds * 1000;
    },
    logMessage(text) {
      const div = document.createElement('div');
      div.className = 'log-line';
      div.textContent = text;
      els.log.appendChild(div);
      while (els.log.children.length > 4) els.log.removeChild(els.log.firstChild);
      // Lines linger 15 s: 6 s is short to read while driving, and a line
      // fired in the last staging step must still be up when the screenshot
      // frame is painted (slow renderers take seconds per frame).
      setTimeout(() => { if (div.parentNode) div.parentNode.removeChild(div); }, 15000);
    },
    update(now, data) {
      if (bannerUntil && now > bannerUntil) {
        els.banner.style.display = 'none';
        bannerUntil = 0;
      }
      if (data.money !== lastMoney) {
        lastMoney = data.money;
        els.money.textContent = `$${Math.floor(data.money).toLocaleString('en-US')}`;
      }
      if (data.health !== lastHealth) {
        lastHealth = data.health;
        const pct = Math.max(0, Math.min(100, data.health));
        els.healthFill.style.width = `${pct}%`;
        els.healthFill.style.background = pct > 50 ? '#22c55e' : pct > 25 ? '#f59e0b' : '#ef4444';
      }
      if (data.stars !== lastStars) {
        lastStars = data.stars;
        els.stars.textContent = starText(data.stars);
        els.stars.style.color = data.stars > 0 ? '#fbbf24' : 'rgba(255,255,255,0.55)';
      }
      els.heatNote.textContent = data.stars > 0
        ? (data.hidden ? 'HIDDEN — HEAT DROPPING' : 'EVADE THE POLICE')
        : '';
      els.heatNote.style.color = data.hidden ? '#4ade80' : '#fca5a5';
      if (data.driving) {
        els.speedo.style.display = 'block';
        els.speedValue.textContent = String(Math.round(data.speedKmh));
      } else {
        els.speedo.style.display = 'none';
      }
      const obj = data.objective || '';
      if (obj !== lastObjective) {
        lastObjective = obj;
        els.objective.textContent = obj;
      }
      els.missionName.textContent = data.missionName || '';
      els.timer.textContent = data.timer != null ? `${Math.ceil(data.timer)}s` : '';
      els.crew.textContent = data.crew ? `CREW: ${data.crew}` : '';
      els.crew.style.display = data.crew ? 'block' : 'none';
      els.prompt.textContent = data.prompt || '';
      els.prompt.style.display = data.prompt ? 'block' : 'none';
      els.crosshair.style.display = data.armed && !data.driving ? 'block' : 'none';
      els.ammo.textContent = data.armed ? `AMMO ${data.ammo}` : '';
      els.hint.style.opacity = data.showHint ? '1' : '0';
      els.muteNote.textContent = data.muted ? 'MUTED (M)' : '';
    },
  };
}
