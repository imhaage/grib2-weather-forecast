import { extractRunId } from "../domain/resources.js";

export function proxyResourceUrl(url, proxyBaseUrl) {
  const parsed = new URL(url);
  return `${proxyBaseUrl}/${parsed.hostname}${parsed.pathname}${parsed.search}`;
}

export function proxyDataGouvUrl(datasetId, proxyBaseUrl) {
  return `${proxyBaseUrl}/www.data.gouv.fr/api/1/datasets/${datasetId}/`;
}

export function parseDataGouvResources(resources, titlePattern) {
  return resources
    .filter((resource) => resource.format === "grib2" && resource.title?.includes(titlePattern))
    .map((resource) => {
      const single = resource.title.match(/__(\d+)H__/);
      const range = resource.title.match(/__(\d+)H(\d+)H__/);
      const runId = extractRunId(`${resource.title} ${resource.url}`);
      if (single) {
        return {
          startHour: +single[1],
          endHour: +single[1],
          key: single[0].slice(2, -2),
          runId,
          title: resource.title,
          url: resource.url,
          filesize: resource.filesize,
        };
      }
      if (range) {
        return {
          startHour: +range[1],
          endHour: +range[2],
          key: range[0].slice(2, -2),
          runId,
          title: resource.title,
          url: resource.url,
          filesize: resource.filesize,
        };
      }
      return null;
    })
    .filter(Boolean)
    .sort((a, b) => a.startHour - b.startHour);
}

export function createDataGouvResourceService({ proxyBaseUrl, fetchImpl = fetch }) {
  return {
    proxyResourceUrl(url) {
      return proxyResourceUrl(url, proxyBaseUrl);
    },

    async fetchResources(datasetId, titlePattern) {
      const response = await fetchImpl(proxyDataGouvUrl(datasetId, proxyBaseUrl));
      if (!response.ok) throw new Error(`API ${response.status}`);
      const data = await response.json();
      return parseDataGouvResources(data.resources, titlePattern);
    },
  };
}
