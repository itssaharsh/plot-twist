/**
 * PlotTwistWarnings — the August warning sequencer: one problem at a time, worst first.
 *
 * Owns: which warning is active, its amber ring (pulses twice, then holds), the green
 *       "resolved" second, and handing the line text/position to the Guidance UI.
 * Reads: plant plans from the Garden, candidates from PlotTwistGeometry.evaluateWarnings.
 * Must not: move plants or own plant state.
 */
import {PlotTwistGarden} from "./PlotTwistGarden"
import {WarningKind, evaluateWarnings, isAugust} from "./PlotTwistGeometry"
import {PlotTwistGuidanceUI} from "./PlotTwistGuidanceUI"
import {PlotTwistPointer} from "./PlotTwistPointer"

const AMBER = new vec4(1.0, 0.72, 0.2, 1.0)
const GREEN = new vec4(0.45, 0.95, 0.5, 1.0)
const PULSE_SEC = 0.55 // one pulse; two pulses then hold
const RESOLVE_SEC = 1.0 // green ring hold
const LINE_FADE_SEC = 0.5
const LINE_ABOVE_TOP_CM = 10

export interface ActiveWarning {
  plantName: string
  kind: WarningKind
  text: string
}

type Phase = "idle" | "showing" | "resolving"

export class PlotTwistWarnings {
  private phase: Phase = "idle"
  private active: ActiveWarning | null = null
  private phaseStart = 0

  constructor(
    private garden: PlotTwistGarden,
    private guidance: PlotTwistGuidanceUI,
    private pointer: PlotTwistPointer,
    private plotRoot: Transform,
    private crowdingThresholdCm: number,
  ) {}

  /** The warning currently on show (null while idle or during the green "resolved" second). */
  get current(): ActiveWarning | null {
    return this.phase === "showing" ? this.active : null
  }

  ringState(plantName: string): "hidden" | "amber" | "green" {
    if (!this.active || this.active.plantName !== plantName) return "hidden"
    return this.phase === "showing" ? "amber" : this.phase === "resolving" ? "green" : "hidden"
  }

  /** Called every frame. `enabled` is false in planting mode. */
  update(now: number, month: number, enabled: boolean): void {
    if (!enabled || !isAugust(month)) {
      if (this.phase !== "idle") this.clearImmediate()
      return
    }
    const candidates = evaluateWarnings(this.garden.plans(), this.crowdingThresholdCm)

    if (this.phase === "showing" && this.active) {
      const same = candidates.find((c) => c.plantName === this.active!.plantName && c.kind === this.active!.kind)
      if (same) {
        if (same.text !== this.active.text) {
          this.active.text = same.text
          this.guidance.setWarningText(same.text)
        }
      } else {
        this.startResolve(now)
      }
    } else if (this.phase === "resolving") {
      if (now - this.phaseStart >= RESOLVE_SEC) {
        this.hideRing(this.active ? this.active.plantName : null)
        this.active = null
        this.phase = "idle"
      }
    }

    if (this.phase === "idle" && candidates.length > 0) {
      const c = candidates[0]
      this.active = {plantName: c.plantName, kind: c.kind, text: c.text}
      this.phase = "showing"
      this.phaseStart = now
      this.guidance.showWarningLine(c.text)
    }

    this.animate(now)
  }

  clearImmediate(): void {
    if (this.active) this.hideRing(this.active.plantName)
    this.active = null
    this.phase = "idle"
    this.guidance.hideWarningLine()
    this.pointer.hide()
  }

  private startResolve(now: number): void {
    this.phase = "resolving"
    this.phaseStart = now
    this.guidance.fadeOutWarningLine(LINE_FADE_SEC)
    this.pointer.hide()
  }

  private hideRing(name: string | null): void {
    if (!name) return
    const p = this.garden.find(name)
    if (p) p.warningRing.enabled = false
  }

  private animate(now: number): void {
    if (!this.active) return
    const p = this.garden.find(this.active.plantName)
    if (!p) {
      this.clearImmediate()
      return
    }
    const t = now - this.phaseStart
    p.warningRing.enabled = true
    if (this.phase === "showing") {
      let s = 1
      // Two outward pulses (|sin| keeps the second beat a swell, not a shrink), then hold.
      if (t < PULSE_SEC * 2) s = 1 + 0.14 * Math.abs(Math.sin((t / PULSE_SEC) * Math.PI))
      p.warningRing.getTransform().setLocalScale(new vec3(s, 1, s))
      p.warningMat.mainPass.baseColor = AMBER
      // Line sits ~10 cm above the plant's top and follows it while dragged.
      const local = new vec3(p.x, p.root.getTransform().getLocalPosition().y + p.heightCm + LINE_ABOVE_TOP_CM, p.z)
      const parent = p.root.getParent()
      const world = parent ? parent.getTransform().getWorldTransform().multiplyPoint(local) : local
      this.guidance.setWarningLinePosition(world)
      this.pointer.update(this.plotRoot.getInvertedWorldTransform().multiplyPoint(p.root.getTransform().getWorldPosition()), now)
    } else if (this.phase === "resolving") {
      p.warningRing.getTransform().setLocalScale(vec3.one())
      p.warningMat.mainPass.baseColor = GREEN
    }
  }
}
