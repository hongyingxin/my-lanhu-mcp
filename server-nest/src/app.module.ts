import { Module } from "@nestjs/common";
import { ApiController } from "./api/api.controller.js";
import { DesignsController } from "./designs/designs.controller.js";
import { DesignsService } from "./designs/designs.service.js";
import { LanhuClientService } from "./lanhu/lanhu-client.service.js";

@Module({
  controllers: [ApiController, DesignsController],
  providers: [LanhuClientService, DesignsService],
})
export class AppModule {}
