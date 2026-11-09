/**
 * PlotTwistShade — light-lavender 4 pm shade patches on the soil (July and August only).
 *
 * Owns: one ShadePatch_<CasterPlantName> SceneObject per tomato / zucchini under the authored
 *       `ShadePatches` root. Each patch = the caster's current footprint circle swept
 *       1.6 × its current height toward ENE, clipped to the soil rectangle, rebuilt with
 *       MeshBuilder whenever the month or a plant position changes.
 * Must not: decide warnings (PlotTwistGeometry.evaluateWarnings does that from the same math).
 */
import {PlantPlan, clipPolygonToRect, shadeCastersAt, stadiumPolygon} from "./PlotTwistGeometry"
import {PolygonMesh} from "./PlotTwistMeshFactory"
import {BED, JULY} from "./PlotTwistPlantData"

interface Patch {
  so: SceneObject
  poly: PolygonMesh
}

export interface ShadePatchInfo {
  name: string
  casterName: string
  visible: boolean
  vertexCount: number
}

export class PlotTwistShade {
  private patches = new Map<string, Patch>()
  private material: Material

  constructor(
    private root: SceneObject,
    overlayMaterial: Material,
    color: vec4,
  ) {
    this.material = overlayMaterial.clone()
    this.material.mainPass.baseColor = color
  }

  /** Rebuild every patch for month m. `visible` false hides them all (planting mode). */
  rebuild(plants: PlantPlan[], m: number, visible: boolean): void {
    const show = visible && m >= JULY
    const casters = shadeCastersAt(plants, m)
    const alive = new Set<string>()
    for (const c of casters) {
      alive.add(c.casterName)
      let patch = this.patches.get(c.casterName)
      if (!patch) patch = this.create(c.casterName)
      if (show) {
        const clipped = clipPolygonToRect(stadiumPolygon(c))
        patch.poly.setPolygon(clipped)
        patch.so.enabled = clipped.length >= 3
      } else {
        patch.so.enabled = false
      }
    }
    this.patches.forEach((p, name) => {
      if (!alive.has(name)) {
        p.so.destroy()
        this.patches.delete(name)
      }
    })
  }

  info(): ShadePatchInfo[] {
    const out: ShadePatchInfo[] = []
    this.patches.forEach((p, caster) =>
      out.push({name: p.so.name, casterName: caster, visible: p.so.enabled, vertexCount: p.poly.vertexCount}),
    )
    return out
  }

  clear(): void {
    this.patches.forEach((p) => p.so.destroy())
    this.patches.clear()
  }

  private create(casterName: string): Patch {
    const so = global.scene.createSceneObject(`ShadePatch_${casterName}`)
    so.setParent(this.root)
    so.getTransform().setLocalPosition(new vec3(0, BED.soilY + 0.3, 0))
    const poly = new PolygonMesh()
    const rmv = so.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    rmv.mesh = poly.mesh
    rmv.mainMaterial = this.material
    const patch = {so, poly}
    this.patches.set(casterName, patch)
    return patch
  }
}
