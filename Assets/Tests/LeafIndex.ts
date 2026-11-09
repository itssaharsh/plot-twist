import {scenariosIndex} from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator"
import {ScenarioMetadata} from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata"
import {PlotTwistC1PlantScenario} from "./PlotTwistC1PlantScenario"
import {PlotTwistC2GrowScenario} from "./PlotTwistC2GrowScenario"
import {PlotTwistC3CrowdingScenario} from "./PlotTwistC3CrowdingScenario"
import {PlotTwistC4ShadeScenario} from "./PlotTwistC4ShadeScenario"
import {PlotTwistC5PlantingScenario} from "./PlotTwistC5PlantingScenario"

/** Plot Twist LEAF scenarios — one per done criterion in devpost/design-brief.md. */
@component
export class LeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = [
    {id: "c1-plant-from-packet", typename: PlotTwistC1PlantScenario.getTypeName()},
    {id: "c2-grow-to-august", typename: PlotTwistC2GrowScenario.getTypeName()},
    {id: "c3-crowding-warning", typename: PlotTwistC3CrowdingScenario.getTypeName()},
    {id: "c4-shade-patch", typename: PlotTwistC4ShadeScenario.getTypeName()},
    {id: "c5-planting-mode", typename: PlotTwistC5PlantingScenario.getTypeName()},
  ]
}
