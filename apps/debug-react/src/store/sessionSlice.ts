import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { LanhuParams } from "@/api/parse-url";
import type { DesignItem } from "@/api/types";

export interface SessionState {
  params: LanhuParams | null;
  designs: DesignItem[];
  selectedDesignId: string | null;
  sectors: unknown;
  versionId: string | null;
  schemaRevise: unknown;
  schemaJson: unknown;
  designDetail: unknown;
  sketchJson: unknown;
  previewObjectUrl: string;
}

const initialState: SessionState = {
  params: null,
  designs: [],
  selectedDesignId: null,
  sectors: null,
  versionId: null,
  schemaRevise: null,
  schemaJson: null,
  designDetail: null,
  sketchJson: null,
  previewObjectUrl: "",
};

const sessionSlice = createSlice({
  name: "session",
  initialState,
  reducers: {
    setParams(state, action: PayloadAction<LanhuParams | null>) {
      state.params = action.payload;
    },
    setDesigns(state, action: PayloadAction<DesignItem[]>) {
      state.designs = action.payload;
    },
    setSelectedDesignId(state, action: PayloadAction<string | null>) {
      state.selectedDesignId = action.payload;
    },
    setSectors(state, action: PayloadAction<unknown>) {
      state.sectors = action.payload;
    },
    setVersionId(state, action: PayloadAction<string | null>) {
      state.versionId = action.payload;
    },
    setSchemaRevise(state, action: PayloadAction<unknown>) {
      state.schemaRevise = action.payload;
    },
    setSchemaJson(state, action: PayloadAction<unknown>) {
      state.schemaJson = action.payload;
    },
    setDesignDetail(state, action: PayloadAction<unknown>) {
      state.designDetail = action.payload;
    },
    setSketchJson(state, action: PayloadAction<unknown>) {
      state.sketchJson = action.payload;
    },
    setPreviewObjectUrl(state, action: PayloadAction<string>) {
      if (state.previewObjectUrl) {
        URL.revokeObjectURL(state.previewObjectUrl);
      }
      state.previewObjectUrl = action.payload;
    },
    prependDesign(state, action: PayloadAction<DesignItem>) {
      const others = state.designs.filter((d) => d.id !== action.payload.id);
      state.designs = [action.payload, ...others];
      state.selectedDesignId = action.payload.id;
    },
    resetDesignArtifacts(state) {
      state.versionId = null;
      state.schemaRevise = null;
      state.schemaJson = null;
      state.designDetail = null;
      state.sketchJson = null;
      if (state.previewObjectUrl) {
        URL.revokeObjectURL(state.previewObjectUrl);
        state.previewObjectUrl = "";
      }
    },
    /** 蓝湖 URL 变更：清空列表与参数，避免选稿/分析仍用上一稿数据 */
    resetLanhuContext(state) {
      state.params = null;
      state.designs = [];
      state.selectedDesignId = null;
      state.sectors = null;
      state.versionId = null;
      state.schemaRevise = null;
      state.schemaJson = null;
      state.designDetail = null;
      state.sketchJson = null;
      if (state.previewObjectUrl) {
        URL.revokeObjectURL(state.previewObjectUrl);
        state.previewObjectUrl = "";
      }
    },
    applyMockSession(
      state,
      action: PayloadAction<{
        params: LanhuParams;
        sectors: unknown;
        designs: DesignItem[];
        selectedDesignId: string | null;
        versionId: string | null;
        schemaRevise: unknown;
        schemaJson: unknown;
        designDetail: unknown;
        sketchJson: unknown;
        previewObjectUrl: string;
      }>,
    ) {
      const p = action.payload;
      state.params = p.params;
      state.sectors = p.sectors;
      state.designs = p.designs;
      state.selectedDesignId = p.selectedDesignId;
      state.versionId = p.versionId;
      state.schemaRevise = p.schemaRevise;
      state.schemaJson = p.schemaJson;
      state.designDetail = p.designDetail;
      state.sketchJson = p.sketchJson;
      if (state.previewObjectUrl) URL.revokeObjectURL(state.previewObjectUrl);
      state.previewObjectUrl = p.previewObjectUrl;
    },
  },
});

export const {
  setParams,
  setDesigns,
  setSelectedDesignId,
  setSectors,
  setVersionId,
  setSchemaRevise,
  setSchemaJson,
  setDesignDetail,
  setSketchJson,
  setPreviewObjectUrl,
  prependDesign,
  resetDesignArtifacts,
  resetLanhuContext,
  applyMockSession,
} = sessionSlice.actions;

export default sessionSlice.reducer;
