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
const GRENADE_PRICE = 300;

export function createMatch(deps) {
    const { world, player, bots, weapon, hud, sounds } = deps;

    const state = {
        phase: 'lobby',
        round: 1,
        score: { TIDE: 0, REEF: 0 },
        money: START_MONEY,
        grenades: 0,
        timer: BUY_TIME,
        plantSite: null,
        plantProgress: 0,
        fuseLeft: 0,
        defuseProgress: 0,
        plantedByPlayer: false,
        endAt: 0,
        winner: null
    };

    const SITES = {
        A: { x: -16, z: -10 },
        B: { x: 16, z: -10 }
    };

    function startMatch() {
        state.score.TIDE = 0;
        state.score.REEF = 0;
        state.round = 1;
        state.money = START_MONEY;
        state.grenades = 0;
        weapon.equip('pistol');
        startRoundSetup();
        state.phase = 'buy';
        state.timer = BUY_TIME;
        hud.showOverlay('buy');
        hud.updateMoney(state.money);
        hud.updateScore(state.score);
        hud.setObjective('Plant the charge at A or B — or eliminate REEF');
    }

    function startRoundSetup() {
        bots.spawnAll();
        player.spawn(false);
        weapon.refill();
        state.plantSite = null;
        state.plantProgress = 0;
        state.fuseLeft = 0;
        state.defuseProgress = 0;
        state.plantedByPlayer = false;
    }

    function startRound() {
        startRoundSetup();
        state.phase = 'round';
        state.timer = ROUND_TIME;
        hud.hideOverlay();
        hud.setObjective('Plant the charge at A or B — or eliminate REEF');
    }

    function endRound(winner, reason) {
        state.winner = winner;
        state.score[winner]++;
        state.money += (winner === 'TIDE' ? WIN_MONEY : LOSS_MONEY);
        if (winner === 'TIDE') {
            sounds.win();
        } else {
            sounds.lose();
        }

        hud.showOverlay('roundEnd', {
            winner,
            reason,
            scoreTide: state.score.TIDE,
            scoreReef: state.score.REEF
        });
        hud.updateScore(state.score);

        state.phase = 'roundEnd';
        state.endAt = performance.now() / 1000 + 4;
    }

    function addKillMoney() {
        state.money += KILL_MONEY;
        hud.updateMoney(state.money);
    }

    function buyWeapon(name) {
        if (state.phase !== 'buy') return false;
        const def = WEAPONS[name];
        if (!def) return false;
        if (weapon.currentName() === name) return false;
        const price = def.price || 0;
        if (state.money < price) return false;

        state.money -= price;
        weapon.equip(name);
        sounds.buy();
        hud.updateMoney(state.money);
        hud.updateWeapon(def.label);
        return true;
    }

    function buyGrenade() {
        if (state.phase !== 'buy') return false;
        if (state.money < GRENADE_PRICE || state.grenades >= 1) return false;
        state.money -= GRENADE_PRICE;
        state.grenades = 1;
        sounds.buy();
        hud.updateMoney(state.money);
        return true;
    }

    function useGrenade() {
        if (state.grenades > 0 && state.phase === 'round') {
            state.grenades -= 1;
            return true;
        }
        return false;
    }

    function step(dt, input, time, ctx) {
        const { playerAlive, playerPos, defuserNear } = ctx;

        if (state.phase === 'buy') {
            state.timer -= dt;
            hud.updateTimer(state.timer);
            if (state.timer <= 0) {
                startRound();
            }
        } else if (state.phase === 'round') {
            state.timer -= dt;
            hud.updateTimer(state.timer);

            if (state.timer <= 0) {
                endRound('REEF', 'Time expired — site held');
                return;
            }

            // Planting logic
            if (!state.plantSite) {
                let nearSite = null;
                for (const [name, pos] of Object.entries(SITES)) {
                    const dx = playerPos.x - pos.x;
                    const dz = playerPos.z - pos.z;
                    if (dx * dx + dz * dz <= 2.5 * 2.5) {
                        nearSite = name;
                        break;
                    }
                }

                if (playerAlive && input.plantHeld && nearSite) {
                    state.plantProgress += dt;
                    hud.setPlant(state.plantProgress / PLANT_TIME);
                    if (state.plantProgress >= PLANT_TIME) {
                        state.plantSite = nearSite;
                        state.fuseLeft = FUSE_TIME;
                        state.plantedByPlayer = true;
                        state.money += PLANT_MONEY;
                        hud.updateMoney(state.money);
                        sounds.plantTick();
                        hud.setObjective('Charge planted — defend it');
                        hud.setPlant(null);
                    }
                } else {
                    state.plantProgress = Math.max(0, state.plantProgress - dt * 2);
                    hud.setPlant(state.plantProgress > 0 ? state.plantProgress / PLANT_TIME : null);
                }
            } else {
                // Fuse countdown
                state.fuseLeft -= dt;
                hud.updateTimer(state.fuseLeft);

                if (state.fuseLeft <= 0) {
                    endRound('TIDE', 'Charge detonated');
                    return;
                }

                // Defuse logic
                if (defuserNear) {
                    state.defuseProgress += dt;
                    if (state.defuseProgress >= DEFUSE_TIME) {
                        endRound('REEF', 'Charge defused');
                        return;
                    }
                } else {
                    state.defuseProgress = Math.max(0, state.defuseProgress - dt * 1.5);
                }
            }

            // Elimination check
            if (bots.aliveCount('REEF') === 0) {
                endRound('TIDE', 'REEF eliminated');
            } else if (bots.aliveCount('TIDE') === 0 && !playerAlive) {
                endRound('REEF', 'TIDE eliminated');
            }
        } else if (state.phase === 'roundEnd') {
            if (time >= state.endAt) {
                if (state.score.TIDE >= WIN_ROUNDS || state.score.REEF >= WIN_ROUNDS || state.round >= MAX_ROUNDS) {
                    state.phase = 'matchEnd';
                    const matchWinner = state.score.TIDE > state.score.REEF ? 'TIDE' : 'REEF';
                    hud.showOverlay('matchEnd', {
                        winner: matchWinner,
                        scoreTide: state.score.TIDE,
                        scoreReef: state.score.REEF
                    });
                } else {
                    state.round += 1;
                    state.phase = 'buy';
                    state.timer = BUY_TIME;
                    hud.showOverlay('buy');
                    hud.updateMoney(state.money);
                    hud.setObjective('Plant the charge at A or B — or eliminate REEF');
                }
            }
        }
    }

    function isOver() { return state.phase === 'matchEnd'; }
    function isPlaying() { return state.phase === 'buy' || state.phase === 'round'; }
    function isBuyPhase() { return state.phase === 'buy'; }
    function playerDied() { endRound('REEF', 'You were eliminated'); }
    function spectating() { return false; }
    function getSpectateTarget() { return null; }
    function forcePhase(phase, timer) {
        state.phase = phase;
        if (timer !== undefined) state.timer = timer;
    }

    return {
        state,
        WIN_ROUNDS,
        MAX_ROUNDS,
        startMatch,
        startRound,
        endRound,
        addKillMoney,
        buyWeapon,
        buyGrenade,
        useGrenade,
        step,
        isOver,
        isPlaying,
        isBuyPhase,
        playerDied,
        spectating,
        getSpectateTarget,
        forcePhase
    };
}
