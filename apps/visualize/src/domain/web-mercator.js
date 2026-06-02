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

export function gridCorners({
  latitudeOfFirstPoint: la1,
  longitudeOfFirstPoint: lo1,
  latitudeOfLastPoint: la2,
  longitudeOfLastPoint: lo2,
}) {
  const north = Math.max(la1, la2);
  const south = Math.min(la1, la2);
  const west = Math.min(lo1, lo2);
  const east = Math.max(lo1, lo2);
  return [
    [west, north],
    [east, north],
    [east, south],
    [west, south],
  ];
}

export function renderProjectionForGrid(grid) {
  const northLat = Math.max(grid.latitudeOfFirstPoint, grid.latitudeOfLastPoint);
  const southLat = Math.min(grid.latitudeOfFirstPoint, grid.latitudeOfLastPoint);
  const isStoN = grid.latitudeOfLastPoint > grid.latitudeOfFirstPoint;
  const northY = webMercatorY(northLat);
  const spanY = northY - webMercatorY(southLat);

  return {
    northLat,
    southLat,
    isStoN,
    northY,
    spanY,
  };
}
