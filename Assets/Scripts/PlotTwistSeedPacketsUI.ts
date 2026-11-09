/**
 * PlotTwistSeedPacketsUI — four big seed packets at the bed's near-left corner (passive view).
 *
 * Owns: a FlexLayout row of UIKit Buttons named `SeedPacket_Tomato`, `SeedPacket_Zucchini`,
 *       `SeedPacket_Basil`, `SeedPacket_Lettuce` (~14 × 20 cm, hover highlight from UIKit),
 *       each showing a small 3D picture of the plant, its name and its spacing.
 * API (Main → UI): setPacketModel(type, prefab) for the picture, setVisible(on),
 *       setHintVisible(on) for the first-use line "Grab a packet" above the row.
 * Events (UI → Main): onPacketDragStart / onPacketDragUpdate / onPacketDragEnd with the
 *       packet type + the SIK drag event. The packet itself never moves.
 * Must not: plant anything — Main turns the drag into a seedling.
 */
import {DragInteractorEvent} from "SpectaclesInteractionKit.lspkg/Core/Interactor/InteractorEvent"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexAlign, FlexAlignSelf, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {PLANT_SPECS, PLANT_TYPES, PlantType} from "./PlotTwistPlantData"

const FONT_SIZE_SCALE = 1.0
type TextRole = "HeadlineXL" | "Headline1" | "Headline2" | "Body"
const TYPE_SCALE: Record<TextRole, {size: number; weight: number}> = {
  HeadlineXL: {size: 62, weight: 700},
  Headline1: {size: 54, weight: 700},
  Headline2: {size: 48, weight: 700},
  Body: {size: 39, weight: 500},
}
function applyTextRole(t: Text, role: TextRole, distanceCm: number = 110): void {
  t.size = TYPE_SCALE[role].size * FONT_SIZE_SCALE * (distanceCm / 110)
  ;(t as Text & {weight?: number}).weight = TYPE_SCALE[role].weight
}

const LAYOUT_Z_LIFT = 0.02
const BUTTON_LABEL_Z = 0.08

export interface PacketDragEvent {
  type: PlantType
  event: DragInteractorEvent
}

@component
export class PlotTwistSeedPacketsUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">PlotTwistSeedPacketsUI – four seed packets to drag onto the soil</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @widget(new SliderWidget(8, 24, 0.5))
  @hint("Packet width in cm (brief: about 14)")
  packetWidthCm: number = 14

  @input
  @widget(new SliderWidget(12, 30, 0.5))
  @hint("Packet height in cm (brief: about 20)")
  packetHeightCm: number = 20

  @input
  @widget(new SliderWidget(0, 6, 0.1))
  @hint("Gap between packets in cm")
  gapCm: number = 2

  @input
  @widget(new SliderWidget(60, 250, 5))
  @hint("Typical viewing distance (cm) used to scale the packet text")
  viewingDistanceCm: number = 150

  @input("vec4", "{1,0.96,0.86,1}")
  @widget(new ColorWidget())
  @hint("Packet text colour (keep it light)")
  textColor: vec4 = new vec4(1, 0.96, 0.86, 1)

  @input
  @hint("First-use hint shown above the packets until the first plant is placed")
  hintText: string = "Grab a packet"

  @input
  @widget(new SliderWidget(80, 300, 5))
  @hint("Hint text size (Text.size; 190 ≈ 3 cm capitals)")
  hintTextSize: number = 170
  @ui.group_end

  private pictureSlots = new Map<PlantType, SceneObject>()
  private hint!: SceneObject
  private _onDragStart = new Event<PacketDragEvent>()
  private _onDragUpdate = new Event<PacketDragEvent>()
  private _onDragEnd = new Event<PacketDragEvent>()
  get onPacketDragStart(): PublicApi<PacketDragEvent> {
    return this._onDragStart.publicApi()
  }
  get onPacketDragUpdate(): PublicApi<PacketDragEvent> {
    return this._onDragUpdate.publicApi()
  }
  get onPacketDragEnd(): PublicApi<PacketDragEvent> {
    return this._onDragEnd.publicApi()
  }

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")
    const content = this.obj(this.sceneObject, "Packets")
    const row = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    row.autoDiscoverItemsOnStart = false // we register items explicitly via addItems
    const W = this.packetWidthCm
    const H = this.packetHeightCm
    row.onInitialized.add(() => {
      row.width = PLANT_TYPES.length * W + (PLANT_TYPES.length - 1) * this.gapCm
      row.height = H
      row.direction = FlexDirection.Row
      row.columnGap = this.gapCm
      row.justifyContent = FlexJustify.Center
      row.alignItems = FlexAlign.Center
    })
    const items: FlexItem[] = []
    for (const type of PLANT_TYPES) items.push(this.buildPacket(content, type, W, H))
    row.addItems(items)

    // First-use hint: one short line just above the row of packets.
    this.hint = this.obj(this.sceneObject, "PacketHint")
    this.hint.getTransform().setLocalPosition(new vec3(0, H / 2 + 4.5, 0.3))
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
    ht.textFill.color = this.textColor
  }

  /** Show / hide the "Grab a packet" first-use line. */
  setHintVisible(on: boolean): void {
    if (this.hint && this.hint.enabled !== on) this.hint.enabled = on
  }

  isHintVisible(): boolean {
    return !!this.hint && this.hint.isEnabledInHierarchy
  }

  /** Put a small 3D picture of the plant on its packet. */
  setPacketModel(type: PlantType, prefab: ObjectPrefab): void {
    const slot = this.pictureSlots.get(type)
    if (!slot || !prefab) return
    for (let i = slot.getChildrenCount() - 1; i >= 0; i--) slot.getChild(i).destroy()
    const spec = PLANT_SPECS[type]
    const fit = (this.packetHeightCm * 0.45) / Math.max(spec.augHeightCm, spec.augFootprintCm)
    const wrap = global.scene.createSceneObject("Picture")
    wrap.setParent(slot)
    wrap.getTransform().setLocalScale(new vec3(fit, fit, fit))
    wrap.getTransform().setLocalRotation(quat.fromEulerAngles(0.25, 0.5, 0))
    prefab.instantiate(wrap)
  }

  setVisible(on: boolean): void {
    this.sceneObject.enabled = on
  }

  private buildPacket(parent: SceneObject, type: PlantType, W: number, H: number): FlexItem {
    const spec = PLANT_SPECS[type]
    const so = this.obj(parent, `SeedPacket_${type}`)
    this.liftInZ(so, LAYOUT_Z_LIFT)
    const btn = so.createComponent(Button.getTypeName()) as Button
    btn.onInitialized.add(() => {
      btn.size = new vec3(W, H, 1)
      const it = btn.interactable
      it.onDragStart.add((e: DragInteractorEvent) => this._onDragStart.invoke({type, event: e}))
      it.onDragUpdate.add((e: DragInteractorEvent) => this._onDragUpdate.invoke({type, event: e}))
      it.onDragEnd.add((e: DragInteractorEvent) => this._onDragEnd.invoke({type, event: e}))
    })
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = W
    item.overrideHeight = H

    // Face: column of picture / name / spacing, lifted in front of the button face.
    const face = this.obj(so, "Face")
    face.getTransform().setLocalPosition(new vec3(0, 0, BUTTON_LABEL_Z))
    const col = face.createComponent(FlexLayout.getTypeName()) as FlexLayout
    col.autoDiscoverItemsOnStart = false // we register items explicitly via addItems
    col.onInitialized.add(() => {
      col.width = W
      col.height = H
      col.direction = FlexDirection.Column
      col.justifyContent = FlexJustify.End
      col.alignItems = FlexAlign.Center
      col.rowGap = 0.4
      col.paddingTop = 1
      col.paddingBottom = 1.4
    })
    const pictureCell = this.obj(face, "PictureCell")
    const picItem = pictureCell.createComponent(FlexItem.getTypeName()) as FlexItem
    picItem.overrideWidth = W - 2
    picItem.overrideHeight = H * 0.5
    const slot = this.obj(pictureCell, "PictureSlot")
    slot.getTransform().setLocalPosition(new vec3(0, -H * 0.22, 3))
    this.pictureSlots.set(type, slot)

    const nameItem = this.addText(face, "Name", spec.displayName, "HeadlineXL", W - 1, 3)
    const spaceItem = this.addText(face, "Spacing", spec.packetSpacing, "Headline2", W - 1, 2.6)
    col.addItems([picItem, nameItem, spaceItem])
    return item
  }

  private addText(parent: SceneObject, name: string, text: string, role: TextRole, w: number, h: number): FlexItem {
    const so = this.obj(parent, name)
    const t = so.createComponent("Component.Text") as Text
    t.text = text
    applyTextRole(t, role, this.viewingDistanceCm)
    t.depthTest = true
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Overflow
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-w / 2, w / 2, -h / 2, h / 2)
    t.textFill.color = this.textColor
    const it = so.createComponent(FlexItem.getTypeName()) as FlexItem
    it.overrideWidth = w
    it.overrideHeight = h
    it.alignSelf = FlexAlignSelf.Center
    return it
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
