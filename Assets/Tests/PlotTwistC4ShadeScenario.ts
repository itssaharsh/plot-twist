/**
 * Done criterion 4: In July and August the tomatoes cast a lavender shade patch toward the
 * east-northeast; a basil inside it gets a shade warning, a lettuce inside it gets a green tick.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {
  check,
  checkEq,
  checkNear,
  freshPlot,
  log,
  plantAtOrThrow,
  sceneObject,
  waitUntil,
  worldAabb,
} from "./PlotTwistLeafHelpers"
import {PlotTwistLeafInteractor} from "./PlotTwistLeafInteractor"

@component
export class PlotTwistC4ShadeScenario extends Scenario {
  async run(): Promise<void> {
    const main = await freshPlot()
    const interactor = new PlotTwistLeafInteractor()

    // Tomato near the west rim; basil and lettuce east-northeast of it (in its 4 pm shadow),
    // spaced so nothing crowds; a control lettuce south of the tomato (out of the shadow).
    const tomato = plantAtOrThrow(main, "Tomato", -40, -200)
    const basil = plantAtOrThrow(main, "Basil", 40.6, -201.2)
    const shadedLettuce = plantAtOrThrow(main, "Lettuce", 6.7, -226.8)
    const sunnyLettuce = plantAtOrThrow(main, "Lettuce", -40, -120)
    const patchName = `ShadePatch_${tomato}`

    const sliderIt = interactor.interactable("MonthSlider")
    const right = sceneObject("MonthSlider").getTransform().right

    // June: no shade yet.
    await interactor.dragBy(sliderIt, right.uniformScale(19))
    const june = main.getMonth()
    check(june >= 0.8 && june < 2, `slider is in June (month ${june.toFixed(2)})`)
    check(!sceneObject(patchName).enabled, `${patchName} hidden in June`)

    // July: drag on to ~2.1.
    await interactor.dragBy(sliderIt, right.uniformScale(80))
    await interactor.dragBy(sliderIt, right.uniformScale(-17))
    const july = main.getMonth()
    check(july >= 2 && july < 2.95, `slider is in July (month ${july.toFixed(2)})`)
    const patchSO = sceneObject(patchName)
    check(patchSO.isEnabledInHierarchy, `${patchName} visible in July`)

    // Lavender (light, blue-violet) — not dark.
    const rmv = patchSO.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
    const c = rmv.mainMaterial.mainPass.baseColor as vec4
    log(`shade colour = ${c.toString()}`)
    check(c.z >= c.x && c.x > c.y && c.y >= 0.6, "shade patch colour is light lavender")

    // Toward the east-northeast: the patch reaches east (+x) and a little north (-z) of the tomato.
    const tomatoPos = sceneObject(tomato).getTransform().getWorldPosition()
    const box = worldAabb(patchSO)
    log(`patch AABB min=${box.min.toString()} max=${box.max.toString()} tomato=${tomatoPos.toString()}`)
    check(box.center.x > tomatoPos.x + 25, "patch extends east of the tomato")
    check(box.max.x > tomatoPos.x + 80, "patch reaches well east (shadow ~1.6 x height)")
    check(box.min.x > tomatoPos.x - 25, "patch does not extend west of the tomato's footprint")
    check(box.min.z < tomatoPos.z - 25, "patch reaches north of the tomato (ENE tilt)")

    // July: lettuce in shade gets its tick; warnings wait for August.
    check(sceneObject("ShadeTick", sceneObject(shadedLettuce)).enabled, "shaded lettuce shows a green tick in July")
    check(!sceneObject("ShadeTick", sceneObject(sunnyLettuce)).enabled, "sunny lettuce shows no tick in July")
    check(main.getActiveWarning() === null, "no warnings in July")

    // August: the basil gets the shade warning.
    await interactor.dragBy(sliderIt, right.uniformScale(80))
    checkNear(main.getMonth(), 3, 0.01, "month after dragging to Aug")
    check(sceneObject(patchName).isEnabledInHierarchy, `${patchName} visible in August`)
    await waitUntil(() => main.getActiveWarning() !== null, 3000, "a warning to show in August")
    const w = main.getActiveWarning()!
    checkEq(w.plantName, basil, "warned plant")
    checkEq(w.kind, "shade", "warning kind")
    checkEq(w.text, "Tomato shades this at 4 pm", "warning text")
    checkEq(main.getWarningRingState(basil), "amber", "basil warning ring")
    checkEq(main.getUiState().warningLine, "Tomato shades this at 4 pm", "WarningLine text")
    check(sceneObject("ShadeTick", sceneObject(shadedLettuce)).enabled, "shaded lettuce shows a green tick in August")
    check(!sceneObject("ShadeTick", sceneObject(sunnyLettuce)).enabled, "sunny lettuce shows no tick in August")
    checkEq(main.getWarningRingState(shadedLettuce), "hidden", "shaded lettuce has no warning ring")

    // Back to May: shade and ticks go away.
    await interactor.dragBy(sliderIt, right.uniformScale(-80))
    check(!sceneObject(patchName).enabled, `${patchName} hidden in May`)
    check(!sceneObject("ShadeTick", sceneObject(shadedLettuce)).enabled, "tick hidden in May")

    log("C4 passed")
  }
}
