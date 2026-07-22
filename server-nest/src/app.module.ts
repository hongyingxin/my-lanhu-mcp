import { Module } from "@nestjs/common";
import { ApiController } from "./api/api.controller.js";
import { DesignsController } from "./designs/designs.controller.js";
import { DesignsService } from "./designs/designs.service.js";
import { LanhuClientService } from "./lanhu/lanhu-client.service.js";
import { PagesController } from "./pages/pages.controller.js";
import { PagesService } from "./pages/pages.service.js";

@Module({
  controllers: [ApiController, DesignsController, PagesController],
  providers: [LanhuClientService, DesignsService, PagesService],
})
export class AppModule {}
