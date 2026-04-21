"use client";

import { createContext, useContext } from "react";
import type { Socket } from "socket.io-client";

const LayoutSocketContext = createContext<Socket | null>(null);

export const LayoutSocketProvider = LayoutSocketContext.Provider;

export function useLayoutSocket(): Socket | null {
  return useContext(LayoutSocketContext);
}
