/**
 * PlotTwistSoilDrag — turns a SIK drag (hand ray, mouse, or LEAF's scripted interactor)
 * into a point on the soil plane, in PlotRoot-local cm.
 *
 * Rule (same code path for every interactor):
 *   1. If the interactor's drag point (endPoint, else grab point + summed drag vectors)
 *      already lies on the soil plane (±3 cm) → use it directly. A scripted drag that
 *      ends on the soil lands exactly there.
 *   2. Else intersect the interactor ray (startPoint + direction) with the soil plane.
 *   3. Else project the drag point from the camera onto the soil plane.
 * Must not: decide whether the point is a valid planting spot — callers check the bed.
 */
import {DragInteractorEvent, InteractorEvent} from "SpectaclesInteractionKit.lspkg/Core/Interactor/InteractorEvent"
import {BED} from "./PlotTwistPlantData"

export class SoilDragTracker {
  private grabWorld: vec3 | null = null
  private dragSum: vec3 = vec3.zero()
  private lastLocal: vec3 | null = null

  constructor(
    private plotRoot: Transform,
    private cameraTransform: Transform,
  ) {}

  /** Call on drag start (or trigger start). `fallbackWorld` is used when the event has no hit point. */
  begin(ev: InteractorEvent, fallbackWorld: vec3): void {
    const it = ev.interactor
    const hit = it ? it.targetHitPosition : null
    this.grabWorld = hit ? hit : fallbackWorld
    this.dragSum = vec3.zero()
    this.lastLocal = null
    const de = ev as DragInteractorEvent
    if (de.dragVector) this.dragSum = this.dragSum.add(de.dragVector)
    this.lastLocal = this.compute(ev)
  }

  /** Call on every drag update; returns the soil point (PlotRoot-local) or null. */
  update(ev: DragInteractorEvent): vec3 | null {
    if (ev.dragVector) this.dragSum = this.dragSum.add(ev.dragVector)
    this.lastLocal = this.compute(ev)
    return this.lastLocal
  }

  /** The last computed soil point (drag end repeats the previous frame's vector, so we don't re-sum). */
  get last(): vec3 | null {
    return this.lastLocal
  }

  /**
   * Call on drag end: the soil point under the pointer at the moment of release (no drag vector
   * is summed again). Falls back to the last tracked point. Using the release position, not the
   * previous frame's, keeps the drop exactly where the user let go even at low frame rates.
   */
  finish(ev: InteractorEvent): vec3 | null {
    const q = this.compute(ev)
    if (q) this.lastLocal = q
    return this.lastLocal
  }

  private soilYWorld(): number {
    return this.plotRoot.getWorldTransform().multiplyPoint(new vec3(0, BED.soilY, 0)).y
  }

  private toLocal(world: vec3): vec3 {
    return this.plotRoot.getInvertedWorldTransform().multiplyPoint(world)
  }

  private compute(ev: InteractorEvent): vec3 | null {
    const soilY = this.soilYWorld()
    const it = ev.interactor
    // 1. Drag point already on the soil plane.
    let dragPoint: vec3 | null = it && it.endPoint ? it.endPoint : null
    if (!dragPoint && this.grabWorld) dragPoint = this.grabWorld.add(this.dragSum)
    if (dragPoint && Math.abs(dragPoint.y - soilY) <= 3) {
      return this.toLocal(new vec3(dragPoint.x, soilY, dragPoint.z))
    }
    // 2. Ray ∩ soil plane.
    const origin = it ? it.startPoint : null
    const dir = it ? it.direction : null
    if (origin && dir && dir.y < -0.02) {
      const t = (soilY - origin.y) / dir.y
      if (t > 0) return this.toLocal(origin.add(dir.uniformScale(t)))
    }
    // 3. Camera → drag point projected onto the soil plane.
    if (dragPoint) {
      const cam = this.cameraTransform.getWorldPosition()
      const d = dragPoint.sub(cam)
      if (d.y < -0.01) {
        const t = (soilY - cam.y) / d.y
        if (t > 0) return this.toLocal(cam.add(d.uniformScale(t)))
      }
    }
    return null
  }
}
