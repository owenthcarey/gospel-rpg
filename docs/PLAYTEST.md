# Playing the three-chapter build

Run `npm ci` and `npm run dev`, then open the printed local URL. A fresh journey begins on the shore. Complete the net-and-bread prelude, return to Simon, prepare the landing and gathering, witness Into the Deep, and finish its aftermath with a reflection. The next chapter appears in the journal and on the road into Capernaum.

For a focused Chapter II review, choose **Saves & settings → Import** and select `tests/fixtures/saves/v4-complete-episode.json`. Importing replaces the current autosave, so export a journey you want to keep first. The supplied save contains completed Chapter I progress and automatically migrates to v7.

## Through the Roof

1. Choose **The road into Capernaum** on the map and continue through the gateway. Notice the explicit passage of some days.
2. Choose **Enter the gathering house**, then **A place in the house**. Neighborhood tasks are optional; the account is already available.
3. Witness the eight scenes. Check the separation of original narration and WEB scripture. Pause motion, read a scene description, and open the complete transcript.
4. At a checkpoint, return to the house, export or reload, then resume at the same scene. Alternatively, finish with the summary; the journal retains all scene memories.
5. After the account, remember the room, sit with Ruth in the courtyard, and share the afternoon with Hannah in the bakehouse. These can be done in any order.
6. Return to the gathering house and choose a reflection: welcome, persistence or amazement. The chapter is complete; the optional stories and original shore remain available.

## A way together

1. Offer Amos your company near the water point. Choose the narrow passage or the outer lane.
2. For the passage, enter the bakehouse, borrow the handcart handle from the tool shelf, return to the cart, and move it aside. The passage stays open. For the outer lane, no tool is needed.
3. Return to Amos and begin the walk. Select **Walk with Amos** on the map for each meeting point. The automatic approach uses a shared walking pace.
4. Pause in a menu or visit another region. Amos waits. If you move far ahead manually, return toward him; the map shows his current position. There is no countdown.
5. At the courtyard, speak with him to remember the walk. The chosen route and his final position persist.

`v5-interrupted-walk.json` is a portable example of a walk in progress. `v5-interrupted-roof.json` preserves that walk while the traveler is witnessing the roof account.

## A table for neighbors

1. Speak with Hannah and choose the courtyard table or the bakehouse table.
2. Carry the bread basket from its shelf and place it on the chosen table.
3. Carry the jug from the opposite shelf, fill it at the neighborhood water point, and bring it to the same table. Bread and water can be delivered in either order.
4. Return to Hannah when both are placed. Re-enter the region and check that the arrangement and seated company remain visible and neighbors acknowledge its location.
5. Try returning a held object to its shelf. Your opportunity to help remains available, and you can carry it again later. Only one neighborhood object can be held at a time.

`v5-carrying-water.json` is a portable example with a filled jug and interrupted companion walk. Optional stories can start or finish before or after the Gospel account.

## A familiar thread

1. After Into the Deep, visit Ruth in the neighborhood courtyard and accept her invitation to find her sewing pouch.
2. Examine the blue thread by the lane water point and the paired stitches on the bakehouse mending cloth. Try both orders. The journal’s Stories view shows which evidence is known; Memories can be filtered to this story.
3. Return to the shore resting place and compare both details. Trying before both clues are known offers a hint instead of claiming the pouch.
4. Close the reading panel and carry the pouch with the nearby-action tray. Put it back, reload and recover it. Stand still and then walk: the held pose should be stationary until you move.
5. Carry it through the lanes to Ruth and return it. Choose to recount the route or share a quiet welcome. Both complete the story and leave the pouch beside her. Reload and check the memory and visible result.

## A place to rest

1. Inspect the landing bench on the shore after Into the Deep. Choose lashing cord or a wooden brace.
2. Clear the loose pieces and fetch material in either order. Cord is near the landing; the brace is in the bakehouse. Use the nearby tray for practical actions. Return material to its source and recover it later.
3. Save or reload while holding the material. Return to the bench, fit the repair and sit to check the seat. Open a menu during the motion: it should pause and then finish after closing. Reduced motion shows the completed result immediately.
4. Compare the two repair appearances. A neighbor uses the completed seat, and Miriam acknowledges it. Revisit from another region and after a reload.
5. While carrying a pouch, jug or handle, track the bench story. Guidance should identify the held object’s real return point. Use **Satchel → Find the return point**, then follow the offered doorways. No item should be replaced by another pickup.

## Journal and continuity

Visit Stories, People, Places and Memories. Filter the story cards and memories, read evidence and all three transcripts, and follow a person/place destination from a lake or roof presentation. The presentation should return to exploration with its current checkpoint preserved. After the fishermen depart, their entries should point to remembered accounts rather than unavailable people.

Check the compact action tray with mouse, keyboard and touch; the original shoreline preparation tasks also use it. Conversations, clue reading and choices retain their reading panels. Repeat on a narrow portrait viewport and 844×390 landscape with large text. Labels should avoid controls and one another; the map retains destinations hidden by crowding.

| Portable fixture             | Starting point                                                     |
| ---------------------------- | ------------------------------------------------------------------ |
| `v6-carrying-pouch.json`     | Identified pouch held on the shore; return it or put it back.      |
| `v6-interrupted-repair.json` | Cleared bench; wooden brace held in the bakehouse.                 |
| `v6-living-capernaum.json`   | Both stories complete, repaired bench and courtyard table company. |

These are in `tests/fixtures/saves/`. The original v1–v5 fixtures remain valid. `node tools/generate_life_fixtures.mjs` regenerates the v6 examples using real reducers and validation.

## Review observations to record

- Which objective or doorway was unclear, with the current region and tracked story.
- Whether keyboard, ground clicks, names and destination lists led to the same places.
- Whether the room cutaways and held objects remained readable at the chosen zoom.
- Whether every scene action remained reachable in portrait and landscape, including large reading size.
- Whether the text's provenance, the traveler's role and the fictional neighbors were clear.
- Actual reading and exploration time. RFC-002’s 35–50 minute target and RFC-003’s 20–35 minute target for their respective optional content remain human pacing targets; automated tests deliberately advance quickly.
- Device, browser, graphics setting, and F3 measurements for performance observations. Phone viewport emulation on a laptop is not a physical-device result.

See [verification](VERIFICATION.md) for completed automated checks, captured rendering data, and the remaining hardware/editorial review limits.

## Beyond Capernaum — The Road to Nain

Import `v7-beyond-capernaum.json` for a completed Chapter II journey with both new optional stories unstarted. Leave the gathering house, cross the lanes and take **The road beyond Capernaum**. The route compresses an imagined journey; it does not represent surveyed distances or a precise Gospel chronology.

1. Open **Map → Journey map**. Verify the current place, visited/unvisited distinction, connected paths and next doorway. Use the local map for individual people and landmarks. Travel remains on foot.
2. Speak with **Tamar** and accept **A way remembered**. Inspect the spring marker and terrace marker in either order. Compare their modeled details and readable inspection studies with her recollection.
3. Return to Tamar with both clues. Try an unsupported interpretation, read the mismatch, then try again. **Show a more specific hint** advances through three optional levels; the last offers an exact destination.
4. Visit the roadside farm’s shelter, confirm its split olive and two pale stones, then return to Tamar. Choose careful observation or shared company as your ending. Repeat from a fresh fixture for the other order/ending.
5. Speak with **Neri** at the farm. Choose the shade or terrace route and begin walking. Select **Walk with Neri** for each meeting point; stay nearby and let him reach each boundary before continuing through its gateway. The doorway text says whether he will come with you.
6. Open menus, walk away, take a different exit, export/reload/import, or witness the Gospel account during the walk. Neri stays in his actual region. **Journal → Company on the road → Find Neri** and the journey map explain where to regroup. Both routes end with a final conversation and visible seated company at Nain.
7. At **A place at the gate**, enter **At the gate** without completing either optional story. Read all six scenes; pause, describe, inspect the full Luke 7:11–17 transcript, leave and reload at a checkpoint. Try finish-with-summary on a second journey.
8. Afterward, visit the gate, courtyard and Adina in any order, then return to the gate and choose compassion, restoration or shared wonder. The road back and all earlier stories stay open.
9. Carry a legacy jug or pouch through the new regions, including while walking with Neri. Use the satchel’s return-point guidance to return it to its original location. Check feet, labels and route markers on slopes and walk around the gate walls and farm shelter.
10. Repeat inspection, maps, story guidance and Gospel controls with keyboard, large text, reduced motion, phone portrait and phone landscape. Check that the toast remains a short notice above the scene, without obscuring the figures.

| Portable v7 fixture          | Starting point                                            |
| ---------------------------- | --------------------------------------------------------- |
| `v7-beyond-capernaum.json`   | Chapter II complete; leave the house for the road.        |
| `v7-road-investigation.json` | Tamar’s invitation accepted; terrace evidence recorded.   |
| `v7-companion-waiting.json`  | Neri waits at the farm while the traveler is on the road. |
| `v7-nain-checkpoint.json`    | The stopped bearers and command, Luke 7:14.               |
| `v7-road-complete.json`      | Chapter III and both road adventures complete.            |

All examples are in `tests/fixtures/saves/`. `npm run fixtures:road` regenerates the v7 examples using the real reducers and save validator. The older v1–v6 examples remain importable. Human reading/pacing, editorial review and physical-device observations should be recorded separately from automated results.

## Living Galilee

Import an older completed-Chapter-II journey or `v7-beyond-capernaum.json`, then walk to the road. The two new stories are independent of Tamar, Neri and Nain. They can be tracked from **Journal → Stories**.

1. Visit **The spring channel** east of the road and offer to help. Inspect its source and both receiving basins. Inspect a channel section before borrowing the scoop; its turn remains unavailable until the preparation is done.
2. Borrow the scoop from its rack, then clear the inlet and entry silt in either order. Leave/reload while carrying it. The satchel retains the return point; returning it early lets you borrow it again while clearing remains unfinished.
3. Return the scoop, then test the unconnected route at the source. Read where the water stops. Turn sections and test again: the 3D openings, plan, direction list and wet route must agree. A changed piece invalidates the earlier test.
4. Try solving without hints, then open **Help with the channel**. Three increasingly specific hints remain optional and persist after reloading. For the north basin use entry east/west, turn west/north, north east/south. For the south basin use entry east/west, turn south/west, south north/east. The unused branch may remain dry.
5. Complete with either memory. Revisit after changing quality or leaving the region: water should still reach the chosen basin and a traveler should be using it. Tamar acknowledges the work.
6. At the farm speak with **Leah**. Inspect both resting places, choose either, and carry the mat, water and screen from **The resting supplies**, one at a time in any order. The chosen site's colored ground guides and readable plan identify unplaced supplies.
7. Place the screen on its initial southern side and check the arrangement. The blocked approach is explained without losing work. Move the screen clockwise to north or west for the shaded place, or north/east for the open place. Missing supplies and an exposed seat produce different explanations.
8. Before finishing, pick each supply up again and return it to the rack. Choose the other site after all placed and held supplies are returned. Rebuild and check the arrangement, then return to Leah for either memory. Company should remain seated at that site on later visits.
9. Carry a mat or screen into another region, read part of a Gospel account, reload there, and return to the rack. Keep a waiting Neri in a different region during this interruption. The held item, checkpoint and his actual position must all survive.
10. Try an older saved position now occupied by a rack or basin. Import should still work and place the traveler on nearby clear ground. Placing a screen over a standing position must also leave a route out.
11. In Settings choose **Explore with fewer markers**, large reading size and reduced motion. Destination lists, hints and nearby interactions remain available. Select a distant destination, use **Cancel walk**, and verify that selection clears without progress. Keyboard movement and opening a menu also cancel the approach.
12. Review the plan and screen controls in desktop, phone portrait and phone landscape. Close an inspection to view work motions and placement guides. Confirm that tree cutaways reveal the traveler without changing walking obstacles. The welcome and save controls should appear before models download; a failed continue/import must leave retry available and preserve the autosave.

| Portable v8 fixture                | Starting point                                                      |
| ---------------------------------- | ------------------------------------------------------------------- |
| `v8-channel-prepared.json`         | Both ends inspected and cleared; scoop returned; solve and test.    |
| `v8-supply-on-the-road.json`       | Screen in hand on the road; shaded site selected at the farm.       |
| `v8-resting-place-unfinished.json` | Mat placed at the shaded site; water and screen remain at the rack. |
| `v8-living-galilee-complete.json`  | North basin flowing and the open farm resting place occupied.       |

Run `npm run fixtures:galilee` to regenerate these with the real reducers and validator. The historical generators retain their original envelope versions. Record how long both stories take, whether repeated trips remain enjoyable, and where the plan, props or directions become unclear. The 25–40 minute combined pacing target, physical touch/screen-reader usability and sustained device performance require human review.
