import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

import { get } from "@/api/client";
import type { RootState } from "@/store";
import { setHasEnvCookie } from "@/store/settingsSlice";

export type HealthPayload = {
  ok?: boolean;
  hasEnvCookie?: boolean;
  message?: string;
};

/** 单次 /api/health：更新 health 数据 + 顶栏 hasEnvCookie */
export const fetchHealth = createAsyncThunk<
  HealthPayload,
  boolean | undefined,
  { state: RootState }
>(
  "health/fetch",
  async (_, { dispatch }) => {
    try {
      const data = await get<HealthPayload>("/api/health");
      dispatch(setHasEnvCookie(Boolean(data.hasEnvCookie)));
      return data;
    } catch {
      dispatch(setHasEnvCookie(false));
      throw new Error("health 请求失败");
    }
  },
  {
    condition: (force, { getState }) => {
      if (force) return true;
      const { status } = getState().health;
      if (status === "loading" || status === "succeeded") return false;
      return true;
    },
  },
);

type HealthState = {
  data: HealthPayload | null;
  status: "idle" | "loading" | "succeeded" | "failed";
  error: string | null;
};

const initialState: HealthState = {
  data: null,
  status: "idle",
  error: null,
};

const healthSlice = createSlice({
  name: "health",
  initialState,
  reducers: {
    resetHealth: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchHealth.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchHealth.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.data = action.payload;
      })
      .addCase(fetchHealth.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error.message ?? "请求失败";
      });
  },
});

export const { resetHealth } = healthSlice.actions;
export default healthSlice.reducer;
