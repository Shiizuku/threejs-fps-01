// Sable Station — HUD: DOM overlays driven by the match state each frame.
// Owns the buy menu; the buy key list is exported so main.js can route
// number keys to purchases while the menu is open.

import { MATCH, WEAPONS } from './config.js';
import { ammoOf, currentWeapon } from './state.js';

export const BUY_ITEMS = [
  { key: 'Digit1', id: 'squall', label: 'Squall-9 SMG' },
  { key: 'Digit2', id: 'longwinter', label: 'Longwinter VK-9' },
  { key: 'Digit3', id: 'aurora', label: 'Aurora .338' },
  { key: 'Digit4', id: 'vest', label: 'Parka Weave' },
  { key: 'Digit5', id: 'vestHelm', label: 'Parka + Visor' },
  { key: 'Digit6', id: 'frag', label: 'Frag Charge' },
  { key: 'Digit7', id: 'flare', label: 'Flare Blind' },
];

export function priceOf(id) {
  if (WEAPONS[id]) return WEAPONS[id].price;
  return { vest: 650, vestHelm: 1000, frag: 300, flare: 200 }[id] ?? 0;
}

function ownedBy(player, id) {
  if (WEAPONS[id]) {
    return player.weapons.primary === id || player.weapons.sidearm === id;
  }
  if (id === 'vest') return player.armor !== 'none';
  if (id === 'vestHelm') return player.armor === 'vestHelm';
  if (id === 'frag') return player.nades.frag > 0;
  if (id === 'flare') return player.nades.flare >= 2;
  return false;
}

const $ = (id) => document.getElementById(id);

export function createHud() {
  const feed = [];
  let bannerT = 0;
  let lastRound = 0;
  let lastPhase = '';

  const buyRows = $('buyRows');
  buyRows.innerHTML = BUY_ITEMS.map((item, i) => (
    `<div class="row" id="buy-${item.id}"><span><span class="key">${i + 1}</span>${item.label}</span><span>$${priceOf(item.id)}</span></div>`
  )).join('');

  function fmtTime(seconds) {
    const s = Math.max(0, Math.ceil(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  return {
    showBanner(title, sub, seconds = 3) {
      $('bannerTitle').textContent = title;
      $('bannerSub').textContent = sub;
      bannerT = seconds;
    },
    update(state, dt) {
      const player = state.fighters.find((f) => f.isPlayer);
      if (!player) return;

      // Round and phase changes get banners.
      if (state.round !== lastRound) {
        lastRound = state.round;
        if (state.round > 1 && state.phase === 'buy') {
          this.showBanner(`ROUND ${state.round}`, 'Buy your kit', 2);
        }
      }
      if (state.phase !== lastPhase) {
        if (state.phase === 'matchover') {
          const won = state.winner === 'atk';
          this.showBanner(won ? 'STATION TAKEN' : 'STATION LOST', `Final score ${state.scores.atk} — ${state.scores.def}`, 60);
        }
        lastPhase = state.phase;
      }
      for (const ev of state.events) {
        if (ev.type === 'kill') {
          const a = state.fighters.find((f) => f.id === ev.attacker);
          const t = state.fighters.find((f) => f.id === ev.target);
          feed.unshift(`${a ? a.name : '—'} ▸ ${t ? t.name : '—'}${ev.head ? ' (headshot)' : ''}`);
          if (feed.length > 5) feed.pop();
        }
        if (ev.type === 'planted') this.showBanner('CHARGE PLANTED', `Site ${ev.site} — ${MATCH.chargeSeconds} seconds`, 2.5);
        if (ev.type === 'hit' && ev.attacker === player.id) {
          $('hitmarker').style.opacity = 1;
          setTimeout(() => { $('hitmarker').style.opacity = 0; }, 90);
        }
      }
      if (state.roundWinner && state.phase === 'over' && bannerT <= 0) {
        const won = state.roundWinner === 'atk';
        this.showBanner(won ? 'ROUND WON' : 'ROUND LOST', `${state.scores.atk} — ${state.scores.def}`, 3.5);
      }
      bannerT -= dt;
      const showBannerNow = bannerT > 0;
      $('bannerTitle').style.opacity = showBannerNow ? 1 : 0;
      $('bannerSub').style.opacity = showBannerNow ? 1 : 0;

      $('feed').innerHTML = feed.join('<br>');
      $('timer').textContent = state.phase === 'planted'
        ? fmtTime(state.charge.t)
        : fmtTime(state.phaseT);
      $('score').innerHTML = `<span class="atk">JACKALS ${state.scores.atk}</span> · <span class="def">${state.scores.def} SENTINELS</span>`;
      $('phase').textContent = {
        buy: 'Buy phase', live: state.charge.state === 'dropped' ? 'Charge dropped' : 'Round live',
        planted: `Charge planted — site ${state.charge.site}`, over: 'Round over', matchover: 'Match over',
      }[state.phase] ?? '';

      $('health').textContent = Math.max(0, Math.round(player.health));
      $('health').style.color = player.health <= 30 ? '#ff7a6b' : '#eef4fa';
      $('armor').textContent = player.armor === 'none' ? '' : player.armor === 'vest' ? '❄ Parka Weave' : '❄ Parka + Visor';
      $('money').textContent = `$${player.money}`;

      const w = currentWeapon(player);
      const ammo = ammoOf(player, w.id);
      $('weaponName').textContent = w.name;
      $('ammo').textContent = w.mag === Infinity ? '—' : `${ammo.mag} / ${ammo.reserve}`;
      $('nades').textContent = `4 Frag ×${player.nades.frag} · 5 Flare ×${player.nades.flare}`;
      $('crosshair').style.opacity = player.alive ? 0.85 : 0;

      // Plant / defuse progress for the player.
      let progress = null;
      if (player.hasCharge && player.plantT > 0) {
        progress = { label: 'PLANTING THE CHARGE', frac: player.plantT / MATCH.plantSeconds };
      } else if (player.defuseT > 0) {
        progress = { label: 'DEFUSING', frac: player.defuseT / MATCH.defuseSeconds };
      }
      $('progress').style.display = progress ? 'block' : 'none';
      if (progress) {
        $('progressLabel').textContent = progress.label;
        $('progressBar').style.width = `${Math.min(100, progress.frac * 100)}%`;
      }

      $('vignette').style.opacity = player.hurtT > 0 ? 0.9 : Math.max(0, parseFloat($('vignette').style.opacity || 0) - dt * 1.5);
      $('blind').style.opacity = Math.min(1, (player.blindT ?? 0) / 1.6);

      // Buy menu
      const showBuy = state.phase === 'buy' && player.alive;
      $('buyMenu').style.display = showBuy ? 'block' : 'none';
      if (showBuy) {
        for (const item of BUY_ITEMS) {
          const row = $(`buy-${item.id}`);
          row.className = 'row' + (ownedBy(player, item.id) ? ' owned' : player.money < priceOf(item.id) ? ' cant' : '');
        }
      }
      return showBuy;
    },
  };
}
