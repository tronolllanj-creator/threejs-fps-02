// HUD copy lives in one table so the overlay and the buy menu agree.
const COPY = {
  start: {
    title: 'EMBER CANYON',
    copy: 'Two teams. One charge. First to five rounds takes the canyon. Click to play.',
    action: 'Click to play'
  },
  paused: {
    title: 'PAUSED',
    copy: 'Game paused. Click to resume.',
    action: 'Resume'
  },
  buy: {
    title: 'Buy phase',
    copy: 'Spend your credits. 1 pistol, 2 SMG, 3 rifle, 4 sniper, 5 frag, 6 smoke. B closes.',
    action: 'Close buy menu'
  },
  roundEnd: {
    title: 'ROUND OVER',
    copy: '',
    action: 'Next round'
  },
  matchEnd: {
    title: 'MATCH OVER',
    copy: '',
    action: 'Play again'
  }
};

export function createHud() {
  const el = {};
  const ids = [
    'game', 'hud', 'crosshair', 'hitmarker', 'ammo-mag', 'ammo-reserve',
    'health-fill', 'health-num', 'timer', 'score-dune', 'score-vulture',
    'round-label', 'money', 'weapon-name', 'killfeed', 'overlay',
    'overlay-title', 'overlay-copy', 'overlay-sub', 'play', 'buy-menu',
    'buy-items', 'plant-bar', 'plant-fill', 'objective', 'vignette',
    'toast', 'damage-numbers', 'round-history', 'hit-direction', 'smoke-indicator'
  ];

  for (const id of ids) {
    el[id] = document.getElementById(id);
  }

  let lastMag = -1;
  let lastRes = -1;
  let lastHp = -1;
  let lastTimer = -1;
  let lastDune = -1;
  let lastVulture = -1;
  let lastRound = '';
  let lastMoney = -1;
  let lastWeapon = '';
  let lastObj = '';
  let lastPlant = -1;
  let lastSmoke = false;
  let playHandler = null;
  let buyHandler = null;
  let restartHandler = null;
  let hitmarkerTimer = null;
  let vignetteTimer = null;
  let hitDirTimer = null;
  let toastTimer = null;

  if (el.play) {
    el.play.addEventListener('click', () => {
      if (el.overlay-sub && el.overlay-sub.dataset.mode === 'matchEnd') {
        if (restartHandler) restartHandler();
      } else if (playHandler) {
        playHandler();
      }
    });
  }

  function setAmmo(mag, reserve) {
    if (mag !== lastMag && el['ammo-mag']) {
      lastMag = mag;
      el['ammo-mag'].textContent = mag;
    }
    if (reserve !== lastRes && el['ammo-reserve']) {
      lastRes = reserve;
      el['ammo-reserve'].textContent = reserve;
    }
  }

  function setHealth(hp) {
    if (hp === lastHp) return;
    lastHp = hp;
    if (el['health-num']) el['health-num'].textContent = Math.max(0, Math.ceil(hp));
    if (el['health-fill']) {
      el['health-fill'].style.width = Math.max(0, Math.min(100, hp)) + '%';
      if (hp < 30) {
        el['health-fill'].style.background = '#e04e3a';
      } else {
        el['health-fill'].style.background = '';
      }
    }
  }

  function setTimer(seconds) {
    if (seconds === lastTimer) return;
    lastTimer = seconds;
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const text = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    if (el.timer) {
      el.timer.textContent = text;
      if (seconds < 10) {
        el.timer.style.color = '#e04e3a';
      } else {
        el.timer.style.color = '';
      }
    }
  }

  function setScore(dune, vulture) {
    if (dune === lastDune && vulture === lastVulture) return;
    lastDune = dune;
    lastVulture = vulture;
    if (el['score-dune']) el['score-dune'].textContent = dune;
    if (el['score-vulture']) el['score-vulture'].textContent = vulture;
  }

  function setRound(n, max) {
    const label = 'Round ' + n + ' / ' + max;
    if (label === lastRound) return;
    lastRound = label;
    if (el['round-label']) el['round-label'].textContent = label;
  }

  function setMoney(n) {
    if (n === lastMoney) return;
    lastMoney = n;
    if (el.money) el.money.textContent = '$' + n;
  }

  function setWeapon(label) {
    if (label === lastWeapon) return;
    lastWeapon = label;
    if (el['weapon-name']) el['weapon-name'].textContent = label;
  }

  function setObjective(text) {
    if (text === lastObj) return;
    lastObj = text;
    if (el.objective) el.objective.textContent = text;
  }

  function feed(killer, victim, headshot) {
    if (!el.killfeed) return;
    const row = document.createElement('div');
    row.className = 'killfeed-row';
    const hsStr = headshot ? ' [HEADSHOT]' : '';
    row.textContent = killer + ' \u2192 ' + victim + hsStr;
    el.killfeed.prepend(row);
    while (el.killfeed.children.length > 4) {
      el.killfeed.removeChild(el.killfeed.lastChild);
    }
    setTimeout(() => {
      row.style.opacity = '0';
      setTimeout(() => {
        if (row.parentNode) row.parentNode.removeChild(row);
      }, 500);
    }, 3500);
  }

  function hitMarker(killed, holdMs) {
    if (!el.hitmarker) return;
    if (hitmarkerTimer) clearTimeout(hitmarkerTimer);
    el.hitmarker.style.opacity = '1';
    el.hitmarker.style.transform = killed ? 'translate(-50%, -50%) scale(1.4)' : 'translate(-50%, -50%) scale(1)';
    hitmarkerTimer = setTimeout(() => {
      if (el.hitmarker) {
        el.hitmarker.style.opacity = '0';
        el.hitmarker.style.transform = 'translate(-50%, -50%) scale(1)';
      }
    }, holdMs || 150);
  }

  function flashDamage() {
    if (!el.vignette) return;
    if (vignetteTimer) clearTimeout(vignetteTimer);
    el.vignette.style.boxShadow = 'inset 0 0 80px rgba(224, 78, 58, 0.7)';
    vignetteTimer = setTimeout(() => {
      if (el.vignette) {
        el.vignette.style.boxShadow = '';
      }
    }, 300);
  }

  function setPlant(progress) {
    if (progress === lastPlant) return;
    lastPlant = progress;
    if (!el['plant-bar']) return;
    if (progress === null || progress <= 0) {
      el['plant-bar'].style.display = 'none';
    } else {
      el['plant-bar'].style.display = 'block';
      if (el['plant-fill']) {
        el['plant-fill'].style.width = Math.max(0, Math.min(100, progress * 100)) + '%';
      }
    }
  }

  function showBuy(items) {
    if (!el['buy-menu'] || !el['buy-items']) return;
    el['buy-items'].innerHTML = '';
    for (const item of items) {
      const row = document.createElement('div');
      row.className = 'buy-item-row';
      row.textContent = item.key + ' \u2014 ' + item.label + ' \u2014 $' + item.price + ' \u2014 ' + item.stats;
      row.addEventListener('click', () => {
        if (buyHandler) buyHandler(item.key);
      });
      el['buy-items'].appendChild(row);
    }
    el['buy-menu'].style.display = 'block';
  }

  function hideBuy() {
    if (el['buy-menu']) el['buy-menu'].style.display = 'none';
  }

  function toast(text) {
    if (!el.toast) return;
    el.toast.textContent = text;
    el.toast.style.opacity = '1';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      if (el.toast) el.toast.style.opacity = '0';
    }, 2500);
  }

  function damageNumber(amount, x, y) {
    if (!el['damage-numbers']) return;
    const d = document.createElement('div');
    d.className = 'damage-num';
    d.textContent = Math.round(amount);
    d.style.left = x + 'px';
    d.style.top = y + 'px';
    el['damage-numbers'].appendChild(d);
    setTimeout(() => {
      if (d.parentNode) d.parentNode.removeChild(d);
    }, 800);
  }

  function setRoundHistory(results) {
    if (!el['round-history']) return;
    el['round-history'].innerHTML = '';
    for (const r of results) {
      const chip = document.createElement('div');
      chip.className = 'round-chip ' + (r ? 'win' : 'loss');
      chip.textContent = r ? 'W' : 'L';
      el['round-history'].appendChild(chip);
    }
  }

  function hitDirection(angle) {
    if (!el['hit-direction']) return;
    if (hitDirTimer) clearTimeout(hitDirTimer);
    el['hit-direction'].style.transform = 'translate(-50%, -50%) rotate(' + angle + 'rad)';
    el['hit-direction'].style.opacity = '1';
    hitDirTimer = setTimeout(() => {
      if (el['hit-direction']) el['hit-direction'].style.opacity = '0';
    }, 600);
  }

  function setSmoke(active) {
    if (active === lastSmoke) return;
    lastSmoke = active;
    if (el['smoke-indicator']) {
      el['smoke-indicator'].style.display = active ? 'block' : 'none';
    }
  }

  function showOverlay(mode, data) {
    if (!el.overlay) return;
    el.overlay.style.display = 'flex';
    const cfg = COPY[mode] || COPY.start;
    if (el['overlay-title']) el['overlay-title'].textContent = cfg.title;
    if (el['overlay-copy']) {
      if (mode === 'roundEnd' && data) {
        el['overlay-copy'].textContent = data.winner + ' wins the round! Reason: ' + data.reason + '. MVP: ' + data.mvp;
      } else if (mode === 'matchEnd' && data) {
        el['overlay-copy'].textContent = data.winner + ' takes the match! Final score: Dune ' + data.scoreDune + ' - ' + data.scoreVulture;
      } else {
        el['overlay-copy'].textContent = cfg.copy;
      }
    }
    if (el.play) el.play.textContent = cfg.action;
    if (el['overlay-sub']) el['overlay-sub'].dataset.mode = mode;
  }

  function hideOverlay() {
    if (el.overlay) el.overlay.style.display = 'none';
  }

  function onPlay(handler) {
    playHandler = handler;
  }

  function onBuy(handler) {
    buyHandler = handler;
  }

  function onRestart(handler) {
    restartHandler = handler;
  }

  return {
    setAmmo,
    setHealth,
    setTimer,
    setScore,
    setRound,
    setMoney,
    setWeapon,
    setObjective,
    feed,
    hitMarker,
    flashDamage,
    setPlant,
    showBuy,
    hideBuy,
    toast,
    damageNumber,
    setRoundHistory,
    hitDirection,
    setSmoke,
    showOverlay,
    hideOverlay,
    onPlay,
    onBuy,
    onRestart
  };
}