/**
 * PlotTwistMonthSliderUI — the May→August slider lying along the bed's near rim (passive view).
 *
 * Owns: a BackPlate strip, a UIKit Slider named `MonthSlider` (~60 cm long, value 0..1 ↔ May..Aug,
 *       continuous), and May / Jun / Jul / Aug tick labels laid out under the knob stops.
 * API (Main → UI): setMonth(m) moves the slider exactly like a user drag would, setVisible(on),
 *       setHintVisible(on) for the first-use line "Drag to August" above the slider.
 * Events (UI → Main): onMonthChanged(m) — live while dragging and on every committed value.
 * Must not: grow plants or hold the month — Main owns the month.
 */
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {Slider} from "SpectaclesUIKit.lspkg/Scripts/Components/Slider/Slider"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexAlign, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"

const FONT_SIZE_SCALE = 1.0
type TextRole = "Headline1" | "Headline2" | "Body"
const TYPE_SCALE: Record<TextRole, {size: number; weight: number}> = {
  Headline1: {size: 54, weight: 700},
  Headline2: {size: 48, weight: 700},
  Body: {size: 39, weight: 500},
}
function applyTextRole(t: Text, role: TextRole, distanceCm: number = 110): void {
  t.size = TYPE_SCALE[role].size * FONT_SIZE_SCALE * (distanceCm / 110)
  ;(t as Text & {weight?: number}).weight = TYPE_SCALE[role].weight
}

const LAYOUT_Z_LIFT = 0.02
const MONTH_MAX = 3

@component
export class PlotTwistMonthSliderUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">PlotTwistMonthSliderUI – May→Aug slider on the near rim</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @widget(new SliderWidget(30, 90, 1))
  @hint("Slider length in cm (brief: about 60 cm)")
  sliderLengthCm: number = 60

  @input
  @widget(new SliderWidget(2, 6, 0.1))
  @hint("Slider thickness / knob size in cm — big enough to pinch from the foot of the bed")
  sliderHeightCm: number = 3.4

  @input
  @hint("Tick labels, comma separated, left (May) to right (Aug)")
  monthLabels: string = "May,Jun,Jul,Aug"

  @input
  @widget(new SliderWidget(60, 250, 5))
  @hint("Typical viewing distance (cm) used to scale the tick labels")
  viewingDistanceCm: number = 140

  @input("vec4", "{1,0.96,0.86,1}")
  @widget(new ColorWidget())
  @hint("Tick label colour (keep it light)")
  labelColor: vec4 = new vec4(1, 0.96, 0.86, 1)

  @input
  @hint("First-use hint shown above the slider while there are plants and it is still at May")
  hintText: string = "Drag to August"

  @input
  @widget(new SliderWidget(80, 300, 5))
  @hint("Hint text size (Text.size; 190 ≈ 3 cm capitals)")
  hintTextSize: number = 170
  @ui.group_end

  private slider!: Slider
  private hint!: SceneObject
  private _onMonthChanged = new Event<number>()
  get onMonthChanged(): PublicApi<number> {
    return this._onMonthChanged.publicApi()
  }

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")
    const backPlate = this.sceneObject.createComponent(BackPlate.getTypeName()) as BackPlate

    const content = this.obj(this.sceneObject, "Content")
    content.getTransform().setLocalPosition(new vec3(0, 0, 0.6))
    const flex = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    flex.autoDiscoverItemsOnStart = false // we register items explicitly via addItems
    const L = this.sliderLengthCm
    const H = this.sliderHeightCm
    flex.onInitialized.add(() => {
      flex.width = L + 4
      flex.height = -1
      flex.direction = FlexDirection.Column
      flex.alignItems = FlexAlign.Center
      flex.justifyContent = FlexJustify.Center
      flex.rowGap = 1.0
      flex.paddingTop = 1.4
      flex.paddingBottom = 1.4
      flex.paddingLeft = 2
      flex.paddingRight = 2
    })
    flex.onLayoutComplete.add((r) => {
      backPlate.size = new vec2(r.containerWidth, r.containerHeight)
    })

    // Slider row
    const sliderSO = this.obj(content, "MonthSlider")
    this.liftInZ(sliderSO, LAYOUT_Z_LIFT)
    this.slider = sliderSO.createComponent(Slider.getTypeName()) as Slider
    this.slider.size = new vec3(L, H, 1) // BEFORE init (fill/knob don't refresh post-init)
    this.slider.currentValue = 0
    const sliderItem = sliderSO.createComponent(FlexItem.getTypeName()) as FlexItem
    sliderItem.overrideWidth = L
    sliderItem.overrideHeight = H
    // onKnobMoved fires live while dragging (and for non-animated programmatic sets).
    this.slider.onKnobMoved.add((v: number) => this._onMonthChanged.invoke(v * MONTH_MAX))
    this.slider.onValueChange.add((v: number) => this._onMonthChanged.invoke(v * MONTH_MAX))

    // Tick labels: 4 equal cells, SpaceBetween so their centres sit under the knob stops.
    const labels = this.monthLabels.split(",").map((s) => s.trim())
    const cellW = H
    const row = this.obj(content, "MonthLabels")
    this.liftInZ(row, LAYOUT_Z_LIFT)
    const rowFlex = row.createComponent(FlexLayout.getTypeName()) as FlexLayout
    rowFlex.autoDiscoverItemsOnStart = false // we register items explicitly via addItems
    const rowItem = row.createComponent(FlexItem.getTypeName()) as FlexItem
    rowItem.overrideWidth = L
    rowItem.overrideHeight = 3
    const items: FlexItem[] = []
    rowFlex.onInitialized.add(() => {
      rowFlex.width = L
      rowFlex.height = 3
      rowFlex.direction = FlexDirection.Row
      rowFlex.justifyContent = FlexJustify.SpaceBetween
      rowFlex.alignItems = FlexAlign.Center
    })
    for (const label of labels) {
      const cell = this.obj(row, `Tick_${label}`)
      this.liftInZ(cell, LAYOUT_Z_LIFT)
      const t = cell.createComponent("Component.Text") as Text
      t.text = label
      applyTextRole(t, "Headline1", this.viewingDistanceCm)
      t.depthTest = true
      t.horizontalAlignment = HorizontalAlignment.Center
      t.verticalAlignment = VerticalAlignment.Center
      t.horizontalOverflow = HorizontalOverflow.Overflow
      t.verticalOverflow = VerticalOverflow.Overflow
      t.layoutRect = Rect.create(-cellW / 2, cellW / 2, -1.5, 1.5)
      t.textFill.color = this.labelColor
      const it = cell.createComponent(FlexItem.getTypeName()) as FlexItem
      it.overrideWidth = cellW
      it.overrideHeight = 3
      items.push(it)
    }
    rowFlex.addItems(items)
    flex.addItems([sliderItem, rowItem])

    // First-use hint: one short line just above the slider (panel is ~10 cm tall, centred).
    this.hint = this.obj(this.sceneObject, "SliderHint")
    this.hint.getTransform().setLocalPosition(new vec3(0, 8.8, 0.8))
    const ht = this.hint.createComponent("Component.Text") as Text
    ht.text = this.hintText
    ht.size = this.hintTextSize
    ;(ht as Text & {weight?: number}).weight = 700
    ht.depthTest = true
    ht.horizontalAlignment = HorizontalAlignment.Center
    ht.verticalAlignment = VerticalAlignment.Center
    ht.horizontalOverflow = HorizontalOverflow.Overflow
    ht.verticalOverflow = VerticalOverflow.Overflow
    ht.layoutRect = Rect.create(-1, 1, -1, 1)
    ht.textFill.color = this.labelColor
    this.hint.enabled = false
  }

  /** Show / hide the "Drag to August" first-use line. */
  setHintVisible(on: boolean): void {
    if (this.hint && this.hint.enabled !== on) this.hint.enabled = on
  }

  isHintVisible(): boolean {
    return !!this.hint && this.hint.isEnabledInHierarchy
  }

  /** Move the slider to month value m (0 = May … 3 = Aug) — same path as a user drag commit. */
  setMonth(m: number): void {
    const v = Math.max(0, Math.min(1, m / MONTH_MAX))
    this.slider.updateCurrentValue(v, false) // jump (no spring) so the month is exact immediately
  }

  getMonthValue(): number {
    return this.slider.currentValue * MONTH_MAX
  }

  setVisible(on: boolean): void {
    this.sceneObject.enabled = on
  }

  private obj(parent: SceneObject, name: string): SceneObject {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    return so
  }

  private liftInZ(so: SceneObject, dz: number): void {
    const t = so.getTransform()
    const p = t.getLocalPosition()
    t.setLocalPosition(new vec3(p.x, p.y, p.z + dz))
  }
}
