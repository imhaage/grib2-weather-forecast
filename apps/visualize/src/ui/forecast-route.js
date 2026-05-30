export function parseForecastRoute(hash) {
  if (hash.startsWith("#inspect/")) {
    return {
      type: "inspect",
      variableShortName: decodeURIComponent(hash.slice(9)),
    };
  }

  if (hash.startsWith("#grid/")) {
    const variableShortName = decodeURIComponent(hash.slice(6));
    return {
      type: "inspect",
      variableShortName,
      canonicalHash: createInspectVariableHash(variableShortName),
    };
  }

  if (hash.startsWith("#forecast/")) {
    return {
      type: "forecast",
      packageKey: hash.slice(10),
    };
  }

  if (hash.startsWith("#arome/")) {
    const packageKey = hash.slice(7);
    return {
      type: "forecast",
      packageKey,
      canonicalHash: createForecastPackageHash(packageKey),
    };
  }

  return { type: "home" };
}

export function createInspectVariableHash(variableShortName) {
  return `#inspect/${encodeURIComponent(variableShortName)}`;
}

export function createForecastPackageHash(packageKey) {
  return `#forecast/${packageKey}`;
}
