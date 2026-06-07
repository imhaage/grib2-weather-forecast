import { extractRunId } from "../../domain/resources.js";

interface DataGouvApiResource {
  filesize?: number;
  format?: string;
  title?: string;
  url: string;
}

interface DataGouvFetchResponse {
  ok: boolean;
  status: number;
  json: () => Promise<{ resources: DataGouvApiResource[] }>;
}

interface DataGouvResourceServiceOptions {
  proxyBaseUrl: string;
  fetchImpl?: (url: string) => Promise<DataGouvFetchResponse>;
}

export function proxyResourceUrl(url: string, proxyBaseUrl: string) {
  const parsed = new URL(url);

  return `${proxyBaseUrl}/${parsed.hostname}${parsed.pathname}${parsed.search}`;
}

export function proxyDataGouvUrl(datasetId: string, proxyBaseUrl: string) {
  return `${proxyBaseUrl}/www.data.gouv.fr/api/1/datasets/${datasetId}/`;
}

export function parseDataGouvResources(resources: DataGouvApiResource[], titlePattern: string) {
  return resources
    .filter((resource) => resource.format === "grib2" && resource.title?.includes(titlePattern))
    .map((resource) => {
      const title = resource.title ?? "";
      const single = title.match(/__(\d+)H__/);
      const range = title.match(/__(\d+)H(\d+)H__/);
      const runId = extractRunId(`${title} ${resource.url}`);

      if (single) {
        return {
          startHour: +single[1],
          endHour: +single[1],
          key: single[0].slice(2, -2),
          runId,
          title,
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
          title,
          url: resource.url,
          filesize: resource.filesize,
        };
      }

      return null;
    })
    .filter((resource) => resource !== null)
    .sort((a, b) => a.startHour - b.startHour);
}

export function createDataGouvResourceService({
  proxyBaseUrl,
  fetchImpl = fetch as unknown as (url: string) => Promise<DataGouvFetchResponse>,
}: DataGouvResourceServiceOptions) {
  return {
    proxyResourceUrl(url: string) {
      return proxyResourceUrl(url, proxyBaseUrl);
    },

    async fetchResources(datasetId: string, titlePattern: string) {
      const response = await fetchImpl(proxyDataGouvUrl(datasetId, proxyBaseUrl));

      if (!response.ok) {
        throw new Error(`API ${response.status}`);
      }

      const data = await response.json();

      return parseDataGouvResources(data.resources, titlePattern);
    },
  };
}
