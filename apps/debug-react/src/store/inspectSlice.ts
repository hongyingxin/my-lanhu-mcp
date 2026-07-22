import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { ConvertDemo, InspectResultKey, InspectResults } from "@/api/types";

export interface InspectState {
  results: InspectResults;
  convertDemo: ConvertDemo | null;
  analyzeResult: unknown;
}

const initialState: InspectState = {
  results: {},
  convertDemo: null,
  analyzeResult: null,
};

const inspectSlice = createSlice({
  name: "inspect",
  initialState,
  reducers: {
    setResult(state, action: PayloadAction<{ key: InspectResultKey; data: unknown }>) {
      state.results[action.payload.key] = action.payload.data;
    },
    mergeResults(state, action: PayloadAction<InspectResults>) {
      Object.assign(state.results, action.payload);
    },
    setConvertDemo(state, action: PayloadAction<ConvertDemo | null>) {
      state.convertDemo = action.payload;
    },
    setAnalyzeResult(state, action: PayloadAction<unknown>) {
      state.analyzeResult = action.payload;
    },
    applyConvertResult(state, action: PayloadAction<ConvertDemo>) {
      const data = action.payload;
      state.convertDemo = data;
      state.results.convertCss = data.after.css ?? "";
      state.results.convertHtml = data.after.htmlBody ?? "";
      state.results.convertHtmlFull = data.after.htmlFull;
      state.results.convertMapping = data.after.mapping;
    },
    resetInspectArtifacts(state) {
      state.convertDemo = null;
      state.analyzeResult = null;
      delete state.results.params;
      delete state.results.sectors;
      delete state.results.designs;
      delete state.results.preview;
      delete state.results.multiInfo;
      delete state.results.schemaRevise;
      delete state.results.schema;
      delete state.results.convertCss;
      delete state.results.convertHtml;
      delete state.results.convertHtmlFull;
      delete state.results.convertMapping;
      delete state.results.designDetail;
      delete state.results.sketch;
      delete state.results.analyze;
      delete state.results.warnings;
      delete state.results.designTokens;
      delete state.results.layoutSummary;
      delete state.results.layerTree;
      delete state.results.sketchAnnotations;
      delete state.results.sketchHtml;
      delete state.results.layerAnnotations;
    },
    resetPrototypeInspectArtifacts(state) {
      delete state.results.prototypeParams;
      delete state.results.prototypeList;
      delete state.results.prototypeDocuments;
      delete state.results.prototypeDownload;
      delete state.results.prototypeAnalyze;
      delete state.results.prototypePageText;
      delete state.results.prototypeDesignInfo;
      delete state.results.prototypeScreenshots;
    },
  },
});

export const {
  setResult,
  mergeResults,
  setConvertDemo,
  setAnalyzeResult,
  applyConvertResult,
  resetInspectArtifacts,
  resetPrototypeInspectArtifacts,
} = inspectSlice.actions;

export default inspectSlice.reducer;
