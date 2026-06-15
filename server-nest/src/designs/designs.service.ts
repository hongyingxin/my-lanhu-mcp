import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  analyzeDesign,
  analyzeDesignBatch,
  convertLanhuSchema,
  convertLanhuSketch,
  extractFullAnnotationsFromSketch,
  getDesignSchemaJson,
  getSketchJson,
  getSlices,
  listDesigns,
  resolveDesignImageUrl,
  resolveDesignScale,
} from "@lanhu/core";
import type { UnknownRecord } from "@lanhu/core";
import { LanhuClientService } from "../lanhu/lanhu-client.service.js";
import {
  getDesignFields,
  getStringField,
  getBooleanField,
  getDesignSelector,
  getNumberField,
  isBatchDesignSelector,
  resolvePersistArtifacts,
  isRecord,
  resolveRequestCookie,
  resolveRequestDdsCookie,
  toErrorMessage,
  COOKIE_REQUIRED_MESSAGE,
} from "../common/request.util.js";
import { getLanhuCookie, getLanhuDataDir } from "../env.js";

@Injectable()
export class DesignsService {
  constructor(@Inject(LanhuClientService) private readonly lanhu: LanhuClientService) {}

  private wrap<T>(fn: () => Promise<T>): Promise<T> {
    return fn().catch((error: unknown) => {
      throw new BadGatewayException(toErrorMessage(error));
    });
  }

  async listDesigns(body: unknown) {
    const url = getStringField(body, "url");
    if (!url) {
      throw new BadRequestException("Missing required field: url");
    }

    const client = this.lanhu.createClient(body);
    const result = await this.wrap(() => listDesigns(client, url));
    return { ok: true, ...result };
  }

  async sectors(body: unknown) {
    const projectId = getStringField(body, "projectId") ?? getStringField(body, "project_id");
    if (!projectId) {
      throw new BadRequestException("Missing required field: projectId");
    }

    const client = this.lanhu.createClient(body);
    const data = await this.wrap(() => client.getProjectSectors(projectId));
    return { ok: true, code: "00000", data };
  }

  async detail(body: unknown) {
    const fields = getDesignFields(body);
    if (!fields) {
      throw new BadRequestException("Missing required fields: projectId, imageId");
    }

    const client = this.lanhu.createClient(body);
    const result = await this.wrap(() =>
      fields.teamId
        ? client.getDesignDocument(fields.imageId, fields.teamId, fields.projectId)
        : client.getDocumentInfo(fields.projectId, fields.imageId),
    );
    return { ok: true, code: "00000", result };
  }

  async multiInfo(body: unknown) {
    const projectId = getStringField(body, "projectId") ?? getStringField(body, "project_id");
    if (!projectId) {
      throw new BadRequestException("Missing required field: projectId");
    }

    const teamId = getStringField(body, "teamId") ?? getStringField(body, "team_id");
    const client = this.lanhu.createClient(body);
    const result = await this.wrap(() =>
      client.getProjectMultiInfo(projectId, teamId, {
        img_limit: 500,
        detach: 1,
      }),
    );
    return { ok: true, code: "00000", result };
  }

  async schemaRevise(body: unknown) {
    const versionId = getStringField(body, "versionId") ?? getStringField(body, "version_id");
    if (!versionId) {
      throw new BadRequestException("Missing required field: versionId");
    }

    const client = this.lanhu.createClient(body);
    const data = await this.wrap(() => client.getDdsSchemaRevision(versionId));
    return { ok: true, code: "00000", data };
  }

  async schema(body: unknown) {
    const fields = getDesignFields(body);
    if (!fields) {
      throw new BadRequestException("Missing required fields: projectId, imageId");
    }

    const client = this.lanhu.createClient(body);
    const result = await this.wrap(() =>
      getDesignSchemaJson(client, fields.imageId, fields.teamId, fields.projectId),
    );
    return { ok: true, ...result };
  }

  async sketch(body: unknown) {
    const fields = getDesignFields(body);
    if (!fields) {
      throw new BadRequestException("Missing required fields: projectId, imageId");
    }

    const client = this.lanhu.createClient(body);
    const result = await this.wrap(() =>
      getSketchJson(client, fields.imageId, fields.teamId, fields.projectId),
    );
    return { ok: true, ...result, sketchJson: result.sketch };
  }

  private async loadSketchForDesign(body: unknown) {
    const fields = getDesignFields(body);
    if (!fields) {
      throw new BadRequestException("Missing required fields: projectId, imageId");
    }

    const designName =
      getStringField(body, "designName") ?? getStringField(body, "design_name") ?? "design";
    const designImageUrl =
      getStringField(body, "designImageUrl") ??
      getStringField(body, "design_image_url") ??
      getStringField(body, "url");

    const client = this.lanhu.createClient(body);
    const sketchResult = await this.wrap(() =>
      getSketchJson(client, fields.imageId, fields.teamId, fields.projectId),
    );

    return { fields, designName, designImageUrl, sketchResult };
  }

  async convertSketch(body: unknown) {
    const { designName, designImageUrl, sketchResult } = await this.loadSketchForDesign(body);
    const convert = convertLanhuSketch(sketchResult.sketch, {
      designName,
      designImageUrl: resolveDesignImageUrl(designImageUrl),
    });
    return {
      ok: true,
      sketch: sketchResult.sketch,
      sketchMeta: {
        imageId: sketchResult.imageId,
        versionId: sketchResult.versionId,
        jsonUrl: sketchResult.jsonUrl,
        documentInfo: sketchResult.documentInfo,
      },
      convert,
    };
  }

  async sketchLayerAnnotations(body: unknown) {
    const { designName, designImageUrl, sketchResult } = await this.loadSketchForDesign(body);
    const convert = convertLanhuSketch(sketchResult.sketch, {
      designName,
      designImageUrl: resolveDesignImageUrl(designImageUrl),
    });
    return {
      ok: true,
      designScale: convert.after.designScale,
      layerAnnotations: convert.after.layerAnnotations,
      mappingCount: convert.after.mappingCount,
    };
  }

  async sketchAnnotations(body: unknown) {
    const { sketchResult } = await this.loadSketchForDesign(body);
    const designScale = resolveDesignScale(sketchResult.sketch);
    const sketchAnnotations = extractFullAnnotationsFromSketch(sketchResult.sketch, designScale);
    return {
      ok: true,
      designScale,
      sketchAnnotations,
    };
  }

  async convert(body: unknown) {
    const designName =
      getStringField(body, "designName") ?? getStringField(body, "design_name") ?? "design";

    if (isRecord(body) && body["schema"] && typeof body["schema"] === "object") {
      try {
        const convert = convertLanhuSchema(body["schema"] as UnknownRecord, designName);
        return { ok: true, convert };
      } catch (error) {
        throw new BadGatewayException(toErrorMessage(error));
      }
    }

    const fields = getDesignFields(body);
    if (!fields) {
      throw new BadRequestException("Missing schema or fields: projectId, imageId");
    }

    const client = this.lanhu.createClient(body);
    const schemaResult = await this.wrap(() =>
      getDesignSchemaJson(client, fields.imageId, fields.teamId, fields.projectId),
    );
    const convert = convertLanhuSchema(schemaResult.schema, designName);
    return { ok: true, schema: schemaResult, convert };
  }

  async preview(body: unknown) {
    const url = getStringField(body, "url");
    if (!url) {
      throw new BadRequestException("Missing required field: url");
    }

    const client = this.lanhu.createClient(body);
    const preview = await this.wrap(() => client.fetchBinaryUrl(url));
    return { ok: true, ...preview };
  }

  async slices(body: unknown) {
    const fields = getDesignFields(body);
    if (!fields) {
      throw new BadRequestException("Missing required fields: projectId, imageId");
    }

    const client = this.lanhu.createClient(body);
    const result = await this.wrap(() =>
      getSlices(client, fields.imageId, fields.teamId, fields.projectId),
    );
    return { ok: true, ...result };
  }

  async analyze(body: unknown) {
    const url = getStringField(body, "url");
    if (!url) {
      throw new BadRequestException("Missing required field: url");
    }

    const cookie = resolveRequestCookie(body, getLanhuCookie());
    if (!cookie) {
      throw new ServiceUnavailableException(COOKIE_REQUIRED_MESSAGE);
    }

    const ddsCookie = resolveRequestDdsCookie(body, undefined, cookie);
    const design = getDesignSelector(body);
    const withSlices = getBooleanField(body, "withSlices");
    const concurrency = getNumberField(body, "concurrency");
    const persistArtifacts = resolvePersistArtifacts(body);
    const dataDir = getLanhuDataDir();

    if (isBatchDesignSelector(design)) {
      const result = await this.wrap(() =>
        analyzeDesignBatch({
          url,
          design,
          withSlices,
          cookie,
          ddsCookie,
          concurrency,
          persistArtifacts,
          dataDir,
        }),
      );
      return { ok: true, ...result };
    }

    const result = await this.wrap(() =>
      analyzeDesign({
        url,
        design: typeof design === "string" ? design : undefined,
        withSlices,
        cookie,
        ddsCookie,
        persistArtifacts,
        dataDir,
      }),
    );
    return { ok: true, ...result };
  }
}
