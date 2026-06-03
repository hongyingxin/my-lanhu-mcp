import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export const STORAGE_KEY = "lanhu-debug-react-config";

export interface SettingsState {
  cookie: string;
  lanhuUrl: string;
  useMock: boolean;
  analyzeWithSlices: boolean;
  hasEnvCookie: boolean;
}

const initialState: SettingsState = {
  cookie: "",
  lanhuUrl: "",
  useMock: false,
  analyzeWithSlices: false,
  hasEnvCookie: false,
};

const settingsSlice = createSlice({
  name: "settings",
  initialState,
  reducers: {
    setCookie(state, action: PayloadAction<string>) {
      state.cookie = action.payload;
    },
    setLanhuUrl(state, action: PayloadAction<string>) {
      state.lanhuUrl = action.payload;
    },
    setUseMock(state, action: PayloadAction<boolean>) {
      state.useMock = action.payload;
    },
    setAnalyzeWithSlices(state, action: PayloadAction<boolean>) {
      state.analyzeWithSlices = action.payload;
    },
    setHasEnvCookie(state, action: PayloadAction<boolean>) {
      state.hasEnvCookie = action.payload;
    },
    loadFromStorage(state) {
      try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as Partial<
          SettingsState & { url?: string }
        >;
        if (saved.cookie) state.cookie = saved.cookie;
        const url = saved.lanhuUrl ?? saved.url;
        if (url) state.lanhuUrl = url;
        if (saved.useMock) state.useMock = true;
        if (saved.analyzeWithSlices) state.analyzeWithSlices = true;
      } catch {
        // ignore
      }
    },
    persistToStorage(state) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          cookie: state.cookie.trim(),
          url: state.lanhuUrl.trim(),
          lanhuUrl: state.lanhuUrl.trim(),
          useMock: state.useMock,
          analyzeWithSlices: state.analyzeWithSlices,
        }),
      );
    },
  },
});

export const {
  setCookie,
  setLanhuUrl,
  setUseMock,
  setAnalyzeWithSlices,
  setHasEnvCookie,
  loadFromStorage,
  persistToStorage,
} = settingsSlice.actions;

export default settingsSlice.reducer;
