/**
 * PlotTwistPointer — the small off-view arrow at the near edge of the bed.
 *
 * Owns: the authored `OffViewArrow` SceneObject (geometry built here), the "is it in view?"
 *       test against the main camera, and the soft chime when the arrow appears.
 * Used for: the active warning's plant (August) and the current dig spot (planting mode).
 * Must not: pick the target — callers pass a PlotRoot-local point or null.
 */
import {buildArrow} from "./PlotTwistMeshFactory"
import {BED} from "./PlotTwistPlantData"

const ARROW_COLOR = new vec4(1.0, 0.78, 0.3, 1.0)
const CHIME_COOLDOWN_SEC = 3

export class PlotTwistPointer {
  private arrowVisual: SceneObject
  private lastChime = -100
  private wasVisible = false

  constructor(
    private arrowRoot: SceneObject,
    private plotRoot: Transform,
    private camera: Camera,
    overlayMaterial: Material,
    private playChime: () => void,
  ) {
    this.arrowVisual = global.scene.createSceneObject("ArrowMesh")
    this.arrowVisual.setParent(arrowRoot)
    const rmv = this.arrowVisual.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    rmv.mesh = buildArrow(11, 7)
    const mat = overlayMaterial.clone()
    mat.mainPass.baseColor = ARROW_COLOR
    rmv.mainMaterial = mat
    this.arrowRoot.enabled = false
  }

  get visible(): boolean {
    return this.arrowRoot.enabled
  }

  /** True when the PlotRoot-local point is inside the camera's view. */
  isInView(local: vec3): boolean {
    const world = this.plotRoot.getWorldTransform().multiplyPoint(local)
    const camT = this.camera.getSceneObject().getTransform()
    const toPoint = world.sub(camT.getWorldPosition())
    const camForward = camT.getWorldRotation().multiplyVec3(new vec3(0, 0, -1))
    if (toPoint.dot(camForward) <= 0) return false
    const s = this.camera.worldSpaceToScreenSpace(world)
    return s.x >= 0.03 && s.x <= 0.97 && s.y >= 0.03 && s.y <= 0.97
  }

  /** Point at `local` (PlotRoot-local) when it is out of view; hide otherwise. */
  update(local: vec3 | null, now: number): void {
    if (!local || this.isInView(local)) {
      this.arrowRoot.enabled = false
      this.wasVisible = false
      return
    }
    const x = Math.max(-50, Math.min(50, local.x))
    const pos = new vec3(x, BED.soilY + BED.rimAboveSoilCm + 1.0, BED.nearZ - BED.rimThicknessCm / 2)
    this.arrowRoot.getTransform().setLocalPosition(pos)
    const dx = local.x - pos.x
    const dz = local.z - pos.z
    const yaw = Math.atan2(-dx, -dz)
    this.arrowRoot.getTransform().setLocalRotation(quat.fromEulerAngles(0, yaw, 0))
    this.arrowRoot.enabled = true
    if (!this.wasVisible && now - this.lastChime > CHIME_COOLDOWN_SEC) {
      this.lastChime = now
      this.playChime()
    }
    this.wasVisible = true
  }

  hide(): void {
    this.arrowRoot.enabled = false
    this.wasVisible = false
  }
}
