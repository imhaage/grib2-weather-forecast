const PROXY = "https://grib2-cors-proxy.imh.workers.dev";

import {
	CENTRES,
	decodeGRIB2,
	fmtLevel,
	fmtRefTime,
	fmtValidTime,
	GENERATING_PROCESS,
	iterateGRIB2Messages,
	MISSING_VALUE,
} from "grib2-decoder";
import { createAnimationPlayer } from "./animation-player.js";
import { generateIsobars, supportsIsobars } from "./src/domain/isobars.js";
import {
	findPackageVariable,
	MODEL_INFO,
	PACKAGES,
} from "./src/domain/model-packages.js";
import {
	buildLUT,
	gradientStopsFor,
	LOG_SCALE_FLOOR,
	legendTicksFor,
} from "./src/domain/palettes.js";
import {
	extractRunId,
	formatRunSummary,
	runTimeValue,
} from "./src/domain/resources.js";
import {
	displayUnitsFor,
	formatValueForUnits,
	unitFnFor,
	unitTransformFor,
} from "./src/domain/unit-transforms.js";
import {
	defaultPaletteFor,
	parameterDescriptionFor,
	staticScaleFor,
	variableKeyFor,
} from "./src/domain/variable-metadata.js";
import { createAnimationCacheService } from "./src/services/animation-cache-service.js";
import { createForecastBlockRefreshService } from "./src/services/forecast-block-refresh-service.js";
import {
	clearGribCache,
	deleteObsoleteCachedGribBlocks,
	readCachedGribBlock,
	readLatestCachedGribBlock,
	writeCachedGribBlock,
} from "./src/services/grib-cache-service.js";
import { createMapRendererService } from "./src/services/map-renderer-service.js";
import { createModelBlockService } from "./src/services/model-block-service.js";
import {
	BLOCK_STATUS,
	BLOCK_STATUS_CLASSES,
	BLOCK_STATUS_LABELS,
	createDataStatusSummaryNodes,
} from "./src/ui/data-status-summary.js";
import { bindAppEvents } from "./src/ui/app-events.js";
import { createDom } from "./src/ui/dom.js";
import {
	createForecastHomeHash,
	createForecastPackageHash,
	createInspectHomeHash,
	createInspectMessageHash,
	createInspectVariableHash,
} from "./src/ui/forecast-route.js";
import { createAppRouter } from "./src/ui/app-router.js";
import { setMapToolbarMode } from "./src/ui/map-toolbar-controller.js";
import { resolveMapBackHash } from "./src/ui/map-back-action.js";
import { prepareFileInputForPick, setHomeTab } from "./src/ui/home-tabs.js";
import { bindHomeEvents } from "./src/ui/home-events.js";
import { renderModelList } from "./src/ui/model-list-view.js";
import { formatStorageEstimate } from "./src/ui/storage-warning.js";
import { createUploadInspectorController } from "./src/controllers/upload-inspector-controller.js";
import { renderUploadedMessageCard } from "./src/ui/upload-inspector-view.js";
import { bindUploadInspectorEvents } from "./src/ui/upload-inspector-events.js";
import { createDownloadWorker } from "./src/workers/download-worker-client.js";

const VARIABLE_GROUP_ORDER = ["Weather maps", "Component fields"];
const DECODED_CACHE_SIZE = 2;
const RASTER_OPACITY = 0.8;
const domRefs = createDom(document);
const dom = {
	viewsHome: domRefs.views.home,
	viewsMap: domRefs.views.map,
	forecastDownloadBars: domRefs.forecastDownload.bars,
	forecastDownloadFileList: domRefs.forecastDownload.fileList,
	forecastDownloadStatus: domRefs.forecastDownload.status,
	forecastHourLabel: domRefs.forecast.hourLabel,
	forecastSlider: domRefs.forecast.slider,
	forecastValidTime: domRefs.forecast.validTime,
	forecastVarSelect: domRefs.forecast.variableSelect,
	playerPlayButton: domRefs.player.playButton,
	cacheWarmup: domRefs.cacheWarmup.root,
	cacheWarmupBar: domRefs.cacheWarmup.bar,
	cacheWarmupCount: domRefs.cacheWarmup.count,
	cacheWarmupLabel: domRefs.cacheWarmup.label,
	dataStatusPanel: domRefs.dataStatus.panel,
	dataStatusSummary: domRefs.dataStatus.summary,
	mapScene: domRefs.map.scene,
	mapCanvas: domRefs.map.canvas,
	mapTooltip: domRefs.map.tooltip,
	mapUnavailable: domRefs.map.unavailable,
	mapWrap: domRefs.map.wrap,
	mapBackButton: domRefs.map.backButton,
	mapSubtitle: domRefs.mapInfo.subtitle,
	mapName: domRefs.mapInfo.name,
	mapDescription: domRefs.mapInfo.description,
	mapLevel: domRefs.mapInfo.level,
	statMin: domRefs.stats.min,
	statMax: domRefs.stats.max,
	statMean: domRefs.stats.mean,
	statValid: domRefs.stats.valid,
	colorScale: domRefs.colorScale.root,
	colorScaleBar: domRefs.colorScale.bar,
	colorScaleTicks: domRefs.colorScale.ticks,
	paletteOptions: domRefs.palette.options,
	paletteSelect: domRefs.palette.uploadSelect,
	paletteSelectForecast: domRefs.palette.forecastSelect,
	uploadSummary: domRefs.upload.summary,
	uploadName: domRefs.upload.name,
	uploadSize: domRefs.upload.size,
	uploadCount: domRefs.upload.count,
	uploadCentre: domRefs.upload.centre,
	uploadReferenceTime: domRefs.upload.referenceTime,
	uploadResults: domRefs.upload.results,
	uploadCards: domRefs.upload.cards,
	uploadStatus: domRefs.upload.status,
	clearGribCacheButton: domRefs.storage.clearCacheButton,
	storageWarning: domRefs.storage.warning,
	storageWarningButton: domRefs.storage.warningButton,
	storageWarningSize: domRefs.storage.warningSize,
	perfDebugPanel: domRefs.perfDebug.panel,
	perfDebugRender: domRefs.perfDebug.render,
	perfDebugDecode: domRefs.perfDebug.decode,
	perfDebugQueue: domRefs.perfDebug.queue,
	perfDebugCache: domRefs.perfDebug.cache,
	perfDebugDecoded: domRefs.perfDebug.decoded,
	perfDebugGen: domRefs.perfDebug.gen,
};

function setPaletteSelectValues(palette) {
	dom.paletteSelect.value = palette;
	dom.paletteSelectForecast.value = palette;
}

// Populate all palette selects from the shared template
for (const sel of [dom.paletteSelect, dom.paletteSelectForecast]) {
	const paletteTemplate = dom.paletteOptions;
	sel.appendChild(paletteTemplate.content.cloneNode(true));
	sel.value = "Plasma";
}

// ── State ─────────────────────────────────────────────────────────────────────
let gridState = null; // { values, min, range, grid, product }
let currentPalette = "Plasma";
let modelState = null; // { packageKey, resources, buffers, messageIndex, hourList, decoded, decodedOrder, variable, currentHour, lastRunInfo }
let isDecoding = false;
let pendingHourIdx = null;
let renderWorker = null;
let modelBlockService = null;
let downloadWorker = null;
let renderGen = 0;
let nextCallId = 0;
const animationCache = createAnimationCacheService();
let tooltipHydrateTimer = null;
let tooltipHydrateToken = 0;
const MAX_PARALLEL_DOWNLOADS = 6;
const PERF_DEBUG =
	new URLSearchParams(window.location.search).get("debug") === "perf";
const perfStats = {
	lastRenderMs: null,
	lastDecodeMs: null,
};
const mapRenderer = createMapRendererService({
	canvasHeightForGrid: mercatorCanvasHeight,
	getGridState: () => gridState,
	getMapScene: () => dom.mapScene,
	missingValue: MISSING_VALUE,
	rasterOpacity: RASTER_OPACITY,
	tooltipEl: dom.mapTooltip,
	wrapEl: dom.mapWrap,
});
const uploadInspector = createUploadInspectorController({
	centres: CENTRES,
	dom: domRefs.upload,
	formatRefTime: fmtRefTime,
	formatSize: fmtSize,
	iterateMessages: iterateGRIB2Messages,
	renderCard: buildCard,
});
// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPerfMs(value) {
	return value == null ? "—" : `${Math.round(value)} ms`;
}

async function runWithConcurrency(items, limit, worker) {
	const results = new Array(items.length);
	let nextIndex = 0;
	const workerCount = Math.min(limit, items.length);

	async function runNext() {
		const index = nextIndex++;
		if (index >= items.length) return;
		results[index] = await worker(items[index], index);
		await runNext();
	}

	await Promise.all(Array.from({ length: workerCount }, runNext));
	return results;
}

function scheduleLowPriorityWork() {
	if ("requestIdleCallback" in window) {
		return new Promise((resolve) => {
			window.requestIdleCallback(resolve, { timeout: 300 });
		});
	}
	return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function updatePerfDiagnostics() {
	if (!PERF_DEBUG) return;
	const panel = dom.perfDebugPanel;
	if (!panel) return;

	const totalBitmaps = modelState?.hourList.length ?? 0;
	const readyBitmaps = totalBitmaps
		? bitmapCacheReadyCount()
		: animationCache.size;
	const decodedSize = modelState?.decoded?.size ?? 0;

	panel.hidden = false;
	dom.perfDebugRender.textContent = `render ${fmtPerfMs(perfStats.lastRenderMs)}`;
	dom.perfDebugDecode.textContent = `decode ${fmtPerfMs(perfStats.lastDecodeMs)}`;
	dom.perfDebugQueue.textContent =
		`queue ${animationCache.queueLength}${animationCache.isPrerendering ? " + active" : ""}`;
	dom.perfDebugCache.textContent =
		`cache ${readyBitmaps} / ${totalBitmaps || animationCache.size}`;
	dom.perfDebugDecoded.textContent = `decoded ${decodedSize}`;
	dom.perfDebugGen.textContent = `gen ${renderGen}`;
}

function setRendering(on) {
	dom.mapScene.classList.toggle("rendering", on);
	updatePerfDiagnostics();
}

function setMapSceneVisible(visible) {
	mapRenderer.setVisible(visible);
}

function initRenderWorker() {
	if (renderWorker) return;
	renderWorker = new Worker(new URL("./render-worker.js", import.meta.url), {
		type: "module",
	});
}

function initDownloadWorker() {
	if (downloadWorker) return;
	downloadWorker = createDownloadWorker();
}

function downloadFileInWorker(url, filesize, onProgress) {
	initDownloadWorker();
	const callId = ++nextCallId;
	return new Promise((resolve, reject) => {
		function onMsg({ data }) {
			if (data.callId !== callId) return;
			if (data.progress) {
				onProgress(data.loaded, data.total);
				return;
			}
			downloadWorker.removeEventListener("message", onMsg);
			downloadWorker.removeEventListener("error", onErr);
			if (data.error) {
				reject(new Error(data.error));
				return;
			}
			resolve(new Uint8Array(data.buffer));
		}
		function onErr(error) {
			downloadWorker.removeEventListener("message", onMsg);
			downloadWorker.removeEventListener("error", onErr);
			reject(error);
		}
		downloadWorker.addEventListener("message", onMsg);
		downloadWorker.addEventListener("error", onErr);
		downloadWorker.postMessage({ callId, url, filesize });
	});
}

function getModelBlockService() {
	if (!modelBlockService) modelBlockService = createModelBlockService();
	return modelBlockService;
}

async function timedDecodeGRIB2(buffer) {
	const startedAt = PERF_DEBUG ? performance.now() : 0;
	const decoded = await decodeGRIB2(buffer);
	if (PERF_DEBUG) {
		perfStats.lastDecodeMs = performance.now() - startedAt;
		updatePerfDiagnostics();
	}
	return decoded;
}

// Sends raw values to the worker, returns Promise<{bitmap,dataMin,dataMax,mean,count}|null>.
// Returns null if renderGen changed before the worker responds (stale result).
// By default values are copied so the main thread keeps ownership for tooltips.
function renderViaWorker(
	values,
	renderParams,
	outW,
	outH,
	{ transferValues = false } = {},
) {
	initRenderWorker();
	const myGen = renderGen;
	const myCallId = ++nextCallId;
	const startedAt = PERF_DEBUG ? performance.now() : 0;

	const { grid } = renderParams;
	const northLat = Math.max(
		grid.latitudeOfFirstPoint,
		grid.latitudeOfLastPoint,
	);
	const southLat = Math.min(
		grid.latitudeOfFirstPoint,
		grid.latitudeOfLastPoint,
	);
	const isStoN = grid.latitudeOfLastPoint > grid.latitudeOfFirstPoint;
	const myNorth = mercatorY(northLat);
	const mySpan = myNorth - mercatorY(southLat);

	return new Promise((resolve) => {
		function onMsg({ data }) {
			if (data.callId !== myCallId) return;
			renderWorker.removeEventListener("message", onMsg);
			renderWorker.removeEventListener("error", onErr);
			if (data.error) {
				console.error("render-worker error:", data.error);
				resolve(null);
				return;
			}
			if (PERF_DEBUG) {
				perfStats.lastRenderMs = performance.now() - startedAt;
				updatePerfDiagnostics();
			}
			if (renderGen !== myGen) {
				data.bitmap?.close();
				resolve(null);
				return;
			}
			resolve({
				bitmap: data.bitmap,
				dataMin: data.dataMin,
				dataMax: data.dataMax,
				mean: data.dataMean,
				count: data.dataCount,
			});
		}
		function onErr(e) {
			renderWorker.removeEventListener("message", onMsg);
			renderWorker.removeEventListener("error", onErr);
			console.error("render-worker crash:", e);
			resolve(null);
		}
		renderWorker.addEventListener("message", onMsg);
		renderWorker.addEventListener("error", onErr);

		const workerValues = transferValues ? values : values.slice();
		const lut = buildLUT(currentPalette, {
			min: renderParams.renderMin,
			max: renderParams.renderMax,
		});
		renderWorker.postMessage(
			{
				callId: myCallId,
				gen: myGen,
				values: workerValues,
				unitTransform: renderParams.unitTransform,
				lut,
				missingValue: MISSING_VALUE,
				min: renderParams.renderMin,
				range: renderParams.range,
				isLog: renderParams.isLog,
				logFloor: LOG_SCALE_FLOOR,
				logDenom: renderParams.logDenom,
				zeroThreshold: renderParams.zeroThreshold,
				outW,
				outH,
				ni: grid.ni,
				nj: grid.nj,
				dj: grid.dj,
				isStoN,
				northLat,
				southLat,
				myNorth,
				mySpan,
			},
			[workerValues.buffer],
		);
	});
}

function invalidateBitmapCache() {
	if (modelState) modelState.animationCacheStatus = "waiting";
	animationCache.clear();
	tooltipHydrateToken++;
	if (tooltipHydrateTimer !== null) clearTimeout(tooltipHydrateTimer);
	tooltipHydrateTimer = null;
	renderGen++;
	updateWarmupProgress();
	updatePerfDiagnostics();
}

function invalidateBlockRenderCache(block) {
	if (!block) return;
	for (let hour = block.startHour; hour <= block.endHour; hour++) {
		animationCache.removeHour(hour);
		evictDecodedHour(hour);
	}
	updateWarmupProgress();
}

function beginModelResourceRefresh() {
	if (!modelState) return null;
	modelState.resourceRefreshId = (modelState.resourceRefreshId ?? 0) + 1;
	return {
		state: modelState,
		refreshId: modelState.resourceRefreshId,
	};
}

function isModelResourceRefreshActive(downloadKey) {
	return Boolean(
		downloadKey &&
			modelState === downloadKey.state &&
			modelState.resourceRefreshId === downloadKey.refreshId,
	);
}

function bitmapCacheKey(hour) {
	return animationCache.keyForHour(hour);
}

function bitmapCacheReadyCount() {
	if (!modelState) return 0;
	return animationCache.readyCount(modelState.hourList);
}

function isBitmapCacheComplete() {
	return animationCache.isComplete(modelState?.hourList ?? []);
}

function isAnimationCacheReadyForPlayback() {
	return Boolean(
		modelState &&
			modelState.animationCacheStatus === "ready" &&
			isBitmapCacheComplete(),
	);
}

function updateWarmupProgress() {
	const container = dom.cacheWarmup;
	if (!container || !modelState?.hourList.length) {
		if (container) container.hidden = true;
		syncPlayButtonAvailability();
		return;
	}

	const total = modelState.hourList.length;
	const ready = bitmapCacheReadyCount();
	const complete = ready === total;
	if (modelState.animationCacheStatus === "building" && complete) {
		modelState.animationCacheStatus = "ready";
	}
	const isWaiting = modelState.animationCacheStatus === "waiting";
	const isReady = modelState.animationCacheStatus === "ready";
	const pct = total ? Math.round((ready / total) * 100) : 0;

	container.hidden = isReady;
	container.classList.toggle("waiting", isWaiting);
	container.classList.toggle("ready", isReady);
	dom.cacheWarmupBar.style.width = `${pct}%`;
	dom.cacheWarmupCount.textContent = `${ready} / ${total}`;
	dom.cacheWarmupLabel.textContent = isWaiting
		? "Preparing animation cache"
		: isReady
			? "Animation ready"
			: "Animation cache";
	syncPlayButtonAvailability();
	updatePerfDiagnostics();
}

function makeBitmapCacheEntry(renderEntry, renderParams) {
	return {
		...renderEntry,
		unitTransform: renderParams.unitTransform,
		renderMin: renderParams.renderMin,
		range: renderParams.range,
		staticScale: renderParams.staticScale,
		isLog: renderParams.isLog,
		displayUnits: renderParams.displayUnits,
		isFallback: renderParams.isFallback,
		grid: renderParams.grid,
		product: renderParams.product,
		header: renderParams.header,
	};
}

function makeBitmapCacheEntryFromWorker(renderEntry) {
	return {
		bitmap: renderEntry.bitmap,
		dataMin: renderEntry.dataMin,
		dataMax: renderEntry.dataMax,
		mean: renderEntry.dataMean,
		count: renderEntry.dataCount,
		unitTransform: renderEntry.unitTransform,
		renderMin: renderEntry.renderMin,
		range: renderEntry.range,
		staticScale: renderEntry.staticScale,
		isLog: renderEntry.isLog,
		displayUnits: renderEntry.displayUnits,
		isFallback: renderEntry.isFallback,
		isobars: renderEntry.isobars,
		grid: renderEntry.grid,
		product: renderEntry.product,
		header: renderEntry.header,
	};
}

function makeGridState(renderParams, values = renderParams.values) {
	return {
		...renderParams,
		values,
		unitFn: unitFnFor(renderParams.unitTransform),
		min: renderParams.renderMin,
		range: renderParams.range,
	};
}

const fmtNum = (v, d = 4) => v.toFixed(d);
const fmtHourLabel = (h) => `+${String(h).padStart(2, "0")}H`;

function fmtSize(b) {
	return b >= 1e6 ? (b / 1e6).toFixed(1) + " MB" : (b / 1e3).toFixed(0) + " KB";
}
function fmtGrid(g) {
	return (
		`${g.ni} × ${g.nj} pts · ` +
		`${g.latitudeOfLastPoint}°–${g.latitudeOfFirstPoint}°N · ` +
		`${g.longitudeOfFirstPoint}°–${g.longitudeOfLastPoint}°E`
	);
}
function code(table, v) {
	return table[v] ? `${table[v]} (${v})` : String(v);
}

function applyDefaultPalette(shortName) {
	const pal = defaultPaletteFor(shortName);
	if (!pal) return;
	currentPalette = pal;
	setPaletteSelectValues(pal);
}

// Mercator helpers (latitude in degrees)
const mercatorY = (lat) =>
	Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const invMercatorY = (my) =>
	((2 * Math.atan(Math.exp(my)) - Math.PI / 2) * 180) / Math.PI;

// Compute the Mercator-proportional canvas height for a given grid.
// The canvas width equals grid.ni; height is chosen so that one pixel ≈ same
// arc-length in both x and y when viewed in Web Mercator.
function mercatorCanvasHeight(grid) {
	const {
		ni,
		latitudeOfFirstPoint: la1,
		latitudeOfLastPoint: la2,
		longitudeOfFirstPoint: lo1,
		longitudeOfLastPoint: lo2,
	} = grid;
	const spanY = Math.abs(mercatorY(la1) - mercatorY(la2));
	const spanX = Math.abs((lo2 - lo1) * Math.PI) / 180;
	return Math.round((ni * spanY) / spanX);
}

// ── Card builder ──────────────────────────────────────────────────────────────

function buildCard(message) {
	return renderUploadedMessageCard(message, {
		code,
		formatGrid: fmtGrid,
		formatLevel: fmtLevel,
		formatValidTime: fmtValidTime,
		generatingProcess: GENERATING_PROCESS,
	});
}

function clearMapLayer() {
	mapRenderer.clearLayer();
	gridState = null;
	hideColorScale();
	hideMapUnavailable();
}

function clearStats() {
	dom.statMin.textContent = "—";
	dom.statMax.textContent = "—";
	dom.statMean.textContent = "—";
	dom.statValid.textContent = "—";
}

function showUnavailableHour(hour) {
	clearMapLayer();
	clearStats();
	dom.forecastValidTime.textContent = formatForecastValidTimeLabel(
		fmtUnavailableValidTime(hour),
	);
	showMapUnavailable();
}

function showMapUnavailable() {
	dom.mapUnavailable.hidden = false;
}

function hideMapUnavailable() {
	dom.mapUnavailable.hidden = true;
}

function fmtUnavailableValidTime(hour) {
	const block = blockForHour(hour);
	const runId = block?.runId;
	const runTime = runId ? Date.parse(runId) : NaN;
	if (!Number.isNaN(runTime)) {
		const valid = new Date(runTime + hour * 60 * 60 * 1000);
		return valid.toISOString().slice(0, 16).replace("T", " ") + " UTC";
	}
	return fmtHourLabel(hour);
}

function renderColorScaleTicks({ min, max, units, isLog }) {
	const ticksEl = dom.colorScaleTicks;
	ticksEl.replaceChildren();
	for (const tick of legendTicksFor({
		paletteName: currentPalette,
		min,
		max,
		isLog,
	})) {
		const el = document.createElement("span");
		el.className = "cs-tick";
		el.style.left = `${tick.position}%`;
		el.textContent = formatValueForUnits(tick.value, units, 1);
		ticksEl.appendChild(el);
	}
}

// Populate and show the color scale legend bar.
function showColorScale(min, max, units, { isLog = false } = {}) {
	renderColorScaleTicks({ min, max, units, isLog });
	dom.colorScale.hidden = false;
}

function hideColorScale() {
	dom.colorScale.hidden = true;
}

function updateLevelInfo(varDef) {
	const parts = [varDef?.level, varDef?.units].filter(Boolean);
	dom.mapLevel.textContent = parts.join(" · ");
}

function updateParamInfo(name, desc, sub) {
	dom.mapName.textContent = name;
	dom.mapDescription.textContent = desc;
	dom.mapSubtitle.textContent = sub;
}

function formatModelPackageSubtitle(packageKey) {
	const parts = getModelPackageLabelParts(packageKey);
	if (!parts) return packageKey;
	return `${parts.modelTitle} ${parts.packageName}`;
}

function getModelPackageLabelParts(packageKey) {
	const pkg = PACKAGES[packageKey];
	if (!pkg) return null;
	const modelTitle = MODEL_INFO[pkg.model]?.title ?? pkg.model;
	const packageName = packageKey.replace(`${pkg.model}_`, "");
	return { modelTitle, packageName };
}

function formatForecastValidTimeLabel(timeLabel) {
	if (!modelState) return timeLabel;
	const parts = getModelPackageLabelParts(modelState.packageKey);
	if (!parts) return `${modelState.packageKey} : ${timeLabel}`;
	return `${parts.modelTitle} - ${parts.packageName} : ${timeLabel}`;
}

function updateStats(min, max, mean, count, units) {
	dom.statMin.textContent = formatValueForUnits(min, units, 3) + " " + units;
	dom.statMax.textContent = formatValueForUnits(max, units, 3) + " " + units;
	dom.statMean.textContent = formatValueForUnits(mean, units, 3) + " " + units;
	dom.statValid.textContent = count.toLocaleString();
}

function toDisplayValues(values) {
	if (values instanceof Float32Array) return values;
	const out = new Float32Array(values.length);
	out.set(values);
	return out;
}

function makeRenderParams(
	data,
	{ values = data.values, displayUnits = null, isFallback = false } = {},
) {
	const { grid, product, header } = data;
	const unitTransform = unitTransformFor(product.shortName);
	const staticScale = staticScaleFor(product.shortName);
	const renderMin = staticScale ? staticScale.min : 0;
	const renderMax = staticScale ? staticScale.max : 1;
	const range = renderMax - renderMin || 1;
	const isLog = staticScale?.log ?? false;
	const logDenom = isLog ? Math.log(staticScale.max / LOG_SCALE_FLOOR) : 1;
	const zeroThreshold = staticScale?.zeroThreshold ?? 0;

	return {
		values: toDisplayValues(values),
		unitTransform,
		renderMin,
		renderMax,
		range,
		staticScale,
		isLog,
		logDenom,
		zeroThreshold,
		displayUnits:
			displayUnits ?? displayUnitsFor(product.shortName, product.units),
		isFallback,
		grid,
		product,
		header,
	};
}

function gridCorners({
	latitudeOfFirstPoint: la1,
	longitudeOfFirstPoint: lo1,
	latitudeOfLastPoint: la2,
	longitudeOfLastPoint: lo2,
}) {
	const north = Math.max(la1, la2);
	const south = Math.min(la1, la2);
	const west = Math.min(lo1, lo2);
	const east = Math.max(lo1, lo2);
	return [
		[west, north],
		[east, north],
		[east, south],
		[west, south],
	];
}

function setMapLayer(canvas, corners) {
	mapRenderer.setLayer(canvas, corners);
}

function ensureHeatCanvas(grid) {
	return mapRenderer.ensureHeatCanvas(grid);
}

function drawBitmapToHeatCanvas(bitmap) {
	mapRenderer.drawBitmap(bitmap);
}

function updateIsobarOverlay(entry, values) {
	if (!supportsIsobars(entry.product.shortName)) {
		mapRenderer.clearIsobars();
		return;
	}
	if (entry.isobars) {
		mapRenderer.updateIsobars(entry.isobars);
		return;
	}
	if (!values) {
		mapRenderer.clearIsobars();
		return;
	}
	entry.isobars = generateIsobars({
		shortName: entry.product.shortName,
		grid: entry.grid,
		values,
		missingValue: MISSING_VALUE,
	});
	mapRenderer.updateIsobars(entry.isobars);
}

function updateStatsAndColorScale(entry) {
	updateStats(
		entry.dataMin,
		entry.dataMax,
		entry.mean,
		entry.count,
		entry.displayUnits,
	);
	const legendMin = entry.staticScale ? entry.renderMin : entry.dataMin;
	const legendMax = entry.staticScale
		? entry.renderMin + entry.range
		: entry.dataMax;
	showColorScale(legendMin, legendMax, entry.displayUnits, {
		isLog: entry.isLog,
	});
}

// Create the MapLibre map once. fitBoundsArgs is optional [bounds, options].
async function initMap(fitBoundsArgs) {
	await mapRenderer.init(fitBoundsArgs);
}

function resetModelState() {
	stopPlayer();
	invalidateBitmapCache();
	setRendering(false);
	modelState = null;
	isDecoding = false;
	pendingHourIdx = null;
	gridState = null;
	updateWarmupProgress();
	dom.forecastDownloadBars.innerHTML = "";
	dom.forecastDownloadFileList.innerHTML = "";
}

function resetApp(targetHash = "") {
	uploadInspector.reset();
	resetModelState();
	clearMapLayer();
	dom.dataStatusPanel.hidden = true;
	location.hash = targetHash;
}

function closeInspectMapView(targetHash) {
	clearMapLayer();
	clearStats();
	setRendering(false);
	location.hash = targetHash;
}

function handleMapBack() {
	const targetHash = resolveMapBackHash({ hasModelState: Boolean(modelState) });
	if (!modelState) {
		closeInspectMapView(targetHash);
		return;
	}
	resetApp(targetHash);
}

// ── Map view: decode one field + render on map ───────────────────────────────

async function showMapView(route) {
	if (!uploadInspector.hasFile()) {
		location.hash = "";
		return;
	}

	const msg = uploadInspector.getSelectedMessage(
		typeof route === "string" ? { variableShortName: route } : route,
	);
	if (!msg) {
		location.hash = "";
		return;
	}

	const product = msg.product;

	// Populate toolbar
	updateParamInfo(
		product.name,
		parameterDescriptionFor(product.shortName),
		fmtValidTime(msg.header, product),
	);

	// Reset stats
	clearStats();
	hideColorScale();

	// Switch view
	showView("view-map");
	setMapSceneVisible(true);

	// Decode (WASM)
	let decoded;
	try {
		decoded = await timedDecodeGRIB2(msg.buffer);
	} catch (err) {
		dom.mapCanvas.textContent = "Decode error: " + err.message;
		return;
	}

	const { grid: gr } = decoded;
	const p = makeRenderParams(decoded);
	gridState = makeGridState(p);

	const { canvas, outH } = ensureHeatCanvas(gr);
	const corners = gridCorners(gr);
	const statsEntry = await renderViaWorker(p.values, p, gr.ni, outH);
	if (!statsEntry) return;
	const entry = makeBitmapCacheEntry(statsEntry, p);

	drawBitmapToHeatCanvas(statsEntry.bitmap);
	statsEntry.bitmap.close();

	await initMap();
	setMapLayer(canvas, corners);
	mapRenderer.fitBounds(
		[
			[corners[3][0], corners[2][1]],
			[corners[1][0], corners[0][1]],
		],
		{ padding: 20, animate: false },
	);

	updateStatsAndColorScale(entry);
}

async function rerenderUploadedGridView() {
	if (!gridState || modelState) return;
	const { grid } = gridState;
	const { outH } = ensureHeatCanvas(grid);

	const statsEntry = await renderViaWorker(
		gridState.values,
		gridState,
		grid.ni,
		outH,
	);
	if (!statsEntry) return;
	const entry = makeBitmapCacheEntry(statsEntry, gridState);

	drawBitmapToHeatCanvas(statsEntry.bitmap);
	statsEntry.bitmap.close();

	updateStatsAndColorScale(entry);
	mapRenderer.triggerRepaint();
}

// ── Forecast package live data ────────────────────────────────────────────────

function proxyUrl(url) {
	const u = new URL(url);
	return `${PROXY}/${u.hostname}${u.pathname}${u.search}`;
}

async function fetchDataGouvResources(datasetId, titlePattern) {
	const resp = await fetch(
		`${PROXY}/www.data.gouv.fr/api/1/datasets/${datasetId}/`,
	);
	if (!resp.ok) throw new Error(`API ${resp.status}`);
	const data = await resp.json();
	return data.resources
		.filter((r) => r.format === "grib2" && r.title?.includes(titlePattern))
		.map((r) => {
			const single = r.title.match(/__(\d+)H__/);
			const range = r.title.match(/__(\d+)H(\d+)H__/);
			const runId = extractRunId(`${r.title} ${r.url}`);
			if (single)
				return {
					startHour: +single[1],
					endHour: +single[1],
					key: single[0].slice(2, -2),
					runId,
					title: r.title,
					url: r.url,
					filesize: r.filesize,
				};
			if (range)
				return {
					startHour: +range[1],
					endHour: +range[2],
					key: range[0].slice(2, -2),
					runId,
					title: r.title,
					url: r.url,
					filesize: r.filesize,
				};
			return null;
		})
		.filter(Boolean)
		.sort((a, b) => a.startHour - b.startHour);
}

async function fetchPackageResources(packageKey, downloadKey) {
	const pkg = PACKAGES[packageKey];
	let resources = await fetchDataGouvResources(pkg.datasetId, pkg.titlePattern);
	if (!isModelResourceRefreshActive(downloadKey)) return null;
	if (pkg.skipHour0) resources = resources.filter((r) => r.startHour > 0);
	return resources;
}

async function downloadFileProg(url, filesize, onProgress) {
	return downloadFileInWorker(proxyUrl(url), filesize, onProgress);
}

async function getCachedDecode(hour) {
	const { decoded, decodedOrder, resources, variable } = modelState;
	if (decoded.has(hour)) {
		updatePerfDiagnostics();
		return decoded.get(hour);
	}

	const block = resources.find((r) => hour >= r.startHour && hour <= r.endHour);
	if (!block || !modelState.buffers.has(block.key)) return null;

	if (!modelState.messageIndex.has(block.key)) indexBlock(block.key);

	const varDef = findPackageVariable(modelState.packageKey, variable);
	const lookupKey =
		varDef?.levelValue != null
			? `${hour}_${varDef.shortName}_${varDef.levelValue}`
			: `${hour}_${variable}`;
	const msgRef = modelState.messageIndex.get(block.key)?.get(lookupKey);
	const msgBuffer = messageViewFromRef(msgRef);
	if (!msgBuffer) return null;

	if (decodedOrder.length >= DECODED_CACHE_SIZE)
		decoded.delete(decodedOrder.shift());
	const dec = await timedDecodeGRIB2(msgBuffer);
	const data = {
		values: dec.values,
		grid: dec.grid,
		product: dec.product,
		header: dec.header,
	};
	decoded.set(hour, data);
	decodedOrder.push(hour);
	return data;
}

function messageViewFromRef(ref) {
	if (!ref) return null;
	const buffer = modelState.buffers.get(ref.blockKey);
	if (!(buffer instanceof Uint8Array)) return null;
	return buffer.subarray(ref.offset, ref.offset + ref.length);
}

function evictDecodedHour(hour) {
	modelState.decoded.delete(hour);
	modelState.decodedOrder = modelState.decodedOrder.filter((h) => h !== hour);
	updatePerfDiagnostics();
}

function indexBlock(blockKey) {
	const buffer = modelState.buffers.get(blockKey);
	if (!(buffer instanceof Uint8Array)) return;
	const block = modelState.resources.find((r) => r.key === blockKey);
	const index = new Map();
	for (const msg of iterateGRIB2Messages(buffer)) {
		const { product } = msg;
		const messageRef = { blockKey, offset: msg.offset, length: msg.length };
		// PDT 4.8 (accumulation) always has forecastTime=0 (start of interval).
		// For single-hour blocks, use the block's hour as the effective forecast time.
		const ft =
			product.pdtNumber === 8 && block.startHour === block.endHour
				? block.endHour
				: product.forecastTime;
		index.set(`${ft}_${product.shortName}_${product.levelValue}`, messageRef);
		const simpleKey = `${ft}_${product.shortName}`;
		if (!index.has(simpleKey)) index.set(simpleKey, messageRef);
	}
	modelState.messageIndex.set(blockKey, index);
}

// Applies all transforms to raw decoded data and returns render-ready params.
// idx is the slider index — needed to compute accumulation diff with previous hour.
async function computeRenderParams(data, idx) {
	const { values, product } = data;
	const isAccumulation = product.pdtNumber === 8;
	let displayValues = values;
	let isFallback = false;
	let displayUnits = null;

	if (isAccumulation && idx > 0) {
		const prevHour = modelState.hourList[idx - 1];
		const prevData = await getCachedDecode(prevHour);
		if (prevData !== null) {
			const diff = new Float32Array(values.length);
			for (let i = 0; i < values.length; i++) {
				if (values[i] <= MISSING_VALUE || prevData.values[i] <= MISSING_VALUE) {
					diff[i] = MISSING_VALUE;
				} else {
					diff[i] = Math.max(0, values[i] - prevData.values[i]);
				}
			}
			displayValues = diff;
		} else {
			isFallback = true;
		}
	}

	if (isAccumulation && !isFallback && idx > 0) displayUnits = "mm/h";

	return makeRenderParams(data, {
		values: displayValues,
		displayUnits,
		isFallback,
	});
}

function modelWorkerRequestForHour(idx, hour, { includeValues = false } = {}) {
	const block = blockForHour(hour);
	if (!block || !modelState.buffers.has(block.key)) return null;

	const varDef = findPackageVariable(
		modelState.packageKey,
		modelState.variable,
	);
	const shortName = varDef?.shortName ?? modelState.variable;
	const staticScale = staticScaleFor(shortName);
	const renderMin = staticScale ? staticScale.min : 0;
	const renderMax = staticScale ? staticScale.max : 1;
	const range = renderMax - renderMin || 1;
	const isLog = staticScale?.log ?? false;
	const prevHour = idx > 0 ? modelState.hourList[idx - 1] : null;
	const previousBlock = prevHour != null ? blockForHour(prevHour) : null;

	return {
		type: "renderHour",
		gen: renderGen,
		blockKey: block.key,
		block,
		hour,
		previousBlockKey: previousBlock?.key ?? null,
		previousBlock,
		previousHour: prevHour,
		variable: {
			shortName,
			levelValue: varDef?.levelValue ?? null,
		},
		unitTransform: unitTransformFor(shortName),
		staticScale,
		renderMin,
		range,
		isLog,
		logFloor: LOG_SCALE_FLOOR,
		logDenom: isLog ? Math.log(staticScale.max / LOG_SCALE_FLOOR) : 1,
		zeroThreshold: staticScale?.zeroThreshold ?? 0,
		displayUnits: displayUnitsFor(shortName, varDef?.units),
		lut: buildLUT(currentPalette, { min: renderMin, max: renderMax }),
		missingValue: MISSING_VALUE,
		includeValues,
	};
}

async function renderModelHourViaWorker(idx, { includeValues = false } = {}) {
	const hour = modelState.hourList[idx];
	const request = modelWorkerRequestForHour(idx, hour, { includeValues });
	if (!request) return null;

	const startedAt = PERF_DEBUG ? performance.now() : 0;
	const result = await getModelBlockService().renderHour(request);
	if (!result) return null;
	if (PERF_DEBUG) {
		perfStats.lastRenderMs = performance.now() - startedAt;
		updatePerfDiagnostics();
	}
	if (renderGen !== request.gen) {
		result.bitmap?.close();
		return null;
	}
	return result;
}

async function decodeModelHourValuesViaWorker(idx, hour) {
	const request = modelWorkerRequestForHour(idx, hour, {
		includeValues: false,
	});
	if (!request) return null;
	const result = await getModelBlockService().decodeValues(request);
	if (!result?.values || renderGen !== request.gen) return null;
	return result;
}

async function presentBitmapEntry(hour, entry, { values } = {}) {
	const { grid, product, header } = entry;
	hideMapUnavailable();

	gridState = makeGridState(entry, values ?? null);

	const { canvas, canvasChanged } = ensureHeatCanvas(grid);
	const corners = gridCorners(grid);
	drawBitmapToHeatCanvas(entry.bitmap);

	const scaleRange = {
		min: entry.renderMin,
		max: entry.renderMin + entry.range,
	};
	const stops = gradientStopsFor(currentPalette, scaleRange)
		.map((stop) => `${stop.color} ${stop.position}%`)
		.join(", ");
	dom.colorScaleBar.style.background = `linear-gradient(to right, ${stops})`;

	await initMap();
	const isFirstLayer = !mapRenderer.hasLayer();
	if (isFirstLayer || canvasChanged) {
		setMapLayer(canvas, corners);
		mapRenderer.fitBounds(
			[
				[corners[3][0], corners[2][1]],
				[corners[1][0], corners[0][1]],
			],
			{ padding: 20, animate: false },
		);
	}
	mapRenderer.triggerRepaint();
	updateIsobarOverlay(entry, values);

	modelState.lastRunInfo = `${modelState.packageKey} · run ${fmtRefTime(header)}`;
	updateParamInfo(
		product.name,
		parameterDescriptionFor(product.shortName),
		formatModelPackageSubtitle(modelState.packageKey),
	);

	updateStatsAndColorScale(entry);

	const validTimeProduct =
		product.pdtNumber === 8
			? { ...product, forecastTime: hour, timeUnit: 1 }
			: product;
	dom.forecastValidTime.textContent = formatForecastValidTimeLabel(
		fmtValidTime(header, validTimeProduct),
	);
}

async function hydrateTooltipValues(
	idx,
	hour,
	token,
	capturedState,
	capturedGen,
) {
	const data = await decodeModelHourValuesViaWorker(idx, hour);
	if (
		!data ||
		modelState !== capturedState ||
		renderGen !== capturedGen ||
		tooltipHydrateToken !== token ||
		capturedState.currentHour !== hour
	)
		return;

	if (
		modelState !== capturedState ||
		renderGen !== capturedGen ||
		tooltipHydrateToken !== token ||
		capturedState.currentHour !== hour
	)
		return;

	const cachedEntry = animationCache.getHour(hour);
	if (cachedEntry) {
		gridState = makeGridState(cachedEntry, data.values);
		updateIsobarOverlay(cachedEntry, data.values);
	}
}

function queueTooltipValueHydration(idx, hour) {
	tooltipHydrateToken++;
	if (tooltipHydrateTimer !== null) clearTimeout(tooltipHydrateTimer);
	tooltipHydrateTimer = null;
	if (animationPlayer.isPlaying()) return;

	const token = tooltipHydrateToken;
	const capturedState = modelState;
	const capturedGen = renderGen;
	tooltipHydrateTimer = setTimeout(() => {
		tooltipHydrateTimer = null;
		if (animationPlayer.isPlaying()) return;
		hydrateTooltipValues(idx, hour, token, capturedState, capturedGen).catch(
			(err) => console.error("hydrateTooltipValues:", err),
		);
	}, 140);
}

function queueCurrentTooltipValueHydration() {
	if (!modelState || gridState?.values) return;
	const slider = dom.forecastSlider;
	const idx = parseInt(slider.value, 10);
	const hour = modelState.hourList[idx];
	if (animationCache.hasHour(hour)) queueTooltipValueHydration(idx, hour);
}

async function showHour(idx) {
	if (isDecoding) {
		pendingHourIdx = idx;
		return;
	}
	isDecoding = true;
	pendingHourIdx = null;
	try {
		const hour = modelState.hourList[idx];
		dom.forecastHourLabel.textContent = fmtHourLabel(hour);

		const cachedEntry = animationCache.getHour(hour);
		if (cachedEntry) {
			modelState.currentHour = hour;
			await presentBitmapEntry(hour, cachedEntry);
			queueTooltipValueHydration(idx, hour);
			return;
		}

		modelState.currentHour = hour;
		const renderEntry = await renderModelHourViaWorker(idx, {
			includeValues: true,
		});
		if (!renderEntry) {
			showUnavailableHour(hour);
			return;
		}

		const entry = makeBitmapCacheEntryFromWorker(renderEntry);
		animationCache.setHour(hour, entry);
		updateWarmupProgress();
		await presentBitmapEntry(hour, entry, { values: renderEntry.values });
	} catch (err) {
		console.error("showHour:", err);
		showUnavailableHour(modelState?.hourList[idx] ?? idx);
	} finally {
		isDecoding = false;
		if (pendingHourIdx !== null) {
			const next = pendingHourIdx;
			pendingHourIdx = null;
			showHour(next);
		}
	}
}

// Renders all hours in a block into the animation cache in the background.
// Silently aborts if the variable or package changes (renderGen / modelState guard).
async function prerenderBlock(blockKey) {
	const capturedState = modelState;
	const capturedGen = renderGen;
	const block = capturedState.resources.find((r) => r.key === blockKey);
	if (!block) return;

	for (let hour = block.startHour; hour <= block.endHour; hour++) {
		if (modelState !== capturedState || renderGen !== capturedGen) return;

		const idx = capturedState.hourList.indexOf(hour);
		if (idx === -1) continue;

		if (animationCache.hasHour(hour)) continue; // already rendered (e.g. by showHour)

		const entry = await renderModelHourViaWorker(idx);
		if (!entry) return; // worker stale or crashed — abort this block

		if (modelState === capturedState && renderGen === capturedGen) {
			if (animationCache.hasHour(hour)) {
				entry.bitmap.close(); // showHour raced and cached it while we were rendering
			} else {
				animationCache.setHour(hour, makeBitmapCacheEntryFromWorker(entry));
				updateWarmupProgress();
			}
		} else {
			entry.bitmap.close();
			return;
		}
	}
}

function queuePrerenderBlock(blockKey) {
	if (!modelState || !modelState.buffers.has(blockKey)) return;
	const gen = renderGen;
	const state = modelState;
	const queued = animationCache.enqueueBlock(blockKey, gen, state);
	if (!queued) return;
	updatePerfDiagnostics();
	drainPrerenderQueue();
}

function queuePrerenderForAllBlocks() {
	if (!modelState) return;
	updateWarmupProgress();
	for (const blockKey of modelState.buffers.keys()) {
		queuePrerenderBlock(blockKey);
	}
}

function waitForPrerenderIdle() {
	return animationCache.waitForIdle();
}

async function drainPrerenderQueue() {
	if (!animationCache.beginDrain()) return;
	updatePerfDiagnostics();
	try {
		let job = animationCache.nextJob();
		while (job) {
			updatePerfDiagnostics();
			if (modelState === job.state && renderGen === job.gen) {
				await prerenderBlock(job.blockKey);
			}
			animationCache.completeJob(job);
			updatePerfDiagnostics();
			job = animationCache.nextJob();
		}
	} finally {
		animationCache.endDrain();
		updatePerfDiagnostics();
		if (animationCache.queueLength > 0) {
			drainPrerenderQueue();
		}
	}
}

function downloadBarForBlock(block) {
	return [...dom.forecastDownloadBars.children].find(
		(item) => item.id === `dl-${block.key}`,
	);
}

function downloadFileItemForBlock(block) {
	return [...dom.forecastDownloadFileList.children].find(
		(item) => item.id === `dl-file-${block.key}`,
	);
}

function setBlockStatus(block, status) {
	block.status = status;
	modelState?.blockStatus?.set(block.key, status);
	const item = downloadBarForBlock(block);
	if (item) {
		item.classList.remove(...BLOCK_STATUS_CLASSES);
		item.classList.add(status);
		if (status === BLOCK_STATUS.READY) item.classList.add("done");
		item.title = `${formatRunSummary([block])} · ${status}`;
	}
	const fileItem = downloadFileItemForBlock(block);
	if (fileItem) {
		fileItem.classList.remove(...BLOCK_STATUS_CLASSES);
		fileItem.classList.add(status);
		if (status === BLOCK_STATUS.READY) fileItem.classList.add("done");
		fileItem.querySelector(".forecast-download-file__status").textContent =
			BLOCK_STATUS_LABELS[status] ?? status;
	}
	updateDataStatusSummary();
}

function setBlockDownloadProgress(block, pct) {
	downloadBarForBlock(block)?.style.setProperty("--pct", pct);
}

function resetBlockDownloadProgress(block) {
	setBlockDownloadProgress(block, "0%");
}

function updateDataStatusSummary() {
	const summary = dom.dataStatusSummary;
	if (!summary || !modelState?.resources.length) return;
	summary.replaceChildren(
		...createDataStatusSummaryNodes(document, modelState.resources),
	);
}

function blockForHour(hour) {
	return (
		modelState?.resources.find(
			(r) => hour >= r.startHour && hour <= r.endHour,
		) ?? null
	);
}

function createModelState(packageKey) {
	return {
		packageKey,
		resourceRefreshId: 0,
		resources: [],
		buffers: new Map(),
		messageIndex: new Map(),
		hourList: [],
		decoded: new Map(),
		decodedOrder: [],
		blockStatus: new Map(),
		variable: null,
		currentHour: null,
		lastRunInfo: null,
		animationCacheStatus: "waiting",
	};
}

function createVariableOption(varDef) {
	const option = document.createElement("option");
	option.value = variableKeyFor(varDef);
	option.textContent = varDef.name;
	return option;
}

function appendGroupedVariableOptions(select, variables) {
	const groups = new Map();
	for (const varDef of variables) {
		const groupName = varDef.group;
		if (!groupName) {
			select.appendChild(createVariableOption(varDef));
			continue;
		}
		if (!groups.has(groupName)) {
			const group = document.createElement("optgroup");
			group.label = groupName;
			groups.set(groupName, group);
		}
		groups.get(groupName).appendChild(createVariableOption(varDef));
	}
	for (const groupName of VARIABLE_GROUP_ORDER) {
		const group = groups.get(groupName);
		if (group) select.appendChild(group);
	}
	for (const [groupName, group] of groups) {
		if (!VARIABLE_GROUP_ORDER.includes(groupName)) select.appendChild(group);
	}
}

function defaultVariableForPackage(pkg) {
	return (
		pkg.variables.find((v) => v.group === "Weather maps") ?? pkg.variables[0]
	);
}

function configureModelVariableControls(pkg) {
	const varSelect = dom.forecastVarSelect;
	varSelect.innerHTML = "";

	const pkgVars = pkg.variables;
	const firstVar = defaultVariableForPackage(pkg);
	modelState.variable = variableKeyFor(firstVar);
	applyDefaultPalette(variableKeyFor(firstVar));
	appendGroupedVariableOptions(varSelect, pkgVars);
	varSelect.value = modelState.variable;
	updateLevelInfo(firstVar);
}

function buildHourList(resources) {
	const hourList = [];
	for (const r of resources) {
		for (let h = r.startHour; h <= r.endHour; h++) hourList.push(h);
	}
	return hourList;
}

function renderDownloadItems(resources) {
	const barsEl = dom.forecastDownloadBars;
	const fileListEl = dom.forecastDownloadFileList;
	barsEl.innerHTML = "";
	fileListEl.innerHTML = "";
	for (const r of resources) {
		setBlockStatus(r, BLOCK_STATUS.MISSING);
		const item = document.createElement("div");
		item.className = `forecast-download-bar ${BLOCK_STATUS.MISSING}`;
		item.id = `dl-${r.key}`;
		item.textContent = r.key;
		item.title = formatRunSummary([r]);
		barsEl.appendChild(item);

		const li = document.createElement("li");
		li.id = `dl-file-${r.key}`;
		li.className = `forecast-download-file ${BLOCK_STATUS.MISSING}`;
		const fileLabel = document.createElement("span");
		fileLabel.textContent = `${r.url.split("/").pop()} · ${fmtSize(r.filesize)}`;
		const statusLabel = document.createElement("span");
		statusLabel.className = "forecast-download-file__status";
		statusLabel.textContent = BLOCK_STATUS_LABELS[BLOCK_STATUS.MISSING];
		li.append(fileLabel, statusLabel);
		fileListEl.appendChild(li);
	}
}

function createModelDownloadSession({
	packageKey,
	pkg,
	resources,
	runSummary,
	downloadKey,
}) {
	return {
		packageKey,
		pkg,
		pkgVars: pkg.variables,
		resources,
		runSummary,
		downloadKey,
		slider: dom.forecastSlider,
		availableCount: 0,
		legendInitialized: false,
		presentationQueue: [],
		presentationIdleResolvers: [],
		isPresentingQueuedBlock: false,
	};
}

function applyModelResources(resources) {
	modelState.resources = resources;
	modelState.hourList = buildHourList(resources);
	const slider = dom.forecastSlider;
	slider.max = modelState.hourList.length - 1;
	if (Number(slider.value) > Number(slider.max)) slider.value = slider.max;
}

function isModelBlockInMemoryCurrent(block, previousBlock) {
	return Boolean(
		previousBlock &&
			modelState.buffers.has(block.key) &&
			previousBlock.filesize === block.filesize &&
			runTimeValue(previousBlock.runId) >= runTimeValue(block.runId),
	);
}

function isModelBlockInMemoryStale(block, previousBlock) {
	return Boolean(
		previousBlock &&
			modelState.buffers.has(block.key) &&
			runTimeValue(previousBlock.runId) < runTimeValue(block.runId),
	);
}

function updateAvailableFileCount(session) {
	dom.forecastDownloadStatus.textContent = `${session.availableCount} / ${session.resources.length} files`;
}

function markInMemoryModelBlockAvailable(block, status, session) {
	setBlockStatus(block, status);
	setBlockDownloadProgress(block, "100%");
	session.availableCount++;
	updateAvailableFileCount(session);
	completeModelDownloadIfReady(session);
}

async function storeModelBlockInWorker(block, buffer) {
	return getModelBlockService().storeBlock(block, buffer);
}

async function storeAvailableModelBlock(block, buffer, status, session) {
	const hadBuffer = modelState.buffers.has(block.key);
	if (hadBuffer) {
		modelState.messageIndex.delete(block.key);
		invalidateBlockRenderCache(block);
	}
	const storedInWorker = await storeModelBlockInWorker(block, buffer);
	if (!storedInWorker) return;
	modelState.buffers.set(block.key, true);
	setBlockStatus(block, status);
	if (!hadBuffer) session.availableCount++;

	setBlockDownloadProgress(block, "100%");
	updateAvailableFileCount(session);
}

function initializeModelLegendFromBlock(buffer, session) {
	// On first arrival: populate legend/info from header (no CCSDS decode)
	if (session.legendInitialized) return;
	session.legendInitialized = true;
	const curVarDef = findPackageVariable(
		session.packageKey,
		modelState.variable,
	);
	const curShortName = curVarDef?.shortName ?? modelState.variable;
	for (const msg of iterateGRIB2Messages(buffer)) {
		const p = msg.product;
		if (!p || p.shortName !== curShortName) continue;
		if (curVarDef?.levelValue != null && p.levelValue !== curVarDef.levelValue)
			continue;
		modelState.lastRunInfo = `${session.packageKey} · run ${fmtRefTime(msg.header)}`;
		applyDefaultPalette(modelState.variable);
		updateParamInfo(
			p.name,
			parameterDescriptionFor(curShortName),
			formatModelPackageSubtitle(modelState.packageKey),
		);
		updateLevelInfo(curVarDef);
		const staticScale = staticScaleFor(curShortName);
		if (staticScale && curVarDef) {
			showColorScale(
				staticScale.min,
				staticScale.max,
				displayUnitsFor(curShortName, curVarDef.units),
				{ isLog: staticScale.log ?? false },
			);
		}
		break;
	}
}

async function refreshMapForAvailableModelBlock(block, session) {
	const currentIdx = parseInt(session.slider.value, 10);
	const currentHour = modelState.hourList[currentIdx];
	if (session.availableCount === 1) {
		setMapSceneVisible(true);
		await initMap();
		if (!isModelResourceRefreshActive(session.downloadKey)) return;
		mapRenderer.fitBounds(session.pkg.bounds, { padding: 20, animate: false });
		await showHour(currentIdx);
	} else if (blockForHour(currentHour)?.key === block.key) {
		await showHour(currentIdx);
	}
}

function completeModelDownloadIfReady(session) {
	if (session.availableCount !== session.resources.length) return;
	updateAvailableFileCount(session);
}

async function presentAvailableModelBlock(block, buffer, status, session) {
	if (!isModelResourceRefreshActive(session.downloadKey)) return;
	initializeModelLegendFromBlock(buffer, session);
	await storeAvailableModelBlock(block, buffer, status, session);
	if (!isModelResourceRefreshActive(session.downloadKey)) return;
	await refreshMapForAvailableModelBlock(block, session);
	completeModelDownloadIfReady(session);
}

async function buildAnimationCacheAfterNetworkSettles(session) {
	if (!isModelResourceRefreshActive(session.downloadKey)) return;
	modelState.animationCacheStatus = "building";
	updateWarmupProgress();
	queuePrerenderForAllBlocks();
	await waitForPrerenderIdle();
	if (!isModelResourceRefreshActive(session.downloadKey)) return;
	modelState.animationCacheStatus = isBitmapCacheComplete()
		? "ready"
		: "waiting";
	updateWarmupProgress();
}

function resolvePresentationIdle(session) {
	const resolvers = session.presentationIdleResolvers.splice(0);
	for (const resolve of resolvers) resolve();
}

function waitForPresentationIdle(session) {
	if (
		!session.isPresentingQueuedBlock &&
		session.presentationQueue.length === 0
	) {
		return Promise.resolve();
	}
	return new Promise((resolve) => {
		session.presentationIdleResolvers.push(resolve);
	});
}

const forecastBlockRefreshService = createForecastBlockRefreshService({
	statuses: BLOCK_STATUS,
	maxParallelDownloads: MAX_PARALLEL_DOWNLOADS,
	runWithConcurrency,
	isRefreshActive: isModelResourceRefreshActive,
	isBlockInMemoryCurrent: isModelBlockInMemoryCurrent,
	isBlockInMemoryStale: isModelBlockInMemoryStale,
	markInMemoryBlockAvailable: markInMemoryModelBlockAvailable,
	readCachedBlock: readCachedGribBlock,
	readLatestCachedBlock: readLatestCachedGribBlock,
	setBlockStatus,
	resetBlockDownloadProgress,
	setBlockDownloadProgress,
	downloadFile: downloadFileProg,
	writeCachedBlock: writeCachedModelBlock,
	deleteObsoleteCachedBlocks: deleteObsoleteCachedGribBlocks,
	enqueueAvailableBlock: enqueueAvailableModelBlockPresentation,
	waitForPresentationIdle,
});

async function writeCachedModelBlock(packageKey, block, buffer) {
	const cacheWriteSucceeded = await writeCachedGribBlock(packageKey, block, buffer);
	if (cacheWriteSucceeded) updateStorageWarningSizeIfOpen();
	return cacheWriteSucceeded;
}

async function enqueueAvailableModelBlockPresentation(
	block,
	buffer,
	status,
	session,
) {
	if (status !== BLOCK_STATUS.READY) {
		await presentAvailableModelBlock(block, buffer, status, session);
		return;
	}

	session.presentationQueue.push({ block, buffer, status, session });
	if (session.isPresentingQueuedBlock) return;

	session.isPresentingQueuedBlock = true;
	try {
		while (session.presentationQueue.length > 0) {
			const job = session.presentationQueue.shift();
			await scheduleLowPriorityWork();
			if (!isModelResourceRefreshActive(session.downloadKey)) return;
			await presentAvailableModelBlock(
				job.block,
				job.buffer,
				job.status,
				job.session,
			);
		}
	} finally {
		session.isPresentingQueuedBlock = false;
		if (session.presentationQueue.length === 0)
			resolvePresentationIdle(session);
	}
}

async function startDownload(packageKey) {
	const pkg = PACKAGES[packageKey];
	modelState = createModelState(packageKey);
	setMapSceneVisible(false);
	const downloadKey = beginModelResourceRefresh();

	configureModelVariableControls(pkg);

	const slider = dom.forecastSlider;
	slider.value = 0;

	dom.forecastDownloadStatus.textContent = "Fetching file list…";

	let resources;
	try {
		resources = await fetchPackageResources(packageKey, downloadKey);
		if (!isModelResourceRefreshActive(downloadKey) || !resources) return;
	} catch (e) {
		if (!isModelResourceRefreshActive(downloadKey)) return;
		dom.forecastDownloadStatus.textContent = "API error: " + e.message;
		return;
	}

	applyModelResources(resources);
	const runSummary = formatRunSummary(resources);

	dom.forecastDownloadStatus.textContent = `Downloading ${resources.length} ${packageKey} files (${runSummary})…`;
	renderDownloadItems(resources);
	const session = createModelDownloadSession({
		packageKey,
		pkg,
		resources,
		runSummary,
		downloadKey,
	});
	updateWarmupProgress();

	const latestReady =
		await forecastBlockRefreshService.refreshBlocksToLatest(session);
	if (!latestReady) return;

	await buildAnimationCacheAfterNetworkSettles(session);
}

// ── Router (hash-based) ───────────────────────────────────────────────────────

function showView(name) {
	dom.viewsHome.hidden = name !== "view-home";
	dom.viewsMap.hidden = name !== "view-map";
	mountStorageWarning(name);
}

function mountStorageWarning(viewId) {
	const warning = dom.storageWarning;
	const main = document.querySelector(`#${viewId} main`);
	if (!warning || !main) return;
	if (warning.parentElement === main && warning === main.firstElementChild) return;
	main.prepend(warning);
}

function showTab(name) {
	setHomeTab(document, name);
}

function resetUploadState() {
	uploadInspector.reset();
}

function setToolbarMode(mode) {
	setMapToolbarMode(document, mode);
}

const router = createAppRouter({
	getHash: () => location.hash,
	replaceHash: (hash) => location.replace(hash),
	setHash: (hash) => {
		location.hash = hash;
	},
	addEventListener: (...args) => window.addEventListener(...args),
	removeEventListener: (...args) => window.removeEventListener(...args),
	isValidPackage: (packageKey) => Boolean(PACKAGES[packageKey]),
	getCurrentPackageKey: () => modelState?.packageKey ?? null,
	showView,
	showTab,
	setToolbarMode,
	showMapView,
	showDataStatusPanel: () => {
		dom.dataStatusPanel.hidden = false;
	},
	resetModelState,
	startDownload,
});

renderModelList({
	container: domRefs.home.modelList,
	packages: PACKAGES,
	modelInfo: MODEL_INFO,
});

bindHomeEvents({
	dom: domRefs,
	handlers: {
		onHomeTabSelect: (tabName) => {
			location.hash =
				tabName === "upload" ? createInspectHomeHash() : createForecastHomeHash();
		},
		onPackageSelect: (key) => {
			location.hash = createForecastPackageHash(key);
		},
	},
});

const animationPlayer = createAnimationPlayer({
	playButton: domRefs.player.playButton,
	resetButton: domRefs.player.resetButton,
	slider: dom.forecastSlider,
	iconPlay: domRefs.player.iconPlay,
	iconPause: domRefs.player.iconPause,
	getModelState: () => modelState,
	isBitmapCacheComplete,
	isAnimationCacheReadyForPlayback,
	queueCurrentTooltipValueHydration,
	showHour,
});

router.start();

// ── Event wiring ──────────────────────────────────────────────────────────────

bindUploadInspectorEvents({
	dom: domRefs,
	handlers: {
		onFilePickRequest: () => {
			prepareFileInputForPick(domRefs.upload.fileInput);
			domRefs.upload.fileInput.click();
		},
		onFileSelected: uploadInspector.processFile,
		onUploadedVariableOpen: ({ messageIndex, variableShortName }) => {
			location.hash =
				messageIndex == null
					? createInspectVariableHash(variableShortName)
					: createInspectMessageHash(messageIndex);
		},
	},
});

async function refreshCurrentModelVisuals({ clearDecoded = false } = {}) {
	const downloadKey = beginModelResourceRefresh();
	stopPlayer();
	await new Promise((r) => requestAnimationFrame(r));
	setRendering(false);
	if (clearDecoded) {
		modelState.decoded.clear();
		modelState.decodedOrder = [];
	}
	invalidateBitmapCache();
	const myGen = renderGen;
	await showHour(parseInt(dom.forecastSlider.value, 10));
	const session = await refreshCurrentModelResourcesToLatest(downloadKey);
	if (
		session &&
		renderGen === myGen &&
		isModelResourceRefreshActive(downloadKey)
	)
		await buildAnimationCacheAfterNetworkSettles(session);
}

async function refreshCurrentModelResourcesToLatest(downloadKey) {
	if (!isModelResourceRefreshActive(downloadKey)) return null;
	const packageKey = downloadKey.state.packageKey;
	const pkg = PACKAGES[packageKey];
	const previousResources = downloadKey.state.resources;

	dom.forecastDownloadStatus.textContent = "Checking latest files…";
	let resources;
	try {
		resources = await fetchPackageResources(packageKey, downloadKey);
	} catch (e) {
		if (isModelResourceRefreshActive(downloadKey))
			dom.forecastDownloadStatus.textContent = "API error: " + e.message;
		return null;
	}
	if (!isModelResourceRefreshActive(downloadKey) || !resources) return null;

	applyModelResources(resources);
	const runSummary = formatRunSummary(resources);
	dom.forecastDownloadStatus.textContent = `Checking ${resources.length} ${packageKey} files (${runSummary})…`;
	renderDownloadItems(resources);

	const session = createModelDownloadSession({
		packageKey,
		pkg,
		resources,
		runSummary,
		downloadKey,
	});
	const latestReady = await forecastBlockRefreshService.refreshBlocksToLatest(
		session,
		{
			previousResources,
		},
	);
	return latestReady ? session : null;
}

async function onPaletteChange(e) {
	currentPalette = e.target.value;
	setPaletteSelectValues(currentPalette);
	if (!gridState) return;
	if (modelState) {
		await refreshCurrentModelVisuals();
	} else {
		await rerenderUploadedGridView();
	}
}

async function onForecastVariableChange(e) {
	if (!modelState) return;
	const varKey = e.target.value;
	modelState.variable = varKey;
	const varDef = findPackageVariable(modelState.packageKey, varKey);
	const shortName = varDef?.shortName ?? varKey;
	applyDefaultPalette(varKey);

	// Immediately sync gv-meta — the async decode may be delayed or queued.
	if (varDef) {
		updateParamInfo(
			varDef.name,
			parameterDescriptionFor(shortName),
			formatModelPackageSubtitle(modelState.packageKey),
		);
		updateLevelInfo(varDef);
	}

	await refreshCurrentModelVisuals({ clearDecoded: true });
}

function onForecastSliderInput() {
	if (!modelState) return;
	showHour(parseInt(dom.forecastSlider.value, 10));
}

// ── Mini-player ───────────────────────────────────────────────────────────────

function stopPlayer() {
	animationPlayer.stopPlayer();
}

function syncPlayButtonAvailability() {
	animationPlayer.syncPlayButtonAvailability();
}

async function updateStorageWarningSize() {
	try {
		const estimate = await navigator.storage?.estimate?.();
		dom.storageWarningSize.textContent = formatStorageEstimate(estimate);
	} catch {
		dom.storageWarningSize.textContent = formatStorageEstimate(null);
	}
}

function updateStorageWarningSizeIfOpen() {
	if (dom.storageWarningButton.getAttribute("aria-expanded") !== "true") return;
	void updateStorageWarningSize();
}

async function onClearCache() {
	await clearGribCache();
	dom.forecastDownloadStatus.textContent = "Download cache cleared.";
	await updateStorageWarningSize();
}

function onStorageWarningToggle() {
	const isExpanded =
		dom.storageWarningButton.getAttribute("aria-expanded") === "true";
	dom.storageWarning.hidden = isExpanded;
	dom.storageWarningButton.setAttribute("aria-expanded", String(!isExpanded));
	if (!isExpanded) updateStorageWarningSize();
}

function onDocumentKeydown(e) {
	if (e.code !== "Space" || !modelState) return;
	if (
		e.target.tagName === "INPUT" ||
		e.target.tagName === "SELECT" ||
		e.target.tagName === "BUTTON"
	)
		return;
	e.preventDefault();
	dom.playerPlayButton.click();
}

bindAppEvents({
	document,
	dom: domRefs,
	handlers: {
		handleMapBack,
		onPaletteChange,
		onForecastVariableChange,
		onForecastSliderInput,
		onClearCache,
		onStorageWarningToggle,
		onDocumentKeydown,
	},
});

updatePerfDiagnostics();
