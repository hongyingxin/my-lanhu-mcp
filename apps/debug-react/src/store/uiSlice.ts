import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type ConsoleStage = "connect" | "design" | "pipeline" | "convert" | "results" | "slices";

export type WorkspaceMode = "design" | "prototype";

export type ResultTabGroup = "analyze" | "convert" | "raw" | "meta";

export type PrototypeResultTabGroup = "output" | "meta";

export interface UiState {
  toast: string;
  workspaceMode: WorkspaceMode;
  consoleStage: ConsoleStage;
  resultGroup: ResultTabGroup;
  activeTab: string;
  prototypeResultGroup: PrototypeResultTabGroup;
  prototypeActiveTab: string;
  loading: Record<string, boolean>;
}

const initialState: UiState = {
  toast: "",
  workspaceMode: "design",
  consoleStage: "connect",
  resultGroup: "analyze",
  activeTab: "analyze",
  prototypeResultGroup: "meta",
  prototypeActiveTab: "prototypeList",
  loading: {},
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    setToast(state, action: PayloadAction<string>) {
      state.toast = action.payload;
    },
    setWorkspaceMode(state, action: PayloadAction<WorkspaceMode>) {
      state.workspaceMode = action.payload;
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
    setPrototypeResultGroup(state, action: PayloadAction<PrototypeResultTabGroup>) {
      state.prototypeResultGroup = action.payload;
    },
    setPrototypeActiveTab(state, action: PayloadAction<string>) {
      state.prototypeActiveTab = action.payload;
    },
    setLoading(state, action: PayloadAction<{ id: string; value: boolean }>) {
      state.loading[action.payload.id] = action.payload.value;
    },
  },
});

export const {
  setToast,
  setWorkspaceMode,
  setConsoleStage,
  setResultGroup,
  setActiveTab,
  setPrototypeResultGroup,
  setPrototypeActiveTab,
  setLoading,
} = uiSlice.actions;
export default uiSlice.reducer;
