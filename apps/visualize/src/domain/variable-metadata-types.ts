import type { StaticScale } from "./field-types";

export interface VariableKeySource {
  shortName: string;
  varKey?: string;
}

export interface VariableMetadata {
  description?: string;
  defaultPalette?: string;
  staticScale?: StaticScale;
}
