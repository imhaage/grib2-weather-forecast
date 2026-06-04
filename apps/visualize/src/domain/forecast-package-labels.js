export function getModelPackageLabelParts(packages, modelInfo, packageKey) {
  const pkg = packages[packageKey];
  if (!pkg) return null;
  const modelTitle = modelInfo[pkg.model]?.title ?? pkg.model;
  const packageName = packageKey.replace(`${pkg.model}_`, "");
  return { modelTitle, packageName };
}

export function formatModelPackageSubtitle(packages, modelInfo, packageKey) {
  const parts = getModelPackageLabelParts(packages, modelInfo, packageKey);
  if (!parts) return packageKey;
  return `${parts.modelTitle} ${parts.packageName}`;
}

export function formatForecastValidTimeLabel(packages, modelInfo, packageKey, timeLabel) {
  if (!packageKey) return timeLabel;
  const parts = getModelPackageLabelParts(packages, modelInfo, packageKey);
  if (!parts) return `${packageKey} : ${timeLabel}`;
  return `${parts.modelTitle} - ${parts.packageName} : ${timeLabel}`;
}
