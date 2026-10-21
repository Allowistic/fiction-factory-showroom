# Owl Cove review notes (Oct 18, 2026)
- Sign: front-on night render reads exactly "Owl Cove." / "NIGHT OWLS" (owlcove_neon_sign_preview_front_night.png). Owl-eye mark in the upper curl of the C. Hangs from the vault on two brass rods, because there is no wall above the back bar.
- Booth: concave R 1.4 counter + 100 deg bandshell; dj-screen 2.443 x 0.90 m (aspect 2.715), ONE mesh, own material, u 0..1 left->right. Joints unchanged. Deck yaw A +15.95 / B -15.95 deg about the platter centres.
- Dex vs booth (review_owl_booth.py, all clips): no body/column/root contact; the hands only touch the platter tops (record surface 1.070-1.073) as intended, with an 8.5 mm rim gap; wave is clean. (An earlier false hit came from the glTF importer's bone-shape Icosphere, which is now excluded.)
- Room fit (showroom frame, mesh vs mesh): booth at cantina-local (-3.0, 0, 1.2) ry +90 / Clay (3.0, 0, 1.2) rot -90. cantina_prop_lights collides; proposed move to Clay (-3.6, 0, 2.0).
- Teal: none in these pieces. The existing cantina_bar teal edge strip and the old booth's teal kick light remain outside this job.
