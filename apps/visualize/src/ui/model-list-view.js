function groupPackagesByModel(packages) {
  const groups = {};
  for (const [key, pkg] of Object.entries(packages)) {
    if (!groups[pkg.model]) groups[pkg.model] = [];
    groups[pkg.model].push({ key, pkg });
  }
  return groups;
}

function createModelMetaElement(info) {
  const meta = document.createElement("div");
  meta.className = "model-meta";
  for (const [label, value, wide] of [
    ["Resolution", info.resolution],
    ["Forecast horizon", info.horizon],
    ["Files", info.filesInfo],
    ["Coverage", `${info.domain} — ${info.domainDesc}`, true],
  ]) {
    const item = document.createElement("div");
    item.className = wide ? "meta-item meta-item-full" : "meta-item";
    const lbl = document.createElement("span");
    lbl.className = "meta-label";
    lbl.textContent = label;
    const val = document.createElement("span");
    val.className = "meta-value";
    val.textContent = value;
    item.appendChild(lbl);
    item.appendChild(val);
    meta.appendChild(item);
  }
  return meta;
}

function createModelPackageElement(key, pkg, onPackageSelect) {
  const pkgEl = document.createElement("div");
  pkgEl.className = "model-package";

  const btn = document.createElement("button");
  btn.className = "btn-primary";
  btn.textContent = key.split("_").pop();
  btn.addEventListener("click", () => {
    onPackageSelect(key);
  });
  pkgEl.appendChild(btn);

  const vars = document.createElement("ul");
  vars.className = "model-package-vars";
  for (const v of pkg.variables) {
    const li = document.createElement("li");
    li.textContent = v.name;
    vars.appendChild(li);
  }
  pkgEl.appendChild(vars);

  return pkgEl;
}

function createModelSectionElement(modelName, entries, modelInfo, onPackageSelect) {
  const info = modelInfo[modelName];

  const section = document.createElement("div");
  section.className = "model-section";

  const title = document.createElement("h2");
  title.className = "model-section-title";
  title.textContent = modelName;
  section.appendChild(title);

  const desc = document.createElement("p");
  desc.className = "model-section-desc";
  desc.textContent = info.description;
  section.appendChild(desc);

  section.appendChild(createModelMetaElement(info));

  const pkgsLabel = document.createElement("p");
  pkgsLabel.className = "model-packages-label";
  pkgsLabel.textContent = "Last available run";
  section.appendChild(pkgsLabel);

  const pkgsEl = document.createElement("div");
  pkgsEl.className = "model-packages";
  for (const { key, pkg } of entries) {
    pkgsEl.appendChild(createModelPackageElement(key, pkg, onPackageSelect));
  }
  section.appendChild(pkgsEl);

  return section;
}

export function renderModelList({ container, packages, modelInfo, onPackageSelect }) {
  const groups = groupPackagesByModel(packages);
  for (const [modelName, entries] of Object.entries(groups)) {
    container.appendChild(
      createModelSectionElement(modelName, entries, modelInfo, onPackageSelect),
    );
  }
}
