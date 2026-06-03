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
import {
	createRenderParams,
	createRenderScaleParams,
} from "./src/domain/forecast-field.js";
import {
	gridCorners,
	mercatorCanvasHeight,
	renderProjectionForGrid,
} from "./src/domain/web-mercator.js";
import { MODEL_INFO, PACKAGES } from "./src/domain/model-packages.js";
import {
	buildLUT,
	gradientStopsFor,
	LOG_SCALE_FLOOR,
	legendTicksFor,
} from "./src/domain/palettes.js";
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
} from "./src/domain/variable-metadata.js";
import { clearGribCache } from "./src/services/grib-cache-service.js";
import { createMapRendererService } from "./src/services/map-renderer-service.js";
import { createRenderWorkerClient } from "./src/workers/render-worker-client.js";
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
import {
	createStorageWarningController,
	formatStorageEstimate,
} from "./src/ui/storage-warning.js";
import { createMapPresentationController } from "./src/controllers/map-presentation-controller.js";
import { createUploadInspectorController } from "./src/controllers/upload-inspector-controller.js";
import { createForecastRunController } from "./src/controllers/forecast-run-controller.js";
import { renderUploadedMessageCard } from "./src/ui/upload-inspector-view.js";
import { bindUploadInspectorEvents } from "./src/ui/upload-inspector-events.js";

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
	mapWrap: domRefs.map.wrap,
	mapBackButton: domRefs.map.backButton,
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
	storageWarningCloseButton: domRefs.storage.warningCloseButton,
	storageWarningButton: domRefs.storage.warningButton,
	storageWarningSize: domRefs.storage.warningSize,
	perfDebugPanel: domRefs.perfDebug.panel,
	perfDebugRender: domRefs.perfDebug.render,
	perfDebugDecode: domRefs.perfDebug.decode,
	perfDebugQueue: domRefs.perfDebug.queue,
	perfDebugCache: domRefs.perfDebug.cache,
	perfDebugDecoded: domRefs.perfDebug.decoded,
	perfDebugGeneration: domRefs.perfDebug.generation,
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
const renderWorkerClient = createRenderWorkerClient();
let currentRenderGeneration = 0;
let forecastRun = null;
const PERF_DEBUG =
	new URLSearchParams(window.location.search).get("debug") === "perf";
const perfStats = {
	lastRenderMs: null,
	lastDecodeMs: null,
};
const storageWarningController = createStorageWarningController({
	dom: domRefs.storage,
	storage: localStorage,
	updateStorageSize: updateStorageWarningSize,
});
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
const mapPresentation = createMapPresentationController({
	dom: domRefs,
	formatValueForUnits,
	getCurrentPalette: () => currentPalette,
	legendTicksFor,
});
forecastRun = createForecastRunController({
	document,
	window,
	dom,
	mapRenderer,
	mapPresentation,
	perfDebug: PERF_DEBUG,
	missingValue: MISSING_VALUE,
	timedDecode: timedDecodeGRIB2,
	makeRenderParams,
	makeGridState,
	gridCorners,
	initMap,
	getCurrentPalette: () => currentPalette,
	getGridState: () => gridState,
	setCurrentPalette: (palette) => {
		currentPalette = palette;
		setPaletteSelectValues(palette);
	},
	setGridState: (state) => {
		gridState = state;
	},
	setRendering,
	updateDiagnostics: updatePerfDiagnostics,
	updateStorageWarningSizeIfOpen,
});
// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPerfMs(value) {
	return value == null ? "—" : `${Math.round(value)} ms`;
}

function updatePerfDiagnostics() {
	if (!PERF_DEBUG) return;
	const panel = dom.perfDebugPanel;
	if (!panel) return;

	const diagnostics = forecastRun?.getDiagnostics();
	const totalBitmaps = diagnostics?.totalBitmaps ?? 0;
	const readyBitmaps = diagnostics?.readyBitmaps ?? 0;
	const queueLength = diagnostics?.queueLength ?? 0;
	const isPrerendering = diagnostics?.isPrerendering ?? false;

	panel.hidden = false;
	dom.perfDebugRender.textContent = `render ${fmtPerfMs(diagnostics?.lastRenderMs ?? perfStats.lastRenderMs)}`;
	dom.perfDebugDecode.textContent = `decode ${fmtPerfMs(diagnostics?.lastDecodeMs ?? perfStats.lastDecodeMs)}`;
	dom.perfDebugQueue.textContent =
		`queue ${queueLength}${isPrerendering ? " + active" : ""}`;
	dom.perfDebugCache.textContent =
		`cache ${readyBitmaps} / ${totalBitmaps || readyBitmaps}`;
	dom.perfDebugDecoded.textContent = "decoded worker";
	dom.perfDebugGeneration.textContent =
		`generation ${diagnostics?.currentRenderGeneration ?? currentRenderGeneration}`;
}

function setRendering(on) {
	dom.mapScene.classList.toggle("rendering", on);
	updatePerfDiagnostics();
}

function setMapSceneVisible(visible) {
	mapRenderer.setVisible(visible);
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
// Returns null if renderGeneration changed before the worker responds (stale result).
// By default values are copied so the main thread keeps ownership for tooltips.
async function renderViaWorker(
	values,
	renderParams,
	outW,
	outH,
	{ transferValues = false } = {},
) {
	const capturedRenderGeneration = currentRenderGeneration;
	const startedAt = PERF_DEBUG ? performance.now() : 0;

	const { grid } = renderParams;
	const projection = renderProjectionForGrid(grid);
	const workerValues = transferValues ? values : values.slice();
	const lut = buildLUT(currentPalette, {
		min: renderParams.renderMin,
		max: renderParams.renderMax,
	});

	const data = await renderWorkerClient.render(
		{
			renderGeneration: capturedRenderGeneration,
			values: workerValues,
			unitTransform: renderParams.unitTransform,
			lut,
			missingValue: MISSING_VALUE,
			renderMin: renderParams.renderMin,
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
			...projection,
		},
		[workerValues.buffer],
	);
	if (!data) return null;
	if (PERF_DEBUG) {
		perfStats.lastRenderMs = performance.now() - startedAt;
		updatePerfDiagnostics();
	}
	if (currentRenderGeneration !== capturedRenderGeneration) {
		data.bitmap?.close();
		return null;
	}
	return {
		bitmap: data.bitmap,
		dataMin: data.dataMin,
		dataMax: data.dataMax,
		mean: data.dataMean,
		count: data.dataCount,
	};
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

// ── Card builder ──────────────────────────────────────────────────────────────

function buildCard(document, message) {
	return renderUploadedMessageCard(document, message, {
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
	mapPresentation.clearStats();
}

// Populate and show the color scale legend bar.
function showColorScale(min, max, units, { isLog = false } = {}) {
	mapPresentation.showColorScale(min, max, units, { isLog });
}

function hideColorScale() {
	mapPresentation.hideColorScale();
}

function hideMapUnavailable() {
	mapPresentation.hideUnavailable();
}

function updateParamInfo(name, description, subtitle) {
	mapPresentation.updateParamInfo(name, description, subtitle);
}

function updateLevelInfo(varDef) {
	mapPresentation.updateLevelInfo(varDef);
}

function setForecastValidTime(label) {
	mapPresentation.setForecastValidTime(label);
}

function setColorScaleGradient(renderMin, range) {
	const stops = gradientStopsFor(currentPalette, {
		min: renderMin,
		max: renderMin + range,
	}).map(({ color, position }) => ({ color, position }));
	mapPresentation.setColorScaleGradient(stops);
}

function updateStats(min, max, mean, count, units) {
	mapPresentation.updateStats(min, max, mean, count, units);
}

function makeRenderParams(
	data,
	{ values = data.values, displayUnits = null, isFallback = false } = {},
) {
	const { product } = data;
	const shortName = product.shortName;
	return createRenderParams({
		data,
		values,
		staticScale: staticScaleFor(shortName),
		unitTransform: unitTransformFor(shortName),
		displayUnits: displayUnits ?? displayUnitsFor(shortName, product.units),
		logFloor: LOG_SCALE_FLOOR,
		isFallback,
	});
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
	setColorScaleGradient(entry.renderMin, entry.range);
}

// Create the MapLibre map once. fitBoundsArgs is optional [bounds, options].
async function initMap(fitBoundsArgs) {
	await mapRenderer.init(fitBoundsArgs);
}

function resetApp(targetHash = "") {
	uploadInspector.reset();
	forecastRun.resetModelState();
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
	const targetHash = resolveMapBackHash({
		hasModelState: forecastRun.hasModelState(),
	});
	if (!forecastRun.hasModelState()) {
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

	const defaultPalette = defaultPaletteFor(product.shortName);
	if (defaultPalette) {
		currentPalette = defaultPalette;
		setPaletteSelectValues(defaultPalette);
	}

	// Populate toolbar
	updateParamInfo(
		product.name,
		parameterDescriptionFor(product.shortName),
		fmtValidTime(msg.header, product),
	);
	updateLevelInfo({ level: fmtLevel(product), units: displayUnitsFor(product.shortName, product.units) });
	setForecastValidTime(fmtValidTime(msg.header, product));

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
	if (!gridState || forecastRun.hasModelState()) return;
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
	getCurrentPackageKey: forecastRun.getPackageKey,
	showView,
	showTab,
	setToolbarMode,
	showMapView,
	showDataStatusPanel: () => {
		dom.dataStatusPanel.hidden = false;
	},
	resetModelState: forecastRun.resetModelState,
	startDownload: forecastRun.startDownload,
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
	getModelState: forecastRun.getModelState,
	isBitmapCacheComplete: forecastRun.isBitmapCacheComplete,
	isAnimationCacheReadyForPlayback:
		forecastRun.isAnimationCacheReadyForPlayback,
	queueCurrentTooltipValueHydration:
		forecastRun.queueCurrentTooltipValueHydration,
	showHour: forecastRun.showHour,
});
forecastRun.setAnimationPlayer(animationPlayer);

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

async function onPaletteChange(e) {
	currentPalette = e.target.value;
	setPaletteSelectValues(currentPalette);
	if (!gridState) return;
	if (forecastRun.hasModelState()) {
		await forecastRun.refreshCurrentModelVisuals();
	} else {
		await rerenderUploadedGridView();
	}
}

async function onForecastVariableChange(e) {
	await forecastRun.handleVariableChange(e.target.value);
}

function onForecastSliderInput() {
	forecastRun.onForecastSliderInput();
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

function onStorageWarningClose() {
	storageWarningController.close();
}

function onStorageWarningToggle() {
	storageWarningController.toggle();
}

function onDocumentKeydown(e) {
	if (e.code !== "Space" || !forecastRun.hasModelState()) return;
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
		onStorageWarningClose,
		onStorageWarningToggle,
		onDocumentKeydown,
	},
});

storageWarningController.initialize();
updatePerfDiagnostics();
