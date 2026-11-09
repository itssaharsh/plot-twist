/**
 * PlotTwistPlantData — the brief's numbers in one place (pure data, no scene access).
 *
 * Owns: plant specs (August height / footprint, packet + planting text), growth curve,
 *       bed geometry (the 4×8 ft raised-bed stand-in), the hard-coded 4 pm August sun.
 * Coordinates: PlotRoot-local cm. Camera/eyes at the origin facing −Z (north),
 *       +X = east (user's right), floor at y = −160, soil top at y = −130.
 * Must not: touch SceneObjects. Every value here comes from devpost/design-brief.md.
 */

export type PlantType = "Tomato" | "Zucchini" | "Basil" | "Lettuce"

export const PLANT_TYPES: PlantType[] = ["Tomato", "Zucchini", "Basil", "Lettuce"]

export interface PlantSpec {
  type: PlantType
  /** Capitalised display name used in warning lines. */
  displayName: string
  /** Real August height (cm). */
  augHeightCm: number
  /** Real August footprint diameter (cm) — also the recommended spacing. */
  augFootprintCm: number
  /** Seed-packet spacing label, e.g. "space 24 in". */
  packetSpacing: string
  /** One line shown above the dig spot in planting mode. */
  plantingLine: string
  /** Tomatoes and zucchini cast the 4 pm shade patch. */
  castsShade: boolean
}

export const PLANT_SPECS: Record<PlantType, PlantSpec> = {
  Tomato: {
    type: "Tomato",
    displayName: "Tomato",
    augHeightCm: 122,
    augFootprintCm: 61,
    packetSpacing: "space 24 in",
    plantingLine: "Tomato · plant at soil level",
    castsShade: true,
  },
  Zucchini: {
    type: "Zucchini",
    displayName: "Zucchini",
    augHeightCm: 61,
    augFootprintCm: 76,
    packetSpacing: "space 30 in",
    plantingLine: "Zucchini · seed 1.3 cm deep",
    castsShade: true,
  },
  Basil: {
    type: "Basil",
    displayName: "Basil",
    augHeightCm: 46,
    augFootprintCm: 61,
    packetSpacing: "space 24 in",
    plantingLine: "Basil · plant at soil level",
    castsShade: false,
  },
  Lettuce: {
    type: "Lettuce",
    displayName: "Lettuce",
    augHeightCm: 15,
    augFootprintCm: 20,
    packetSpacing: "space 8 in",
    plantingLine: "Lettuce · seed 0.6 cm deep",
    castsShade: false,
  },
}

/** Seedlings are 8 cm tall and 8 cm across in May; plants never shrink below this. */
export const SEEDLING_CM = 8

export const MONTH_NAMES = ["May", "Jun", "Jul", "Aug"]
export const MONTH_MAX = 3
/** m >= this shows rings for every plant and the shade patches (July and August). */
export const JULY = 2
/** m >= this counts as "August" for warnings (slider at the Aug end). */
export const AUGUST_WARN_THRESHOLD = 2.95

/** Growth keys from the brief: May seedling, Jun 1/3, Jul 3/4, Aug full. */
const GROWTH_KEYS = [0, 1 / 3, 3 / 4, 1]

/** Fraction of full August size at month value m (0 = May … 3 = Aug), linear between keys. */
export function growthFraction(m: number): number {
  const mm = Math.max(0, Math.min(MONTH_MAX, m))
  const i = Math.min(Math.floor(mm), MONTH_MAX - 1)
  const t = mm - i
  return GROWTH_KEYS[i] + (GROWTH_KEYS[i + 1] - GROWTH_KEYS[i]) * t
}

export interface PlantSize {
  heightCm: number
  footprintCm: number
}

/** size(m) = max(8, frac(m) × full), per axis. */
export function sizeAt(type: PlantType, m: number): PlantSize {
  const spec = PLANT_SPECS[type]
  const f = growthFraction(m)
  return {
    heightCm: Math.max(SEEDLING_CM, f * spec.augHeightCm),
    footprintCm: Math.max(SEEDLING_CM, f * spec.augFootprintCm),
  }
}

export function augSize(type: PlantType): PlantSize {
  const spec = PLANT_SPECS[type]
  return {heightCm: spec.augHeightCm, footprintCm: spec.augFootprintCm}
}

/** Raised bed stand-in: 122 × 244 cm, 30 cm tall, near short edge 80 cm ahead. */
export const BED = {
  widthCm: 122,
  lengthCm: 244,
  heightCm: 30,
  centerX: 0,
  nearZ: -80,
  farZ: -324,
  floorY: -160,
  soilY: -130,
  rimThicknessCm: 4,
  rimAboveSoilCm: 7,
}

export interface Rect {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

/** The soil surface inside the wooden rim — where seedlings can be planted. */
export const SOIL_RECT: Rect = {
  minX: BED.centerX - BED.widthCm / 2 + BED.rimThicknessCm,
  maxX: BED.centerX + BED.widthCm / 2 - BED.rimThicknessCm,
  minZ: BED.farZ + BED.rimThicknessCm,
  maxZ: BED.nearZ - BED.rimThicknessCm,
}

/**
 * Hard-coded sun: mid-August, 4 pm, ~40°N — elevation 32°, azimuth 262° (WSW).
 * Shadows fall toward azimuth 82° (ENE). North = −Z, East = +X, so the shadow
 * direction is (sin 82°, 0, −cos 82°) ≈ (0.990, 0, −0.139).
 */
const SHADOW_AZIMUTH_DEG = 82
export const SHADOW_DIR = {
  x: Math.sin((SHADOW_AZIMUTH_DEG * Math.PI) / 180),
  z: -Math.cos((SHADOW_AZIMUTH_DEG * Math.PI) / 180),
}
/** Shadow length = 1.6 × the plant's current height (1 / tan 32°). */
export const SHADOW_LENGTH_FACTOR = 1.6
