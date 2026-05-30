import { createForecastHomeHash, createInspectHomeHash } from "./forecast-route.js";

export function resolveMapBackHash({ hasModelState }) {
  return hasModelState ? createForecastHomeHash() : createInspectHomeHash();
}
