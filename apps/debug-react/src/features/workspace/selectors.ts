import type { RootState } from "@/store";
import { mappingToSliceItems, resolveSliceDownloadUrl } from "@/features/slices-download/slice-download";
import type { SliceItem } from "@/features/slices-download/slice-download";

export function selectSelectedDesign(state: RootState) {
  const { designs, selectedDesignId } = state.session;
  if (!designs.length) return null;
  return designs.find((d) => d.id === selectedDesignId) ?? designs[0] ?? null;
}

export function selectHasCookie(state: RootState) {
  return Boolean(state.settings.cookie.trim()) || state.settings.hasEnvCookie;
}

export function selectDesignFields(state: RootState) {
  const design = selectSelectedDesign(state);
  return {
    projectId: state.session.params?.project_id ?? "",
    teamId: state.session.params?.team_id ?? null,
    imageId: design?.id || state.session.params?.doc_id || "",
  };
}

export function selectSliceDownloadOptions(state: RootState) {
  const design = selectSelectedDesign(state);
  const bData = state.slices.sliceBData as { designName?: string } | null;
  return {
    scale: state.slices.sliceScale,
    format: state.slices.sliceFormat,
    source: state.slices.sliceSource,
    designName: design?.name || bData?.designName || "design",
  };
}

export function selectSliceItems(state: RootState): SliceItem[] {
  if (state.slices.sliceSource === "mapping") {
    const mapping =
      (state.inspect.results.convertMapping as Record<string, string> | undefined) ??
      state.inspect.convertDemo?.after?.mapping;
    return mappingToSliceItems(mapping);
  }
  const b = state.slices.sliceBData as { slices?: SliceItem[] } | null;
  return b?.slices ?? [];
}

export function selectSliceMappingReady(state: RootState) {
  const mapping =
    state.inspect.results.convertMapping ?? state.inspect.convertDemo?.after?.mapping;
  return Boolean(mapping && typeof mapping === "object" && Object.keys(mapping).length);
}

export function previewUrlForSlice(state: RootState, slice: SliceItem) {
  const opts = selectSliceDownloadOptions(state);
  const url = resolveSliceDownloadUrl(slice, opts);
  if (!url) return "—";
  const clean = url.split("?")[0];
  return url.length > 72 ? `${clean.slice(0, 48)}…${url.slice(-16)}` : url;
}
