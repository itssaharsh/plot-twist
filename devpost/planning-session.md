# plan-lens interview

The planning conversation that produced [`design-brief.md`](design-brief.md). It ran with the `plan-lens` skill from the Devpost Learn skill pack (`npx skills add challengepost/learn-specs`) in Claude Code, inside this Lens Studio project.

**Me:** Run the plan-lens skill.

**plan-lens:** Everything's in place: your PlotTwist project is open in this folder, Lens Studio is connected, and CLAD is installed.

---

Welcome to Learn AR with SPECS. As the concept video showed, a coding agent builds what you describe, so the more specific your description, the better your Lens. Instead of you writing that description, I'll interview you about your idea and check it against AR design habits and what Lens Studio's preview can do. Your answers become a design brief, saved to `devpost/design-brief.md`. Then you start a fresh chat, point CLAD at the brief, and it builds the Lens.

This takes about 20 to 30 minutes and six to eight questions. You make the decisions. I'll ask follow-ups and point out where an idea might fight the glasses or the preview. Speech-to-text helps.

**What would you like to make for glasses? If you don't have an idea yet, tell me a bit about what you spend your time on.**

**Me:** A garden planner for my first raised vegetable bed. I'm calling it Plot Twist. On planting day I'm kneeling at a new 4 by 8 foot bed with seed packets in one hand and dirt on my fingers, and the packet says "space 24 inches", which is a number I honestly can't picture. Everyone I know who started a vegetable bed ended up with one zucchini swallowing everything by August. I want to see my bed in August before I plant it in May, right there in the soil, and then have it tell me where each plant goes while my hands are busy.

**plan-lens:** Plot Twist is a great name, and this idea fits glasses well. "24 inches" turns into a full-size zucchini sitting in your soil, and your hands stay free for the dirt.

You described two moments: seeing the bed in August, and being told where each plant goes while you plant. A first Lens works best built around one of them.

**Picture Plot Twist at its very best. You're kneeling at the bed. What exactly do you see in the soil, and what are you doing right then?**

**Me:** The best moment is the August reveal. I'm standing at the foot of the bed, looking down at the soil. I've dropped in tomato, zucchini, basil and lettuce as little seedlings where I think they should go. Then I drag one slider from May to August and watch every plant grow to its real full size in my bed. The zucchini's leaves spread over the basil, and the tall tomatoes throw a patch of afternoon shade over where I put the basil. I pick up the basil, move it to the sunny end, and the warning clears. That's the moment I'd show a friend.

The planting part matters to me too, but it's the follow-through: once the layout is fixed, I press "Plant it" and it shows one spot at a time where to dig, so I can keep my hands in the soil. I'm happy for that to stay simple.

**plan-lens:** That's a strong moment. You can show it to a friend in one slider drag, and the basil fix shows the Lens is useful, not just pretty.

One thing to plan for: in Lens Studio's preview, Plot Twist can't see your real bed or know where the sun is. So the Lens needs **stand-ins**, meaning simple fake versions of what the real glasses would sense, so the moment still works in the preview. The growing, shade and warnings can all be built for real on top of them.

**What should stand in for your real 4 by 8 bed, and how should the Lens know which way the afternoon sun comes from?**

**Me:** For the bed: a virtual raised bed at real size on the floor, 122 by 244 cm and 30 cm tall, with a wooden rim and a soil top, its near short end about 80 cm in front of me. And four big virtual seed packets next to it that I grab, standing in for showing the glasses my real packets.

For the sun: hard-code it. Assume the bed's long side runs north to south, I'm standing at the south end, and the afternoon sun comes from the west, on my left. Use a real sun position for mid-August at 4 pm around 40 degrees north: the sun is about 32 degrees above the horizon, coming from the west-southwest (azimuth about 262 degrees), so a plant's shadow is about 1.6 times its height, falling toward the east-northeast. I worked that out from NOAA's solar position equations. The plant sizes should come from real extension-service numbers too: tomato 122 cm tall with a 61 cm footprint, zucchini 61 cm tall and 76 cm across, basil 46 cm tall and 61 cm across, lettuce 15 cm tall and 20 cm across (the August footprint is the recommended spacing). Lettuce actually likes afternoon shade in summer because heat makes it bolt, so lettuce in shade should get a small tick, while basil in shade gets the warning.

**plan-lens:** Those numbers are excellent. I checked the shadow math: at 32° sun height, a shadow is about 1.6 times the plant's height, so it's right. Real sizes and a real sun angle will make the August reveal believable. The lettuce tick is a nice touch too, since it shows the Lens knows each plant's needs and isn't just flagging all shade.

Now the controls. During the reveal you're standing at the foot of the bed looking down at the soil. Because the glasses' view is narrow (about a hand's width at arm's length), anything outside your gaze is easy to miss.

**Where do the four seed packets and the May-to-August slider sit, and where are your eyes while you drag the slider?**

**Me:** The seed packets sit in a short row at the bed's near-left corner, about 90 cm off the floor (waist height), each about 14 by 20 cm, tilted up toward me so I can read them. The slider lies along the bed's near rim, right below where I'm looking, about 60 cm long and angled up toward me, with May, Jun, Jul, Aug marked on it. While I drag it my eyes stay on the soil just beyond the slider, where the plants are growing, so the slider is at the bottom edge of my view and the bed fills the rest. The "Plant it" button sits at the near-right corner, about 12 cm across. Spacing rings lie flat on the soil around each plant, and a warning is one short line about 10 cm above the plant that has the problem, never a panel.

**plan-lens:** That placement follows good glasses habits: the controls sit at the bottom edge of your view, the bed fills the rest, and warnings sit on the plant they're about. I don't have anything to push back on.

Now your hands. One note so you know: in the preview, your mouse acts as one hand doing a pinch, so grabbing, dragging, and pressing all work there.

**How does a seedling get from a packet into the soil (and can you plant more than one of each)? And after you press "Plant it", how do you move from one dig spot to the next with dirt on your fingers?**

**Me:** I pinch a packet and drag. A ghost seedling with a faint ring of its spacing follows my hand over the soil, and when I let go, the seedling appears right there. The packet stays where it was, so yes, I can plant as many of each as I want, one drag per plant. To move a plant that's already in, I pinch it and drag it. For the demo I'd plant 2 tomatoes, 1 zucchini, 3 basil and 4 lettuce.

After "Plant it", one dig spot shows at a time: a chalk-white X on the soil with one line above it, like "Tomato · plant at soil level" or "Lettuce · seed 0.6 cm deep", and a big Done button right next to the spot. I pinch Done (a pinch doesn't need clean fingers) and the next spot lights up with a soft chime. After the last one it says the bed is planted. No voice.

**plan-lens:** That covers the hands well. Drag-to-plant with a ghost and a spacing ring is clear, and one big Done button suits dirty fingers.

Next, what shows when. During the reveal you'll have spacing rings, shade patches, and warnings in the bed together, and that could crowd it.

**When should the spacing rings, shade patches, and warnings appear, and when should they get out of the way? Also, you mentioned the zucchini spreading over the basil. Is crowding a warning too, or only shade?**

**Me:** Crowding is a warning too, and it's the main one: zucchini covering the basil is the plot twist.

- Rings: only while I'm dragging a plant, and when the slider is at July or August, where they show each plant's real August footprint. In May and June they're hidden so the bed looks like a bed.
- Shade patches: only July and August, light lavender (not dark, since dark disappears on the glasses), for the 4 pm sun.
- Warnings: only in August, only on the plant in trouble, one at a time if there are several (the worst first). An amber ring that pulses twice, then holds, plus one short line above the plant like "Zucchini covers this by July". As soon as I move the plant out, the ring turns green for a second and the line fades.
- Lettuce in shade gets a small green tick, no text.
- Seed packets hide once I press "Plant it". During planting, everything else dims and only the current dig spot is bright.
- If a warning is on a plant outside my view, a soft chime and a small arrow at the edge of the bed point to it.

**plan-lens:** That gives the bed a clear rhythm: it looks like a plain bed in May, and only the problems show up in August. The lavender shade is a smart call for a display where dark colors disappear.

You've answered the big design questions. One question left before I draft.

**How will you know it works? Name three to five things you should be able to do or see in Lens Studio's preview, using your mouse and keyboard.**

**Me:** 1. Dragging a seed packet over the soil and releasing it places a seedling at that spot with a ring of its spacing; the packet stays so I can plant another.
2. Dragging the slider from May to August grows every plant to its real August height and footprint (tomato 122 cm tall, zucchini 76 cm across, basil 61 cm, lettuce 20 cm).
3. In August, a basil inside the zucchini's footprint shows an amber ring and the line "Zucchini covers this by July"; dragging the basil out turns the ring green and the line disappears.
4. In July and August the tomatoes cast a lavender shade patch toward the east-northeast; a basil inside it gets a shade warning, a lettuce inside it gets a green tick.
5. Pressing "Plant it" shows one dig spot at a time with the plant's name and depth; pressing Done moves to the next; after the last spot it says the bed is planted.

**plan-lens:** The draft is saved at `devpost/design-brief.md` with `status: draft`. Here's the part you shaped. The Build notes and After the build sections at the bottom are kept exactly as the template wrote them.

---

# Design brief: Plot Twist

**The one spatial moment.** Standing at the foot of the 4 by 8 foot bed, you drop in tomato, zucchini, basil and lettuce seedlings, then drag one slider from May to August. Every plant grows to its real full size, the zucchini spreads over the basil, and the tomatoes shade it. You move the basil to the sunny end and the warning clears. Then "Plant it" shows one dig spot at a time.

**Why glasses:** it draws in the world (24 inches becomes a real zucchini in your soil), leaves your body free (dirty fingers, pinch to continue), and shares your view (the plan sits on the bed you're looking at).

**Stand-ins:** a virtual 122 × 244 × 30 cm bed, 80 cm in front of you. Four grabbable seed packets. A hard-coded sun for mid-August at 4 pm, 40° north: 32° high from azimuth 262°, so shadows are 1.6 × plant height, falling toward the east-northeast.

**Where things live:** packets at the near-left corner at waist height (14 × 20 cm, tilted up). The 60 cm slider along the near rim, marked May to Aug. "Plant it" at the near-right corner (12 cm). Rings and shade lie flat on the soil. Warnings are one line 10 cm above the plant in trouble.

**Plants:**

| Plant | Height | Footprint | Planting line |
|---|---|---|---|
| Tomato | 122 cm | 61 cm | "Tomato · plant at soil level" |
| Zucchini | 61 cm | 76 cm | "Zucchini · seed 2.5 cm deep" *(default)* |
| Basil | 46 cm | 61 cm | "Basil · plant at soil level" *(default)* |
| Lettuce | 15 cm | 20 cm | "Lettuce · seed 0.6 cm deep" |

**Hands:** pinch and drag a packet to plant (a ghost seedling and ring follow your hand; the packet stays). Pinch and drag a plant to move it. Drag the slider. Pinch "Plant it", then pinch Done for each spot. No voice.

**When things show:**
- Rings appear only while dragging, or in July and August.
- Lavender shade appears only in July and August.
- Warnings appear only in August, one at a time, worst first. Each is an amber ring that pulses twice, plus one line. Moving the plant out turns the ring green, then the line fades.
- Lettuce in shade gets a green tick.
- In planting mode, everything dims except the current spot, and a chime plays for each new spot.
- A chime and an arrow point to anything out of view.

**Done criteria:** your five, word for word. Demo set: 2 tomatoes, 1 zucchini, 3 basil, 4 lettuce.

**Out of scope:** recognizing the real bed or packets, the real sun, other times of day, other plants, saving layouts, watering, pests and harvest, voice.

**Risks:**
- On real glasses, the full bed won't fit in the narrow view, and the far end is about 3.2 m away for pinching.
- Looking down for a long time may tire your neck.
- The shade is correct only for your bed's orientation and that one sun position.
- The demo set fits at full spacing, but only just.

---

**Defaults I picked that you didn't decide** (each is marked `(default)` in the file):
- Seedlings start about 8 cm tall. Plants reach about a third of full size in June and three quarters in July.
- Only the tomatoes and the zucchini cast shade.
- The crowding warning goes on the smaller plant, and overlaps under 5 cm don't count.
- Crowding warnings come before shade warnings.
- The shade warning reads "Tomato shades this after 4 pm".
- "Plant it" works even while warnings are showing.
- Dig spots go in the order you placed the plants.
- Warning text is about 3 cm tall. The Done button is 12 cm.
- The soil is a lighter brown so it shows up on the glasses.

**Is there anything you'd like to change?**

**Me:** Looks good. One small change: make the shade warning read "Tomato shades this at 4 pm". Otherwise approved.

**plan-lens:** Your brief is approved. The shade warning now reads "Tomato shades this at 4 pm", and `devpost/design-brief.md` is marked `status: approved`.

Here's how to build it:

1. Keep Lens Studio open with this project. In Claude Code, `/mcp` should show `lens-studio` connected, and `/plugin` should list CLAD. If either is missing, follow the Quick Start on the resources page before building: https://learn-specs.devpost.com/resources
2. Clear this chat with `/clear`, or start a new chat in the project folder (`SpecsLens`, the one with `PlotTwist.esproj`). CLAD works best with a clean context.
3. Paste this:
   > Read devpost/design-brief.md and build it for SPECS. Follow the brief closely. Get the basic flow working first, then add detail. Write and run LEAF tests for each done criterion, and tell me which pass.
4. A full build can take 30 minutes or more. When it's done, open the **After the build** section at the bottom of your brief and try your Lens in the preview.

This was a pleasure to plan. You brought your own sun angles and extension-service numbers, which will make the August reveal believable. I hope the zucchini stays in its corner this year. 🌱
