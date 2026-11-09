/**
 * Done criterion 3: In August, a basil inside the zucchini's footprint shows an amber ring and
 * the line "Zucchini covers this by July"; dragging the basil out turns the ring green and the
 * line disappears.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {
  SOIL_Y,
  check,
  checkEq,
  checkNear,
  freshPlot,
  log,
  plant,
  plantAtOrThrow,
  sceneObject,
  waitUntil,
  watchFor,
} from "./PlotTwistLeafHelpers"
import {PlotTwistLeafInteractor} from "./PlotTwistLeafInteractor"

@component
export class PlotTwistC3CrowdingScenario extends Scenario {
  async run(): Promise<void> {
    const main = await freshPlot()
    const interactor = new PlotTwistLeafInteractor()

    // Basil 30 cm from the zucchini — inside its 38 cm August radius.
    const zucchini = plantAtOrThrow(main, "Zucchini", 20, -170)
    const basil = plantAtOrThrow(main, "Basil", 20, -140)

    // Grow the bed to August with the slider.
    const right = sceneObject("MonthSlider").getTransform().right
    await interactor.dragBy(interactor.interactable("MonthSlider"), right.uniformScale(80))
    checkNear(main.getMonth(), 3, 0.01, "month after dragging the slider to Aug")

    // Amber ring + the exact line on the basil.
    await waitUntil(() => main.getActiveWarning() !== null, 3000, "a warning to show in August")
    const w = main.getActiveWarning()!
    checkEq(w.plantName, basil, "warned plant")
    checkEq(w.kind, "crowding", "warning kind")
    checkEq(w.text, "Zucchini covers this by July", "warning text")
    checkEq(main.getWarningRingState(basil), "amber", "basil warning ring")
    checkEq(main.getWarningRingState(zucchini), "hidden", "zucchini warning ring")
    const lineSO = sceneObject("WarningLine")
    check(lineSO.isEnabledInHierarchy, "WarningLine is visible")
    checkEq(main.getUiState().warningLine, "Zucchini covers this by July", "WarningLine text")
    const basilTop = sceneObject(basil).getTransform().getWorldPosition().y + plant(main, basil).heightCm
    const lineY = lineSO.getTransform().getWorldPosition().y
    check(lineY > basilTop && lineY < basilTop + 25, `WarningLine sits just above the basil (line y ${lineY.toFixed(1)}, basil top ${basilTop.toFixed(1)})`)

    // Drag the basil well clear of the zucchini; watch the ring while it happens.
    const sawGreen = watchFor(() => main.getWarningRingState(basil) === "green", 6000)
    await interactor.dragToPoint(interactor.interactable(basil), main.bedToWorld(-30, SOIL_Y, -290))
    checkNear(plant(main, basil).x, -30, 2, "basil x after the drag (bed cm)")
    checkNear(plant(main, basil).z, -290, 2, "basil z after the drag (bed cm)")
    check(await sawGreen, "basil ring turned green after moving out of trouble")

    // The line fades and no warning remains.
    await waitUntil(() => !lineSO.enabled, 3000, "WarningLine to disappear")
    check(main.getActiveWarning() === null, "no active warning after the fix")
    await waitUntil(() => main.getWarningRingState(basil) === "hidden", 3000, "basil ring to clear after its green second")
    await sleep(300)
    check(main.getActiveWarning() === null, "still no warning a moment later")

    log("C3 passed")
  }
}
