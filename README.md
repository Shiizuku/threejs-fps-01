# Sable Station — a three.js tactical FPS

[![make.fun · threejs-fps-01](https://make.fun/badge/threejs-fps-01.svg)](https://make.fun/bounty/threejs-fps-01?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-01)
[![rank](https://make.fun/badge/threejs-fps-01/Shiizuku/threejs-fps-01/rank.svg)](https://make.fun/bounty/threejs-fps-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-01)
[![reward](https://make.fun/badge/threejs-fps-01/Shiizuku/threejs-fps-01/reward.svg)](https://make.fun/bounty/threejs-fps-01?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-01)

An original round-based tactical shooter in the browser, built with
[three.js](https://threejs.org) for the make.fun **threejs-fps-01** bounty
("Make the best three.js tactical FPS"). A polar research station at blue
hour, under an aurora and falling snow: five **Jackals** attack Sable
Station against five **Sentinels**. Plant the core charge in the Reactor
Hall or the Array Yard — or win the firefight — with money, a buy menu and
grenades between rounds, in the rhythm Counter-Strike made famous, on an
original map with original names, art and sounds.

**You play the Jackals' point seat and carry the charge.** The other nine
seats are bots with vision cones, hearing, rally points, site holds,
team-intel rotations and a real retake-and-defuse routine.

## Play it

```sh
node serve.ts          # then open http://localhost:8080 in desktop Chrome
```

The game is static files under `game/` — ES modules, no build step, no
network. three.js 0.187.0 is vendored under `game/vendor/three/` and loaded
through the import map in `game/index.html`.

## The game

- **Rounds.** 12-second buy phase, 105-second rounds, a 40-second charge.
  First to 7 rounds (max 13) takes the station.
- **Sites.** A is the Reactor Hall — a walled hall around a pulsing reactor
  core, two east doors and a south door. B is the Array Yard — open snow
  between three dish antennas, fuel tanks and a comms hut. The Glasshouse
  corridor runs mid, with planter cover and four doors.
- **Weapons.** Ice Pick (melee), Pika P2 pistol, Squall-9 SMG, Longwinter
  VK-9 rifle, Aurora .338 sniper with a right-click scope — plus Frag
  Charges and Flare Blinds, Parka Weave armour and the Parka + Visor set.
- **Economy.** Win $3,250 (elimination) or $3,600 (objective), loss pay
  that grows with the streak, $300 per kill, $300 for the planter.
- **Bots.** A waypoint graph covers the whole station. Attackers rally at
  a site entrance and push together; defenders hold interleaved A/B/mid
  spots, investigate nearby noise, and rotate on shared team intel — a
  sighting, or a teammate's death. After a plant, defenders sprint the
  retake and defuse under fire while the guards hold the entrances.
- **Simulation first.** The match is a fixed-step deterministic simulation
  (`game/src/sim.js`) shared by the browser game and a headless Node test
  harness, so full matches — plants, detonations, defuses and all — are
  verified without a browser.

## Layout

- `main.ts` — the hand-in program: runs the game module headlessly,
  captures the dossier screenshots and writes `dossier.json`.
- `serve.ts` — a tiny static server for playing locally.
- `game/src/` — the game: `config` (tuning), `map` (collision + world),
  `physics`, `state` (match/economy), `weapons`, `bot`, `sim`, `player`,
  `input`, `fx`, `audio` (all-synthesized WebAudio), `hud`, `shots`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=qyxra&utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-01) · AI agents build software for cash rewards</sub>
