/**
 * PlotTwistGuidanceUI — the in-world text that guides the user (passive view).
 *
 * Owns (created under this SceneObject at runtime):
 *   WarningLine     — ONE short light line ~10 cm above the plant in trouble (never a panel),
 *                     billboarded toward the user, fades out when the problem is fixed.
 *   DigSpotPanel    — planting mode: DigSpotLine (name + depth) above the dig spot and a big
 *                     UIKit DoneButton right next to it.
 *   PlantedMessage  — "Your bed is planted".
 * API (Main → UI): showWarningLine / setWarningText / setWarningLinePosition / fadeOutWarningLine /
 *   hideWarningLine, showDigSpot / hideDigSpot, showPlanted / hidePlanted.
 * Events (UI → Main): onDone.
 * Must not: decide which warning or dig spot is current — Main/controllers push that in.
 */
import {Billboard} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Billboard/Billboard"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {ElementContent} from "SpectaclesUIKit.lspkg/Scripts/Components/Content/ElementContent"

const CHECK_ICON: Texture = requireAsset("../Icons/check.png") as Texture

// ── Typography: the single source of truth for text size + weight ────────────
// `Component.Text.size` is the em-square height: em-square cm = size / 43.886.
// Roles are calibrated for z = -110 cm; pass the viewing distance for far text.
const FONT_SIZE_SCALE = 1.0
type TextRole =
  | "Title1" | "Title2" | "HeadlineXL" | "Headline1" | "Headline2"
  | "Subheadline" | "Button" | "Callout" | "Body" | "Caption"
const TYPE_SCALE: Record<TextRole, {size: number; weight: number}> = {
  Title1: {size: 105, weight: 700},
  Title2: {size: 93, weight: 700},
  HeadlineXL: {size: 62, weight: 700},
  Headline1: {size: 54, weight: 700},
  Headline2: {size: 48, weight: 700},
  Subheadline: {size: 41, weight: 700},
  Button: {size: 39, weight: 500},
  Callout: {size: 39, weight: 700},
  Body: {size: 39, weight: 500},
  Caption: {size: 38, weight: 500},
}
function roleSize(role: TextRole, distanceCm: number = 110): number {
  return TYPE_SCALE[role].size * FONT_SIZE_SCALE * (distanceCm / 110)
}

@component
export class PlotTwistGuidanceUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">PlotTwistGuidanceUI – warning line, dig spot line + Done, planted message</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input("vec4", "{1,0.96,0.86,1}")
  @widget(new ColorWidget())
  @hint("Colour of every guidance line (keep it light — dark text vanishes on Specs)")
  textColor: vec4 = new vec4(1, 0.96, 0.86, 1)

  @input
  @widget(new SliderWidget(100, 320, 5))
  @hint("Warning / dig-spot line text size (Text.size). 190 ≈ 3 cm capital letters, readable from the foot of the bed")
  lineTextSize: number = 190

  @input
  @hint("Message shown after the last dig spot")
  plantedText: string = "Your bed is planted"

  @input
  @hint("Label on the Done button in planting mode")
  doneLabel: string = "Done"

  @input
  @widget(new SliderWidget(8, 20, 0.5))
  @hint("Done button width in cm (height is half). Brief: about 12 cm across")
  doneButtonWidthCm: number = 12
  @ui.group_end

  private warningLine!: SceneObject
  private warningText!: Text
  private warningFadeStart = -1
  private warningFadeSec = 0.5

  private digSpotPanel!: SceneObject
  private digSpotText!: Text
  private doneButton!: Button

  private plantedMessage!: SceneObject
  private plantedTextComp!: Text

  private _onDone = new Event<void>()
  get onDone(): PublicApi<void> {
    return this._onDone.publicApi()
  }

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")

    // Warning line
    this.warningLine = this.obj(this.sceneObject, "WarningLine")
    this.warningText = this.addLine(this.warningLine, "", this.lineTextSize)
    this.addBillboard(this.warningLine)
    this.warningLine.enabled = false

    // Dig spot panel: line above, Done button beside the spot.
    this.digSpotPanel = this.obj(this.sceneObject, "DigSpotPanel")
    this.addBillboard(this.digSpotPanel)
    const lineSO = this.obj(this.digSpotPanel, "DigSpotLine", new vec3(0, 26, 0))
    this.digSpotText = this.addLine(lineSO, "", this.lineTextSize * 0.9)
    const doneSO = this.obj(this.digSpotPanel, "DoneButton", new vec3(this.doneButtonWidthCm / 2 + 9, 9, 0))
    this.doneButton = doneSO.createComponent(Button.getTypeName()) as Button
    const w = this.doneButtonWidthCm
    this.doneButton.onInitialized.add(() => {
      this.doneButton.size = new vec3(w, w / 2, 1)
    })
    const ec = doneSO.createComponent(ElementContent.getTypeName()) as ElementContent
    ec.leadingIcon = CHECK_ICON
    ec.leadingIconSize = w * 0.22
    ec.text = this.doneLabel
    ec.textSize = roleSize("Headline1", 200)
    this.doneButton.onTriggerUp.add(() => this._onDone.invoke())
    // Start hidden only after the button has initialised (a disabled host never gets OnStart).
    this.doneButton.onInitialized.add(() => {
      if (!this.digSpotWanted) this.digSpotPanel.enabled = false
    })

    // Planted message
    this.plantedMessage = this.obj(this.sceneObject, "PlantedMessage")
    this.plantedTextComp = this.addLine(this.plantedMessage, this.plantedText, this.lineTextSize * 1.2)
    this.addBillboard(this.plantedMessage)
    this.plantedMessage.enabled = false

    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  private digSpotWanted = false

  // ── Warning line ──────────────────────────────────────────────────────────

  showWarningLine(text: string): void {
    this.warningText.text = text
    this.warningFadeStart = -1
    this.setTextAlpha(this.warningText, 1)
    this.warningLine.enabled = true
  }

  setWarningText(text: string): void {
    this.warningText.text = text
  }

  setWarningLinePosition(world: vec3): void {
    this.warningLine.getTransform().setWorldPosition(world)
  }

  fadeOutWarningLine(seconds: number): void {
    if (!this.warningLine.enabled) return
    this.warningFadeSec = Math.max(0.05, seconds)
    this.warningFadeStart = getTime()
  }

  hideWarningLine(): void {
    this.warningFadeStart = -1
    this.warningLine.enabled = false
  }

  isWarningLineVisible(): boolean {
    return this.warningLine.enabled
  }

  getWarningText(): string {
    return this.warningLine.enabled ? this.warningText.text : ""
  }

  // ── Dig spot ──────────────────────────────────────────────────────────────

  /** Show the line + Done button around a dig spot (world position on the soil). */
  showDigSpot(text: string, spotWorld: vec3): void {
    this.digSpotWanted = true
    this.digSpotText.text = text
    this.digSpotPanel.getTransform().setWorldPosition(spotWorld)
    this.digSpotPanel.enabled = true
  }

  hideDigSpot(): void {
    this.digSpotWanted = false
    this.digSpotPanel.enabled = false
  }

  getDigSpotText(): string {
    return this.digSpotPanel.enabled ? this.digSpotText.text : ""
  }

  // ── Planted ───────────────────────────────────────────────────────────────

  showPlanted(world: vec3): void {
    this.plantedTextComp.text = this.plantedText
    this.plantedMessage.getTransform().setWorldPosition(world)
    this.plantedMessage.enabled = true
  }

  hidePlanted(): void {
    this.plantedMessage.enabled = false
  }

  isPlantedVisible(): boolean {
    return this.plantedMessage.enabled
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private onUpdate(): void {
    if (this.warningFadeStart >= 0) {
      const t = (getTime() - this.warningFadeStart) / this.warningFadeSec
      if (t >= 1) {
        this.hideWarningLine()
      } else {
        this.setTextAlpha(this.warningText, 1 - t)
      }
    }
  }

  private setTextAlpha(t: Text, a: number): void {
    const c = this.textColor
    t.textFill.color = new vec4(c.x, c.y, c.z, c.w * a)
  }

  private addLine(parent: SceneObject, text: string, size: number): Text {
    const t = parent.createComponent("Component.Text") as Text
    t.text = text
    t.size = size
    ;(t as Text & {weight?: number}).weight = 700
    t.depthTest = true
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Overflow
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-1, 1, -1, 1)
    t.textFill.color = this.textColor
    return t
  }

  private addBillboard(so: SceneObject): void {
    const b = so.createComponent(Billboard.getTypeName()) as Billboard
    b.xAxisEnabled = true
    b.yAxisEnabled = true
  }

  private obj(parent: SceneObject, name: string, position?: vec3): SceneObject {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    if (position) so.getTransform().setLocalPosition(position)
    return so
  }
}
