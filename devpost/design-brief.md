---
status: approved
---

# Design brief: Plot Twist

<!-- Filled in by plan-lens from the learner's interview. Use the learner's words. Mark any value they didn't choose as (default). -->

## The one spatial moment
On planting day I'm standing at the foot of my new 4 by 8 foot raised bed, looking down at the soil, where I've dropped in tomato, zucchini, basil and lettuce as little seedlings where I think they should go. I drag one slider from May to August and watch every plant grow to its real full size in my bed. The zucchini's leaves spread over the basil, and the tall tomatoes throw a patch of afternoon shade over where I put the basil. I pick up the basil, move it to the sunny end, and the warning clears. That's the moment I'd show a friend.

The follow-through stays simple: once the layout is fixed, I press "Plant it" and it shows one spot at a time where to dig, so I can keep my hands in the soil.

## Why it belongs on glasses
- Uses: draws in the world, leaves your body free, shares your view.
  - Draws in the world: "space 24 inches" becomes a full-size August zucchini sitting in my own soil, at real scale.
  - Leaves your body free: seed packets in one hand and dirt on my fingers. A pinch doesn't need clean fingers.
  - Shares your view: the plan sits on the bed I'm looking at, not on a grid on a screen. (In the preview, the bed is a stand-in.)
- Why it's better than the phone or laptop version: a planner on a screen shows a flat grid, and 24 inches is still "a number I honestly can't picture." Here I see my bed in August before I plant it in May, right there in the soil, and it tells me where each plant goes while my hands are busy.

## Product or overlay
- Type: overlay: it responds to a real bed, real seed packets and the real afternoon sun.
- What the real version would sense: the real raised bed and its soil, the seed packets in my hand, and where the sun is.
- Stand-in for the preview:
  - **Bed:** a virtual raised bed at real size on the floor, 122 by 244 cm and 30 cm tall, with a wooden rim and a soil top, its near short end about 80 cm in front of me.
  - **Seed packets:** four big virtual seed packets next to the bed that I grab, standing in for showing the glasses my real packets.
  - **Sun:** hard-coded. The bed's long side runs north to south, I'm standing at the south end, and the afternoon sun comes from the west, on my left. The sun position is real for mid-August at 4 pm around 40° north (from NOAA's solar position equations): about 32° above the horizon, coming from the west-southwest (azimuth about 262°). So a plant's shadow is about 1.6 times its height, falling toward the east-northeast (about 82°).

## Where things live
- Where the user is looking during the main task: standing at the foot (south end) of the bed, eyes on the soil just beyond the slider, where the plants are growing. The slider is at the bottom edge of the view and the bed fills the rest. Standing eye height about 160 cm (default).
- **Raised bed:** on the floor, long side pointing straight ahead (north), near short end about 80 cm in front of the user and centered on them. 122 x 244 cm, 30 cm tall, wooden rim, soil top in a warm mid-brown light enough to read on an additive display (default).
- **Seed packets:** a short row of four at the bed's near-left corner, about 90 cm off the floor (waist height), each about 14 x 20 cm, tilted up toward the user so they're readable. Each shows the plant's name, a simple picture and its spacing, e.g. "Tomato · space 24 in" (default).
- **Plants:** on the soil where they were dropped, at real size for the month on the slider.
- **May-to-August slider:** lies along the bed's near rim, right below where the user is looking, about 60 cm long and angled up toward them, with May, Jun, Jul, Aug marked on it.
- **"Plant it" button:** at the bed's near-right corner, about 12 cm across.
- **Spacing rings and shade patches:** flat on the soil.
- **Warnings:** one short line about 10 cm above the plant that has the problem, never a panel. Light text with letters about 3 cm tall so it reads from the foot of the bed (default).
- **Dig spot (planting mode):** a chalk-white X on the soil, about 10 cm across (default), with one line above it and a big Done button right next to the spot, about 12 cm across (default, same as "Plant it").

### Plant sizes
From extension-service numbers. The August footprint is the recommended spacing.

| Plant | August height | August footprint | Packet spacing | Planting line |
|---|---|---|---|---|
| Tomato | 122 cm | 61 cm across | 24 in (default) | "Tomato · plant at soil level" |
| Zucchini | 61 cm | 76 cm across | 30 in (default) | "Zucchini · seed 2.5 cm deep" (default) |
| Basil | 46 cm | 61 cm across | 24 in (default) | "Basil · plant at soil level" (default) |
| Lettuce | 15 cm | 20 cm across | 8 in (default) | "Lettuce · seed 0.6 cm deep" |

- Growth: seedlings are about 8 cm tall and 8 cm across in May (default). They grow smoothly with the slider, to about a third of full size in June and three quarters in July, reaching full size in August (default).
- Basil in afternoon shade is a problem. Lettuce likes afternoon shade in summer, because heat makes it bolt.

## Hands and input
- **Plant a seedling:** pinch a seed packet and drag. A ghost seedling with a faint ring of its spacing follows the hand over the soil; letting go puts the seedling right there. The packet stays where it was, so you can plant as many of each as you want, one drag per plant. Letting go off the soil plants nothing (default).
- **Move a plant:** pinch it and drag it to a new spot on the soil. Works in any month (default).
- **Grow the bed:** drag the slider from May to August, and back.
- **Start planting:** pinch "Plant it". It works even while warnings are showing (default).
- **Next dig spot:** pinch Done.
- Targets are big and highlight when aimed at.
- Voice: none.

## When things show
- Start: the bed is empty and the slider is at May (default).
- **Spacing rings:** only while dragging a plant, and when the slider is at July or August, where they show each plant's real August footprint. In May and June they're hidden so the bed looks like a bed.
- **Shade patches:** only in July and August, light lavender (not dark, since dark disappears on the glasses), for the 4 pm sun. Cast by the tomatoes and the zucchini (default). Each patch is the plant's footprint stretched 1.6 times its current height toward the east-northeast, clipped to the bed (default).
- **Warnings:** only in August, only on the plant in trouble, one at a time if there are several, worst first. An amber ring that pulses twice, then holds, plus one short line above the plant.
  - **Crowding** is the main warning ("zucchini covering the basil is the plot twist"): two plants' August footprints overlap. The warning goes on the smaller plant, e.g. "Zucchini covers this by July". Overlaps under 5 cm don't count (default).
  - **Shade:** a basil whose center is inside a shade patch gets "Tomato shades this at 4 pm".
  - Worst first means crowding before shade, and bigger overlaps first (default).
  - As soon as the plant is moved out of trouble, the ring turns green for a second and the line fades. Then the next warning, if any, shows.
- **Lettuce in shade:** a small green tick, no text, in July and August (default months).
- **Seed packets:** hide once "Plant it" is pressed.
- **Planting mode:** everything else dims and only the current dig spot is bright. Spots go in the order the plants were placed (default). Pinching Done lights up the next spot with a soft chime. After the last one it says the bed is planted ("Your bed is planted", default wording).
- If something needs attention out of view: a warning on a plant outside the view plays a soft chime and shows a small arrow at the edge of the bed pointing to it. The same arrow points to the next dig spot if it's out of view (default).

## Done criteria
Each one can be checked in Lens Studio's preview.
1. Dragging a seed packet over the soil and releasing it places a seedling at that spot with a ring of its spacing; the packet stays so I can plant another.
2. Dragging the slider from May to August grows every plant to its real August height and footprint (tomato 122 cm tall, zucchini 76 cm across, basil 61 cm, lettuce 20 cm).
3. In August, a basil inside the zucchini's footprint shows an amber ring and the line "Zucchini covers this by July"; dragging the basil out turns the ring green and the line disappears.
4. In July and August the tomatoes cast a lavender shade patch toward the east-northeast; a basil inside it gets a shade warning, a lettuce inside it gets a green tick.
5. Pressing "Plant it" shows one dig spot at a time with the plant's name and depth; pressing Done moves to the next; after the last spot it says the bed is planted.

Demo set: 2 tomatoes, 1 zucchini, 3 basil and 4 lettuce.

## Out of scope
- Recognizing a real bed or real seed packets. The preview uses the stand-ins above.
- Finding the real sun from location, date or compass. There's one hard-coded sun: mid-August, 4 pm, about 40° north.
- Shade at other times of day or in other months.
- Plants other than tomato, zucchini, basil and lettuce.
- Saving a layout between sessions.
- Watering, feeding, pests and harvest.
- Voice.

## Risks and open questions
- The glasses' view is narrow (about 37° tall by 32° wide). From the foot of the bed the far end is about 3.2 m away, so on real glasses the whole bed, and especially the 122 cm tomatoes, won't fit in view at once. The preview's view may look roomier. Feel unproven.
- On real glasses, planting or moving plants at the far end means pinching from about 3 m away or walking along the bed. The mouse does this easily in the preview. Feel unproven.
- Looking down at a bed at floor level for a long time may tire the neck. Feel unproven.
- The shade is correct only for this setup: bed running north to south, user at the south end, mid-August at 4 pm, around 40° north.
- The demo set fills the bed tightly at full spacing, so a layout with no warnings should fit but leaves little room.
- Plant sizes are extension-service averages; real plants vary.

## Build notes for CLAD
- Build for SPECS so it runs and can be demonstrated in Lens Studio's preview. No SPECS device is available.
- Use Spectacles Interaction Kit (SIK) and UI Kit for all interactions, so they work with the mouse in Interactive Preview and with LEAF.
- Build any stand-in exactly as described above, and keep it obvious in the scene.
- Use real-world scale in centimeters. Keep content inside the user's view during the main task.
- The display is additive: black renders as transparent. Don't rely on black or very dark content to be seen; keep text light and readable from where the user stands.
- Get the basic flow working first, then add detail.
- Write LEAF scenarios for each done criterion, run them in preview, and report which pass. Say which criteria have no test.
- Don't record, identify, or follow people.

## After the build: judge it
This part is for you, after CLAD finishes.

1. **Does it work?** Ask your agent which LEAF tests passed and which done criteria have no test.
2. **Walk around it.** Open the preview in Interactive Preview. Use WASD to move, Q and E to go down and up, and right-drag (or hold Shift) to look around. Clicking acts as a pinch. Stand where a user would and look at the task.
3. **Ask the three questions.**
   - Does it use what I'm looking at?
   - Does it put something in my space, where it belongs?
   - Does it free my hands or let me keep my eyes up?
   - Would it be just as good on a phone? If so, what would make it need the glasses?
4. **Check comfort.**
   - Everything I need is in view while I do the task. Nothing sits at the edges, behind me, or stuck to my face.
   - Every control is within reach of someone standing there.
   - Text reads easily from where I stand. No dark UI disappearing.
   - Things show when needed and get out of the way.
5. **Label what you know.** Write "logic proven" next to anything the tests and preview show working, and "feel unproven" next to anything only real glasses could tell you (comfort over time, real hand tracking, real recognition).
6. **Fix with design notes, not code.** Tell your agent what to change in design terms, for example: "Move the step card 15 cm lower and next to the pan. Make the Next button twice as big. Re-run the tests." If a fix takes under a minute, like nudging a panel, do it yourself in the scene.
7. **Submit.** Record a video under 3 minutes of your Lens in the preview, public on YouTube. Make your repo public with your Lens Studio project and this `devpost/` folder. Details are on the hackathon site: https://learn-specs.devpost.com/resources
