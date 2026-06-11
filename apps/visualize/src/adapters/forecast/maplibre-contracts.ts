export interface MapLibreBoundsPort {
  getEast(): number;
  getNorth(): number;
  getSouth(): number;
  getWest(): number;
}

export interface MapLibreSourcePort {
  setData?(data: unknown): void;
}

export interface MapLibreLayerPort {
  addLayer(layer: Record<string, unknown>): void;
  addSource(id: string, source: Record<string, unknown>): void;
  getLayer(id: string): unknown;
  getSource(id: string): MapLibreSourcePort | null | undefined;
  removeLayer(id: string): void;
  removeSource(id: string): void;
}

export interface MapLibreSymbolPort extends MapLibreLayerPort {
  addImage?(
    id: string,
    image: {
      width: number;
      height: number;
      data: Uint8ClampedArray;
    },
  ): void;
  hasImage?(id: string): boolean;
}

export interface MapLibreMapPort extends MapLibreSymbolPort {
  addControl(control: unknown): void;
  fitBounds(bounds: unknown, options?: unknown): void;
  getBounds?(): MapLibreBoundsPort;
  getZoom?(): number;
  once(event: "load", callback: () => void): void;
  on(event: "moveend" | "zoomend", callback: () => void): void;
  resize(): void;
  triggerRepaint(): void;
}
