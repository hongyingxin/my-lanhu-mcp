import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { RequestLogEntry } from "@/api/types";

const logsSlice = createSlice({
  name: "logs",
  initialState: [] as RequestLogEntry[],
  reducers: {
    prependLog(state, action: PayloadAction<Omit<RequestLogEntry, "id"> & { id?: number }>) {
      state.unshift({
        id: action.payload.id ?? Date.now() + Math.random(),
        ok: action.payload.ok,
        method: action.payload.method,
        url: action.payload.url,
        status: action.payload.status,
        elapsedMs: action.payload.elapsedMs,
        note: action.payload.note,
      });
    },
    clearLogs() {
      return [];
    },
  },
});

export const { prependLog, clearLogs } = logsSlice.actions;
export default logsSlice.reducer;
