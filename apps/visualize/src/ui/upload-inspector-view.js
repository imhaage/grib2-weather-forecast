function renderCardRow(key, value) {
  return `
    <div class="card-row">
<span class="key">${key}</span>
<span class="val">${value}</span>
    </div>`;
}

export function renderUploadedMessageCard(
  message,
  { code, formatGrid, formatLevel, formatValidTime, generatingProcess },
) {
  const { index, header, product, grid } = message;
  return `
    <div class="card surface">
<div class="card-header">
  <span class="badge">${product.shortName}</span>
  <div><div class="card-title">${product.name}</div></div>
</div>
<div class="card-rows">
  ${renderCardRow("Unit", product.units)}
  ${renderCardRow("Level", formatLevel(product))}
  ${renderCardRow("Forecast time (UTC)", formatValidTime(header, product))}
  ${renderCardRow("Process", code(generatingProcess, product.typeOfGeneratingProcess))}
  <hr class="card-divider">
  ${renderCardRow("Grid", formatGrid(grid))}
  ${renderCardRow("Resolution", `${grid.di}° × ${grid.dj}°`)}
  ${renderCardRow("Message #", index)}
</div>
<button class="btn-grid" data-var="${product.shortName}">Show on map</button>
    </div>`;
}
