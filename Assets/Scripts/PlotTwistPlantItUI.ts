/**
 * PlotTwistPlantItUI — the "Plant it" button at the bed's near-right corner (passive view).
 *
 * Owns: a UIKit Button named `PlantItButton` (sprout icon + "Plant it", ~13 cm across) and a
 *       one-line hint above it (used for "Plant a seed packet first").
 * API (Main → UI): setVisible(on), showHint(text, seconds).
 * Events (UI → Main): onPlantIt.
 * Must not: decide whether planting can start — Main does.
 */
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {ElementContent} from "SpectaclesUIKit.lspkg/Scripts/Components/Content/ElementContent"

const SPROUT_ICON: Texture = requireAsset("../Icons/psychiatry.png") as Texture

const FONT_SIZE_SCALE = 1.0
type TextRole = "Headline1" | "Headline2" | "Body"
const TYPE_SCALE: Record<TextRole, {size: number; weight: number}> = {
  Headline1: {size: 54, weight: 700},
  Headline2: {size: 48, weight: 700},
  Body: {size: 39, weight: 500},
}
function roleSize(role: TextRole, distanceCm: number = 110): number {
  return TYPE_SCALE[role].size * FONT_SIZE_SCALE * (distanceCm / 110)
}
function applyTextRole(t: Text, role: TextRole, distanceCm: number = 110): void {
  t.size = roleSize(role, distanceCm)
  ;(t as Text & {weight?: number}).weight = TYPE_SCALE[role].weight
}

@component
export class PlotTwistPlantItUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">PlotTwistPlantItUI – "Plant it" button at the near-right corner</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Button label")
  label: string = "Plant it"

  @input
  @widget(new SliderWidget(8, 20, 0.5))
  @hint("Button width in cm (height is half). Brief: about 12 cm across")
  buttonWidthCm: number = 13

  @input
  @widget(new SliderWidget(60, 250, 5))
  @hint("Typical viewing distance (cm) used to scale the label and hint text")
  viewingDistanceCm: number = 140

  @input("vec4", "{1,0.96,0.86,1}")
  @widget(new ColorWidget())
  @hint("Hint text colour (keep it light)")
  hintColor: vec4 = new vec4(1, 0.96, 0.86, 1)
  @ui.group_end

  private buttonSO!: SceneObject
  private hintSO!: SceneObject
  private hintText!: Text
  private hintUntil = -1

  private _onPlantIt = new Event<void>()
  get onPlantIt(): PublicApi<void> {
    return this._onPlantIt.publicApi()
  }

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")
    const w = this.buttonWidthCm
    this.buttonSO = global.scene.createSceneObject("PlantItButton")
    this.buttonSO.setParent(this.sceneObject)
    const btn = this.buttonSO.createComponent(Button.getTypeName()) as Button
    btn.onInitialized.add(() => {
      btn.size = new vec3(w, w / 2, 1)
    })
    const ec = this.buttonSO.createComponent(ElementContent.getTypeName()) as ElementContent
    ec.leadingIcon = SPROUT_ICON
    ec.leadingIconSize = w * 0.2
    ec.text = this.label
    ec.textSize = roleSize("Headline2", this.viewingDistanceCm)
    btn.onTriggerUp.add(() => this._onPlantIt.invoke())

    this.hintSO = global.scene.createSceneObject("PlantItHint")
    this.hintSO.setParent(this.sceneObject)
    this.hintSO.getTransform().setLocalPosition(new vec3(0, w / 4 + 4, 0.1))
    this.hintText = this.hintSO.createComponent("Component.Text") as Text
    applyTextRole(this.hintText, "Body", this.viewingDistanceCm)
    this.hintText.depthTest = true
    this.hintText.horizontalAlignment = HorizontalAlignment.Center
    this.hintText.verticalAlignment = VerticalAlignment.Center
    this.hintText.horizontalOverflow = HorizontalOverflow.Overflow
    this.hintText.verticalOverflow = VerticalOverflow.Overflow
    this.hintText.layoutRect = Rect.create(-1, 1, -1, 1)
    this.hintText.textFill.color = this.hintColor
    this.hintSO.enabled = false

    this.createEvent("UpdateEvent").bind(() => {
      if (this.hintUntil >= 0 && getTime() > this.hintUntil) {
        this.hintUntil = -1
        this.hintSO.enabled = false
      }
    })
  }

  setVisible(on: boolean): void {
    this.sceneObject.enabled = on
  }

  showHint(text: string, seconds: number): void {
    this.hintText.text = text
    this.hintSO.enabled = true
    this.hintUntil = getTime() + seconds
  }

  getHintText(): string {
    return this.hintSO.enabled ? this.hintText.text : ""
  }
}
