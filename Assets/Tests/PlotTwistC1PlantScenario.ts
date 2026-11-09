/**
 * Done criterion 1: Dragging a seed packet over the soil and releasing it places a seedling
 * at that spot with a ring of its spacing; the packet stays so I can plant another.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {
  SOIL_Y,
  check,
  checkEq,
  checkNear,
  freshPlot,
  log,
  sceneObject,
  worldAabb,
} from "./PlotTwistLeafHelpers"
import {PlotTwistLeafInteractor} from "./PlotTwistLeafInteractor"

@component
export class PlotTwistC1PlantScenario extends Scenario {
  async run(): Promise<void> {
    const main = await freshPlot()
    const interactor = new PlotTwistLeafInteractor()

    const packetSO = sceneObject("SeedPacket_Tomato")
    const packetPosBefore = packetSO.getTransform().getWorldPosition()
    const packet = interactor.interactable("SeedPacket_Tomato")

    // 1. Drag the tomato packet onto the soil and let go.
    await interactor.dragToPoint(packet, main.bedToWorld(-20, SOIL_Y, -200))
    let plants = main.getPlants()
    checkEq(plants.length, 1, "plants after first packet drag")
    const first = plants[0]
    checkEq(first.type, "Tomato", "first plant type")
    checkNear(first.x, -20, 2, "first plant x (bed cm)")
    checkNear(first.z, -200, 2, "first plant z (bed cm)")
    checkNear(first.heightCm, 8, 0.01, "seedling height in May")
    checkNear(first.footprintCm, 8, 0.01, "seedling width in May")

    // 2. The seedling shows a ring of its spacing (tomato: 24 in = 61 cm).
    const plantSO = sceneObject(first.name)
    const ring = sceneObject("SpacingRing", plantSO)
    check(ring.enabled, `${first.name}/SpacingRing is visible right after the drop`)
    const ringBox = worldAabb(ring)
    checkNear(ringBox.size.x, 61, 2, "spacing ring diameter (x) in cm")
    checkNear(ringBox.size.z, 61, 2, "spacing ring diameter (z) in cm")
    const plantPos = plantSO.getTransform().getWorldPosition()
    checkNear(ringBox.center.x, plantPos.x, 1, "ring centred on the seedling (x)")
    checkNear(ringBox.center.z, plantPos.z, 1, "ring centred on the seedling (z)")

    // 3. The packet stays where it was.
    check(packetSO.isEnabledInHierarchy, "SeedPacket_Tomato is still visible")
    const moved = packetSO.getTransform().getWorldPosition().distance(packetPosBefore)
    checkNear(moved, 0, 0.5, "SeedPacket_Tomato moved distance (cm)")

    // 4. ...so I can plant another from the same packet.
    await interactor.dragToPoint(interactor.interactable("SeedPacket_Tomato"), main.bedToWorld(20, SOIL_Y, -290))
    plants = main.getPlants()
    checkEq(plants.length, 2, "plants after second drag from the same packet")
    checkEq(plants[1].type, "Tomato", "second plant type")
    checkNear(plants[1].x, 20, 2, "second plant x (bed cm)")
    checkNear(plants[1].z, -290, 2, "second plant z (bed cm)")
    check(sceneObject("SpacingRing", sceneObject(plants[1].name)).enabled, "second seedling shows its spacing ring")

    // 5. Brief default: letting go off the soil plants nothing.
    await interactor.dragToPoint(interactor.interactable("SeedPacket_Lettuce"), main.bedToWorld(-110, SOIL_Y, -200))
    checkEq(main.getPlants().length, 2, "plants after releasing a packet off the soil")

    log("C1 passed")
  }
}
