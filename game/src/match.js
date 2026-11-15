import { WEAPONS } from './weapon.js';

// First to five rounds; 4-4 goes to a single deciding round.
const WIN_ROUNDS = 5;
const MAX_ROUNDS = 9;
const ROUND_TIME = 100;
const BUY_TIME = 12;
const PLANT_TIME = 3;
const DEFUSE_TIME = 4;
const FUSE_TIME = 35;
const START_MONEY = 800;
const KILL_MONEY = 300;
const WIN_MONEY = 1400;
const LOSS_MONEY = 900;
const PLANT_MONEY = 300;
const FRAG_PRICE = 300;
const SMOKE_PRICE = 250;

export function createMatch(deps) {
  const { world, player, bots, weapon, hud, sounds } = deps;

  const match = {
    phase: 'lobby',
    round: 1,
    score: { DUNE: 0, VULTURE: 0 },
    money: START_MONEY,
    frags: 0,
    smokes: 0,
    timer: BUY_TIME,
    plantSite: null,
    plantProgress: 0,
    fuseLeft: 0,
    defuseProgress: 0,
    plantedByPlayer: false,
    endAt: 0,
    winner: null,
    roundKills: { DUNE: 0, VULTURE: 0, Sable: 0, Kite: 0, Falcon: 0, Adder: 0, Rook: 0, You: 0 },
    history: [],

    startMatch() {
      this.score.DUNE = 0;
      this.score.VULTURE = 0;
      this.round = 1;
      this.money = START_MONEY;
      this.frags = 0;
      this.smokes = 0;
      this.history = [];
      weapon.equip('pistol');
      bots.spawnAll();
      player.spawn('attack');
      this.phase = 'buy';
      this.timer = BUY_TIME;
      this.plantSite = null;
      this.plantProgress = 0;
      this.fuseLeft = 0;
      this.defuseProgress = 0;
      hud.setRoundHistory(this.history);
      hud.setMoney(this.money);
      hud.setAmmo(weapon.mag, weapon.reserve);
      hud.showOverlay('buy');
      hud.setObjective('Buy phase: gear up and prepare to advance');
    },

    startRound() {
      bots.spawnAll();
      player.spawn('attack');
      weapon.refill();
      this.phase = 'round';
      this.timer = ROUND_TIME;
      this.plantSite = null;
      this.plantProgress = 0;
      this.fuseLeft = 0;
      this.defuseProgress = 0;
      this.roundKills = { DUNE: 0, VULTURE: 0, Sable: 0, Kite: 0, Falcon: 0, Adder: 0, Rook: 0, You: 0 };
      hud.hideOverlay();
      hud.setObjective('Plant the charge at A or B — or eliminate VULTURE');
    },

    endRound(winnerName, reason) {
      this.winner = winnerName;
      this.score[winnerName]++;
      const duneWon = winnerName === 'DUNE';
      this.history.push(duneWon ? 'W' : 'L');
      this.money += duneWon ? WIN_MONEY : LOSS_MONEY;
      hud.setRoundHistory(this.history);
      hud.setMoney(this.money);

      if (duneWon) sounds.win();
      else sounds.lose();

      let bestName = 'You';
      let maxK = -1;
      for (const [name, k] of Object.entries(this.roundKills)) {
        if (k > maxK) {
          maxK = k;
          bestName = name;
        }
      }

      const isMatchOver = this.score.DUNE >= WIN_ROUNDS || this.score.VULTURE >= WIN_ROUNDS || this.round >= MAX_ROUNDS;

      if (isMatchOver) {
        this.phase = 'matchEnd';
        const matchWinner = this.score.DUNE > this.score.VULTURE ? 'DUNE' : 'VULTURE';
        hud.showOverlay('matchEnd', {
          winner: matchWinner,
          reason: 'Match concluded',
          scoreDune: this.score.DUNE,
          scoreVulture: this.score.VULTURE,
          mvp: bestName
        });
      } else {
        this.phase = 'roundEnd';
        hud.showOverlay('roundEnd', {
          winner: winnerName,
          reason,
          scoreDune: this.score.DUNE,
          scoreVulture: this.score.VULTURE,
          mvp: bestName
        });
      }
      this.endAt = performance.now() * 0.001 + 4;
    },

    addKillMoney() {
      this.money += KILL_MONEY;
      hud.setMoney(this.money);
    },

    addKill(name) {
      this.roundKills[name] = (this.roundKills[name] || 0) + 1;
    },

    buyWeapon(name) {
      if (this.phase !== 'buy') return false;
      const def = WEAPONS[name];
      if (!def) return false;
      const price = def.price || 0;
      if (this.money < price || weapon.currentName() === name) return false;
      this.money -= price;
      weapon.equip(name);
      sounds.buy();
      hud.setMoney(this.money);
      hud.setWeapon(def.label);
      return true;
    },

    buyGrenade(kind) {
      if (this.phase !== 'buy') return false;
      const price = kind === 'frag' ? FRAG_PRICE : SMOKE_PRICE;
      const count = kind === 'frag' ? this.frags : this.smokes;
      if (this.money < price || count >= 1) return false;
      this.money -= price;
      if (kind === 'frag') this.frags = 1;
      else this.smokes = 1;
      sounds.buy();
      hud.setMoney(this.money);
      return true;
    },

    useGrenade(kind) {
      if (this.phase !== 'round') return false;
      if (kind === 'frag' && this.frags > 0) {
        this.frags--;
        return true;
      }
      if (kind === 'smoke' && this.smokes > 0) {
        this.smokes--;
        return true;
      }
      return false;
    },

    step(dt, input, time, ctx) {
      if (this.phase === 'buy') {
        this.timer -= dt;
        hud.setTimer(this.timer);
        if (this.timer <= 0) {
          this.startRound();
        }
      } else if (this.phase === 'round') {
        this.timer -= dt;
        hud.setTimer(this.timer);

        if (this.timer <= 0) {
          this.endRound('VULTURE', 'Time expired — site held');
          return;
        }

        if (ctx.playerAlive && input.plantHeld && !this.plantSite) {
          const nearA = ctx.playerPos.distanceTo(world.sites.A) <= 2.5;
          const nearB = ctx.playerPos.distanceTo(world.sites.B) <= 2.5;
          if (nearA || nearB) {
            this.plantProgress += dt;
            hud.setPlant(this.plantProgress / PLANT_TIME);
            if (this.plantProgress >= PLANT_TIME) {
              this.plantSite = nearA ? 'A' : 'B';
              this.fuseLeft = FUSE_TIME;
              this.money += PLANT_MONEY;
              this.plantedByPlayer = true;
              sounds.plantTick();
              hud.setMoney(this.money);
              hud.setObjective(`Charge planted at ${this.plantSite} — defend it`);
              hud.setPlant(null);
            }
          } else {
            this.plantProgress = Math.max(0, this.plantProgress - dt * 2);
            hud.setPlant(this.plantProgress > 0 ? this.plantProgress / PLANT_TIME : null);
          }
        } else {
          this.plantProgress = Math.max(0, this.plantProgress - dt * 2);
          hud.setPlant(this.plantProgress > 0 ? this.plantProgress / PLANT_TIME : null);
        }

        if (this.plantSite) {
          this.fuseLeft -= dt;
          hud.setTimer(this.fuseLeft);
          if (ctx.defuserNear) {
            this.defuseProgress += dt;
            if (this.defuseProgress >= DEFUSE_TIME) {
              this.endRound('VULTURE', 'Charge defused');
              return;
            }
          } else {
            this.defuseProgress = Math.max(0, this.defuseProgress - dt);
          }

          if (this.fuseLeft <= 0) {
            this.endRound('DUNE', 'Charge detonated');
            return;
          }
        }

        if (bots.aliveCount('VULTURE') === 0) {
          this.endRound('DUNE', 'VULTURE eliminated');
          return;
        }
        if (bots.aliveCount('DUNE') === 0 && !ctx.playerAlive) {
          this.endRound('VULTURE', 'DUNE eliminated');
          return;
        }
      } else if (this.phase === 'roundEnd') {
        if (time >= this.endAt) {
          if (this.score.DUNE >= WIN_ROUNDS || this.score.VULTURE >= WIN_ROUNDS || this.round >= MAX_ROUNDS) {
            this.phase = 'matchEnd';
          } else {
            this.round += 1;
            this.phase = 'buy';
            this.timer = BUY_TIME;
            hud.showOverlay('buy');
            hud.setObjective('Buy phase: gear up and prepare');
          }
        }
      }
    }
  };

  return match;
}