/**
 * PlotTwistSoilSurface — the soil top of the raised-bed stand-in and its square-foot grid.
 *
 * Owns: `SoilTop`, a quad over the soil inside the rim with known UVs (u across the bed, v along
 *       its length) so the furrow rows in the soil texture run the bed's length, and
 *       `SquareFootGrid`, faint chalk lines every 1 ft (30.48 cm) measured from the bed's outer
 *       edges — 4 × 8 squares on the 4 × 8 ft bed, so spacing is legible at a glance.
 * Coordinates: local to `RaisedBed (stand-in)` — origin at the bed's centre on the floor,
 *       +Z toward the user (south), soil top at y = soilTopY.
 * Must not: add colliders. Planting and moving use ray/plane math against the soil plane.
 */

@component
export class PlotTwistSoilSurface extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">PlotTwistSoilSurface – textured soil top + chalk square-foot grid</span>')
  @ui.separator
  @ui.group_start("Assets")
  @input
  @hint("Soil material (its baseTex is the furrowed soil texture)")
  soilMaterial!: Material

  @input
  @hint("Unlit overlay material, cloned and tinted for the chalk grid")
  gridMaterial!: Material
  @ui.group_end

  @ui.group_start("Bed size")
  @input
  @hint("Outer width of the bed in cm (4 ft)")
  outerWidthCm: number = 122

  @input
  @hint("Outer length of the bed in cm (8 ft)")
  outerLengthCm: number = 244

  @input
  @hint("Rim plank thickness in cm")
  rimThicknessCm: number = 4

  @input
  @hint("Soil top height above the floor in cm")
  soilTopY: number = 30
  @ui.group_end

  @ui.group_start("Grid")
  @input
  @widget(new SliderWidget(10, 60, 0.5))
  @hint("Grid square size in cm (1 ft = 30.48)")
  cellCm: number = 30.48

  @input
  @widget(new SliderWidget(0.3, 3, 0.1))
  @hint("Chalk line width in cm")
  lineWidthCm: number = 1.1

  @input("vec4", "{1.0,0.98,0.93,0.55}")
  @widget(new ColorWidget())
  @hint("Chalk line colour (alpha = how faint)")
  gridColor: vec4 = new vec4(1.0, 0.98, 0.93, 0.55)
  @ui.group_end

  onAwake(): void {
    if (!this.soilMaterial || !this.gridMaterial) {
      print("[PlotTwistSoilSurface] ERROR: soilMaterial / gridMaterial not wired")
      return
    }
    const halfW = this.outerWidthCm / 2 - this.rimThicknessCm
    const halfL = this.outerLengthCm / 2 - this.rimThicknessCm

    // Soil top: u runs across the bed (x), v along its length (z).
    const soil = this.child("SoilTop", this.soilTopY + 0.03)
    const smb = newBuilder()
    pushVertex(smb, -halfW, -halfL, 0, 0)
    pushVertex(smb, halfW, -halfL, 1, 0)
    pushVertex(smb, halfW, halfL, 1, 1)
    pushVertex(smb, -halfW, halfL, 0, 1)
    smb.appendIndices([0, 2, 1, 0, 3, 2])
    smb.updateMesh()
    const soilRmv = soil.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    soilRmv.mesh = smb.getMesh()
    soilRmv.mainMaterial = this.soilMaterial

    // Square-foot grid: interior lines only (the rim frames the outer edge).
    const grid = this.child("SquareFootGrid", this.soilTopY + 0.12)
    const gmb = newBuilder()
    const idx: number[] = []
    const w = this.lineWidthCm / 2
    const outerHalfW = this.outerWidthCm / 2
    const outerHalfL = this.outerLengthCm / 2
    for (let x = -outerHalfW + this.cellCm; x < outerHalfW - 0.5; x += this.cellCm) {
      appendRect(gmb, idx, x - w, x + w, -halfL, halfL)
    }
    for (let z = -outerHalfL + this.cellCm; z < outerHalfL - 0.5; z += this.cellCm) {
      appendRect(gmb, idx, -halfW, halfW, z - w, z + w)
    }
    gmb.appendIndices(idx)
    gmb.updateMesh()
    const gridMat = this.gridMaterial.clone()
    gridMat.mainPass.baseColor = this.gridColor
    const gridRmv = grid.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    gridRmv.mesh = gmb.getMesh()
    gridRmv.mainMaterial = gridMat
  }

  private child(name: string, y: number): SceneObject {
    const so = global.scene.createSceneObject(name)
    so.setParent(this.sceneObject)
    so.getTransform().setLocalPosition(new vec3(0, y, 0))
    return so
  }
}

function newBuilder(): MeshBuilder {
  const mb = new MeshBuilder([
    {name: "position", components: 3},
    {name: "normal", components: 3, normalized: true},
    {name: "texture0", components: 2},
  ])
  mb.topology = MeshTopology.Triangles
  mb.indexType = MeshIndexType.UInt16
  return mb
}

function pushVertex(mb: MeshBuilder, x: number, z: number, u: number, v: number): void {
  mb.appendVerticesInterleaved([x, 0, z, 0, 1, 0, u, v])
}

function appendRect(mb: MeshBuilder, idx: number[], x0: number, x1: number, z0: number, z1: number): void {
  const b = mb.getVerticesCount()
  pushVertex(mb, x0, z0, 0, 0)
  pushVertex(mb, x1, z0, 1, 0)
  pushVertex(mb, x1, z1, 1, 1)
  pushVertex(mb, x0, z1, 0, 1)
  idx.push(b, b + 2, b + 1, b, b + 3, b + 2)
}
