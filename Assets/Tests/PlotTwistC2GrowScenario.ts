/**
 * Done criterion 2: Dragging the slider from May to August grows every plant to its real
 * August height and footprint (tomato 122 cm tall, zucchini 76 cm across, basil 61 cm,
 * lettuce 20 cm).
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {
  check,
  checkNear,
  freshPlot,
  log,
  measuredPlants,
  plant,
  plantAtOrThrow,
  sceneObject,
} from "./PlotTwistLeafHelpers"
import {PlotTwistLeafInteractor} from "./PlotTwistLeafInteractor"

const AUGUST: Record<string, {h: number; w: number}> = {
  Tomato: {h: 122, w: 61},
  Zucchini: {h: 61, w: 76},
  Basil: {h: 46, w: 61},
  Lettuce: {h: 15, w: 20},
}

@component
export class PlotTwistC2GrowScenario extends Scenario {
  async run(): Promise<void> {
    const main = await freshPlot()
    const interactor = new PlotTwistLeafInteractor()

    // Setup: one of each, well apart (plantAt is the packet-drop code path).
    const names = [
      plantAtOrThrow(main, "Tomato", -30, -290),
      plantAtOrThrow(main, "Zucchini", 15, -160),
      plantAtOrThrow(main, "Basil", -25, -100),
      plantAtOrThrow(main, "Lettuce", 40, -300),
    ]
    for (const n of names) {
      checkNear(plant(main, n).heightCm, 8, 0.01, `${n} height in May`)
    }

    check(main.getUiState().sliderHintVisible, '"Drag to August" hint shows with plants at May')

    // Drag the slider knob from May all the way to the August end.
    const sliderSO = sceneObject("MonthSlider")
    const right = sliderSO.getTransform().right
    await interactor.dragBy(interactor.interactable("MonthSlider"), right.uniformScale(80))
    checkNear(main.getMonth(), 3, 0.01, "month after dragging the slider to the Aug end")
    check(!main.getUiState().sliderHintVisible, '"Drag to August" hint gone once the slider moved')

    // Every plant is at its real August size (logical size + measured world size of the model).
    const measured = measuredPlants(main)
    for (const n of names) {
      const p = plant(main, n)
      const want = AUGUST[p.type]
      checkNear(p.heightCm, want.h, 0.5, `${n} August height (cm)`)
      checkNear(p.footprintCm, want.w, 0.5, `${n} August footprint (cm)`)
      const m = measured.find((q) => q.n === n)
      check(!!m && m.visH !== null && m.visW !== null, `${n} has a measurable model`)
      checkNear(m!.visH as number, want.h, 2, `${n} model world height (cm)`)
      checkNear(m!.visW as number, want.w, 2, `${n} model world width (cm)`)
    }

    // ...and back: dragging to May returns them to seedlings.
    await interactor.dragBy(interactor.interactable("MonthSlider"), right.uniformScale(-80))
    checkNear(main.getMonth(), 0, 0.01, "month after dragging the slider back to May")
    for (const n of names) {
      checkNear(plant(main, n).heightCm, 8, 0.01, `${n} height back in May`)
    }

    log("C2 passed")
  }
}
