function groupPackagesByModel(packages) {
  const groups = {};

  for (const [key, pkg] of Object.entries(packages)) {
    if (!groups[pkg.model]) {
      groups[pkg.model] = [];
    }

    groups[pkg.model].push({ key, pkg });
  }

  return groups;
}

function createModelMetaElement(info) {
  const meta = document.createElement("div");
  meta.className = "model-meta";

  for (const [id, label, value] of [
    ["resolution", "Resolution", info.resolution],
    ["forecast-horizon", "Forecast horizon", info.horizon],
    ["files", "Files", info.filesInfo],
    ["bounding-box", "Bounding box", info.boundingBox],
    ["coverage", "Coverage", info.coverage],
  ]) {
    const item = document.createElement("div");
    item.className = `meta-item meta-item-${id}`;
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

const HOME_GROUP_ORDER = ["Weather maps", "Component fields"];

function homeVariableGroupsForPackage(pkg) {
  if (pkg.homeVariableGroups) {
    return pkg.homeVariableGroups;
  }

  const byGroup = new Map();

  for (const variable of pkg.variables) {
    const group = variable.group ?? "Component fields";

    if (!byGroup.has(group)) {
      byGroup.set(group, []);
    }

    byGroup.get(group).push(variable.name);
  }

  return HOME_GROUP_ORDER.filter((group) => byGroup.has(group)).map((group) => ({
    group,
    names: byGroup.get(group),
  }));
}

function createVariableGroupElement(group) {
  const groupEl = document.createElement("li");
  groupEl.className = "model-package-var-group";

  const title = document.createElement("span");
  title.className = "model-package-var-group-title";
  title.textContent = group.group;
  groupEl.appendChild(title);

  const vars = document.createElement("ul");
  vars.className = "model-package-var-list";

  for (const name of group.names) {
    const li = document.createElement("li");
    li.textContent = name;
    vars.appendChild(li);
  }

  groupEl.appendChild(vars);

  return groupEl;
}

function createModelPackageElement(key, pkg) {
  const pkgEl = document.createElement("div");
  pkgEl.className = "model-package";

  const packageName = key.split("_").pop();
  const title = document.createElement("span");
  title.className = "meta-label model-package-label";
  title.textContent = packageName;
  pkgEl.appendChild(title);

  const vars = document.createElement("ul");
  vars.className = "model-package-vars";

  for (const group of homeVariableGroupsForPackage(pkg)) {
    vars.appendChild(createVariableGroupElement(group));
  }

  pkgEl.appendChild(vars);

  const btn = document.createElement("button");
  btn.className = "btn-primary";
  btn.dataset.action = "show-package";
  btn.dataset.packageKey = key;
  btn.textContent = "Show on map";

  pkgEl.appendChild(btn);

  return pkgEl;
}

function createModelSectionElement(modelName, entries, modelInfo) {
  const info = modelInfo[modelName];

  const section = document.createElement("section");
  section.className = "model-section";

  const header = document.createElement("div");
  header.className = "model-section-header";

  const title = document.createElement("h2");
  title.className = "model-section-title";
  title.textContent = info.title;
  header.appendChild(title);

  const desc = document.createElement("p");
  desc.className = "model-section-desc";
  desc.textContent = info.description;
  header.appendChild(desc);

  section.appendChild(header);

  const data = document.createElement("div");
  data.className = "model-section-data";

  data.appendChild(createModelMetaElement(info));

  const pkgsLabel = document.createElement("p");
  pkgsLabel.className = "model-packages-label";
  pkgsLabel.textContent = "Packages (last available run)";
  data.appendChild(pkgsLabel);

  const pkgsEl = document.createElement("div");
  pkgsEl.className = "model-packages";

  for (const { key, pkg } of entries) {
    pkgsEl.appendChild(createModelPackageElement(key, pkg));
  }

  data.appendChild(pkgsEl);

  section.appendChild(data);

  return section;
}

export function renderModelList({ container, packages, modelInfo }) {
  const groups = groupPackagesByModel(packages);

  for (const [modelName, entries] of Object.entries(groups)) {
    container.appendChild(createModelSectionElement(modelName, entries, modelInfo));
  }
}
