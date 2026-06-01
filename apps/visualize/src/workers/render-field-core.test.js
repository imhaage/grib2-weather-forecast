// @vitest-environment jsdom

import { describe, expect, test } from "vitest";
import { webMercatorY } from "../domain/web-mercator.js";
import { renderFieldToImageData } from "./render-field-core.js";

globalThis.ImageData = class ImageData {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
  }
};

function makeLut() {
  const lut = new Uint8ClampedArray(256 * 3);
  for (let index = 0; index < 256; index++) {
    lut[index * 3] = index;
    lut[index * 3 + 1] = 0;
    lut[index * 3 + 2] = 255 - index;
  }
  return lut;
}

function render(overrides = {}) {
  return renderFieldToImageData({
    values: new Float32Array([0, 1, -9999, 2]),
    unitTransform: null,
    lut: makeLut(),
    missingValue: -9999,
    renderMin: 0,
    range: 2,
    isLog: false,
    logFloor: 0.1,
    logDenom: 1,
    zeroThreshold: 0,
    outW: 2,
    outH: 3,
    ni: 2,
    nj: 2,
    dj: 1,
    isStoN: false,
    northLat: 1,
    southLat: 0,
    northY: webMercatorY(1),
    spanY: webMercatorY(1) - webMercatorY(0),
    ...overrides,
  });
}

describe("render field core", () => {
  test("renders image data and field statistics", () => {
    const result = render();

    expect(result.image.width).toBe(2);
    expect(result.image.height).toBe(3);
    expect(result.dataMin).toBe(0);
    expect(result.dataMax).toBe(2);
    expect(result.dataMean).toBe(0.8);
    expect(result.dataCount).toBe(5);
    expect([...result.image.data.slice(0, 4)]).toEqual([0, 0, 255, 255]);
    expect([...result.image.data.slice(16, 20)]).toEqual([0, 0, 0, 0]);
  });

  test("applies zero threshold and log scale", () => {
    const result = render({
      values: new Float32Array([0.05, 1, 10, 100]),
      isLog: true,
      logFloor: 0.1,
      logDenom: Math.log(100 / 0.1),
      zeroThreshold: 0.1,
    });

    expect(result.dataMin).toBe(1);
    expect(result.dataMax).toBe(100);
    expect(result.dataCount).toBe(4);
  });
});
