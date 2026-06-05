import { generateIsobars, supportsIsobars } from "../domain/isobars.js";

export function createForecastIsobarOverlayService({
  generateIsobars: buildIsobars = generateIsobars,
  missingValue,
  renderer,
  supportsIsobars: canShowIsobars = supportsIsobars,
}) {
  function update(entry, values) {
    if (!canShowIsobars(entry.product.shortName)) {
      renderer.clearIsobars();
      return;
    }
    if (entry.isobars) {
      renderer.updateIsobars(entry.isobars);
      return;
    }
    if (!values) {
      renderer.clearIsobars();
      return;
    }
    entry.isobars = buildIsobars({
      shortName: entry.product.shortName,
      grid: entry.grid,
      values,
      missingValue,
    });
    renderer.updateIsobars(entry.isobars);
  }

  return {
    update,
  };
}
