import type { AppDispatch } from "@/store";
import {
  prependDesign,
  setDesignDetail,
  setParams,
  setSchemaJson,
  setSchemaRevise,
  setSketchJson,
  setVersionId,
} from "@/store/sessionSlice";
import {
  applyConvertResult,
  mergeResults,
  setAnalyzeResult,
  setResult,
} from "@/store/inspectSlice";
import { onAnalyzeSlices } from "@/store/slicesSlice";
import { mapServerParams } from "../mappers";
import { formatLayerAnnotationsText } from "../resultFormat";
import type { ConvertDemo } from "@/api/types";

export function normalizeSketchConvert(convert: ConvertDemo): ConvertDemo {
  const htmlFull = convert.after.htmlFull ?? "";
  const bodyMatch = htmlFull.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const htmlBody = bodyMatch ? bodyMatch[1]!.trim() : htmlFull;
  return {
    ok: true,
    source: "sketch",
    before: null,
    after: {
      css: "",
      cssPreview: "（Sketch fallback · 无 Schema CSS 规则）",
      cssRuleCount: 0,
      htmlBody,
      htmlBodyPreview: htmlBody.slice(0, 2500),
      htmlPreviewDoc: htmlFull,
      htmlFull,
      htmlLength: convert.after.htmlLength ?? htmlFull.length,
      mapping: convert.after.mapping ?? {},
      mappingCount: convert.after.mappingCount ?? Object.keys(convert.after.mapping ?? {}).length,
      layerAnnotations: convert.after.layerAnnotations ?? [],
      designScale: convert.after.designScale,
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyAnalyzeResult(dispatch: AppDispatch, data: any) {
  dispatch(setAnalyzeResult(data));

  if (data.params) {
    const parsed = mapServerParams(data.params);
    dispatch(setParams(parsed));
    dispatch(setResult({ key: "params", data: parsed }));
  }

  if (data.design) {
    const item = {
      index: data.design.index ?? 1,
      id: data.design.id,
      name: data.design.name,
      width: data.design.width,
      height: data.design.height,
      url: data.design.url,
    };
    dispatch(prependDesign(item));
    dispatch(setResult({ key: "designs", data: { total: 0, designs: [] } }));
  }

  if (data.schema) {
    dispatch(setSchemaJson(data.schema));
    dispatch(setResult({ key: "schema", data: data.schema }));
    if (data.schemaMeta) {
      dispatch(setVersionId(data.schemaMeta.versionId));
      dispatch(
        setSchemaRevise({
          code: "00000",
          data: {
            data_resource_url: data.schemaMeta.schemaUrl,
            version_id: data.schemaMeta.versionId,
          },
        }),
      );
    }
  }

  if (data.sketch) {
    dispatch(setSketchJson(data.sketch));
    dispatch(setResult({ key: "sketch", data: data.sketch }));
  }

  if (data.sketchMeta?.documentInfo) {
    const detail = { code: "00000", result: data.sketchMeta.documentInfo };
    dispatch(setDesignDetail(detail));
    dispatch(setResult({ key: "designDetail", data: detail }));
  }

  if (data.convert) {
    const normalized =
      data.convertSource === "sketch" ? normalizeSketchConvert(data.convert) : data.convert;
    dispatch(applyConvertResult(normalized));
  }

  const layerAnnotationsRaw =
    data.layerAnnotations ??
    (data.convertSource === "sketch" ? data.convert?.after?.layerAnnotations : undefined);
  const sketchHtml =
    data.convertSource === "sketch" ? (data.convert?.after?.htmlFull as string | undefined) : undefined;

  dispatch(
    mergeResults({
      analyze: {
        status: data.status,
        convertSource: data.convertSource,
        projectName: data.projectName,
        design: data.design,
        totalWarnings: data.warnings?.length ?? 0,
        artifacts: data.artifacts ?? null,
        previewImage: data.previewImage
          ? { path: data.previewImage.path, contentType: data.previewImage.contentType }
          : null,
      },
      warnings: data.warnings ?? [],
      designTokens: data.designTokens ?? null,
      layoutSummary: data.layoutSummary ?? null,
      layerTree: data.layerTree ?? null,
      sketchAnnotations: data.sketchAnnotations ?? null,
      layerAnnotations: layerAnnotationsRaw
        ? formatLayerAnnotationsText(layerAnnotationsRaw)
        : null,
      sketchHtml: sketchHtml ?? null,
    }),
  );

  if (data.slices) {
    dispatch(onAnalyzeSlices(data.slices));
  }
}
