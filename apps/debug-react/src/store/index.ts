import { configureStore } from "@reduxjs/toolkit";

import healthReducer from "./healthSlice";
import inspectReducer from "./inspectSlice";
import logsReducer from "./logsSlice";
import sessionReducer from "./sessionSlice";
import settingsReducer from "./settingsSlice";
import slicesReducer from "./slicesSlice";
import uiReducer from "./uiSlice";

export const store = configureStore({
  reducer: {
    health: healthReducer,
    settings: settingsReducer,
    session: sessionReducer,
    inspect: inspectReducer,
    slices: slicesReducer,
    logs: logsReducer,
    ui: uiReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
