"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

// Subscribe function that does nothing (we don't need to listen for changes)
const subscribe = () => () => {};

// Get snapshot function that checks if we're on the client
const getSnapshot = () => true;

// Server snapshot always returns false
const getServerSnapshot = () => false;

export function Portal({ children }: { children: ReactNode }) {
  // Use useSyncExternalStore to safely check if we're on the client
  const isClient = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (!isClient) return null;
  return createPortal(children, document.body);
}

