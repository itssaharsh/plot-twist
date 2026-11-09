/**
 * PlotTwistGarden — owns the planted plants (the single source of truth for plant state).
 *
 * Owns: Plant_<Type>_<n> SceneObjects under the authored `Plants` root, their growth
 *       visuals (the one legitimate runtime scale: a `Visual` wrapper, never the collider),
 *       root-centred colliders + SIK Interactables (pinch-drag to move, any month),
 *       SpacingRing / WarningRing / ShadeTick children, dimming for planting mode,
 *       and the GhostSeedling shown while a seed packet is dragged.
 * Per-plant hierarchy:
 *   Plant_Tomato_1            (unit scale, identity rotation, at the soil point; Collider + Interactable)
 *     Visual                  (growth scale wrapper)
 *       <GLB prefab instance> (authored 100× import scale, re-centred + grounded)
 *     SpacingRing             (August footprint, flat on the soil)
 *     WarningRing             (amber / green; driven by PlotTwistWarnings)
 *     ShadeTick               (green tick for lettuce in afternoon shade)
 * Must not: decide warnings, shade or planting order — Main pushes those in.
 */
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {DragInteractorEvent, InteractorEvent} from "SpectaclesInteractionKit.lspkg/Core/Interactor/InteractorEvent"
import {ColliderUtils} from "SpectaclesInteractionKit.lspkg/Utils/ColliderUtils"
import {PlantPlan, pointInRect} from "./PlotTwistGeometry"
import {buildPost, buildRing, buildTick} from "./PlotTwistMeshFactory"
import {BED, JULY, PlantType, SEEDLING_CM, augSize, sizeAt} from "./PlotTwistPlantData"
import {SoilDragTracker} from "./PlotTwistSoilDrag"

/** Minimum pinch target for a plant (cm) — seedlings stay easy to grab. */
const MIN_COLLIDER_WIDTH = 16
const MIN_COLLIDER_HALF_HEIGHT = 12

const RING_COLOR = new vec4(0.92, 0.97, 0.86, 0.7)
const GHOST_RING_COLOR = new vec4(0.85, 1.0, 0.85, 0.45)
const GHOST_COLOR = new vec4(0.7, 1.0, 0.72, 0.45)
const TICK_COLOR = new vec4(0.45, 0.95, 0.5, 1.0)
/** Amber warning ring: a wide band just outside the August footprint so it reads from the foot of the bed. */
export const WARNING_AMBER = new vec4(1.0, 0.74, 0.18, 1.0)
const WARNING_RING_GAP_CM = 0.5
const WARNING_RING_WIDTH_CM = 6

export interface PlantEntity {
  name: string
  type: PlantType
  placedIndex: number
  x: number
  z: number
  root: SceneObject
  visualWrap: SceneObject
  instance: SceneObject
  collider: ColliderComponent
  interactable: Interactable
  spacingRing: SceneObject
  spacingMat: Material
  warningRing: SceneObject
  warningMat: Material
  shadeTick: SceneObject
  rmvs: RenderMeshVisual[]
  originalMats: Material[]
  ringUntil: number
  ringFadeSec: number
  dragging: boolean
  hovered: boolean
  heightCm: number
  footprintCm: number
  /** The exact handlers wired to the SIK Interactable (exposed so tests can drive them). */
  dragHandlers: {
    start: (ev: DragInteractorEvent) => void
    update: (ev: DragInteractorEvent) => void
    end: (ev: DragInteractorEvent) => void
  } | null
}

export interface GardenCallbacks {
  onPlantPickedUp: (p: PlantEntity) => void
  onPlantMoved: (p: PlantEntity) => void
  onPlantDropped: (p: PlantEntity, moved: boolean) => void
}

interface NativeBounds {
  min: vec3
  max: vec3
}

export class PlotTwistGarden {
  readonly plants: PlantEntity[] = []
  private placedCounter = 0
  private nativeBounds = new Map<PlantType, NativeBounds>()
  private displayMonth = 0
  private interactionEnabled = true
  private dimmed = false
  private ghostVisuals = new Map<PlantType, SceneObject>()
  private ghostRing: SceneObject | null = null
  private ghostType: PlantType | null = null

  constructor(
    private plantsRoot: SceneObject,
    private plotRoot: Transform,
    private cameraTransform: Transform,
    private ghostRoot: SceneObject,
    private prefabs: Record<PlantType, ObjectPrefab>,
    private overlayMaterial: Material,
    private dimMaterial: Material,
    private ringHoldSeconds: number,
    private callbacks: GardenCallbacks,
    private stakeMaterial: Material | null = null,
  ) {
    this.ghostRoot.enabled = false
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  get count(): number {
    return this.plants.length
  }

  find(name: string): PlantEntity | null {
    for (const p of this.plants) if (p.name === name) return p
    return null
  }

  plans(): PlantPlan[] {
    return this.plants.map((p) => ({name: p.name, type: p.type, x: p.x, z: p.z, placedIndex: p.placedIndex}))
  }

  // ── Planting / moving ─────────────────────────────────────────────────────

  /** Plant a seedling at PlotRoot-local (x, z). Returns null when the spot is off the soil. */
  plantAt(type: PlantType, x: number, z: number, now: number): PlantEntity | null {
    if (!pointInRect({x, z})) return null
    this.placedCounter++
    const n = this.placedCounter
    const name = `Plant_${type}_${n}`

    const root = global.scene.createSceneObject(name)
    root.setParent(this.plantsRoot)
    root.getTransform().setLocalPosition(new vec3(x, BED.soilY, z))

    const visualWrap = global.scene.createSceneObject("Visual")
    visualWrap.setParent(root)
    const instance = this.prefabs[type].instantiate(visualWrap)
    const bounds = this.boundsFor(type, instance, root)
    const c = bounds.min.add(bounds.max).uniformScale(0.5)
    // Re-centre in x/z and seat the base on the soil (offset is in wrapper-local units).
    const ip = instance.getTransform().getLocalPosition()
    instance.getTransform().setLocalPosition(new vec3(ip.x - c.x, ip.y - bounds.min.y, ip.z - c.z))

    const rmvs = this.collectRmvs(instance)
    if (type === "Tomato" && this.stakeMaterial) rmvs.push(this.addStake(visualWrap, bounds))
    const originalMats = rmvs.map((r) => r.mainMaterial)

    // Collider first (on the unit-scale root), then the Interactable that discovers it.
    const collider = root.createComponent("Physics.ColliderComponent") as ColliderComponent
    collider.fitVisual = false
    collider.shape = Shape.createBoxShape()
    const interactable = root.createComponent(Interactable.getTypeName()) as Interactable

    const aug = augSize(type)
    const spacingMat = this.overlayMaterial.clone()
    spacingMat.mainPass.baseColor = RING_COLOR
    const spacingRing = this.makeFlat(root, "SpacingRing", buildRing(aug.footprintCm / 2 - 1.2, aug.footprintCm / 2), spacingMat, 0.6)
    spacingRing.enabled = false

    const warningMat = this.overlayMaterial.clone()
    warningMat.mainPass.baseColor = WARNING_AMBER
    const ringIn = aug.footprintCm / 2 + WARNING_RING_GAP_CM
    const warningRing = this.makeFlat(root, "WarningRing", buildRing(ringIn, ringIn + WARNING_RING_WIDTH_CM), warningMat, 1.0)
    warningRing.enabled = false

    const tickMat = this.overlayMaterial.clone()
    tickMat.mainPass.baseColor = TICK_COLOR
    const shadeTick = global.scene.createSceneObject("ShadeTick")
    shadeTick.setParent(root)
    const tickRmv = shadeTick.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    tickRmv.mesh = buildTick(7, 1.4)
    tickRmv.mainMaterial = tickMat
    shadeTick.enabled = false

    const entity: PlantEntity = {
      name,
      type,
      placedIndex: n,
      x,
      z,
      root,
      visualWrap,
      instance,
      collider,
      interactable,
      spacingRing,
      spacingMat,
      warningRing,
      warningMat,
      shadeTick,
      rmvs,
      originalMats,
      ringUntil: now + this.ringHoldSeconds,
      ringFadeSec: 0.6,
      dragging: false,
      hovered: false,
      heightCm: SEEDLING_CM,
      footprintCm: SEEDLING_CM,
      dragHandlers: null,
    }
    this.plants.push(entity)
    this.wireInteraction(entity)
    this.applySize(entity)
    if (this.dimmed) this.applyDim(entity, true)
    interactable.enabled = this.interactionEnabled
    return entity
  }

  /** Move a plant to PlotRoot-local (x, z). Returns false (and leaves it) when off the soil. */
  movePlant(name: string, x: number, z: number): boolean {
    const p = this.find(name)
    if (!p || !pointInRect({x, z})) return false
    this.setPos(p, x, z)
    return true
  }

  removeAll(): void {
    for (const p of this.plants) p.root.destroy()
    this.plants.length = 0
    this.placedCounter = 0
    this.hideGhost()
  }

  // ── Month / modes ─────────────────────────────────────────────────────────

  /** Size every plant for month value m (0 = May … 3 = Aug). */
  setDisplayMonth(m: number): void {
    this.displayMonth = m
    for (const p of this.plants) this.applySize(p)
  }

  setInteractionEnabled(on: boolean): void {
    this.interactionEnabled = on
    for (const p of this.plants) p.interactable.enabled = on
  }

  setDimmed(on: boolean): void {
    this.dimmed = on
    for (const p of this.plants) this.applyDim(p, on)
  }

  /** Per-frame: ring visibility (Jul/Aug, while dragging, ~2 s after planting, hover hint) + tick billboard. */
  update(now: number, ringsAllowed: boolean): void {
    const camPos = this.cameraTransform.getWorldPosition()
    for (const p of this.plants) {
      let a = 0
      if (ringsAllowed) {
        if (this.displayMonth >= JULY || p.dragging) a = 1
        else if (now < p.ringUntil) a = 1
        else if (now < p.ringUntil + p.ringFadeSec) a = 1 - (now - p.ringUntil) / p.ringFadeSec
        else if (p.hovered) a = 0.45
      }
      p.spacingRing.enabled = a > 0.01
      if (a > 0.01) p.spacingMat.mainPass.baseColor = new vec4(RING_COLOR.x, RING_COLOR.y, RING_COLOR.z, RING_COLOR.w * a)

      if (p.shadeTick.enabled) {
        const t = p.shadeTick.getTransform()
        const wp = t.getWorldPosition()
        const yaw = Math.atan2(camPos.x - wp.x, camPos.z - wp.z)
        t.setWorldRotation(quat.fromEulerAngles(0, yaw, 0))
      }
    }
  }

  setShadeTicks(names: Set<string>): void {
    for (const p of this.plants) p.shadeTick.enabled = names.has(p.name)
  }

  // ── Ghost seedling (packet drag preview) ──────────────────────────────────

  showGhost(type: PlantType, x: number, z: number): void {
    if (this.ghostType !== type) {
      this.ghostVisuals.forEach((so) => (so.enabled = false))
      const v = this.ghostVisualFor(type)
      v.enabled = true
      this.ghostType = type
      if (this.ghostRing) this.ghostRing.destroy()
      const mat = this.overlayMaterial.clone()
      mat.mainPass.baseColor = GHOST_RING_COLOR
      const aug = augSize(type)
      this.ghostRing = this.makeFlat(this.ghostRoot, "GhostSpacingRing", buildRing(aug.footprintCm / 2 - 1.2, aug.footprintCm / 2), mat, 0.6)
    }
    this.ghostRoot.getTransform().setLocalPosition(new vec3(x, BED.soilY, z))
    this.ghostRoot.enabled = true
  }

  hideGhost(): void {
    this.ghostRoot.enabled = false
  }

  get ghostVisible(): boolean {
    return this.ghostRoot.enabled
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private setPos(p: PlantEntity, x: number, z: number): void {
    p.x = x
    p.z = z
    p.root.getTransform().setLocalPosition(new vec3(x, BED.soilY, z))
  }

  private applySize(p: PlantEntity): void {
    const s = sizeAt(p.type, this.displayMonth)
    p.heightCm = s.heightCm
    p.footprintCm = s.footprintCm
    const nb = this.nativeBounds.get(p.type)
    if (nb) {
      const size = nb.max.sub(nb.min)
      p.visualWrap.getTransform().setLocalScale(
        new vec3(s.footprintCm / Math.max(size.x, 0.001), s.heightCm / Math.max(size.y, 0.001), s.footprintCm / Math.max(size.z, 0.001)),
      )
    }
    // Root-centred box: top at the plant's top, mirrored below the soil (keeps the
    // Interactable's origin on the soil plane so scripted drags stay on the soil).
    const w = Math.max(MIN_COLLIDER_WIDTH, s.footprintCm)
    const hh = Math.max(MIN_COLLIDER_HALF_HEIGHT, s.heightCm)
    const box = p.collider.shape as BoxShape
    box.size = new vec3(w, hh * 2, w)
    p.collider.shape = box
    ColliderUtils.invalidateCacheEntry(p.collider)
    p.shadeTick.getTransform().setLocalPosition(new vec3(0, s.heightCm + 7, 0))
  }

  private applyDim(p: PlantEntity, on: boolean): void {
    for (let i = 0; i < p.rmvs.length; i++) {
      p.rmvs[i].mainMaterial = on ? this.dimMaterial : p.originalMats[i]
    }
  }

  private wireInteraction(p: PlantEntity): void {
    const tracker = new SoilDragTracker(this.plotRoot, this.cameraTransform)
    let startX = p.x
    let startZ = p.z
    let moved = false
    p.interactable.onHoverEnter.add(() => (p.hovered = true))
    p.interactable.onHoverExit.add(() => (p.hovered = false))
    const start = (ev: DragInteractorEvent) => {
      if (!this.interactionEnabled) return
      startX = p.x
      startZ = p.z
      moved = false
      p.dragging = true
      tracker.begin(ev as InteractorEvent, p.root.getTransform().getWorldPosition())
      this.callbacks.onPlantPickedUp(p)
    }
    const update = (ev: DragInteractorEvent) => {
      if (!p.dragging) return
      const q = tracker.update(ev)
      if (q && pointInRect({x: q.x, z: q.z})) {
        this.setPos(p, q.x, q.z)
        moved = true
      } else {
        this.setPos(p, startX, startZ) // off the soil → show it back where it was
      }
      this.callbacks.onPlantMoved(p)
    }
    const end = (ev: DragInteractorEvent) => {
      if (!p.dragging) return
      p.dragging = false
      const q = tracker.finish(ev as InteractorEvent)
      if (q && pointInRect({x: q.x, z: q.z})) {
        this.setPos(p, q.x, q.z)
      } else {
        this.setPos(p, startX, startZ)
        moved = false
      }
      p.ringUntil = 0
      this.callbacks.onPlantDropped(p, moved)
    }
    p.dragHandlers = {start, update, end}
    p.interactable.onDragStart.add(start)
    p.interactable.onDragUpdate.add(update)
    p.interactable.onDragEnd.add(end)
  }

  private makeFlat(parent: SceneObject, name: string, mesh: RenderMesh, mat: Material, y: number): SceneObject {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    so.getTransform().setLocalPosition(new vec3(0, y, 0))
    const rmv = so.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    rmv.mesh = mesh
    rmv.mainMaterial = mat
    return so
  }

  /**
   * Tomatoes grow up a wooden stake. The stake sits in the growth wrapper (so it grows with the
   * plant) beside the main stem, and stays inside the plant's August bounds (95 % of its height).
   */
  private addStake(visualWrap: SceneObject, nb: NativeBounds): RenderMeshVisual {
    const size = nb.max.sub(nb.min)
    const stake = global.scene.createSceneObject("Stake")
    stake.setParent(visualWrap)
    stake.getTransform().setLocalPosition(new vec3(size.x * 0.08, 0, size.z * 0.06))
    const rmv = stake.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    rmv.mesh = buildPost(Math.max(1.5, size.x * 0.036), size.y * 0.95)
    rmv.mainMaterial = this.stakeMaterial as Material
    return rmv
  }

  private collectRmvs(so: SceneObject, out: RenderMeshVisual[] = []): RenderMeshVisual[] {
    const comps = so.getComponents("Component.RenderMeshVisual") as RenderMeshVisual[]
    for (const c of comps) out.push(c)
    for (let i = 0; i < so.getChildrenCount(); i++) this.collectRmvs(so.getChild(i), out)
    return out
  }

  /** Native AABB of a prefab instance in the plant root's local space (wrapper at scale 1). */
  private boundsFor(type: PlantType, instance: SceneObject, root: SceneObject): NativeBounds {
    const cached = this.nativeBounds.get(type)
    if (cached) return cached
    const inv = root.getTransform().getInvertedWorldTransform()
    let min = new vec3(1e9, 1e9, 1e9)
    let max = new vec3(-1e9, -1e9, -1e9)
    for (const rmv of this.collectRmvs(instance)) {
      if (!rmv.mesh) continue
      const m = inv.mult(rmv.getTransform().getWorldTransform())
      const a = rmv.mesh.aabbMin
      const b = rmv.mesh.aabbMax
      for (let i = 0; i < 8; i++) {
        const corner = new vec3(i & 1 ? b.x : a.x, i & 2 ? b.y : a.y, i & 4 ? b.z : a.z)
        const w = m.multiplyPoint(corner)
        min = vec3.min(min, w)
        max = vec3.max(max, w)
      }
    }
    if (min.x > max.x) {
      // No mesh found — fall back to the normalized August size, grounded and centred.
      const aug = augSize(type)
      min = new vec3(-aug.footprintCm / 2, 0, -aug.footprintCm / 2)
      max = new vec3(aug.footprintCm / 2, aug.heightCm, aug.footprintCm / 2)
    }
    const nb = {min, max}
    this.nativeBounds.set(type, nb)
    return nb
  }

  private ghostVisualFor(type: PlantType): SceneObject {
    const existing = this.ghostVisuals.get(type)
    if (existing) return existing
    const wrap = global.scene.createSceneObject(`Ghost_${type}`)
    wrap.setParent(this.ghostRoot)
    const instance = this.prefabs[type].instantiate(wrap)
    const nb = this.boundsFor(type, instance, this.ghostRoot)
    const c = nb.min.add(nb.max).uniformScale(0.5)
    const ip = instance.getTransform().getLocalPosition()
    instance.getTransform().setLocalPosition(new vec3(ip.x - c.x, ip.y - nb.min.y, ip.z - c.z))
    const size = nb.max.sub(nb.min)
    const s = sizeAt(type, 0)
    wrap.getTransform().setLocalScale(new vec3(s.footprintCm / size.x, s.heightCm / size.y, s.footprintCm / size.z))
    wrap.getTransform().setLocalPosition(new vec3(0, 1.5, 0))
    const ghostMat = this.overlayMaterial.clone()
    ghostMat.mainPass.baseColor = GHOST_COLOR
    for (const r of this.collectRmvs(instance)) r.mainMaterial = ghostMat
    this.ghostVisuals.set(type, wrap)
    return wrap
  }
}

