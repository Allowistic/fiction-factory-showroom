# Showroom spec (Mira, Studio) v1

This replaces the workflow plan in LAYOUT_SPEC.md (kept for history).
It's an imagined virtual showroom Vincent enters on the Quest 3 to host 2–5 friends and show off what he's built with the crew.
Fine art and atmosphere first, with a warm 1970s soul. Equipment is shown as exhibits, not a workspace.
Units: meters. Origin is the arrival point, +Z is forward into the room, +Y is up.

## Size and shape
- Main hall: 12 W x 9 D, ceiling 4.2 m. That's big enough for 5 avatars to move without crowding, small enough to feel intimate.
- Shape: an L or a soft U, so the room can't all be seen from the door. Reveal it in stages.
- Floor: dark wood, with a sunken "conversation pit" (0.35 m step down, a classic 70s move) as the social heart.
- Keep every path at least 1.8 m wide, so two people can pass and a group of 3 can stand together.

## Flow (the sequence)
1. ARRIVAL VESTIBULE (3 x 3 m, lower 2.6 m ceiling, dim). Everyone spawns here, spaced 1 m apart, facing forward. One framed sightline through a wide opening to the builds shelf glowing at the far end. Compression before release.
2. REVEAL. Step through and the ceiling lifts to 4.2 m and the LED cove opens up. Builds wall straight ahead (the centerpiece, about 10 m away), conversation pit off to one side.
3. EXHIBIT WALK (clockwise along the long wall). Pedestal exhibits spaced about 2.5 m apart, each with its own pin light:
   - Bambu X1C on a plinth, with a few prints arranged like sculpture
   - 3018-PRO CNC under a glass vitrine, with a carved piece beside it
   - Room for 2–3 more crew builds (Fun Again EV, robotics, ShadyAF lamp, Bombshell crest). Leave empty plinths as slots.
   - A small brass or wood label rail at each piece (name, crew, year)
4. CENTERPIECE: BUILDS WALL. Full height on the far wall, with warm-wood floating shelves lit from below and a dark alcove behind for depth. Its own gathering spot: a 4 x 3 m clear zone in front for 3–5 people to stand and point.
5. CONVERSATION PIT (about 4.5 m round or square). Built-in curved banquette in burnt orange or rust velvet, low walnut table in the middle, a globe pendant overhead. Seats 5. The control panel lives here on a pedestal or the table edge, so the host can change the scene from the group.
6. SCENE WINDOW / MOTION GOD WALL. A big screen-like window wall facing the pit, where Motion God's scenes play (sunset, desert, space, etc.). It doubles as the "view" and sets the mood for the whole room.
7. LISTENING NOOK (optional, off the pit). A hi-fi cabinet with turntable and reel-to-reel and two lounge chairs (Eames-style). A small 2-person spot.
Return path: the loop ends back near the pit, not the door, so people stay.

## Sightlines
- From arrival: the builds wall, framed.
- From the pit: the scene window ahead, the builds wall to one side.
- From the builds wall: look back across the pit to the scene window.
- Nothing taller than 1.2 m in the middle of the room except plinths, so heads stay visible across the space.

## Light (most of the art)
- Base: 2700K amber LED cove at the ceiling break, kept low (about 30% of the old brightness). The room should feel like dusk.
- Accent: narrow pin spots on every exhibit and an under-shelf wash on the builds wall. The objects should be the brightest things in the room.
- Pit: a warm globe pendant plus a soft glow from under the banquette.
- The scene window lights the room in its own colors when scenes change.
- Avoid flat even light everywhere. Contrast and pools of light are the point.

## Materials and palette
- Walnut slat or groove paneling on the builds wall and the vestibule. Other walls matte plaster in deep warm tones (terracotta, chocolate).
- Accents: harvest gold, burnt orange, avocado, cream. Brass details on the label rails and pendants.
- Rugs: a low geometric shag in the pit.
- Plinths: walnut or cream lacquer, 0.9–1.1 m high.
- Period touches, sparing (it's a gallery, not a theme park): a lava lamp on the builds wall, a sunburst clock in the vestibule, a macramé hanger with a plant by the scene window.

## Multi-user notes
- Spawn points: 5 in the vestibule, staggered.
- Group spots: arrival (2–5 people), builds wall (3–5), pit (seated 5), listening nook (2), plus a pause spot in front of each exhibit (2–3).
- The control panel should be reachable from inside the pit so the host doesn't have to leave the group.
- Keep teleport or nav targets at each group spot.

## Next
- Nova can tighten the visual direction (palette and light mood) if Vincent wants.
- No real dimensions are needed. These are design sizes, so Jules can scale ±20% to taste.

## Cantina (sci-fi bar room off the hall), added 2026-10-16
A separate room with a warm, worn sci-fi cantina feel: dark and intimate, lit by the bar and the entertainment center. It still sits in the same 70s/fine-art family as the hall (amber light, rust and brass), just pushed toward space-port.

### Entertainment center (anchor)
- Marcos Bini entertainment center, modeled by Clay from /workspace/campbell-creek/ent-center/. From parts.json the overall extents come out to about 4.07 m wide, 0.37 m deep, and 2.17 m tall (the bottom of the model sits about 0.38 m up, so the full height may be about 2.55 m). Clay should confirm the final W x D x H; the room below leaves 1 m of slack.
- Placement: centered on the cantina's far wall (wall opposite the entry), flush to the wall. It's the first thing seen when you come through the door, the room's "altar." Its built-in lighting/openings glow; it's the brightest object in the room after the bar back.

### Room
- Size: 8 W x 6.5 D, ceiling 3.2 m (lower than the hall, for intimacy). Slightly rounded or chamfered corners, with a domed or ribbed ceiling (sci-fi hull feel).
- Floor: dark metal-and-wood deck. Walls: deep rust/charcoal with brass ribs every 1.2 m.

### Doorway and draw budget
- Location: off the end of the exhibit walk, on the hall's back wall near the builds wall (before the return to the pit), so the cantina is the "bonus room" at the end of the tour.
- Form: an angled dogleg passage, 1.2 m wide x about 3 m long with one 90° turn, plus a round "airlock" arch (2.2 m tall) at each end. The turn blocks any straight line between hall and cantina, so only one room needs to render at a time; swap or cull rooms at the midpoint of the passage.
- Passage lighting: a dim amber strip at floor level and a single glowing panel at the turn. It's a mood shift, hall to cantina.

### Sightline through the door
- Stepping out of the dogleg into the cantina: the entertainment center dead ahead (about 6 m away), centered and glowing. The bar curves in from the left, the booth sits to the right. Nothing taller than 1.1 m between the door and the entertainment center, so the view stays clear.

### Bar and seating (2–5 guests)
- Bar: a curved (arc) bar along the left wall, about 4 m along its front, 1.05 m high, 0.6 m deep top. Glowing underside (amber or teal LED) and a brass footrail. Back bar on the left wall: glowing bottle shelves plus a small screen or porthole.
- Stools: 4, 0.75 m tall, spaced 0.65 m apart along the arc.
- Booth: a curved booth on the right side, opposite the bar, in rust velvet, seats 3–4 around a round table 1.0 m across. Faces the entertainment center at an angle.
- Standing spot: a 2 x 2 m clear zone between the bar and the booth, for a host and guests to mingle. Teleport target here.
- Clear paths: 1.5 m min from the door to the bar, the booth, and the entertainment center.

### Light
- Very dark base (about 20% ambient). Light comes from the bar underside glow, the back-bar shelves, the entertainment center's own lighting, and a low pendant over the booth table.
- Accent color is teal against the amber, used sparingly: the back-bar glow and the ceiling ribs only.

### Coordinates (cantina-local, meters)
- Origin is the cantina door (the exit of the dogleg), with +Z pointing into the room.
- Entertainment center: center at [0, 0, 6.3], facing -Z.
- Bar arc: from [-3.6, 0, 1.5] to [-2.0, 0, 5.0]. Booth center: [2.6, 0, 3.6]. Standing zone: [0, 0, 3.2].
