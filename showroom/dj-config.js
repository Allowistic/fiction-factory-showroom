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
  // ONE swappable palette (Nova will supply real show colours). Names used by the .lights.json cues; a cue may also give a raw '#rrggbb'.
  // null entries fall back to the palette inside the loaded .lights.json.
  PALETTE: null,
  SAFETY: { maxFlashHz: 3.0 }, // strobe / pulse cap (Dex: <= 3 Hz). Spots are fixed downlights onto the decks: they never aim at visitors or the camera.
  REQUESTS: { enabled: false, note: 'Requests coming soon' }, // placeholder: the form sends nowhere and stores nothing
};
