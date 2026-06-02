import { variableKeyFor } from "../domain/variable-metadata.js";

const VARIABLE_GROUP_ORDER = ["Weather maps", "Component fields"];

function createVariableOption(document, varDef) {
  const option = document.createElement("option");
  option.value = variableKeyFor(varDef);
  option.textContent = varDef.name;
  return option;
}

export function appendGroupedVariableOptions(document, select, variables) {
  const groups = new Map();
  for (const varDef of variables) {
    const groupName = varDef.group;
    if (!groupName) {
      select.appendChild(createVariableOption(document, varDef));
      continue;
    }
    if (!groups.has(groupName)) {
      const group = document.createElement("optgroup");
      group.label = groupName;
      groups.set(groupName, group);
    }
    groups.get(groupName).appendChild(createVariableOption(document, varDef));
  }
  for (const groupName of VARIABLE_GROUP_ORDER) {
    const group = groups.get(groupName);
    if (group) select.appendChild(group);
  }
  for (const [groupName, group] of groups) {
    if (!VARIABLE_GROUP_ORDER.includes(groupName)) select.appendChild(group);
  }
}

export function defaultVariableForPackage(pkg) {
  return pkg.variables.find((variable) => variable.group === "Weather maps") ?? pkg.variables[0];
}
