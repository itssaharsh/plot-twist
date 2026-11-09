/**
 * PlotTwistPlanting — "Plant it" mode: one dig spot at a time, in placement order.
 *
 * Owns: the dig-spot index, the chalk-white X under the authored `DigSpot` object,
 *       advancing on Done (soft chime) and the final "Your bed is planted" (success chime).
 * Reads: plant positions from the Garden (plants stay where the user put them).
 * Must not: move or resize plants (Main dims them and shows them at seedling size).
 */
import {PlantEntity, PlotTwistGarden} from "./PlotTwistGarden"
import {PlotTwistGuidanceUI} from "./PlotTwistGuidanceUI"
import {buildCross} from "./PlotTwistMeshFactory"
import {BED, PLANT_SPECS} from "./PlotTwistPlantData"
import {PlotTwistPointer} from "./PlotTwistPointer"

const CHALK = new vec4(0.98, 0.98, 0.95, 1)
const X_SIZE_CM = 12
const X_STROKE_CM = 1.8

export class PlotTwistPlanting {
  private order: PlantEntity[] = []
  private index = -1
  private _active = false

  constructor(
    private garden: PlotTwistGarden,
    private guidance: PlotTwistGuidanceUI,
    private pointer: PlotTwistPointer,
    private digSpot: SceneObject,
    private plotRoot: Transform,
    overlayMaterial: Material,
    private playChime: () => void,
    private playSuccess: () => void,
  ) {
    const x = global.scene.createSceneObject("ChalkX")
    x.setParent(digSpot)
    const rmv = x.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    rmv.mesh = buildCross(X_SIZE_CM, X_STROKE_CM)
    const mat = overlayMaterial.clone()
    mat.mainPass.baseColor = CHALK
    rmv.mainMaterial = mat
    this.digSpot.enabled = false
  }

  get active(): boolean {
    return this._active
  }

  /** -1 when not planting; 0..n-1 = current spot; n = all planted. */
  get digSpotIndex(): number {
    return this._active ? this.index : -1
  }

  get total(): number {
    return this.order.length
  }

  get finished(): boolean {
    return this._active && this.index >= this.order.length
  }

  start(): void {
    this.order = this.garden.plants.slice().sort((a, b) => a.placedIndex - b.placedIndex)
    this._active = true
    this.index = 0
    this.guidance.hidePlanted()
    this.showSpot()
  }

  /** Done pressed on the current spot. */
  done(): void {
    if (!this._active || this.index >= this.order.length) return
    this.index++
    if (this.index < this.order.length) {
      this.playChime()
      this.showSpot()
    } else {
      this.digSpot.enabled = false
      this.guidance.hideDigSpot()
      this.pointer.hide()
      const world = this.plotRoot.getWorldTransform().multiplyPoint(new vec3(0, BED.soilY + 48, (BED.nearZ + BED.farZ) / 2 + 40))
      this.guidance.showPlanted(world)
      this.playSuccess()
    }
  }

  update(now: number): void {
    if (!this._active || this.index < 0 || this.index >= this.order.length) return
    const p = this.order[this.index]
    this.pointer.update(new vec3(p.x, BED.soilY, p.z), now)
  }

  reset(): void {
    this._active = false
    this.index = -1
    this.order = []
    this.digSpot.enabled = false
    this.guidance.hideDigSpot()
    this.guidance.hidePlanted()
    this.pointer.hide()
  }

  private showSpot(): void {
    const p = this.order[this.index]
    this.digSpot.getTransform().setLocalPosition(new vec3(p.x, BED.soilY + 0.8, p.z))
    this.digSpot.enabled = true
    const world = this.plotRoot.getWorldTransform().multiplyPoint(new vec3(p.x, BED.soilY, p.z))
    this.guidance.showDigSpot(PLANT_SPECS[p.type].plantingLine, world)
  }
}
