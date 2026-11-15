import * as three from 'three';

// HUD copy lives in one table so the overlay and the buy menu agree.
const COPY = {
  start: { title: 'TIDELOCK HARBOR', copy: 'Two teams. One charge. First to five rounds takes the harbor. Click to play.', action: 'Click to play' },
  paused: { title: 'PAUSED', copy: 'Game paused. Click resume to continue.', action: 'Resume' },
  buy: { title: 'Buy phase', copy: 'Spend your credits. 1 pistol, 2 rifle, 3 sniper, 4 grenade. B closes.', action: 'Close buy menu' },
  roundEnd: { title: 'Round Over', copy: '', action: 'Next round' },
  matchEnd: { title: 'Match Over', copy: '', action: 'Play again' }
};

export function createHud() {
  const el = {
    game: document.getElementById('game'),
    hud: document.getElementById('hud'),
    crosshair: document.getElementById('crosshair'),
    hitmarker: document.getElementById('hitmarker'),
    ammoMag: document.getElementById('ammo-mag'),
    ammoReserve: document.getElementById('ammo-reserve'),
    healthFill: document.getElementById('health-fill'),
    healthNum: document.getElementById('health-num'),
    timer: document.getElementById('timer'),
    scoreTide: document.getElementById('score-tide'),
    scoreReef: document.getElementById('score-reef'),
    roundLabel: document.getElementById('round-label'),
    money: document.getElementById('money'),
    weaponName: document.getElementById('weapon-name'),
    killfeed: document.getElementById('killfeed'),
    overlay: document.getElementById('overlay'),
    overlayTitle: document.getElementById('overlay-title'),
    overlayCopy: document.getElementById('overlay-copy'),
    overlaySub: document.getElementById('overlay-sub'),
    play: document.getElementById('play'),
    buyMenu: document.getElementById('buy-menu'),
    buyItems: document.getElementById('buy-items'),
    plantBar: document.getElementById('plant-bar'),
    plantFill: document.getElementById('plant-fill'),
    objective: document.getElementById('objective'),
    vignette: document.getElementById('vignette'),
    toast: document.getElementById('toast')
  };

  let last = {};
  let hitTimer = null;
  let toastTimer = null;
  let playHandler = null;
  let buyHandler = null;
  let restartHandler = null;

  el.play.addEventListener('click', () => {
    if (el.overlay.classList.contains('match-end') && restartHandler) {
      restartHandler();
    } else if (playHandler) {
      playHandler();
    }
  });

  function setAmmo(mag, reserve) {
    const val = `${mag} / ${reserve}`;
    if (last.ammo === val) return;
    last.ammo = val;
    el.ammoMag.textContent = mag;
    el.ammoReserve.textContent = reserve;
  }

  function setHealth(hp) {
    if (last.hp === hp) return;
    last.hp = hp;
    el.healthNum.textContent = hp;
    el.healthFill.style.width = `${Math.max(0, Math.min(100, hp))}%`;
    if (hp < 30) {
      el.healthFill.style.background = 'var(--coral)';
    } else {
      el.healthFill.style.background = 'var(--cyan)';
    }
  }

  function setTimer(seconds) {
    if (last.timer === seconds) return;
    last.timer = seconds;
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const text = `${m}:${s < 10 ? '0' : ''}${s}`;
    el.timer.textContent = text;
    if (seconds < 10) {
      el.timer.style.color = 'var(--coral)';
    } else {
      el.timer.style.color = 'var(--ink)';
    }
  }

  function setScore(tide, reef) {
    const val = `${tide}-${reef}`;
    if (last.score === val) return;
    last.score = val;
    el.scoreTide.textContent = tide;
    el.scoreReef.textContent = reef;
  }

  function setRound(n, max) {
    const val = `${n}/${max}`;
    if (last.round === val) return;
    last.round = val;
    el.roundLabel.textContent = `Round ${n} of ${max}`;
  }

  function setMoney(n) {
    if (last.money === n) return;
    last.money = n;
    el.money.textContent = `$${n}`;
  }

  function setWeapon(label) {
    if (last.weapon === label) return;
    last.weapon = label;
    el.weaponName.textContent = label;
  }

  function setObjective(text) {
    if (last.objective === text) return;
    last.objective = text;
    el.objective.textContent = text;
  }

  function feed(killer, victim, headshot) {
    const row = document.createElement('div');
    row.className = 'killfeed-row';
    row.innerHTML = `<span class="killer">${killer}</span> ${headshot ? '<span class="hs">⚡</span>' : '→'} <span class="victim">${victim}</span>`;
    el.killfeed.prepend(row);
    while (el.killfeed.children.length > 4) {
      el.killfeed.removeChild(el.killfeed.lastChild);
    }
    setTimeout(() => {
      row.style.opacity = '0.3';
    }, 3000);
  }

  function hitMarker(killed, holdMs) {
    if (hitTimer) clearTimeout(hitTimer);
    el.hitmarker.style.opacity = '1';
    el.hitmarker.style.transform = killed ? 'translate(-50%, -50%) scale(1.4)' : 'translate(-50%, -50%) scale(1)';
    if (killed) {
      el.hitmarker.style.borderColor = 'var(--coral)';
    } else {
      el.hitmarker.style.borderColor = 'var(--ink)';
    }
    hitTimer = setTimeout(() => {
      el.hitmarker.style.opacity = '0';
      el.hitmarker.style.transform = 'translate(-50%, -50%) scale(1)';
    }, holdMs || 150);
  }

  function flashDamage() {
    el.vignette.style.opacity = '0.8';
    setTimeout(() => {
      el.vignette.style.opacity = '0.2';
    }, 200);
  }

  function setPlant(progress) {
    if (progress === null || progress === undefined) {
      el.plantBar.style.display = 'none';
    } else {
      el.plantBar.style.display = 'block';
      el.plantFill.style.width = `${Math.round(progress * 100)}%`;
    }
  }

  function showBuy(items) {
    el.buyItems.innerHTML = '';
    items.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'buy-item';
      row.innerHTML = `<span>[${item.key}] ${item.label}</span><span>$${item.price}</span>`;
      row.addEventListener('click', () => {
        if (buyHandler) buyHandler(item.key);
      });
      el.buyItems.appendChild(row);
    });
    el.buyMenu.style.display = 'block';
  }

  function hideBuy() {
    el.buyMenu.style.display = 'none';
  }

  function toast(text) {
    if (toastTimer) clearTimeout(toastTimer);
    el.toast.textContent = text;
    el.toast.style.opacity = '1';
    toastTimer = setTimeout(() => {
      el.toast.style.opacity = '0';
    }, 2500);
  }

  function showOverlay(mode, data) {
    const c = COPY[mode] || COPY.start;
    el.overlayTitle.textContent = c.title;
    el.overlayCopy.textContent = c.copy;
    el.play.textContent = c.action;

    if (mode === 'roundEnd' && data) {
      el.overlayTitle.textContent = `${data.winner} Wins Round`;
      el.overlayCopy.textContent = `${data.reason} — Score: TIDE ${data.scoreTide} - REEF ${data.scoreReef}`;
    } else if (mode === 'matchEnd' && data) {
      el.overlayTitle.textContent = `${data.winner} Wins Match!`;
      el.overlayCopy.textContent = `Final Score: TIDE ${data.scoreTide} - REEF ${data.scoreReef}`;
      el.play.textContent = 'Play Again';
    }

    el.overlay.style.display = 'flex';
  }

  function hideOverlay() {
    el.overlay.style.display = 'none';
  }

  function onPlay(handler) { playHandler = handler; }
  function onBuy(handler) { buyHandler = handler; }
  function onRestart(handler) { restartHandler = handler; }

  const BUY_ITEMS = [
    { key: '1', label: 'P9 Sidearm', price: 0 },
    { key: '2', label: 'KV-9 Carbine', price: 900 },
    { key: '3', label: 'Harborline-90', price: 2200 },
    { key: '4', label: 'Grenade', price: 300 }
  ];
  const WEAPON_LABELS = { pistol: 'P9 Sidearm', rifle: 'KV-9 Carbine', sniper: 'Harborline-90' };
  function updateMoney(n) { setMoney(n); }
  function updateScore(score) { setScore(score.TIDE, score.REEF); }
  function updateWeapon(label) { setWeapon(label); }
  function updateTimer(sec) { setTimer(sec); }
  function showOverlayPaused() { showOverlay('paused'); }
  function toggleBuy(isBuy) { if (isBuy) showBuy(BUY_ITEMS); else hideBuy(); }
  function update(matchObj, weaponObj, playerObj) {
    setAmmo(weaponObj.mag, weaponObj.reserve);
    setHealth(playerObj.health);
    setTimer(matchObj.state.timer);
    setScore(matchObj.state.score.TIDE, matchObj.state.score.REEF);
    setRound(matchObj.state.round, matchObj.MAX_ROUNDS);
    setMoney(matchObj.state.money);
    setWeapon(WEAPON_LABELS[weaponObj.currentName()] || weaponObj.currentName());
  }

  return {
    setAmmo, setHealth, setTimer, setScore, setRound, setMoney, setWeapon, setObjective,
    feed, hitMarker, flashDamage, setPlant, showBuy, hideBuy, toast,
    showOverlay, hideOverlay, onPlay, onBuy, onRestart,
    updateMoney, updateScore, updateWeapon, updateTimer, showOverlayPaused, toggleBuy, update
  };
}