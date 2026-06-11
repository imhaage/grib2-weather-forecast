export type NumericFieldValues = Float32Array | Float64Array;
export type UnitTransformKey = "t" | "wspd" | "p" | "msl" | "tcc" | null;

export interface StaticScale {
  min: number;
  max: number;
  log?: boolean;
  zeroThreshold?: number;
}

export interface GridDefinition {
  ni: number;
  nj: number;
  di?: number;
  dj: number;
  latitudeOfFirstPoint: number;
  longitudeOfFirstPoint: number;
  latitudeOfLastPoint: number;
  longitudeOfLastPoint: number;
}

export interface ProductDefinition {
  shortName: string;
  name?: string;
  units?: string;
  level?: string;
  levelValue?: number;
  forecastTime?: number;
  timeUnit?: number;
  pdtNumber?: number;
}

export interface MessageHeader {
  centre?: number;
  refTime?: string | Date;
}

export interface DecodedField {
  values: NumericFieldValues;
  grid: GridDefinition;
  product: ProductDefinition;
  header: MessageHeader;
}
