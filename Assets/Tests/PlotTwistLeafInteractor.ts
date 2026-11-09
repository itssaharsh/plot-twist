/**
 * PlotTwistLeafInteractor — LEAF's default (far-field, mouse-like) interactor with
 * frame-rate-independent drags and an optional visible SIK pinch cursor.
 *
 * LEAF's built-in drag() adds its vector on EVERY drag-update frame, so the total distance
 * depends on the frame rate. These helpers still go through drag() (so SIK raises the real
 * DragStart / DragUpdate / DragEnd events on the target), but steer the pinch point to an
 * exact place:
 *   - dragToPoint: the pointer glides to a world point (ray from the eyes through it) and
 *     holds there before release — like aiming at a spot on the soil and letting go.
 *   - dragBy: the pointer moves by an exact world offset in total — like sliding a knob.
 *
 * showCursor() attaches SIK's own InteractorCursor to this interactor and keeps it on the
 * simulated pinch point, so a screen recording shows where the "hand" is (used by the demo).
 */
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {nextFrame, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {InteractorCursor} from "SpectaclesInteractionKit.lspkg/Components/Interaction/InteractorCursor/InteractorCursor"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import {log} from "./PlotTwistLeafHelpers"

export interface DragOptions {
  /** Fraction of the drag spent moving; the rest holds still at the goal before release. Default 0.6. */
  moveFraction?: number
  /** Ease in and out (smoothstep) instead of moving at constant speed. Default false. */
  ease?: boolean
  /** Pause after release, ms. Default 300. */
  settleMs?: number
}

function progress(t0: number, now: number, moveMs: number, ease: boolean): number {
  const k = Math.max(0, Math.min(1, (now - t0) / Math.max(1, moveMs)))
  return ease ? k * k * (3 - 2 * k) : k
}

export class PlotTwistLeafInteractor extends DefaultLeafInteractor {
  private cursor: InteractorCursor | null = null
  private cursorObject: SceneObject | null = null
  private cursorPoint: vec3 | null = null

  constructor() {
    super("PlotTwistLeafInteractor")
  }

  interactable(name: string): Interactable {
    const it = findInteractableByName(name, undefined, true)
    if (!it) throw new Error(`Interactable "${name}" not found or not enabled`)
    return it
  }

  // ── Visible pinch cursor (optional) ──────────────────────────────────────

  /** Attach SIK's InteractorCursor to this interactor. Returns false if SIK refuses (demo goes on without it). */
  showCursor(startWorld: vec3): boolean {
    try {
      this.cursorObject = global.scene.createSceneObject("LeafDemoPinchCursor")
      const c = this.cursorObject.createComponent(InteractorCursor.getTypeName()) as InteractorCursor
      c.interactor = this.sikInteractor
      this.cursor = c
      this.setCursor(startWorld)
      return true
    } catch (e) {
      log(`showCursor: SIK cursor unavailable (${e}); continuing without it`)
      this.hideCursor()
      return false
    }
  }

  hideCursor(): void {
    if (this.cursorObject) this.cursorObject.destroy()
    this.cursorObject = null
    this.cursor = null
  }

  private setCursor(p: vec3): void {
    this.cursorPoint = p
    if (this.cursor) {
      try {
        this.cursor.cursorPosition = p
      } catch (e) {
        this.cursor = null
      }
    }
  }

  /** Glide the visible cursor to `p` over `ms` (no-op without a cursor, apart from the wait). */
  async glideCursorTo(p: vec3, ms: number): Promise<void> {
    const from = this.cursorPoint
    if (!this.cursor || !from || ms <= 0) {
      if (this.cursor) this.setCursor(p)
      await sleep(Math.max(0, ms))
      return
    }
    const t0 = getTime() * 1000
    while (true) {
      const k = progress(t0, getTime() * 1000, ms, true)
      this.setCursor(vec3.lerp(from, p, k))
      if (k >= 1) break
      await nextFrame()
    }
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  /** Pinch-and-release (a tap) on the named interactable. */
  async tap(name: string, settleMs: number = 300): Promise<void> {
    log(`tap ${name}`)
    const target = this.interactable(name)
    if (this.cursor) this.setCursor(target.getTransform().getWorldPosition())
    await this.trigger(target)
    await sleep(settleMs)
  }

  /** Pinch `target`, glide the pinch point to `goalWorld`, hold, release. */
  async dragToPoint(target: Interactable, goalWorld: vec3, durationMs: number = 1000, opts: DragOptions = {}): Promise<void> {
    log(`dragToPoint ${target.getSceneObject().name} -> ${goalWorld.toString()}`)
    const moveMs = durationMs * (opts.moveFraction ?? 0.6)
    const ease = opts.ease ?? false
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
      const p = vec3.lerp(a, goalWorld, progress(t0, now, moveMs, ease))
      this.startPoint = camera.getWorldPosition()
      this.endPoint = p
      if (this.cursor) this.setCursor(p)
    })
    try {
      await this.drag(target, vec3.zero(), durationMs)
    } finally {
      unsubscribe()
    }
    if (this.cursor) this.setCursor(goalWorld)
    await sleep(opts.settleMs ?? 300)
  }

  /** Pinch `target` and move the pinch point by `deltaWorld` in total, then release. */
  async dragBy(target: Interactable, deltaWorld: vec3, durationMs: number = 1000, opts: DragOptions = {}): Promise<void> {
    log(`dragBy ${target.getSceneObject().name} by ${deltaWorld.toString()}`)
    const moveMs = durationMs * (opts.moveFraction ?? 0.6)
    const ease = opts.ease ?? false
    let fromStart: vec3 | null = null
    let fromEnd: vec3 | null = null
    let cursorFrom: vec3 | null = null
    let t0 = 0
    const unsubscribe = target.onDragUpdate.add(() => {
      const now = getTime() * 1000
      if (fromStart === null || fromEnd === null) {
        fromStart = this.startPoint
        fromEnd = this.endPoint
        cursorFrom = this.cursorPoint ?? this.endPoint
        t0 = now
      }
      const s = fromStart as vec3
      const e = fromEnd as vec3
      const d = deltaWorld.uniformScale(progress(t0, now, moveMs, ease))
      this.startPoint = s.add(d)
      this.endPoint = e.add(d)
      if (this.cursor && cursorFrom) this.setCursor((cursorFrom as vec3).add(d))
    })
    try {
      await this.drag(target, vec3.zero(), durationMs)
    } finally {
      unsubscribe()
    }
    await sleep(opts.settleMs ?? 300)
  }
}
