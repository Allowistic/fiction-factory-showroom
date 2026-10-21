// DJ booth / light-show config (Dex). Edit here; nothing else needs to change.
export const DJ_CONFIG = {
  // Rendered sets from Dex's web-booth package (copied into showroom/audio/). .ogg preferred, .mp3 fallback.
  // mp3Offset: Dex's MP3s start ~25 ms late vs the cue grid -> mix time = audio.currentTime - 0.025 when the MP3 is playing.
  SETS: [
    { id: 'free-mix-2026-10-17', label: 'Free Mix 2026-10-17', ogg: 'audio/free-mix-2026-10-17.ogg', mp3: 'audio/free-mix-2026-10-17.mp3', mp3Offset: 0.025,
      cues: 'audio/free-mix-2026-10-17.cues.json', lights: 'audio/free-mix-2026-10-17.lights.json', peaks: 'audio/free-mix-2026-10-17.peaks.json',
      credit: 'Mix by Dex for Vincent, CC BY-SA 4.0. Music: otto von disko, Klaus PP & Sloxxx (unfoundsound, CC BY 4.0); Sir Leaks, Spirit Come First, Galería Disco (Monofónicos, CC BY-SA); Microfluid (Taktalsmittel, CC BY-SA 3.0); Mehta (Yarn Audio, CC BY 4.0). Full credits in free-mix-2026-10-17.cues.json.' }, // README "Short credit (UI / footer)" (markdown backticks dropped)
    { id: 'scratch-demo', label: 'Scratch demo', mp3: 'audio/scratch-demo.mp3', mp3Offset: 0.025,
      cues: 'audio/scratch-demo.cues.json', lights: 'audio/scratch-demo.lights.json', peaks: 'audio/scratch-demo.peaks.json',
      credit: 'Scratch demo by Dex. Fully synthesized — no commercial recordings. Cleared for public use in the Fiction Factory showroom.' },
  ],
  AUDIO_URL: null,      // optional live stream (Icecast / HLS URL). null = none (Dex has no public stream yet). Overrides SETS when set; no cue sidecar -> analyser beat estimate.
  LIGHTSHOW_WS: null,   // optional ws(s):// URL for live cue messages in the .lights.json cue shape (future OSC bridge). Stub: null = off.
  SAFETY: { maxFlashHz: 3.0 }, // strobe / pulse cap (Dex: <= 3 Hz). Spots are fixed downlights onto the decks: they never aim at visitors or the camera.
  // Dex set reach targets (dex-set.js DEX_TARGETS shape, booth-local m). Set to '../assets/builds-opt/owlcove_booth_positions.json' once Clay ships it; null = built-in defaults.
  DEX_TARGETS_URL: null,
  // Full music credits: shown on the guestbook's "Music credits" page (book / XR read view / HTML modal). Same text as assets/props/CREDITS.md.
  MUSIC_CREDITS: [
    { title: 'Free Mix 2026-10-17', license: 'CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/)',
      short: 'Mix by Dex for Vincent, CC BY-SA 4.0. Music: otto von disko, Klaus PP & Sloxxx (unfoundsound, CC BY 4.0); Sir Leaks, Spirit Come First, Galería Disco (Monofónicos, CC BY-SA); Microfluid (Taktalsmittel, CC BY-SA 3.0); Mehta (Yarn Audio, CC BY 4.0). Full credits in free-mix-2026-10-17.cues.json.',
      lines: ['haunting memories by otto von disko, from [unfound88] happy in novi sad (unfoundsound). https://archive.org/details/unfound88 — CC BY 4.0',
        'aestate by Klaus PP & Sloxxx, from [unfound88] happy in novi sad (unfoundsound). https://archive.org/details/unfound88 — CC BY 4.0',
        'Sonidos Bajotierra by Sir Leaks (Carlos Alfredo Ruiz), from MNF018 (Monofónicos). https://archive.org/details/MNF018_Sir_Leaks--Sonidos_Bajotierra — CC BY-SA 3.0',
        'Convection by Spirit Come First, from MNF032 1993 Again EP (Monofónicos). https://archive.org/details/MNF032_Spirit_Come_First--1993_Again_EP — CC BY-SA 4.0',
        'Morning Monochrome by Microfluid, from Autobiography [TAM026] (Taktalsmittel). https://archive.org/details/TAM026-microfluid — CC BY-SA 3.0',
        'Bngrv by Mehta, from Aimlessly Wandering / Bngrv [YARN013] (Yarn Audio). https://archive.org/details/yarn013 — CC BY 4.0',
        'Memorias by Galería Disco, from MNF015 Memorias EP (Monofónicos). https://archive.org/details/MNF015_Galeria_Disco--Memorias_EP — CC BY-SA 3.0',
        "Mix by Dex for Vincent. Every track was excerpted, time-stretched, EQ'd/filtered, crossfaded, loudness-normalized and limited. Derivative work shared under CC BY-SA 4.0."] },
    { title: 'Scratch demo', license: 'Original, cleared for public use (Fiction Factory).',
      short: 'Scratch demo by Dex. Fully synthesized — no commercial recordings. Cleared for public use in the Fiction Factory showroom.',
      lines: ['Fully synthesized by Dex on 2026-10-17. No commercial recordings used.', "Drums, bass, Em7 horn stab, vinyl noise, and 'ahhh' tone: original synthesis (numpy/scipy).",
        'Voice calls (check it out / fresh / yeah / come on): espeak-ng TTS output; program is GPLv3, audio output free to use.', 'License: Original, cleared for public use (Fiction Factory).'] },
  ],
  // booth pool (Owl Cove, Nova): fixture-0 cone level (linear, additive) and the warm real-time light over the decks
  BOOTH_POOL: { color: '#e8a04a', cone: 0.07, light: 1.1, lightIdle: 0.9 },
  // ONE swappable palette: overrides colour names used by the .lights.json cues (names not listed keep the file's palette).
  PALETTE: { teal: '#c8642c' }, // Nova: show beams read warm, never green -> Dex's 'teal' cues render ember (other names keep Dex's palette)
  REQUESTS: { enabled: false, note: 'Requests coming soon' }, // placeholder: the form sends nowhere and stores nothing
  // Owl Cove booth screen visualizer (visualizer.js, hand-rolled Canvas2D). Nova's look, 2026-10-17: 70s hi-fi LED meter. Colours / ballistics live here.
  VISUALIZER: {
    ASPECT: 2.715,        // owlcove dj-screen: arc length 2.443 m / height 0.9 m. Canvas width / height; UV stays 0..1.
    WIDTH: { xr: 512, touch: 512, desktop: 1024 }, // canvas width in px (height = width / ASPECT). XR budget: <= 512 x 256
    FPS: 30, IDLE_FPS: 10, // texture updates per second while playing / paused (XR budget: <= 30)
    BARS: 32, SEGMENTS: 18, F_MIN: 40, F_MAX: 16000, // log-spaced bands
    FFT: 2048, MIN_DB: -72, MAX_DB: -20, TILT: 0.10, // analyser dB window; TILT lifts the treble bars (music falls off with frequency)
    ATTACK_MS: 70, RELEASE_MS: 650,  // bar ballistics (exponential time constants)
    PEAK_HOLD_MS: 600, PEAK_FALL: 0.28, // peak caps: hold, then fall at 0.28 bar-heights per second
    MAX_MEAN_RISE: 2.0,   // flash guard: the mean bar level can rise at most this much per second
    SCREEN_GAIN: 0.95,
    SCOPE_GAIN: 2.2,      // oscilloscope height (x the upper-third band); the trace is clipped to the band    // constant screen material brightness (no beat pulse: only the bars move)
    SCOPE_PX_XR: 1.75,    // scope line width in px on the 512-wide XR canvas (scaled with canvas width elsewhere)
    TRACK_CREDIT_S: 6,    // after each track change the bottom edge shows that track's artist + licence for this long
    CREDIT_HINT: 'Music credits in the guestbook',
    // Nova look pass v2 (2026-10-18): small header (DEX amber 60 %, coral LIVE/READY, one moon-white track line at 50 %), no credit strip,
    // coral peak caps a touch brighter than the bars, unlit segments ~4.5 %
    COLORS: { ground: '#1b2340', low: '#e8a04a', high: '#ff5a4a', peak: '#ff5a4a', peakBoost: 1.15, unlitAlpha: 0.045,
      scope: '#f3ead8', scopeAlpha: 0.30, dex: '#e8a04a', dexAlpha: 0.6, live: '#ff5a4a', track: '#f3ead8', trackAlpha: 0.5, hint: '#f3ead8', hintAlpha: 0.22, scanlineAlpha: 0.16 },
  },
};
