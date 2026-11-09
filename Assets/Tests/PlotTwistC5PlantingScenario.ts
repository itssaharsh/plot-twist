/**
 * Done criterion 5: Pressing "Plant it" shows one dig spot at a time with the plant's name and
 * depth; pressing Done moves to the next; after the last spot it says the bed is planted.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {
  SOIL_Y,
  check,
  checkEq,
  checkNear,
  freshPlot,
  log,
  plantAtOrThrow,
  sceneObject,
} from "./PlotTwistLeafHelpers"
import {PlotTwistLeafInteractor} from "./PlotTwistLeafInteractor"

@component
export class PlotTwistC5PlantingScenario extends Scenario {
  async run(): Promise<void> {
    const main = await freshPlot()
    const interactor = new PlotTwistLeafInteractor()

    // Placement order defines dig order.
    const spots: {type: "Tomato" | "Basil" | "Lettuce"; x: number; z: number; line: string}[] = [
      {type: "Tomato", x: -30, z: -290, line: "Tomato · plant at soil level"},
      {type: "Basil", x: 30, z: -110, line: "Basil · plant at soil level"},
      {type: "Lettuce", x: -40, z: -120, line: "Lettuce · seed 0.6 cm deep"},
    ]
    for (const s of spots) plantAtOrThrow(main, s.type, s.x, s.z)

    await interactor.tap("PlantItButton")
    check(main.isPlantingMode(), "planting mode after pressing Plant it")
    check(!sceneObject("SeedPackets").isEnabledInHierarchy, "seed packets are hidden")

    const digSpot = sceneObject("DigSpot")
    for (let i = 0; i < spots.length; i++) {
      const s = spots[i]
      checkEq(main.getDigSpotIndex(), i, `dig spot index for step ${i + 1}`)
      check(digSpot.isEnabledInHierarchy, `DigSpot visible for step ${i + 1}`)
      checkEq(main.getUiState().digSpotLine, s.line, `DigSpotLine text for step ${i + 1}`)
      // The X sits on the plant's spot.
      const want = main.bedToWorld(s.x, SOIL_Y, s.z)
      const at = digSpot.getTransform().getWorldPosition()
      checkNear(at.x, want.x, 3, `DigSpot x for step ${i + 1}`)
      checkNear(at.z, want.z, 3, `DigSpot z for step ${i + 1}`)
      check(!main.getUiState().plantedVisible, `no "planted" message during step ${i + 1}`)
      await interactor.tap("DoneButton")
    }

    // After the last Done: the bed is planted.
    checkEq(main.getDigSpotIndex(), spots.length, "dig spot index after the last Done")
    check(!digSpot.isEnabledInHierarchy, "DigSpot hidden after the last Done")
    const planted = sceneObject("PlantedMessage")
    check(planted.isEnabledInHierarchy, "PlantedMessage visible")
    const text = planted.getComponent("Component.Text") as Text
    checkEq(text ? text.text : "", "Your bed is planted", "PlantedMessage text")

    log("C5 passed")
  }
}
