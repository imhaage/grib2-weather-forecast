export function parseForecastRoute(hash) {
  if (hash.startsWith("#grid/")) {
    return {
      type: "grid",
      variableShortName: decodeURIComponent(hash.slice(6)),
    };
  }

  if (hash.startsWith("#forecast/")) {
    return {
      type: "forecast",
      packageKey: hash.slice(10),
    };
  }

  if (hash.startsWith("#arome/")) {
    return {
      type: "forecast",
      packageKey: hash.slice(7),
    };
  }

  return { type: "home" };
}

export function createForecastPackageHash(packageKey) {
  return `#forecast/${packageKey}`;
}
