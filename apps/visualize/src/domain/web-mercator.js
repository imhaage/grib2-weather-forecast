import { lngLatToWorld, worldToLngLat } from "@math.gl/web-mercator";

export function webMercatorX(longitude) {
  return lngLatToWorld([longitude, 0])[0];
}

export function webMercatorY(latitude) {
  return lngLatToWorld([0, latitude])[1];
}

export function latitudeFromWebMercatorY(y) {
  return worldToLngLat([0, y])[1];
}

export function mercatorCanvasHeight(grid) {
  const spanY = Math.abs(
    webMercatorY(grid.latitudeOfFirstPoint) - webMercatorY(grid.latitudeOfLastPoint),
  );
  const spanX = Math.abs(
    webMercatorX(grid.longitudeOfLastPoint) - webMercatorX(grid.longitudeOfFirstPoint),
  );
  return Math.round((grid.ni * spanY) / spanX);
}
