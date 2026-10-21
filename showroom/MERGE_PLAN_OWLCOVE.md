# Merge plan: teleporter/beam + /hangar/ onto Owl Cove (Jules, 2026-10-21)

Owl Cove is unpublished, in a local working copy based on main (fd7615b). Files this branch changes in showroom/:

| File | This branch | Owl Cove touched? | 3-way result |
|---|---|---|---|
| showroom.js | +26/-3 | yes (~110 lines) | 2 small conflicts |
| cantina.js | +2 | yes (~75 lines) | clean |
| README.md | +10 | yes | clean |
| portal.js, beam.js, QA_TELEPORTER_BEAM.md | new | no | clean |
| ../hangar/ (built Hangar) | new | no | clean |

Conflicts in showroom.js (both easy, keep both sides):
1. XR controller select raycast: Owl Cove keeps the old line; this branch adds `portal.pick` to the target list plus the arch jump. Take the branch line and keep any Owl Cove changes after it.
2. `window.LOFT` exports line: Owl Cove adds `LOFT.raycasterCtor`; this branch adds `LOFT.portal`. Keep both.

Order: publish Owl Cove first (after Penny passes it). Then rebase this branch on it, resolve the two conflicts, and re-check:
- The cantina draw budget (25 or fewer in stereo). The portal adds 1 draw, plus 1 more while the beam is lit.
- The arch (x=1.95 on the entry wall) doesn't collide with the Owl Cove dressing or lanterns.
- The beam's white-out stays under the 3 Hz flash limit.
- The arch sign styling fits the Tiki Nest theme.
