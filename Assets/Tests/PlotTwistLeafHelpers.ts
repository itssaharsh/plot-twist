/**
 * Shared helpers for the Plot Twist LEAF scenarios.
 *
 * Tests drive the Lens through real SIK interactions (see PlotTwistLeafInteractor) and read
 * state through PlotTwistMain's read-only test surface plus plain SceneObject state.
 * Setup-only steps (planting a known layout) use PlotTwistMain.plantAt, which is the same
 * function the packet-drop handler calls.
 */
import {findSceneObjectByName, nextFrame, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {PlantInfo, PlotTwistMain} from "../Scripts/PlotTwistMain"

/** Soil top in the bed frame (PlotRoot-local cm). */
export const SOIL_Y = -130

export function log(msg: string): void {
  print(`[PlotTwistLeaf] ${msg}`)
}

export function getMain(): PlotTwistMain {
  const so = findSceneObjectByName("PlotTwist")
  if (!so) throw new Error("SceneObject 'PlotTwist' not found")
  const main = so.getComponent(PlotTwistMain.getTypeName()) as PlotTwistMain
  if (!main) throw new Error("PlotTwistMain component not found on 'PlotTwist'")
  return main
}

function nowMs(): number {
  return getTime() * 1000
}

/** Polls every frame until cond() is true; throws with `label` after timeoutMs. */
export async function waitUntil(cond: () => boolean, timeoutMs: number, label: string): Promise<void> {
  const end = nowMs() + timeoutMs
  while (!safe(cond)) {
    if (nowMs() > end) throw new Error(`Timed out after ${timeoutMs} ms waiting for: ${label}`)
    await nextFrame()
  }
}

/** Polls every frame for up to timeoutMs; resolves true as soon as cond() is true. */
export async function watchFor(cond: () => boolean, timeoutMs: number): Promise<boolean> {
  const end = nowMs() + timeoutMs
  while (nowMs() <= end) {
    if (safe(cond)) return true
    await nextFrame()
  }
  return false
}

function safe(cond: () => boolean): boolean {
  try {
    return cond()
  } catch (e) {
    return false
  }
}

/** Waits for the Lens to finish init, then clears the bed back to the start state (empty, May). */
export async function freshPlot(): Promise<PlotTwistMain> {
  await waitUntil(() => getMain().isReady(), 30000, "PlotTwistMain.isReady()")
  const main = getMain()
  main.resetPlot()
  const t0 = getTime()
  let frames = 0
  while (getTime() - t0 < 0.4) {
    await nextFrame()
    frames++
  }
  log(`preview frame rate ≈ ${(frames / (getTime() - t0)).toFixed(1)} fps`)
  check(main.getPlants().length === 0, "bed is empty after resetPlot()")
  checkNear(main.getMonth(), 0, 0.001, "month after resetPlot()")
  return main
}

export function check(cond: boolean, label: string): void {
  if (!cond) throw new Error(`Check failed: ${label}`)
  log(`ok: ${label}`)
}

export function checkNear(actual: number, expected: number, tol: number, label: string): void {
  if (!(Math.abs(actual - expected) <= tol)) {
    throw new Error(`Check failed: ${label} — expected ${expected} ± ${tol}, got ${actual}`)
  }
  log(`ok: ${label} = ${Math.round(actual * 100) / 100} (expected ${expected} ± ${tol})`)
}

export function checkEq<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`Check failed: ${label} — expected "${expected}", got "${actual}"`)
  }
  log(`ok: ${label} = "${actual}"`)
}

export function plant(main: PlotTwistMain, name: string): PlantInfo {
  const p = main.getPlants().find((q) => q.name === name)
  if (!p) throw new Error(`Plant "${name}" not found`)
  return p
}

export function plantAtOrThrow(main: PlotTwistMain, type: "Tomato" | "Zucchini" | "Basil" | "Lettuce", x: number, z: number): string {
  const name = main.plantAt(type, x, z)
  if (!name) throw new Error(`plantAt(${type}, ${x}, ${z}) planted nothing`)
  log(`setup: planted ${name} at (${x}, ${z})`)
  return name
}

export function sceneObject(name: string, root?: SceneObject): SceneObject {
  const so = findSceneObjectByName(name, root)
  if (!so) throw new Error(`SceneObject "${name}" not found${root ? ` under "${root.name}"` : ""}`)
  return so
}

/** World-space AABB size of the first RenderMeshVisual on `so`. */
export function worldAabb(so: SceneObject): {min: vec3; max: vec3; size: vec3; center: vec3} {
  const rmv = so.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
  if (!rmv) throw new Error(`No RenderMeshVisual on "${so.name}"`)
  const min = rmv.worldAabbMin()
  const max = rmv.worldAabbMax()
  return {min, max, size: max.sub(min), center: min.add(max).uniformScale(0.5)}
}

export interface MeasuredPlant {
  n: string
  visH: number | null
  visW: number | null
}

/** Each plant's measured world-space visual size, from PlotTwistMain.debugStateJson(). */
export function measuredPlants(main: PlotTwistMain): MeasuredPlant[] {
  const state = JSON.parse(main.debugStateJson()) as {plants: MeasuredPlant[]}
  return state.plants
}
