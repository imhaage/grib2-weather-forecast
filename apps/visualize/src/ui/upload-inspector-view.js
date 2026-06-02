function createElement(document, tagName, { className, textContent } = {}) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (textContent != null) element.textContent = textContent;
  return element;
}

function createCardRow(document, key, value) {
  const row = createElement(document, "div", { className: "card-row" });
  row.append(
    createElement(document, "span", { className: "key", textContent: key }),
    createElement(document, "span", { className: "val", textContent: String(value) }),
  );
  return row;
}

export function renderUploadedMessageCard(
  document,
  message,
  { code, formatGrid, formatLevel, formatValidTime, generatingProcess },
) {
  const { index, header, product, grid } = message;
  const card = createElement(document, "div", { className: "card surface" });
  const headerEl = createElement(document, "div", { className: "card-header" });
  const titleWrapper = createElement(document, "div");
  const rows = createElement(document, "div", { className: "card-rows" });
  const button = createElement(document, "button", {
    className: "btn-grid",
    textContent: "Show on map",
  });

  titleWrapper.append(
    createElement(document, "div", { className: "card-title", textContent: product.name }),
  );
  headerEl.append(
    createElement(document, "span", { className: "badge", textContent: product.shortName }),
    titleWrapper,
  );
  rows.append(
    createCardRow(document, "Unit", product.units),
    createCardRow(document, "Level", formatLevel(product)),
    createCardRow(document, "Forecast time (UTC)", formatValidTime(header, product)),
    createCardRow(document, "Process", code(generatingProcess, product.typeOfGeneratingProcess)),
    createElement(document, "hr", { className: "card-divider" }),
    createCardRow(document, "Grid", formatGrid(grid)),
    createCardRow(document, "Resolution", `${grid.di}° × ${grid.dj}°`),
    createCardRow(document, "Message #", index),
  );
  button.dataset.var = product.shortName;
  button.dataset.messageIndex = String(index);
  card.append(headerEl, rows, button);
  return card;
}
