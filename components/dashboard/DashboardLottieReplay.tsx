"use client";

import { createContext } from "react";

/** A card-local replay counter; entering another card never restarts this scene. */
export const DashboardLottieReplay = createContext(0);
