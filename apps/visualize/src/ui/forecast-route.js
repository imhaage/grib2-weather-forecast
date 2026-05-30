export function parseForecastRoute(hash) {
  if (!hash) {
    return {
      type: "home",
      tab: "model",
      canonicalHash: createForecastHomeHash(),
    };
  }

  if (hash === "#forecast") {
    return {
      type: "home",
      tab: "model",
    };
  }

  if (hash === "#inspect") {
    return {
      type: "home",
      tab: "upload",
    };
  }

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

  return {
    type: "home",
    tab: "model",
    canonicalHash: createForecastHomeHash(),
  };
}

export function createForecastHomeHash() {
  return "#forecast";
}

export function createInspectHomeHash() {
  return "#inspect";
}

export function createInspectVariableHash(variableShortName) {
  return `#inspect/${encodeURIComponent(variableShortName)}`;
}

export function createForecastPackageHash(packageKey) {
  return `#forecast/${packageKey}`;
}
