/**
 * PlotTwistLeafInteractor — LEAF's default (far-field, mouse-like) interactor with two
 * frame-rate-independent drags.
 *
 * LEAF's built-in drag() adds its vector on EVERY drag-update frame, so the total distance
 * depends on the frame rate. These helpers still go through drag() (so SIK raises the real
 * DragStart / DragUpdate / DragEnd events on the target), but steer the pinch point to an
 * exact place:
 *   - dragToPoint: the pointer glides to a world point (ray from the eyes through it) and
 *     holds there before release — like aiming at a spot on the soil and letting go.
 *   - dragBy: the pointer moves by an exact world offset in total — like sliding a knob.
 */
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import {log} from "./PlotTwistLeafHelpers"

/** Fraction of the drag spent moving; the rest holds still at the goal before release. */
const MOVE_FRACTION = 0.6

export class PlotTwistLeafInteractor extends DefaultLeafInteractor {
  constructor() {
    super("PlotTwistLeafInteractor")
  }

  interactable(name: string): Interactable {
    const it = findInteractableByName(name, undefined, true)
    if (!it) throw new Error(`Interactable "${name}" not found or not enabled`)
    return it
  }

  /** Pinch-and-release (a tap) on the named interactable. */
  async tap(name: string): Promise<void> {
    log(`tap ${name}`)
    await this.trigger(this.interactable(name))
    await sleep(300)
  }

  /** Pinch `target`, glide the pinch point to `goalWorld`, hold, release. */
  async dragToPoint(target: Interactable, goalWorld: vec3, durationMs: number = 1000): Promise<void> {
    log(`dragToPoint ${target.getSceneObject().name} -> ${goalWorld.toString()}`)
    const camera = WorldCameraFinderProvider.getInstance()
    let from: vec3 | null = null
    let t0 = 0
    const unsubscribe = target.onDragUpdate.add(() => {
      const now = getTime() * 1000
      if (from === null) {
        from = this.endPoint
        t0 = now
      }
      const a = from as vec3
      const k = Math.min(1, (now - t0) / (durationMs * MOVE_FRACTION))
      this.startPoint = camera.getWorldPosition()
      this.endPoint = vec3.lerp(a, goalWorld, k)
    })
    try {
      await this.drag(target, vec3.zero(), durationMs)
    } finally {
      unsubscribe()
    }
    await sleep(300)
  }

  /** Pinch `target` and move the pinch point by `deltaWorld` in total, then release. */
  async dragBy(target: Interactable, deltaWorld: vec3, durationMs: number = 1000): Promise<void> {
    log(`dragBy ${target.getSceneObject().name} by ${deltaWorld.toString()}`)
    let fromStart: vec3 | null = null
    let fromEnd: vec3 | null = null
    let t0 = 0
    const unsubscribe = target.onDragUpdate.add(() => {
      const now = getTime() * 1000
      if (fromStart === null || fromEnd === null) {
        fromStart = this.startPoint
        fromEnd = this.endPoint
        t0 = now
      }
      const s = fromStart as vec3
      const e = fromEnd as vec3
      const k = Math.min(1, (now - t0) / (durationMs * MOVE_FRACTION))
      const d = deltaWorld.uniformScale(k)
      this.startPoint = s.add(d)
      this.endPoint = e.add(d)
    })
    try {
      await this.drag(target, vec3.zero(), durationMs)
    } finally {
      unsubscribe()
    }
    await sleep(300)
  }
}
