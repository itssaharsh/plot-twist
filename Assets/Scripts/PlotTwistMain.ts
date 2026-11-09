/**
 * PlotTwistMain — orchestration for Plot Twist (plan a raised bed, see it in August).
 *
 * Owns: the month (single source of truth), planting-mode flag, and wiring between the
 *       UI modules (passive views) and the controllers:
 *         PlotTwistGarden   – plants (state + visuals + drag-to-move)
 *         PlotTwistShade    – lavender 4 pm shade patches (Jul/Aug)
 *         PlotTwistWarnings – one August warning at a time, worst first
 *         PlotTwistPlanting – "Plant it" dig spots
 *         PlotTwistPointer  – off-view arrow + chime
 * Expects @inputs: authored roots (PlotRoot, Plants, ShadePatches, GhostSeedling, DigSpot,
 *       OffViewArrow), the four UI modules, the overlay material, plant models, SFX tracks.
 * Exposes a read-only test surface (getMonth, getPlants, getActiveWarning, …) plus helpers
 *       that run the SAME code paths as the real interactions (setMonth, plantAt, movePlant,
 *       pressPlantIt, pressDone).
 * Must not: create Text / UIKit (that lives in the *UI.ts modules).
 * Size note: ~680 lines because ~250 of them are the public test surface the LEAF suite uses
 *       (queries, synthetic-drag helpers, demo layout, state snapshot). Orchestration itself is
 *       the init / month / packet-drag / planting / update sections.
 */
import {DragInteractorEvent} from "SpectaclesInteractionKit.lspkg/Core/Interactor/InteractorEvent"
import {PlantEntity, PlotTwistGarden} from "./PlotTwistGarden"
import {lettuceInShade, pointInRect} from "./PlotTwistGeometry"
import {PlotTwistAudio} from "./PlotTwistAudio"
import {PlotTwistGuidanceUI} from "./PlotTwistGuidanceUI"
import {PlotTwistMonthSliderUI} from "./PlotTwistMonthSliderUI"
import {BED, MONTH_MAX, PLANT_TYPES, PlantType, SOIL_RECT} from "./PlotTwistPlantData"
import {PlotTwistPlantItUI} from "./PlotTwistPlantItUI"
import {PlotTwistPlanting} from "./PlotTwistPlanting"
import {PlotTwistPointer} from "./PlotTwistPointer"
import {PacketDragEvent, PlotTwistSeedPacketsUI} from "./PlotTwistSeedPacketsUI"
import {PlotTwistShade} from "./PlotTwistShade"
import {SoilDragTracker} from "./PlotTwistSoilDrag"
import {ActiveWarning, PlotTwistWarnings} from "./PlotTwistWarnings"

export interface PlantInfo {
  name: string
  type: PlantType
  x: number
  z: number
  heightCm: number
  footprintCm: number
  placedIndex: number
}

@component
export class PlotTwistMain extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">PlotTwistMain – raised-bed planner orchestration + test API</span>')
  @ui.separator

  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("Main camera (Camera Object) — used for drag rays and the off-view test")
  camera!: Camera
  @input
  @hint("PlotRoot: every bed coordinate is local to this object (move it to re-seat the bed)")
  plotRoot!: SceneObject
  @input
  @hint("Container for planted Plant_<Type>_<n> objects")
  plantsRoot!: SceneObject
  @input
  @hint("Container for ShadePatch_<plant> objects")
  shadeRoot!: SceneObject
  @input
  @hint("Ghost seedling + faint spacing ring shown while a packet is dragged")
  ghostSeedling!: SceneObject
  @input
  @hint("Chalk-X dig spot shown in planting mode")
  digSpot!: SceneObject
  @input
  @hint("Small arrow at the near edge of the bed pointing at off-view targets")
  offViewArrow!: SceneObject
  @input
  @hint("Seed packet row (UI module)")
  seedPackets!: PlotTwistSeedPacketsUI
  @input
  @hint("May→Aug slider (UI module)")
  monthSlider!: PlotTwistMonthSliderUI
  @input
  @hint("Plant it button (UI module)")
  plantIt!: PlotTwistPlantItUI
  @input
  @hint("Warning line, dig spot line + Done, planted message (UI module)")
  guidance!: PlotTwistGuidanceUI
  @input
  @hint("Unlit, transparent, two-sided base material cloned for rings, shade, X, tick, arrow, ghost, dim")
  overlayMaterial!: Material
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Assets (swap freely)</span>')
  @ui.group_start("Assets")
  @input
  @hint("Tomato plant model, August size (61 × 122 × 61 cm)")
  tomatoModel!: ObjectPrefab
  @input
  @hint("Zucchini plant model, August size (76 × 61 × 76 cm)")
  zucchiniModel!: ObjectPrefab
  @input
  @hint("Basil plant model, August size (61 × 46 × 61 cm)")
  basilModel!: ObjectPrefab
  @input
  @hint("Lettuce plant model, August size (20 × 15 × 20 cm)")
  lettuceModel!: ObjectPrefab
  @input
  @hint("Soft chime: next dig spot, off-view warning")
  softChime!: AudioTrackAsset
  @input
  @hint("Gentle success chime: bed planted")
  successChime!: AudioTrackAsset
  @input
  @hint("Soft tick when a packet or plant is picked up")
  pickupTick!: AudioTrackAsset
  @input
  @hint("Soft tick when a seedling is set down")
  dropTick!: AudioTrackAsset
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @widget(new SliderWidget(0, 6, 0.1))
  @hint("Seconds a new seedling keeps its spacing ring in May/Jun before it fades")
  ringHoldSeconds: number = 2
  @input
  @widget(new SliderWidget(0, 20, 0.5))
  @hint("August footprints must overlap by more than this (cm) to count as crowding")
  crowdingThresholdCm: number = 5
  @input("vec4", "{0.80,0.72,1.0,0.42}")
  @widget(new ColorWidget())
  @hint("Shade patch colour — light lavender, semi-transparent (dark vanishes on Specs)")
  shadeColor: vec4 = new vec4(0.8, 0.72, 1.0, 0.42)
  @input("vec4", "{0.34,0.42,0.32,0.5}")
  @widget(new ColorWidget())
  @hint("Plant colour while dimmed in planting mode")
  dimColor: vec4 = new vec4(0.34, 0.42, 0.32, 0.5)
  @input
  @widget(new SliderWidget(0, 1, 0.05))
  @hint("Volume of every sound cue")
  sfxVolume: number = 0.8
  @input
  @hint("At start, seat PlotRoot under the user: x/z + heading from the camera, floor under their feet")
  seatPlotAtUser: boolean = true
  @input
  @widget(new SliderWidget(120, 200, 1))
  @hint("Assumed standing eye height (cm) when the world origin is the user's eyes (on device)")
  eyeHeightCm: number = 160
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Debug</span>')
  @ui.group_start("Debug")
  @input
  @hint("Wireframe every collider (restart preview after toggling)")
  debugColliders: boolean = false
  @input
  @hint("Plant the brief's demo set (2 tomatoes, 1 zucchini, 3 basil, 4 lettuce) shortly after start — for demos and screenshots")
  demoLayoutOnStart: boolean = false
  @input
  @widget(new SliderWidget(0, 3, 0.05))
  @hint("Month the demo layout jumps to (0 = May … 3 = Aug)")
  demoStartMonth: number = 3
  @ui.group_end

  private garden!: PlotTwistGarden
  private shade!: PlotTwistShade
  private warnings!: PlotTwistWarnings
  private planting!: PlotTwistPlanting
  private pointer!: PlotTwistPointer
  private audio!: PlotTwistAudio
  private packetTracker: SoilDragTracker | null = null
  private ready = false
  private month = 0
  private plantingMode = false
  private shadeDirty = true
  private seatUntil = 0
  private seatLogged = false
  private demoDone = false
  private reportAt = -1

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.init())
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  // ── Public test surface (read-only queries) ──────────────────────────────

  /** True once init has run and the bed has been seated (≈0.6 s after start). Tests should wait for this. */
  isReady(): boolean {
    return this.ready && (!this.seatPlotAtUser || this.seatLogged)
  }

  getMonth(): number {
    return this.month
  }

  getPlants(): PlantInfo[] {
    if (!this.ready) return []
    return this.garden.plants.map((p) => ({
      name: p.name,
      type: p.type,
      x: p.x,
      z: p.z,
      heightCm: p.heightCm,
      footprintCm: p.footprintCm,
      placedIndex: p.placedIndex,
    }))
  }

  getActiveWarning(): ActiveWarning | null {
    if (!this.ready) return null
    const w = this.warnings.current
    return w ? {plantName: w.plantName, kind: w.kind, text: w.text} : null
  }

  getWarningRingState(plantName: string): "hidden" | "amber" | "green" {
    return this.ready ? this.warnings.ringState(plantName) : "hidden"
  }

  isPlantingMode(): boolean {
    return this.plantingMode
  }

  /** -1 when not planting; 0-based index of the lit dig spot; = plant count once the bed is planted. */
  getDigSpotIndex(): number {
    return this.ready ? this.planting.digSpotIndex : -1
  }

  getShadePatches(): {name: string; casterName: string; visible: boolean; vertexCount: number}[] {
    return this.ready ? this.shade.info() : []
  }

  isOffViewArrowVisible(): boolean {
    return this.ready ? this.pointer.visible : false
  }

  /** Bed geometry in PlotRoot-local cm (plantAt / movePlant / getPlants use this frame). */
  getBedInfo(): {soilY: number; minX: number; maxX: number; minZ: number; maxZ: number; plotRootWorld: vec3} {
    return {
      soilY: BED.soilY,
      minX: SOIL_RECT.minX,
      maxX: SOIL_RECT.maxX,
      minZ: SOIL_RECT.minZ,
      maxZ: SOIL_RECT.maxZ,
      plotRootWorld: this.plotRoot.getTransform().getWorldPosition(),
    }
  }

  /** Visible-state snapshot of the UI modules (for tests). */
  getUiState(): {
    packetsVisible: boolean
    sliderVisible: boolean
    plantItVisible: boolean
    plantItHint: string
    warningLine: string
    digSpotVisible: boolean
    digSpotLine: string
    plantedVisible: boolean
  } {
    return {
      packetsVisible: this.seedPackets.getSceneObject().enabled,
      sliderVisible: this.monthSlider.getSceneObject().enabled,
      plantItVisible: this.plantIt.getSceneObject().enabled,
      plantItHint: this.plantIt.getHintText(),
      warningLine: this.guidance.getWarningText(),
      digSpotVisible: this.digSpot.enabled,
      digSpotLine: this.guidance.getDigSpotText(),
      plantedVisible: this.guidance.isPlantedVisible(),
    }
  }

  /** PlotRoot-local (bed frame) → world. Handy for building LEAF drag deltas. */
  bedToWorld(x: number, y: number, z: number): vec3 {
    return this.plotRoot.getTransform().getWorldTransform().multiplyPoint(new vec3(x, y, z))
  }

  /** World → PlotRoot-local (bed frame). */
  worldToBed(world: vec3): vec3 {
    return this.plotRoot.getTransform().getInvertedWorldTransform().multiplyPoint(world)
  }

  // ── Public helpers that use the same code paths as the real interactions ──

  /** Moves the UIKit slider (value m/3) exactly like a committed user drag. */
  setMonth(m: number): void {
    if (!this.ready) return
    this.monthSlider.setMonth(m)
    this.applyMonth(m)
  }

  /** Plant a seedling at PlotRoot-local (x, z) — the packet-drop handler calls this too. */
  plantAt(type: PlantType, x: number, z: number): string | null {
    if (!this.ready || this.plantingMode) return null
    const p = this.garden.plantAt(type, x, z, getTime())
    if (!p) return null
    this.shadeDirty = true
    return p.name
  }

  /** Move a plant to PlotRoot-local (x, z) — same result as dragging it there. */
  movePlant(name: string, x: number, z: number): boolean {
    if (!this.ready || this.plantingMode) return false
    const ok = this.garden.movePlant(name, x, z)
    if (ok) this.shadeDirty = true
    return ok
  }

  pressPlantIt(): void {
    this.onPlantIt()
  }

  pressDone(): void {
    this.onDone()
  }

  /**
   * Drive the real packet drag handlers (tracker → ghost → drop → plantAt) with synthetic SIK
   * events whose drag point ends on the soil at bed-local (x, z). Returns the new plant's name.
   */
  simulatePacketDrop(type: PlantType, x: number, z: number): string | null {
    if (!this.ready || this.plantingMode) return null
    const grab = this.packetWorldPosition(type)
    const target = this.bedToWorld(x, BED.soilY, z)
    const before = this.garden.count
    this.onPacketDragStart({type, event: this.fakeDrag(grab, grab, vec3.zero())})
    this.onPacketDragUpdate({type, event: this.fakeDrag(target, grab, target.sub(grab))})
    this.onPacketDragEnd({type, event: this.fakeDrag(target, grab, vec3.zero())})
    return this.garden.count > before ? this.garden.plants[this.garden.count - 1].name : null
  }

  /** Drive a plant's real SIK drag handlers to bed-local (x, z). Off-soil targets snap back. */
  simulatePlantDrag(name: string, x: number, z: number): boolean {
    if (!this.ready) return false
    const p = this.garden.find(name)
    if (!p || !p.dragHandlers) return false
    const grab = p.root.getTransform().getWorldPosition()
    const target = this.bedToWorld(x, BED.soilY, z)
    p.dragHandlers.start(this.fakeDrag(grab, grab, vec3.zero()))
    p.dragHandlers.update(this.fakeDrag(target, grab, target.sub(grab)))
    p.dragHandlers.end(this.fakeDrag(target, grab, vec3.zero()))
    return Math.abs(p.x - x) < 0.01 && Math.abs(p.z - z) < 0.01
  }

  /** Plant the brief's demo set: a crowded basil, a shaded basil, two shaded lettuces. */
  plantDemoLayout(): string[] {
    const spots: [PlantType, number, number][] = [
      ["Tomato", -35, -290],
      ["Tomato", -35, -220],
      ["Zucchini", 25, -150],
      ["Basil", 35, -105], // crowded by the zucchini
      ["Basil", 30, -228], // in the tomato's 4 pm shade
      ["Basil", -30, -108],
      ["Lettuce", 40, -298], // in shade → green tick
      ["Lettuce", 50, -312], // in shade → green tick
      ["Lettuce", -45, -150],
      ["Lettuce", -45, -175],
    ]
    const names: string[] = []
    for (const [t, x, z] of spots) {
      const n = this.simulatePacketDrop(t, x, z)
      if (n) names.push(n)
    }
    return names
  }

  /** Clear the bed back to the start state (empty, May, not planting). For tests. */
  resetPlot(): void {
    if (!this.ready) return
    this.planting.reset()
    this.warnings.clearImmediate()
    this.garden.removeAll()
    this.shade.clear()
    this.plantingMode = false
    this.garden.setDimmed(false)
    this.garden.setInteractionEnabled(true)
    this.seedPackets.setVisible(true)
    this.monthSlider.setVisible(true)
    this.plantIt.setVisible(true)
    this.monthSlider.setMonth(0)
    this.applyMonth(0)
  }

  // ── Init ─────────────────────────────────────────────────────────────────

  private init(): void {
    const missing: string[] = []
    const req: [string, unknown][] = [
      ["camera", this.camera],
      ["plotRoot", this.plotRoot],
      ["plantsRoot", this.plantsRoot],
      ["shadeRoot", this.shadeRoot],
      ["ghostSeedling", this.ghostSeedling],
      ["digSpot", this.digSpot],
      ["offViewArrow", this.offViewArrow],
      ["seedPackets", this.seedPackets],
      ["monthSlider", this.monthSlider],
      ["plantIt", this.plantIt],
      ["guidance", this.guidance],
      ["overlayMaterial", this.overlayMaterial],
      ["tomatoModel", this.tomatoModel],
      ["zucchiniModel", this.zucchiniModel],
      ["basilModel", this.basilModel],
      ["lettuceModel", this.lettuceModel],
    ]
    for (const [k, v] of req) if (!v) missing.push(k)
    if (missing.length > 0) {
      print("[PlotTwist] ERROR: required @input not wired: " + missing.join(", "))
      return
    }

    const plotT = this.plotRoot.getTransform()
    const camT = this.camera.getSceneObject().getTransform()
    // The preview applies the tracked camera pose a few frames after start, so keep
    // re-seating for a short window (0.6 s), then lock the bed in place.
    if (this.seatPlotAtUser) {
      this.seatPlot(plotT, camT)
      this.seatUntil = getTime() + 0.6
    }
    const overlay = this.overlayMaterial
    overlay.mainPass.twoSided = true
    overlay.mainPass.depthWrite = false
    overlay.mainPass.blendMode = BlendMode.Normal

    const dimMat = overlay.clone()
    dimMat.mainPass.baseColor = this.dimColor

    const prefabs: Record<PlantType, ObjectPrefab> = {
      Tomato: this.tomatoModel,
      Zucchini: this.zucchiniModel,
      Basil: this.basilModel,
      Lettuce: this.lettuceModel,
    }

    this.audio = new PlotTwistAudio(
      this.getSceneObject(),
      {soft: this.softChime, success: this.successChime, pickup: this.pickupTick, drop: this.dropTick},
      this.sfxVolume,
    )

    this.garden = new PlotTwistGarden(
      this.plantsRoot,
      plotT,
      camT,
      this.ghostSeedling,
      prefabs,
      overlay,
      dimMat,
      this.ringHoldSeconds,
      {
        onPlantPickedUp: () => this.audio.play("pickup"),
        onPlantMoved: () => (this.shadeDirty = true),
        onPlantDropped: (_p: PlantEntity, moved: boolean) => {
          this.shadeDirty = true
          if (moved) this.audio.play("drop")
        },
      },
    )
    this.shade = new PlotTwistShade(this.shadeRoot, overlay, this.shadeColor)
    this.pointer = new PlotTwistPointer(this.offViewArrow, plotT, this.camera, overlay, () => this.audio.play("soft"))
    this.warnings = new PlotTwistWarnings(this.garden, this.guidance, this.pointer, plotT, this.crowdingThresholdCm)
    this.planting = new PlotTwistPlanting(
      this.garden,
      this.guidance,
      this.pointer,
      this.digSpot,
      plotT,
      overlay,
      () => this.audio.play("soft"),
      () => this.audio.play("success"),
    )

    for (const t of PLANT_TYPES) this.seedPackets.setPacketModel(t, prefabs[t])
    this.seedPackets.onPacketDragStart.add((e) => this.onPacketDragStart(e))
    this.seedPackets.onPacketDragUpdate.add((e) => this.onPacketDragUpdate(e))
    this.seedPackets.onPacketDragEnd.add((e) => this.onPacketDragEnd(e))
    this.monthSlider.onMonthChanged.add((m: number) => this.applyMonth(m))
    this.plantIt.onPlantIt.add(() => this.onPlantIt())
    this.guidance.onDone.add(() => this.onDone())

    this.ready = true
    this.applyMonth(0)
    if (this.debugColliders) this.setColliderDebugAll(this.plotRoot, true)

    const cam = camT.getWorldPosition()
    print(
      `[PlotTwist] ready. camera world=(${cam.x.toFixed(1)}, ${cam.y.toFixed(1)}, ${cam.z.toFixed(1)}); ` +
        `PlotRoot world=${plotT.getWorldPosition().toString()}; soil y=${BED.soilY}`,
    )
  }

  // ── Month ────────────────────────────────────────────────────────────────

  private applyMonth(m: number): void {
    this.month = Math.max(0, Math.min(MONTH_MAX, m))
    if (!this.ready) return
    if (!this.plantingMode) this.garden.setDisplayMonth(this.month)
    this.shadeDirty = true
  }

  // ── Packet drag → plant ──────────────────────────────────────────────────

  private onPacketDragStart(e: PacketDragEvent): void {
    if (!this.ready || this.plantingMode) return
    this.packetTracker = new SoilDragTracker(this.plotRoot.getTransform(), this.camera.getSceneObject().getTransform())
    const packetPos = e.event.interactable
      ? e.event.interactable.getSceneObject().getTransform().getWorldPosition()
      : this.plotRoot.getTransform().getWorldPosition()
    this.packetTracker.begin(e.event, packetPos)
    this.audio.play("pickup")
    this.updateGhost(e.type, this.packetTracker.last)
  }

  private onPacketDragUpdate(e: PacketDragEvent): void {
    if (!this.packetTracker) return
    this.updateGhost(e.type, this.packetTracker.update(e.event as DragInteractorEvent))
  }

  private onPacketDragEnd(e: PacketDragEvent): void {
    if (!this.packetTracker) return
    const q = this.packetTracker.last
    this.packetTracker = null
    this.garden.hideGhost()
    if (q && pointInRect({x: q.x, z: q.z})) {
      if (this.plantAt(e.type, q.x, q.z)) this.audio.play("drop")
    }
  }

  private updateGhost(type: PlantType, q: vec3 | null): void {
    if (q && pointInRect({x: q.x, z: q.z})) this.garden.showGhost(type, q.x, q.z)
    else this.garden.hideGhost()
  }

  // ── Planting mode ────────────────────────────────────────────────────────

  private onPlantIt(): void {
    if (!this.ready || this.plantingMode) return
    if (this.garden.count === 0) {
      this.plantIt.showHint("Plant a seed packet first", 2.5)
      return
    }
    this.plantingMode = true
    this.packetTracker = null
    this.garden.hideGhost()
    this.seedPackets.setVisible(false)
    this.monthSlider.setVisible(false)
    this.plantIt.setVisible(false)
    this.warnings.clearImmediate()
    this.garden.setInteractionEnabled(false)
    this.garden.setDimmed(true)
    this.garden.setDisplayMonth(0) // planting today: show seedlings
    this.garden.setShadeTicks(new Set<string>())
    this.shadeDirty = true
    this.planting.start()
  }

  private onDone(): void {
    if (!this.ready || !this.plantingMode) return
    this.planting.done()
  }

  // ── Frame update ─────────────────────────────────────────────────────────

  private onUpdate(): void {
    if (!this.ready) return
    const now = getTime()
    if (this.seatPlotAtUser && !this.seatLogged) {
      const plotT = this.plotRoot.getTransform()
      const camT = this.camera.getSceneObject().getTransform()
      if (now < this.seatUntil) {
        this.seatPlot(plotT, camT)
      } else {
        this.seatLogged = true
        if (this.demoLayoutOnStart && !this.demoDone) {
          this.demoDone = true
          const planted = this.plantDemoLayout()
          this.setMonth(this.demoStartMonth)
          print(`[PlotTwist] demo layout planted: ${planted.join(", ")}`)
          this.reportAt = now + 2.5
        }
        print(`[PlotTwist] bed seated. camera world=${camT.getWorldPosition().toString()}; PlotRoot world=${plotT.getWorldPosition().toString()}`)
      }
    }
    this.garden.update(now, !this.plantingMode)
    if (this.shadeDirty) {
      this.shadeDirty = false
      const plans = this.garden.plans()
      this.shade.rebuild(plans, this.month, !this.plantingMode)
      this.garden.setShadeTicks(this.plantingMode ? new Set<string>() : lettuceInShade(plans, this.month))
    }
    this.warnings.update(now, this.month, !this.plantingMode)
    if (this.reportAt > 0 && now >= this.reportAt) {
      this.reportAt = -1
      print("[PlotTwist] state " + this.debugStateJson())
    }
    if (this.plantingMode) this.planting.update(now)

  }

  /**
   * The brief's frame is "eyes at the origin, facing −Z, floor 160 cm below". Seat PlotRoot so
   * that frame matches the user's start pose: same x/z and heading as the camera, floor under
   * their feet. Lens Studio's Interactive Preview starts the camera high in a room whose floor is
   * world y = 0 (camera ≈ 180 cm up), while on device world tracking starts at the eyes (y ≈ 0).
   */
  private seatPlot(plotT: Transform, camT: Transform): void {
    const cam = camT.getWorldPosition()
    const fwd = camT.getWorldRotation().multiplyVec3(new vec3(0, 0, -1))
    const yaw = Math.abs(fwd.x) + Math.abs(fwd.z) > 1e-3 ? Math.atan2(-fwd.x, -fwd.z) : 0
    const floorY = cam.y > 100 ? 0 : cam.y - this.eyeHeightCm
    plotT.setWorldPosition(new vec3(cam.x, floorY - BED.floorY, cam.z))
    plotT.setWorldRotation(quat.fromEulerAngles(0, yaw, 0))
  }

  /** One-line JSON snapshot of the test surface (used by the demo layout report). */
  debugStateJson(): string {
    const plants = this.garden.plants.map((p) => {
      const b = this.visualBounds(p)
      return {
        n: p.name,
        x: Math.round(p.x),
        z: Math.round(p.z),
        h: Math.round(p.heightCm * 10) / 10,
        w: Math.round(p.footprintCm * 10) / 10,
        visH: b ? Math.round(b.y * 10) / 10 : null,
        visW: b ? Math.round(b.x * 10) / 10 : null,
        ring: p.spacingRing.enabled,
        warn: this.warnings.ringState(p.name),
        tick: p.shadeTick.enabled,
      }
    })
    return JSON.stringify({
      month: Math.round(this.month * 100) / 100,
      active: this.getActiveWarning(),
      line: this.guidance.getWarningText(),
      shade: this.shade.info().map((i) => `${i.name}:${i.visible}:${i.vertexCount}`),
      arrow: this.pointer.visible,
      plants,
    })
  }

  /** World-space size of a plant's visual (union of its mesh visuals' world AABBs). */
  private visualBounds(p: PlantEntity): vec3 | null {
    let min = new vec3(1e9, 1e9, 1e9)
    let max = new vec3(-1e9, -1e9, -1e9)
    for (const r of p.rmvs) {
      min = vec3.min(min, r.worldAabbMin())
      max = vec3.max(max, r.worldAabbMax())
    }
    return min.x > max.x ? null : max.sub(min)
  }

  private packetWorldPosition(type: PlantType): vec3 {
    const so = this.findChildByName(this.seedPackets.getSceneObject(), `SeedPacket_${type}`)
    return so ? so.getTransform().getWorldPosition() : this.bedToWorld(-93, -70, -80)
  }

  private findChildByName(root: SceneObject, name: string): SceneObject | null {
    if (root.name === name) return root
    for (let i = 0; i < root.getChildrenCount(); i++) {
      const f = this.findChildByName(root.getChild(i), name)
      if (f) return f
    }
    return null
  }

  /** A synthetic SIK drag event: drag point `point`, ray from the camera through it. */
  private fakeDrag(point: vec3, grab: vec3, dragVector: vec3): DragInteractorEvent {
    const cam = this.camera.getSceneObject().getTransform().getWorldPosition()
    const interactor = {
      endPoint: point,
      startPoint: cam,
      direction: point.sub(cam).normalize(),
      targetHitPosition: grab,
    }
    return {interactor, dragVector, planecastDragVector: null, interactable: null, target: null} as unknown as DragInteractorEvent
  }

  private setColliderDebugAll(root: SceneObject, on: boolean): void {
    const cols = root.getComponents("Physics.ColliderComponent") as ColliderComponent[]
    for (const c of cols) c.debugDrawEnabled = on
    for (let i = 0; i < root.getChildrenCount(); i++) this.setColliderDebugAll(root.getChild(i), on)
  }
}
