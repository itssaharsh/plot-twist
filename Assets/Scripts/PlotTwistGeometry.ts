/**
 * PlotTwistGeometry — pure 2D (x/z) math for the bed plan. No scene access.
 *
 * Owns: point-in-bed, shade "stadium" (footprint circle swept along the 4 pm shadow),
 *       Sutherland–Hodgman clipping to the soil rectangle, crowding + shade warning
 *       evaluation (worst first), lettuce-in-shade test.
 * Must not: create SceneObjects or read transforms — callers pass plain numbers.
 */
import {
  AUGUST_WARN_THRESHOLD,
  JULY,
  PLANT_SPECS,
  PlantType,
  Rect,
  SHADOW_DIR,
  SHADOW_LENGTH_FACTOR,
  SOIL_RECT,
  augSize,
  sizeAt,
} from "./PlotTwistPlantData"

export interface P2 {
  x: number
  z: number
}

export interface PlantPlan {
  name: string
  type: PlantType
  x: number
  z: number
  placedIndex: number
}

export type WarningKind = "crowding" | "shade"

export interface WarningCandidate {
  plantName: string
  kind: WarningKind
  text: string
  /** Larger = worse. Crowding: overlap in cm. Shade: depth inside the patch in cm. */
  severity: number
  sourceName: string
}

export interface ShadeCaster {
  casterName: string
  casterType: PlantType
  cx: number
  cz: number
  radius: number
  length: number
}

export function pointInRect(p: P2, r: Rect = SOIL_RECT): boolean {
  return p.x >= r.minX && p.x <= r.maxX && p.z >= r.minZ && p.z <= r.maxZ
}

export function distPointSegment(p: P2, a: P2, b: P2): number {
  const abx = b.x - a.x
  const abz = b.z - a.z
  const len2 = abx * abx + abz * abz
  let t = len2 > 1e-9 ? ((p.x - a.x) * abx + (p.z - a.z) * abz) / len2 : 0
  t = Math.max(0, Math.min(1, t))
  const qx = a.x + abx * t - p.x
  const qz = a.z + abz * t - p.z
  return Math.sqrt(qx * qx + qz * qz)
}

/** Shade casters (tomatoes + zucchini) at month m, using their current size. */
export function shadeCastersAt(plants: PlantPlan[], m: number): ShadeCaster[] {
  const out: ShadeCaster[] = []
  for (const p of plants) {
    if (!PLANT_SPECS[p.type].castsShade) continue
    const s = sizeAt(p.type, m)
    out.push({
      casterName: p.name,
      casterType: p.type,
      cx: p.x,
      cz: p.z,
      radius: s.footprintCm / 2,
      length: SHADOW_LENGTH_FACTOR * s.heightCm,
    })
  }
  return out
}

/** Distance-based "inside the shade patch" test (patch is clipped to the bed). */
export function shadeDepth(p: P2, c: ShadeCaster): number {
  if (!pointInRect(p)) return -1
  const a = {x: c.cx, z: c.cz}
  const b = {x: c.cx + SHADOW_DIR.x * c.length, z: c.cz + SHADOW_DIR.z * c.length}
  return c.radius - distPointSegment(p, a, b)
}

/** Stadium polygon (convex, counter-clockwise seen from above) for a caster. */
export function stadiumPolygon(c: ShadeCaster, segmentsPerCap: number = 14): P2[] {
  const dx = SHADOW_DIR.x
  const dz = SHADOW_DIR.z
  const baseAngle = Math.atan2(dz, dx)
  const ex = c.cx + dx * c.length
  const ez = c.cz + dz * c.length
  const pts: P2[] = []
  // Front cap around the shadow tip: angles baseAngle-90° .. baseAngle+90°
  for (let i = 0; i <= segmentsPerCap; i++) {
    const a = baseAngle - Math.PI / 2 + (Math.PI * i) / segmentsPerCap
    pts.push({x: ex + Math.cos(a) * c.radius, z: ez + Math.sin(a) * c.radius})
  }
  // Back cap around the plant: angles baseAngle+90° .. baseAngle+270°
  for (let i = 0; i <= segmentsPerCap; i++) {
    const a = baseAngle + Math.PI / 2 + (Math.PI * i) / segmentsPerCap
    pts.push({x: c.cx + Math.cos(a) * c.radius, z: c.cz + Math.sin(a) * c.radius})
  }
  return pts
}

/** Sutherland–Hodgman clip of a polygon against an axis-aligned rectangle. */
export function clipPolygonToRect(poly: P2[], r: Rect = SOIL_RECT): P2[] {
  type Edge = {inside: (p: P2) => boolean; cut: (a: P2, b: P2) => P2}
  const lerpAtX = (a: P2, b: P2, x: number): P2 => {
    const t = (x - a.x) / (b.x - a.x)
    return {x, z: a.z + (b.z - a.z) * t}
  }
  const lerpAtZ = (a: P2, b: P2, z: number): P2 => {
    const t = (z - a.z) / (b.z - a.z)
    return {x: a.x + (b.x - a.x) * t, z}
  }
  const edges: Edge[] = [
    {inside: (p) => p.x >= r.minX, cut: (a, b) => lerpAtX(a, b, r.minX)},
    {inside: (p) => p.x <= r.maxX, cut: (a, b) => lerpAtX(a, b, r.maxX)},
    {inside: (p) => p.z >= r.minZ, cut: (a, b) => lerpAtZ(a, b, r.minZ)},
    {inside: (p) => p.z <= r.maxZ, cut: (a, b) => lerpAtZ(a, b, r.maxZ)},
  ]
  let out = poly
  for (const e of edges) {
    if (out.length === 0) break
    const input = out
    out = []
    for (let i = 0; i < input.length; i++) {
      const cur = input[i]
      const prev = input[(i + input.length - 1) % input.length]
      const curIn = e.inside(cur)
      const prevIn = e.inside(prev)
      if (curIn) {
        if (!prevIn) out.push(e.cut(prev, cur))
        out.push(cur)
      } else if (prevIn) {
        out.push(e.cut(prev, cur))
      }
    }
  }
  return out
}

/** Which plant gets the crowding warning: smaller Aug footprint, then shorter, then later placed. */
function smallerOf(a: PlantPlan, b: PlantPlan): PlantPlan {
  const sa = augSize(a.type)
  const sb = augSize(b.type)
  if (sa.footprintCm !== sb.footprintCm) return sa.footprintCm < sb.footprintCm ? a : b
  if (sa.heightCm !== sb.heightCm) return sa.heightCm < sb.heightCm ? a : b
  return a.placedIndex > b.placedIndex ? a : b
}

/**
 * All current problems, worst first: crowding (biggest overlap first), then shade on basil.
 * One entry per plant (its worst problem). Uses AUGUST sizes/shade (warnings only show in Aug).
 */
export function evaluateWarnings(plants: PlantPlan[], crowdingThresholdCm: number): WarningCandidate[] {
  const crowd = new Map<string, WarningCandidate>()
  for (let i = 0; i < plants.length; i++) {
    for (let j = i + 1; j < plants.length; j++) {
      const a = plants[i]
      const b = plants[j]
      const ra = augSize(a.type).footprintCm / 2
      const rb = augSize(b.type).footprintCm / 2
      const d = Math.hypot(a.x - b.x, a.z - b.z)
      const overlap = ra + rb - d
      if (overlap <= crowdingThresholdCm) continue
      const victim = smallerOf(a, b)
      const bigger = victim === a ? b : a
      const prev = crowd.get(victim.name)
      if (!prev || overlap > prev.severity) {
        crowd.set(victim.name, {
          plantName: victim.name,
          kind: "crowding",
          text: `${PLANT_SPECS[bigger.type].displayName} covers this by July`,
          severity: overlap,
          sourceName: bigger.name,
        })
      }
    }
  }

  const shade: WarningCandidate[] = []
  const casters = shadeCastersAt(plants, 3)
  for (const p of plants) {
    if (p.type !== "Basil" || crowd.has(p.name)) continue
    let best: WarningCandidate | null = null
    for (const c of casters) {
      if (c.casterName === p.name) continue
      const depth = shadeDepth({x: p.x, z: p.z}, c)
      if (depth >= 0 && (!best || depth > best.severity)) {
        best = {
          plantName: p.name,
          kind: "shade",
          text: `${PLANT_SPECS[c.casterType].displayName} shades this at 4 pm`,
          severity: depth,
          sourceName: c.casterName,
        }
      }
    }
    if (best) shade.push(best)
  }

  const crowdList = Array.from(crowd.values()).sort((a, b) => b.severity - a.severity)
  shade.sort((a, b) => b.severity - a.severity)
  return crowdList.concat(shade)
}

/** Lettuce whose centre sits inside a current shade patch (Jul/Aug) → green tick. */
export function lettuceInShade(plants: PlantPlan[], m: number): Set<string> {
  const out = new Set<string>()
  if (m < JULY) return out
  const casters = shadeCastersAt(plants, m)
  for (const p of plants) {
    if (p.type !== "Lettuce") continue
    for (const c of casters) {
      if (shadeDepth({x: p.x, z: p.z}, c) >= 0) {
        out.add(p.name)
        break
      }
    }
  }
  return out
}

export function isAugust(m: number): boolean {
  return m >= AUGUST_WARN_THRESHOLD
}
