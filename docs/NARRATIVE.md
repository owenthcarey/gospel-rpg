# Narrative and editorial guide

**Into the Deep** combines an imagined village prelude, a narrated dramatization of **Luke 5:1–11**, and an original village aftermath. The traveler's errands and conversations are connective fiction. They do not cause, earn or change the catch and calling.

Every conversation/caption identifies its provenance:

- **Original dialogue:** invented connective speech for Simon and original villagers Miriam and Ezra.
- **Original narration:** descriptions, observations and scene transitions.
- **Scripture · WEB:** direct World English Bible quotations with verse references.

The local source module is `src/content/episode/scripture.ts`. It stores all eleven verses separately from narration and staging, verified against [the public-domain WEB source](https://ebible.org/engwebp/LUK05.htm). Scene captions quote the account as Gospel narration, preserving the speakers within each verse. The prelude's direct Jesus dialogue remains the verified Luke 5:4 quotation. No invented teaching or new speech is attributed to Jesus; Luke does not record the content of the teaching in 5:3.

A reference attached to original dialogue identifies context, not evidence for its invented wording. Boats, clothing, handling of nets, architecture and village placement are artistic interpretations. Human historical/theological review remains distinct from source/provenance checks.

## Chapter flow

1. **A place by the water:** meet Simon, collect a mended net and Miriam's bread in either order, deliver them, and hear the prelude's Luke 5:4 quotation.
2. **Make room on the shore:** return to Simon. Carry an empty basket to the landing, coil a loose rope and make room for gathering neighbors. These are imagined acts of help.
3. **A view across the water:** the traveler stays on shore while the presentation takes a narrated closer view of the boats. The introduction explains this viewpoint.
4. **Ten scenes:** gathering, teaching, invitation, Simon's answer, lowering the net, abundance, partners, astonishment, calling and return. Every verse in Luke 5:1–11 appears in the transcript. Brief original narration connects the verses without inventing historical speech.
5. **After the boats return:** Luke 5:11 is followed by an explicit return to the imagined traveler. The fishermen have departed; the boats and cargo remain. Help at the landing and talk with Miriam and Ezra.
6. **What stays with you:** choose wonder, trust or community. Each choice receives its own journal reflection and later original acknowledgement. The village stays available.

Scene advancement is user-paced. Pause/read, leave/resume and finish-with-summary preserve access to the entire account. Summary advances the narrated portion only; the aftermath remains playable. There is no timing challenge, alternate Gospel outcome, moral score, spiritual currency or preferred reflection.

## Optional village story: An ordinary morning

Ezra invites the traveler to remember the well, grove and shore, then return to share a memory. Voices at the well, quiet in the grove, and the open lake each receive a distinct original response. A shared pause adds **A place among neighbors** to the journal. The chosen memory persists; migrated old completions leave it unspecified until the player voluntarily remembers it again.

This story can begin or finish before, during or after the main episode. Earlier discoveries count. Tracking the village story changes guidance but never gates the main episode. After the lake return, Ezra's aftermath conversation also provides access to the village story.

## Content changes

Keep stable event, checkpoint and journal IDs. Choices must point to an existing node or close. Renaming IDs already stored in saves requires migration. New scripture belongs in the verified source module. Run content-graph, provenance, transition and save tests after edits. Do not use animation completion as narrative authority.
