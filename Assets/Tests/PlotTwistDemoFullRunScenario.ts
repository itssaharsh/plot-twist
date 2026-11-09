/**
 * demo-full-run — the whole Plot Twist experience, performed slowly the way a person would,
 * for an uncut screen recording of the preview. It is a demo, not a test: it asserts nothing
 * and never fails on timing; it only logs what it did.
 *
 * Layout (bed cm; x east/right, z north/away): 2 tomatoes on the west side, the zucchini far
 * right, a basil inside the zucchini's August footprint, a basil east of a tomato (4 pm shade),
 * a free basil, two lettuces east of the tomatoes (shade → green tick) and two in the sun.
 * Spacing is chosen so the only problems are the crowded basil (then, once it moves, the
 * shaded basil — the "next warning").
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {SOIL_Y, freshPlot, log, sceneObject} from "./PlotTwistLeafHelpers"
import {PlotTwistLeafInteractor} from "./PlotTwistLeafInteractor"

type Kind = "Tomato" | "Zucchini" | "Basil" | "Lettuce"

const LAYOUT: {type: Kind; x: number; z: number; note: string}[] = [
  {type: "Tomato", x: -35, z: -295, note: "west, far"},
  {type: "Tomato", x: -35, z: -230, note: "west, middle"},
  {type: "Zucchini", x: 35, z: -150, note: "far right"},
  {type: "Basil", x: 35, z: -118, note: "inside the zucchini's August footprint"},
  {type: "Basil", x: 30, z: -238, note: "east of a tomato → 4 pm shade"},
  {type: "Basil", x: -35, z: -165, note: "free, sunny"},
  {type: "Lettuce", x: 10, z: -302, note: "east of a tomato → shade tick"},
  {type: "Lettuce", x: 40, z: -308, note: "east of a tomato → shade tick"},
  {type: "Lettuce", x: -3, z: -195, note: "sunny"},
  {type: "Lettuce", x: 5, z: -88, note: "sunny"},
]
/** A free, sunny spot for the crowded basil (clear of every August footprint and shadow). */
const SUNNY_SPOT = {x: -35, z: -100}

const PLANT_DRAG_MS = 1200
const BETWEEN_PLANTS_MS = 600
const SLIDER_DRAG_MS = 5000
const MOVE_BASIL_MS = 1500
const PER_SPOT_MS = 1500
/** The slider track is 60 cm minus the 3.4 cm knob; a hair more lands exactly on August. */
const SLIDER_TRAVEL_CM = 57.5

@component
export class PlotTwistDemoFullRunScenario extends Scenario {
  async run(): Promise<void> {
    const main = await freshPlot()
    const hand = new PlotTwistLeafInteractor()
    const firstPacket = sceneObject("SeedPacket_Tomato").getTransform().getWorldPosition()
    const cursorOn = hand.showCursor(firstPacket)
    log(`demo: SIK pinch cursor ${cursorOn ? "on" : "unavailable"}`)
    try {
      await sleep(1500)

      // 1. Plant the demo set, one packet drag per plant.
      const names: string[] = []
      for (let i = 0; i < LAYOUT.length; i++) {
        const s = LAYOUT[i]
        const packetName = `SeedPacket_${s.type}`
        const packetPos = sceneObject(packetName).getTransform().getWorldPosition()
        await hand.glideCursorTo(packetPos, i === 0 ? 400 : BETWEEN_PLANTS_MS)
        const before = main.getPlants().length
        await hand.dragToPoint(hand.interactable(packetName), main.bedToWorld(s.x, SOIL_Y, s.z), PLANT_DRAG_MS, {
          moveFraction: 0.85,
          ease: true,
          settleMs: 0,
        })
        const plants = main.getPlants()
        const name = plants.length > before ? plants[plants.length - 1].name : "(nothing planted)"
        names.push(name)
        log(`demo: planted ${name} — ${s.note}`)
      }
      await sleep(2000)

      // 2. Grow the bed: drag the slider from May to August over 5 s, then hold on August.
      const slider = sceneObject("MonthSlider").getTransform()
      const right = slider.right
      const mayEnd = slider.getWorldPosition().add(right.uniformScale(-SLIDER_TRAVEL_CM / 2))
      await hand.glideCursorTo(mayEnd, 700)
      await hand.dragBy(hand.interactable("MonthSlider"), right.uniformScale(SLIDER_TRAVEL_CM), SLIDER_DRAG_MS, {
        moveFraction: 0.97,
        settleMs: 0,
      })
      log(`demo: month ${main.getMonth().toFixed(2)}, warning ${JSON.stringify(main.getActiveWarning())}`)
      await sleep(4000)

      // 3. Fix the plot twist: move the crowded basil to a free sunny spot.
      const crowded = names[3]
      const basilPos = sceneObject(crowded).getTransform().getWorldPosition()
      await hand.glideCursorTo(basilPos, 700)
      await hand.dragToPoint(hand.interactable(crowded), main.bedToWorld(SUNNY_SPOT.x, SOIL_Y, SUNNY_SPOT.z), MOVE_BASIL_MS, {
        moveFraction: 0.85,
        ease: true,
        settleMs: 0,
      })
      log(`demo: moved ${crowded}; next warning ${JSON.stringify(main.getActiveWarning())}`)
      await sleep(3000)

      // 4. Plant it: one dig spot at a time, Done on each (~1.5 s per spot).
      await hand.glideCursorTo(sceneObject("PlantItButton").getTransform().getWorldPosition(), 700)
      await hand.tap("PlantItButton", 0)
      for (let i = 0; i < names.length; i++) {
        await sleep(PER_SPOT_MS - 500)
        const done = sceneObject("DoneButton").getTransform().getWorldPosition()
        await hand.glideCursorTo(done, 300)
        await hand.tap("DoneButton", 0)
        log(`demo: dig spot ${i + 1}/${names.length} done`)
      }
      await sleep(3000) // hold on "Your bed is planted"

      // 5. Look ahead again: the full bed in August is the final frame.
      const mayEnd2 = slider.getWorldPosition().add(right.uniformScale(-SLIDER_TRAVEL_CM / 2))
      await hand.glideCursorTo(mayEnd2, 700)
      await hand.dragBy(hand.interactable("MonthSlider"), right.uniformScale(SLIDER_TRAVEL_CM), SLIDER_DRAG_MS, {
        moveFraction: 0.97,
        settleMs: 0,
      })
      log(`demo: final month ${main.getMonth().toFixed(2)}`)
      await sleep(1500)
    } catch (e) {
      // A demo never fails the run; it just reports where it stopped.
      log(`demo: stopped early — ${e}`)
    } finally {
      hand.hideCursor()
    }
    log("demo-full-run finished")
  }
}
