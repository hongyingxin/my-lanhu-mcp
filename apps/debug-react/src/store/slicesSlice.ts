import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface SlicesState {
  sliceBData: unknown;
  sliceSource: "scaleUrls" | "mapping";
  sliceScale: string;
  sliceFormat: string;
  sliceDownloadProgress: { done: number; total: number; current: string } | null;
  slicePanelView: "list" | "json";
}

const initialState: SlicesState = {
  sliceBData: null,
  sliceSource: "scaleUrls",
  sliceScale: "1x",
  sliceFormat: "png",
  sliceDownloadProgress: null,
  slicePanelView: "list",
};

const slicesSlice = createSlice({
  name: "slices",
  initialState,
  reducers: {
    setSliceBData(state, action: PayloadAction<unknown>) {
      state.sliceBData = action.payload;
    },
    setSliceSource(state, action: PayloadAction<"scaleUrls" | "mapping">) {
      state.sliceSource = action.payload;
    },
    setSliceScale(state, action: PayloadAction<string>) {
      state.sliceScale = action.payload;
    },
    setSliceFormat(state, action: PayloadAction<string>) {
      state.sliceFormat = action.payload;
    },
    setSliceDownloadProgress(
      state,
      action: PayloadAction<{ done: number; total: number; current: string } | null>,
    ) {
      state.sliceDownloadProgress = action.payload;
    },
    setSlicePanelView(state, action: PayloadAction<"list" | "json">) {
      state.slicePanelView = action.payload;
    },
    resetSliceState(state) {
      state.sliceBData = null;
      state.slicePanelView = "list";
      state.sliceDownloadProgress = null;
    },
    onAnalyzeSlices(state, action: PayloadAction<{ slices?: unknown[] }>) {
      state.sliceBData = action.payload;
      if (action.payload.slices?.length) {
        state.sliceSource = "scaleUrls";
        state.slicePanelView = "list";
      }
    },
  },
});

export const {
  setSliceBData,
  setSliceSource,
  setSliceScale,
  setSliceFormat,
  setSliceDownloadProgress,
  setSlicePanelView,
  resetSliceState,
  onAnalyzeSlices,
} = slicesSlice.actions;

export default slicesSlice.reducer;
