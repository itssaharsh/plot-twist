/**
 * PlotTwistMeshFactory — code-authored flat overlay meshes (MeshBuilder).
 *
 * Owns: ring (annulus), filled polygon (shade patch), chalk X, tick, arrow geometry.
 *       All flat shapes lie in the local XZ plane (y = 0, normal +Y) unless noted.
 * Must not: pick materials or positions — callers own placement + material.
 * Materials used with these meshes are two-sided, so winding is not load-bearing.
 */
import {P2} from "./PlotTwistGeometry"

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

function pushFlat(mb: MeshBuilder, x: number, z: number, u: number, v: number): void {
  mb.appendVerticesInterleaved([x, 0, z, 0, 1, 0, u, v])
}

/** Flat ring in XZ: inner/outer radius in cm. */
export function buildRing(innerR: number, outerR: number, segments: number = 64): RenderMesh {
  const mb = newBuilder()
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2
    const c = Math.cos(a)
    const s = Math.sin(a)
    pushFlat(mb, c * innerR, s * innerR, i / segments, 0)
    pushFlat(mb, c * outerR, s * outerR, i / segments, 1)
  }
  const idx: number[] = []
  for (let i = 0; i < segments; i++) {
    const a = i * 2
    idx.push(a, a + 1, a + 3, a, a + 3, a + 2)
  }
  mb.appendIndices(idx)
  mb.updateMesh()
  return mb.getMesh()
}

/** Re-usable builder for a convex polygon fan (shade patch); rebuilt when the polygon changes. */
export class PolygonMesh {
  private mb: MeshBuilder = newBuilder()

  get mesh(): RenderMesh {
    return this.mb.getMesh()
  }

  /** Replace the geometry with a convex polygon (fan triangulation). */
  setPolygon(poly: P2[]): void {
    const vCount = this.mb.getVerticesCount()
    if (vCount > 0) this.mb.eraseVertices(0, vCount)
    const iCount = this.mb.getIndicesCount()
    if (iCount > 0) this.mb.eraseIndices(0, iCount)
    if (poly.length >= 3) {
      for (const p of poly) pushFlat(this.mb, p.x, p.z, 0, 0)
      const idx: number[] = []
      for (let i = 1; i < poly.length - 1; i++) idx.push(0, i, i + 1)
      this.mb.appendIndices(idx)
    }
    this.mb.updateMesh()
  }

  get vertexCount(): number {
    return this.mb.getVerticesCount()
  }
}

function appendQuadXZ(mb: MeshBuilder, idx: number[], cx: number, cz: number, halfLen: number, halfW: number, angle: number): void {
  const base = mb.getVerticesCount()
  const ux = Math.cos(angle)
  const uz = Math.sin(angle)
  const vx = -uz
  const vz = ux
  const corners = [
    [-halfLen, -halfW],
    [halfLen, -halfW],
    [halfLen, halfW],
    [-halfLen, halfW],
  ]
  for (const [l, w] of corners) pushFlat(mb, cx + ux * l + vx * w, cz + uz * l + vz * w, 0, 0)
  idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
}

/** Chalk-white "X" lying on the soil, `sizeCm` across, `strokeCm` thick. */
export function buildCross(sizeCm: number, strokeCm: number): RenderMesh {
  const mb = newBuilder()
  const idx: number[] = []
  const half = sizeCm / 2
  appendQuadXZ(mb, idx, 0, 0, half, strokeCm / 2, Math.PI / 4)
  appendQuadXZ(mb, idx, 0, 0, half, strokeCm / 2, -Math.PI / 4)
  mb.appendIndices(idx)
  mb.updateMesh()
  return mb.getMesh()
}

/** Flat arrow in XZ pointing toward local −Z (forward). Total length `lenCm`. */
export function buildArrow(lenCm: number, widthCm: number): RenderMesh {
  const mb = newBuilder()
  const idx: number[] = []
  const headLen = lenCm * 0.45

  const shaftW = widthCm * 0.38
  const tipZ = -lenCm / 2
  const headBaseZ = tipZ + headLen
  // Shaft (from headBase back to +len/2)
  const zA = headBaseZ
  const zB = lenCm / 2
  const b = mb.getVerticesCount()
  pushFlat(mb, -shaftW / 2, zA, 0, 0)
  pushFlat(mb, shaftW / 2, zA, 0, 0)
  pushFlat(mb, shaftW / 2, zB, 0, 0)
  pushFlat(mb, -shaftW / 2, zB, 0, 0)
  idx.push(b, b + 1, b + 2, b, b + 2, b + 3)
  // Head
  const h = mb.getVerticesCount()
  pushFlat(mb, 0, tipZ, 0, 0)
  pushFlat(mb, widthCm / 2, headBaseZ, 0, 0)
  pushFlat(mb, -widthCm / 2, headBaseZ, 0, 0)
  idx.push(h, h + 1, h + 2)
  mb.appendIndices(idx)
  mb.updateMesh()

  return mb.getMesh()
}

/** Upright check-mark in the local XY plane (faces ±Z), `sizeCm` wide. */
export function buildTick(sizeCm: number, strokeCm: number): RenderMesh {
  const mb = newBuilder()
  const idx: number[] = []
  const addBar = (x0: number, y0: number, x1: number, y1: number) => {
    const dx = x1 - x0
    const dy = y1 - y0
    const len = Math.hypot(dx, dy)
    const nx = (-dy / len) * (strokeCm / 2)
    const ny = (dx / len) * (strokeCm / 2)
    const base = mb.getVerticesCount()
    const v = (x: number, y: number) => mb.appendVerticesInterleaved([x, y, 0, 0, 0, 1, 0, 0])
    v(x0 + nx, y0 + ny)
    v(x1 + nx, y1 + ny)
    v(x1 - nx, y1 - ny)
    v(x0 - nx, y0 - ny)
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }
  const s = sizeCm
  addBar(-0.45 * s, 0.05 * s, -0.12 * s, -0.3 * s)
  addBar(-0.14 * s, -0.3 * s, 0.48 * s, 0.38 * s)
  mb.appendIndices(idx)
  mb.updateMesh()
  return mb.getMesh()
}

/**
 * Upright square post (a garden stake), base at y = 0, `widthCm` square and `heightCm` tall.
 * Six faces with outward normals, so it shades correctly with an opaque lit material.
 */
export function buildPost(widthCm: number, heightCm: number): RenderMesh {
  const mb = newBuilder()
  const idx: number[] = []
  const h = widthCm / 2
  const quad = (p: number[][], n: number[]) => {
    const b = mb.getVerticesCount()
    const uv = [[0, 0], [1, 0], [1, 1], [0, 1]]
    for (let i = 0; i < 4; i++) mb.appendVerticesInterleaved([p[i][0], p[i][1], p[i][2], n[0], n[1], n[2], uv[i][0], uv[i][1]])
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3)
  }
  const H = heightCm
  quad([[-h, 0, h], [h, 0, h], [h, H, h], [-h, H, h]], [0, 0, 1]) // +Z
  quad([[h, 0, -h], [-h, 0, -h], [-h, H, -h], [h, H, -h]], [0, 0, -1]) // -Z
  quad([[h, 0, h], [h, 0, -h], [h, H, -h], [h, H, h]], [1, 0, 0]) // +X
  quad([[-h, 0, -h], [-h, 0, h], [-h, H, h], [-h, H, -h]], [-1, 0, 0]) // -X
  quad([[-h, H, h], [h, H, h], [h, H, -h], [-h, H, -h]], [0, 1, 0]) // top
  mb.appendIndices(idx)
  mb.updateMesh()
  return mb.getMesh()
}
