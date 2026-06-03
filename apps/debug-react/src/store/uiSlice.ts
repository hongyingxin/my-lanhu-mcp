import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type ConsoleStage = "connect" | "design" | "pipeline" | "convert" | "results" | "slices";

export type ResultTabGroup = "analyze" | "convert" | "raw" | "meta";

export interface UiState {
  toast: string;
  consoleStage: ConsoleStage;
  resultGroup: ResultTabGroup;
  activeTab: string;
  loading: Record<string, boolean>;
}

const initialState: UiState = {
  toast: "",
  consoleStage: "connect",
  resultGroup: "analyze",
  activeTab: "analyze",
  loading: {},
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    setToast(state, action: PayloadAction<string>) {
      state.toast = action.payload;
    },
    setConsoleStage(state, action: PayloadAction<ConsoleStage>) {
      state.consoleStage = action.payload;
    },
    setResultGroup(state, action: PayloadAction<ResultTabGroup>) {
      state.resultGroup = action.payload;
    },
    setActiveTab(state, action: PayloadAction<string>) {
      state.activeTab = action.payload;
    },
    setLoading(state, action: PayloadAction<{ id: string; value: boolean }>) {
      state.loading[action.payload.id] = action.payload.value;
    },
  },
});

export const { setToast, setConsoleStage, setResultGroup, setActiveTab, setLoading } =
  uiSlice.actions;
export default uiSlice.reducer;
