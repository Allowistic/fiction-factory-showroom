# Prop credits (assets/props/)

| File | Source | Author | License |
|---|---|---|---|
| kenney_desk.glb, kenney_table.glb (fallback only), kenney_chairDesk.glb, kenney_bookcaseOpenLow.glb | https://kenney.nl/assets/furniture-kit (Furniture Kit 2.0) | Kenney (www.kenney.nl) | CC0 1.0 |
| cnc.glb ("CNC Table") | https://poly.pizza/m/4CNKV3tEKzb | Jerry (poly.pizza/u/Jerry) | CC-BY 3.0 |

The 1970s props (home computer + CRT, drafting lamp, rotary phone, hi-fi, clock, macramé plant, globe and dome pendants, pegboard, rug, posters, lava lamp) are built procedurally in `seventies.js`. They have no third-party assets.
CC-BY attribution: "CNC Table" by Jerry, CC-BY 3.0, via poly.pizza.

## Cantina pieces (assets/builds-opt/)
Full notes are in [../builds-opt/CREDITS_cantina.md](../builds-opt/CREDITS_cantina.md).

| File | Source | Author | License |
|---|---|---|---|
| cantina_bar, cantina_back_bar, cantina_stools, cantina_booth, cantina_prop_* (10) | Original procedural geometry (Blender 4.3) | Clay | Original, no Star Wars IP |
| Textures baked into cantina_*_atlas.jpg: Wood066, Metal032, Leather037, Metal046B | https://ambientcg.com | ambientCG | CC0 1.0 |
| ent_center_bar.glb | Vincent's Marcos Bini entertainment center design, baked by Clay (Lebombo HDRI from Poly Haven, CC0, not embedded) | Vincent / Clay | Owner's design |
| showroom/tv-bombshell.jpg (TV snapshot) | Screenshot of https://bombshelldiscovery.org | Bombshell Discovery | Shown as the site itself |


## Music: DJ booth (showroom/audio/)

From Dex's web-booth package (`/workspace/dj-vj-bot/web-booth/`), copied unchanged. `mix.mp3` (320k) is not used.

### Free Mix 2026-10-17 (`free-mix-2026-10-17.ogg` / `.mp3`)

License of the mix: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Short credit, shown on the booth screen footer and in the panel:

> Mix by Dex for Vincent, CC BY-SA 4.0. Music: otto von disko, Klaus PP & Sloxxx (unfoundsound, CC BY 4.0); Sir Leaks, Spirit Come First, Galería Disco (Monofónicos, CC BY-SA); Microfluid (Taktalsmittel, CC BY-SA 3.0); Mehta (Yarn Audio, CC BY 4.0). Full credits in `free-mix-2026-10-17.cues.json`.

Full attribution (`credits[]` in the cues file):

- haunting memories by otto von disko, from [unfound88] happy in novi sad (unfoundsound). https://archive.org/details/unfound88 — CC BY 4.0
- aestate by Klaus PP & Sloxxx, from [unfound88] happy in novi sad (unfoundsound). https://archive.org/details/unfound88 — CC BY 4.0
- Sonidos Bajotierra by Sir Leaks (Carlos Alfredo Ruiz), from MNF018 (Monofónicos). https://archive.org/details/MNF018_Sir_Leaks--Sonidos_Bajotierra — CC BY-SA 3.0
- Convection by Spirit Come First, from MNF032 1993 Again EP (Monofónicos). https://archive.org/details/MNF032_Spirit_Come_First--1993_Again_EP — CC BY-SA 4.0
- Morning Monochrome by Microfluid, from Autobiography [TAM026] (Taktalsmittel). https://archive.org/details/TAM026-microfluid — CC BY-SA 3.0
- Bngrv by Mehta, from Aimlessly Wandering / Bngrv [YARN013] (Yarn Audio). https://archive.org/details/yarn013 — CC BY 4.0
- Memorias by Galería Disco, from MNF015 Memorias EP (Monofónicos). https://archive.org/details/MNF015_Galeria_Disco--Memorias_EP — CC BY-SA 3.0
- Mix by Dex for Vincent. Every track was excerpted, time-stretched, EQ'd/filtered, crossfaded, loudness-normalized and limited. Derivative work shared under CC BY-SA 4.0.

### Scratch demo (`scratch-demo.mp3`)

License: Original, cleared for public use (Fiction Factory).

> Scratch demo by Dex. Fully synthesized — no commercial recordings. Cleared for public use in the Fiction Factory showroom.

- Fully synthesized by Dex on 2026-10-17. No commercial recordings used.
- Drums, bass, Em7 horn stab, vinyl noise, and 'ahhh' tone: original synthesis (numpy/scipy).
- Voice calls (check it out / fresh / yeah / come on): espeak-ng TTS output; program is GPLv3, audio output free to use.
- License: Original, cleared for public use (Fiction Factory).

### Booth robots / hardware

The bartender, Dex, and the booth counter/decks/mixer are procedural placeholders written for the showroom (original, no third-party assets). Clay's models replace them later.

## Owl Cove Tiki Nest booth screen visualizer (showroom/visualizer.js)
Original code written for this project (hand-rolled Canvas2D LED spectrum + oscilloscope, Web Audio `AnalyserNode`). No third-party visualizer library is vendored or loaded, so no extra licence applies. Look per Nova's direction (2026-10-17).

