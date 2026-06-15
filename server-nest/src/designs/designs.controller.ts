import { Body, Controller, Inject, Post } from "@nestjs/common";
import { DesignsService } from "./designs.service.js";

@Controller("api/designs")
export class DesignsController {
  constructor(@Inject(DesignsService) private readonly designs: DesignsService) {}

  @Post("list")
  list(@Body() body: unknown) {
    return this.designs.listDesigns(body);
  }

  @Post("sectors")
  sectors(@Body() body: unknown) {
    return this.designs.sectors(body);
  }

  @Post("detail")
  detail(@Body() body: unknown) {
    return this.designs.detail(body);
  }

  @Post("multi-info")
  multiInfo(@Body() body: unknown) {
    return this.designs.multiInfo(body);
  }

  @Post("schema-revise")
  schemaRevise(@Body() body: unknown) {
    return this.designs.schemaRevise(body);
  }

  @Post("schema")
  schema(@Body() body: unknown) {
    return this.designs.schema(body);
  }

  @Post("sketch")
  sketch(@Body() body: unknown) {
    return this.designs.sketch(body);
  }

  @Post("convert-sketch")
  convertSketch(@Body() body: unknown) {
    return this.designs.convertSketch(body);
  }

  @Post("sketch-layer-annotations")
  sketchLayerAnnotations(@Body() body: unknown) {
    return this.designs.sketchLayerAnnotations(body);
  }

  @Post("sketch-annotations")
  sketchAnnotations(@Body() body: unknown) {
    return this.designs.sketchAnnotations(body);
  }

  @Post("convert")
  convert(@Body() body: unknown) {
    return this.designs.convert(body);
  }

  @Post("preview")
  preview(@Body() body: unknown) {
    return this.designs.preview(body);
  }

  @Post("slices")
  slices(@Body() body: unknown) {
    return this.designs.slices(body);
  }

  @Post("analyze")
  analyze(@Body() body: unknown) {
    return this.designs.analyze(body);
  }
}
