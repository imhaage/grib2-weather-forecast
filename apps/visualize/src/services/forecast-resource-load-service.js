export function createForecastResourceLoadService({
  fetchPackageResources,
  isRefreshActive,
  setStatus,
}) {
  async function loadPackageResources({ packageKey, downloadKey, loadingStatus }) {
    setStatus(loadingStatus);
    try {
      return await fetchPackageResources(packageKey, downloadKey);
    } catch (error) {
      if (isRefreshActive(downloadKey)) {
        setStatus(`API error: ${error.message}`);
      }
      return null;
    }
  }

  return {
    loadPackageResources,
  };
}
