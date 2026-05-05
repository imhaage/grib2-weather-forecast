//#region \0rolldown/runtime.js
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
//#endregion
//#region src/parameters.js
/**
* WMO GRIB2 parameter table — embedded subset of FM-92 code tables 4.1/4.2.
*
* Key format: "<discipline>:<parameterCategory>:<parameterNumber>"
* Derived from eccodes/definitions/grib2/tables/32/4.2.*.*.table
*
* Browser-compatible: no I/O, pure JS object literal.
*
* @type {Record<string, { name: string, shortName: string, units: string }>}
*/
const PARAMETERS = {
	"0:0:0": {
		shortName: "t",
		name: "Temperature",
		units: "K"
	},
	"0:0:1": {
		shortName: "tv",
		name: "Virtual temperature",
		units: "K"
	},
	"0:0:2": {
		shortName: "pt",
		name: "Potential temperature",
		units: "K"
	},
	"0:0:3": {
		shortName: "eqpt",
		name: "Equivalent potential temperature",
		units: "K"
	},
	"0:0:4": {
		shortName: "tmax",
		name: "Maximum temperature",
		units: "K"
	},
	"0:0:5": {
		shortName: "tmin",
		name: "Minimum temperature",
		units: "K"
	},
	"0:0:6": {
		shortName: "td",
		name: "Dewpoint temperature",
		units: "K"
	},
	"0:0:7": {
		shortName: "dptd",
		name: "Dewpoint depression",
		units: "K"
	},
	"0:0:10": {
		shortName: "slhf",
		name: "Latent heat net flux",
		units: "W m-2"
	},
	"0:0:11": {
		shortName: "sshf",
		name: "Sensible heat net flux",
		units: "W m-2"
	},
	"0:0:17": {
		shortName: "skt",
		name: "Skin temperature",
		units: "K"
	},
	"0:0:18": {
		shortName: "tsn",
		name: "Snow temperature (top of snow)",
		units: "K"
	},
	"0:0:21": {
		shortName: "atmp",
		name: "Apparent temperature",
		units: "K"
	},
	"0:0:27": {
		shortName: "twb",
		name: "Wet-bulb temperature",
		units: "K"
	},
	"0:0:32": {
		shortName: "wbpt",
		name: "Wet-bulb potential temperature",
		units: "K"
	},
	"0:1:0": {
		shortName: "q",
		name: "Specific humidity",
		units: "kg kg-1"
	},
	"0:1:1": {
		shortName: "r",
		name: "Relative humidity",
		units: "%"
	},
	"0:1:2": {
		shortName: "mixr",
		name: "Humidity mixing ratio",
		units: "kg kg-1"
	},
	"0:1:3": {
		shortName: "pwat",
		name: "Precipitable water",
		units: "kg m-2"
	},
	"0:1:4": {
		shortName: "vp",
		name: "Vapour pressure",
		units: "Pa"
	},
	"0:1:6": {
		shortName: "e",
		name: "Evaporation",
		units: "kg m-2"
	},
	"0:1:7": {
		shortName: "prate",
		name: "Precipitation rate",
		units: "kg m-2 s-1"
	},
	"0:1:8": {
		shortName: "tp",
		name: "Total precipitation",
		units: "kg m-2"
	},
	"0:1:9": {
		shortName: "lsp",
		name: "Large-scale precipitation",
		units: "kg m-2"
	},
	"0:1:10": {
		shortName: "cp",
		name: "Convective precipitation",
		units: "kg m-2"
	},
	"0:1:11": {
		shortName: "sd",
		name: "Snow depth",
		units: "m"
	},
	"0:1:12": {
		shortName: "sr",
		name: "Snowfall rate water equivalent",
		units: "kg m-2 s-1"
	},
	"0:1:13": {
		shortName: "swe",
		name: "Water equiv of accum snow depth",
		units: "kg m-2"
	},
	"0:1:51": {
		shortName: "tcw",
		name: "Total column water",
		units: "kg m-2"
	},
	"0:1:64": {
		shortName: "tcwv",
		name: "Total column integrated water vapour",
		units: "kg m-2"
	},
	"0:1:65": {
		shortName: "rrate",
		name: "Rain precipitation rate",
		units: "kg m-2 s-1"
	},
	"0:1:66": {
		shortName: "srate",
		name: "Snow precipitation rate",
		units: "kg m-2 s-1"
	},
	"0:1:69": {
		shortName: "tclw",
		name: "Total column integrated cloud water",
		units: "kg m-2"
	},
	"0:1:70": {
		shortName: "tciw",
		name: "Total column integrated cloud ice",
		units: "kg m-2"
	},
	"0:1:75": {
		shortName: "tgrp",
		name: "Graupel (snow pellets) precipitation",
		units: "kg m-2"
	},
	"0:1:83": {
		shortName: "clwc",
		name: "Specific cloud liquid water content",
		units: "kg kg-1"
	},
	"0:1:84": {
		shortName: "ciwc",
		name: "Specific cloud ice water content",
		units: "kg kg-1"
	},
	"0:1:85": {
		shortName: "crwc",
		name: "Specific rain water content",
		units: "kg kg-1"
	},
	"0:1:86": {
		shortName: "cswc",
		name: "Specific snow water content",
		units: "kg kg-1"
	},
	"0:2:0": {
		shortName: "wdir",
		name: "Wind direction (from which blowing)",
		units: "degree true"
	},
	"0:2:1": {
		shortName: "wspd",
		name: "Wind speed",
		units: "m s-1"
	},
	"0:2:2": {
		shortName: "u",
		name: "U-component of wind",
		units: "m s-1"
	},
	"0:2:3": {
		shortName: "v",
		name: "V-component of wind",
		units: "m s-1"
	},
	"0:2:4": {
		shortName: "strm",
		name: "Stream function",
		units: "m2 s-1"
	},
	"0:2:5": {
		shortName: "vpot",
		name: "Velocity potential",
		units: "m2 s-1"
	},
	"0:2:8": {
		shortName: "w",
		name: "Vertical velocity (pressure)",
		units: "Pa s-1"
	},
	"0:2:9": {
		shortName: "wz",
		name: "Vertical velocity (geometric)",
		units: "m s-1"
	},
	"0:2:10": {
		shortName: "absv",
		name: "Absolute vorticity",
		units: "s-1"
	},
	"0:2:11": {
		shortName: "absD",
		name: "Absolute divergence",
		units: "s-1"
	},
	"0:2:12": {
		shortName: "relv",
		name: "Relative vorticity",
		units: "s-1"
	},
	"0:2:13": {
		shortName: "d",
		name: "Relative divergence",
		units: "s-1"
	},
	"0:2:14": {
		shortName: "pvort",
		name: "Potential vorticity",
		units: "K m2 kg-1 s-1"
	},
	"0:2:15": {
		shortName: "dudz",
		name: "Vertical u-component shear",
		units: "s-1"
	},
	"0:2:16": {
		shortName: "dvdz",
		name: "Vertical v-component shear",
		units: "s-1"
	},
	"0:2:20": {
		shortName: "bdis",
		name: "Boundary layer dissipation",
		units: "W m-2"
	},
	"0:2:21": {
		shortName: "maxws",
		name: "Maximum wind speed",
		units: "m s-1"
	},
	"0:2:22": {
		shortName: "gust",
		name: "Wind speed (gust)",
		units: "m s-1"
	},
	"0:2:23": {
		shortName: "ugust",
		name: "U-component of wind (gust)",
		units: "m s-1"
	},
	"0:2:24": {
		shortName: "vgust",
		name: "V-component of wind (gust)",
		units: "m s-1"
	},
	"0:3:0": {
		shortName: "p",
		name: "Pressure",
		units: "Pa"
	},
	"0:3:1": {
		shortName: "msl",
		name: "Pressure reduced to MSL",
		units: "Pa"
	},
	"0:3:2": {
		shortName: "ptend",
		name: "Pressure tendency",
		units: "Pa s-1"
	},
	"0:3:4": {
		shortName: "z",
		name: "Geopotential",
		units: "m2 s-2"
	},
	"0:3:5": {
		shortName: "gh",
		name: "Geopotential height",
		units: "gpm"
	},
	"0:3:6": {
		shortName: "geomh",
		name: "Geometric height",
		units: "m"
	},
	"0:3:10": {
		shortName: "den",
		name: "Density",
		units: "kg m-3"
	},
	"0:3:12": {
		shortName: "thick",
		name: "Thickness",
		units: "m"
	},
	"0:3:18": {
		shortName: "blh",
		name: "Planetary boundary layer height",
		units: "m"
	},
	"0:3:25": {
		shortName: "lnsp",
		name: "Natural log of pressure",
		units: "Numeric"
	},
	"0:4:0": {
		shortName: "nswrs",
		name: "Net short-wave radiation flux (surface)",
		units: "W m-2"
	},
	"0:4:1": {
		shortName: "nswrt",
		name: "Net short-wave radiation flux (TOA)",
		units: "W m-2"
	},
	"0:4:7": {
		shortName: "dswrf",
		name: "Downward short-wave radiation flux",
		units: "W m-2"
	},
	"0:4:8": {
		shortName: "uswrf",
		name: "Upward short-wave radiation flux",
		units: "W m-2"
	},
	"0:4:9": {
		shortName: "ssr",
		name: "Net short-wave radiation flux",
		units: "W m-2"
	},
	"0:4:11": {
		shortName: "nsrscs",
		name: "Net short-wave radiation flux, clear sky",
		units: "W m-2"
	},
	"0:4:52": {
		shortName: "dsrfcs",
		name: "Downward short-wave radiation flux, clear sky",
		units: "W m-2"
	},
	"0:5:0": {
		shortName: "nlwrs",
		name: "Net long-wave radiation flux (surface)",
		units: "W m-2"
	},
	"0:5:1": {
		shortName: "nlwrt",
		name: "Net long-wave radiation flux (TOA)",
		units: "W m-2"
	},
	"0:5:3": {
		shortName: "dlwrf",
		name: "Downward long-wave radiation flux",
		units: "W m-2"
	},
	"0:5:4": {
		shortName: "ulwrf",
		name: "Upward long-wave radiation flux",
		units: "W m-2"
	},
	"0:5:5": {
		shortName: "lwrf",
		name: "Net long-wave radiation flux",
		units: "W m-2"
	},
	"0:5:6": {
		shortName: "nlwrcs",
		name: "Net long-wave radiation flux, clear sky",
		units: "W m-2"
	},
	"0:5:8": {
		shortName: "dlwrcs",
		name: "Downward long-wave radiation flux, clear sky",
		units: "W m-2"
	},
	"0:6:0": {
		shortName: "cice",
		name: "Cloud ice",
		units: "kg m-2"
	},
	"0:6:1": {
		shortName: "tcc",
		name: "Total cloud cover",
		units: "%"
	},
	"0:6:3": {
		shortName: "lcc",
		name: "Low cloud cover",
		units: "%"
	},
	"0:6:4": {
		shortName: "mcc",
		name: "Medium cloud cover",
		units: "%"
	},
	"0:6:5": {
		shortName: "hcc",
		name: "High cloud cover",
		units: "%"
	},
	"0:6:6": {
		shortName: "cw",
		name: "Cloud water",
		units: "kg m-2"
	},
	"0:6:11": {
		shortName: "cb",
		name: "Cloud base",
		units: "m"
	},
	"0:6:12": {
		shortName: "cto",
		name: "Cloud top",
		units: "m"
	},
	"0:6:18": {
		shortName: "tcolw",
		name: "Total column-integrated cloud water",
		units: "kg m-2"
	},
	"0:6:19": {
		shortName: "tcoli",
		name: "Total column-integrated cloud ice",
		units: "kg m-2"
	},
	"0:7:0": {
		shortName: "pli",
		name: "Parcel lifted index (to 500 hPa)",
		units: "K"
	},
	"0:7:1": {
		shortName: "bli",
		name: "Best lifted index (to 500 hPa)",
		units: "K"
	},
	"0:7:2": {
		shortName: "kx",
		name: "K index",
		units: "K"
	},
	"0:7:4": {
		shortName: "tt",
		name: "Total totals index",
		units: "K"
	},
	"0:7:6": {
		shortName: "cape",
		name: "Convective available potential energy",
		units: "J kg-1"
	},
	"0:7:7": {
		shortName: "cin",
		name: "Convective inhibition",
		units: "J kg-1"
	},
	"0:7:8": {
		shortName: "hlcy",
		name: "Storm relative helicity",
		units: "J kg-1"
	},
	"0:14:0": {
		shortName: "toz",
		name: "Total ozone",
		units: "DU"
	},
	"0:14:1": {
		shortName: "o3",
		name: "Ozone mixing ratio",
		units: "kg kg-1"
	},
	"0:14:2": {
		shortName: "tco3",
		name: "Total column integrated ozone",
		units: "DU"
	},
	"2:0:0": {
		shortName: "lsm",
		name: "Land cover (0=sea, 1=land)",
		units: "Proportion"
	},
	"2:0:2": {
		shortName: "stl",
		name: "Soil temperature",
		units: "K"
	},
	"2:0:3": {
		shortName: "soilw",
		name: "Soil moisture content",
		units: "kg m-2"
	},
	"2:0:9": {
		shortName: "swvl",
		name: "Volumetric soil moisture content",
		units: "Proportion"
	},
	"2:0:10": {
		shortName: "ghf",
		name: "Ground heat flux",
		units: "W m-2"
	},
	"2:0:25": {
		shortName: "vswvl",
		name: "Volumetric soil moisture",
		units: "m3 m-3"
	},
	"2:0:50": {
		shortName: "src",
		name: "Skin reservoir content",
		units: "kg m-2"
	},
	"2:3:18": {
		shortName: "soilt",
		name: "Soil temperature (multi-layer)",
		units: "K"
	},
	"2:3:19": {
		shortName: "soilm",
		name: "Soil moisture (multi-layer)",
		units: "kg m-3"
	},
	"2:3:20": {
		shortName: "csoilw",
		name: "Column-integrated soil moisture",
		units: "kg m-2"
	},
	"10:0:3": {
		shortName: "swh",
		name: "Significant height of wind waves",
		units: "m"
	},
	"10:0:5": {
		shortName: "mpww",
		name: "Mean period of wind waves",
		units: "s"
	}
};
/**
* Look up a GRIB2 parameter by discipline, category, and number.
*
* @param {number} discipline        - From Section 0 (0=Meteorological, 10=Oceanographic…)
* @param {number} parameterCategory - From Section 4, template offset +0
* @param {number} parameterNumber   - From Section 4, template offset +1
* @returns {{ name: string, shortName: string, units: string }}
*/
function lookupParameter(discipline, parameterCategory, parameterNumber) {
	return PARAMETERS[`${discipline}:${parameterCategory}:${parameterNumber}`] ?? {
		name: `Unknown (D${discipline} C${parameterCategory} N${parameterNumber})`,
		shortName: `par_d${discipline}_c${parameterCategory}_n${parameterNumber}`,
		units: "unknown"
	};
}
//#endregion
//#region src/byte-helpers.js
/** Sentinel value for missing / bitmap-masked grid points. */
const MISSING_VALUE = -1e100;
const u8 = (d, i) => d[i];
const u16 = (d, i) => d[i] << 8 | d[i + 1];
const u32 = (d, i) => (d[i] << 24 | d[i + 1] << 16 | d[i + 2] << 8 | d[i + 3]) >>> 0;
const sm16 = (d, i) => {
	const r = u16(d, i);
	return r & 32768 ? -(r & 32767) : r;
};
const f32be = (d, i) => new DataView(d.buffer, d.byteOffset + i, 4).getFloat32(0, false);
/**
* Read nBits bits from data starting at bitPos[0] (MSB first).
* bitPos is a single-element array used as a mutable reference.
*/
function readBits(data, bitPos, nBits) {
	let value = 0;
	for (let i = 0; i < nBits; i++) {
		const byteIdx = bitPos[0] >>> 3;
		const bitIdx = 7 - (bitPos[0] & 7);
		value = value << 1 | data[byteIdx] >> bitIdx & 1;
		bitPos[0]++;
	}
	return value >>> 0;
}
//#endregion
//#region src/templates/drt-constant.js
var drt_constant_exports = /* @__PURE__ */ __exportAll({
	decode: () => decode$5,
	parseParams: () => parseParams$5
});
function parseParams$5(_data, _t) {
	return {};
}
async function decode$5(_data, _dataStart, _dataLen, _s5, totalPoints, _bitmap) {
	return new Float64Array(totalPoints).fill(MISSING_VALUE);
}
//#endregion
//#region src/templates/drt-simple.js
var drt_simple_exports = /* @__PURE__ */ __exportAll({
	decode: () => decode$4,
	parseParams: () => parseParams$4
});
function parseParams$4(data, t) {
	if (t + 10 > data.length) return {};
	return {
		referenceValue: f32be(data, t),
		binaryScaleFactor: sm16(data, t + 4),
		decimalScaleFactor: sm16(data, t + 6),
		bitsPerValue: u8(data, t + 8)
	};
}
async function decode$4(data, dataStart, _dataLen, s5, totalPoints, bitmap) {
	const values = new Float64Array(totalPoints).fill(MISSING_VALUE);
	if (s5.bitsPerValue === 0) {
		for (let i = 0; i < totalPoints; i++) if (!bitmap || bitmap[i] !== 0) values[i] = s5.referenceValue;
		return values;
	}
	const R = s5.referenceValue;
	const bScale = Math.pow(2, s5.binaryScaleFactor);
	const dScale = Math.pow(10, -s5.decimalScaleFactor);
	const bitPos = [dataStart * 8];
	let valIdx = 0;
	for (let i = 0; i < totalPoints; i++) {
		if (bitmap && bitmap[i] === 0) continue;
		if (valIdx >= s5.numberOfPackedValues) break;
		values[i] = (R + readBits(data, bitPos, s5.bitsPerValue) * bScale) * dScale;
		valIdx++;
	}
	return values;
}
//#endregion
//#region src/templates/drt-complex.js
var drt_complex_exports = /* @__PURE__ */ __exportAll({
	decode: () => decode$3,
	parseParams: () => parseParams$3
});
function parseParams$3(data, t) {
	if (t + 36 > data.length) return {};
	const params = {
		referenceValue: f32be(data, t),
		binaryScaleFactor: sm16(data, t + 4),
		decimalScaleFactor: sm16(data, t + 6),
		bitsPerValue: u8(data, t + 8),
		missingValueManagement: u8(data, t + 11),
		numberOfGroups: u32(data, t + 20),
		groupWidthRef: u8(data, t + 24),
		nBitsGroupWidth: u8(data, t + 25),
		groupLengthRef: u32(data, t + 26),
		lengthIncrement: u8(data, t + 30),
		lastGroupLength: u32(data, t + 31),
		nBitsGroupLength: u8(data, t + 35),
		orderOfSpatialDiff: 0,
		nExtraDescriptorOctets: 0
	};
	if (t + 38 <= data.length) {
		params.orderOfSpatialDiff = u8(data, t + 36);
		params.nExtraDescriptorOctets = u8(data, t + 37);
	}
	return params;
}
async function decode$3(data, dataStart, _dataLen, s5, totalPoints, bitmap) {
	const values = new Float64Array(totalPoints).fill(MISSING_VALUE);
	const { referenceValue: R, binaryScaleFactor: E, decimalScaleFactor: D, bitsPerValue: bpv, missingValueManagement: missVal, numberOfGroups: NG, groupWidthRef: Wref, nBitsGroupWidth: nBitsW, groupLengthRef: Lref, lengthIncrement: deltaL, lastGroupLength, nBitsGroupLength: nBitsL, templateNumber, orderOfSpatialDiff: order, nExtraDescriptorOctets: ww } = s5;
	const bScale = Math.pow(2, E);
	const dScale = Math.pow(10, -D);
	const bitPos = [dataStart * 8];
	let ival1 = 0, ival2 = 0, gmin = 0;
	if (templateNumber === 3 && ww > 0) {
		const nBitsDesc = ww * 8;
		ival1 = readBits(data, bitPos, nBitsDesc);
		if (order === 2) ival2 = readBits(data, bitPos, nBitsDesc);
		const sign = readBits(data, bitPos, 1);
		const mag = readBits(data, bitPos, nBitsDesc - 1);
		gmin = sign ? -mag : mag;
	}
	const gref = new Int32Array(NG);
	for (let g = 0; g < NG; g++) gref[g] = readBits(data, bitPos, bpv);
	bitPos[0] = bitPos[0] + 7 & -8;
	const gwidth = new Uint8Array(NG);
	for (let g = 0; g < NG; g++) gwidth[g] = Wref + (nBitsW > 0 ? readBits(data, bitPos, nBitsW) : 0);
	bitPos[0] = bitPos[0] + 7 & -8;
	const glen = new Int32Array(NG);
	for (let g = 0; g < NG; g++) glen[g] = Lref + (nBitsL > 0 ? readBits(data, bitPos, nBitsL) : 0) * deltaL;
	if (NG > 0) glen[NG - 1] = lastGroupLength;
	bitPos[0] = bitPos[0] + 7 & -8;
	const N = s5.numberOfPackedValues;
	const ifld = new Int32Array(N);
	const ifldmiss = new Uint8Array(N);
	let n = 0;
	const bpvMsng1 = (1 << bpv) - 1;
	const bpvMsng2 = bpvMsng1 - 1;
	for (let g = 0; g < NG; g++) {
		const W = gwidth[g];
		const L = glen[g];
		for (let k = 0; k < L && n < N; k++, n++) if (W === 0) if (missVal >= 1 && gref[g] === bpvMsng1) ifldmiss[n] = 1;
		else if (missVal === 2 && gref[g] === bpvMsng2) ifldmiss[n] = 2;
		else ifld[n] = gref[g];
		else {
			const raw = readBits(data, bitPos, W);
			const msng1 = (1 << W) - 1;
			if (missVal >= 1 && raw === msng1) ifldmiss[n] = 1;
			else if (missVal === 2 && raw === msng1 - 1) ifldmiss[n] = 2;
			else ifld[n] = raw + gref[g];
		}
	}
	if (templateNumber === 3 && ww > 0) {
		const nonMiss = [];
		for (let i = 0; i < N; i++) if (ifldmiss[i] === 0) nonMiss.push(i);
		if (nonMiss.length > 0) ifld[nonMiss[0]] = ival1;
		if (order === 2 && nonMiss.length > 1) ifld[nonMiss[1]] = ival2;
		const start = order === 2 ? 2 : 1;
		for (let k = start; k < nonMiss.length; k++) {
			const i = nonMiss[k];
			if (order === 1) ifld[i] = ifld[i] + gmin + ifld[nonMiss[k - 1]];
			else ifld[i] = ifld[i] + gmin + 2 * ifld[nonMiss[k - 1]] - ifld[nonMiss[k - 2]];
		}
	}
	let valIdx = 0;
	for (let i = 0; i < totalPoints; i++) {
		if (bitmap && bitmap[i] === 0) continue;
		if (valIdx >= N) break;
		if (ifldmiss[valIdx] === 0) values[i] = (R + ifld[valIdx] * bScale) * dScale;
		valIdx++;
	}
	return values;
}
//#endregion
//#region src/wasm/jpeg2000-loader.js
/**
* Lazy loader for the OpenJPEG WASM module (@cornerstonejs/codec-openjpeg).
* Provides jp2DecodeBuffer() — decodes a raw J2C codestream to integer samples.
*
* openjpegwasm_decode.js is a CJS/UMD Emscripten build that uses require() and
* __dirname internally. Strategy:
*   - Node.js: load via createRequire() so the CJS context is available (require,
*     __dirname, module.exports). The file then sets up readBinary/readAsync and
*     finds the WASM relative to its own __dirname — no extra options needed.
*   - Browser: load via dynamic import() using the export default we added to the
*     file, and override locateFile so the WASM URL is resolved correctly (the
*     file sets scriptDirectory="" for ESM dynamic imports where currentScript is null).
*/
const _wasmUrl = new URL("./openjpegwasm_decode.wasm", import.meta.url);
let _modulePromise$1 = null;
async function loadJP2Module() {
	if (!_modulePromise$1) {
		let createJP2Module;
		const opts = {};
		if (typeof process !== "undefined" && process.versions?.node) {
			const { createRequire } = await import("node:module");
			createJP2Module = createRequire(import.meta.url)("./openjpegwasm_decode.cjs");
		} else {
			({default: createJP2Module} = await import("./openjpegwasm_decode.js"));
			opts.locateFile = (filename) => filename.endsWith(".wasm") ? _wasmUrl.href : filename;
		}
		_modulePromise$1 = createJP2Module(opts);
	}
	return _modulePromise$1;
}
/**
* Decode a raw JPEG 2000 J2C codestream into an array of integer samples.
*
* @param {Uint8Array} compressed - Raw J2C codestream bytes (Section 7 data)
* @returns {Promise<Int32Array>} decoded integer sample values
*/
async function jp2DecodeBuffer(compressed) {
	const decoder = new (await (loadJP2Module())).J2KDecoder();
	try {
		decoder.getEncodedBuffer(compressed.length).set(compressed);
		decoder.decode();
		const decodedBuffer = decoder.getDecodedBuffer();
		const { width, height, bitsPerSample } = decoder.getFrameInfo();
		const totalSamples = width * height;
		const result = new Int32Array(totalSamples);
		if (bitsPerSample <= 8) {
			const view = new Uint8Array(decodedBuffer);
			for (let i = 0; i < totalSamples; i++) result[i] = view[i];
		} else if (bitsPerSample <= 16) {
			const raw = new Uint8Array(decodedBuffer);
			const view = new Uint16Array(raw.buffer, raw.byteOffset, totalSamples);
			for (let i = 0; i < totalSamples; i++) result[i] = view[i];
		} else {
			const raw = new Uint8Array(decodedBuffer);
			const view = new Int32Array(raw.buffer, raw.byteOffset, totalSamples);
			for (let i = 0; i < totalSamples; i++) result[i] = view[i];
		}
		return result;
	} finally {
		decoder.delete();
	}
}
//#endregion
//#region src/templates/drt-jpeg2000.js
var drt_jpeg2000_exports = /* @__PURE__ */ __exportAll({
	decode: () => decode$2,
	parseParams: () => parseParams$2
});
function parseParams$2(data, t) {
	if (t + 10 > data.length) return {};
	return {
		referenceValue: f32be(data, t),
		binaryScaleFactor: sm16(data, t + 4),
		decimalScaleFactor: sm16(data, t + 6),
		bitsPerValue: u8(data, t + 8)
	};
}
async function decode$2(data, dataStart, dataLen, s5, totalPoints, bitmap) {
	const values = new Float64Array(totalPoints).fill(MISSING_VALUE);
	if (s5.bitsPerValue === 0) {
		for (let i = 0; i < totalPoints; i++) if (!bitmap || bitmap[i] !== 0) values[i] = s5.referenceValue;
		return values;
	}
	const decoded = await jp2DecodeBuffer(data.slice(dataStart, dataStart + dataLen));
	const R = s5.referenceValue;
	const bScale = Math.pow(2, s5.binaryScaleFactor);
	const dScale = Math.pow(10, -s5.decimalScaleFactor);
	let valIdx = 0;
	for (let i = 0; i < totalPoints; i++) {
		if (bitmap && bitmap[i] === 0) continue;
		if (valIdx >= decoded.length) break;
		values[i] = (R + decoded[valIdx] * bScale) * dScale;
		valIdx++;
	}
	return values;
}
let _modulePromise = null;
/**
* Load and initialise the WASM module. Safe to call multiple times —
* returns the same cached module.
*
* @param {string|URL} [wasmUrl] - Optional explicit URL to ccsds.wasm.
*   If omitted, the module tries to locate ccsds.wasm relative to this file.
* @returns {Promise<object>} Emscripten module instance.
*/
async function loadCCSDSModule(wasmUrl) {
	if (!_modulePromise) {
		const { default: createCCSDSModule } = await import("./ccsds.js");
		const opts = {};
		if (wasmUrl) opts.locateFile = (filename) => filename.endsWith(".wasm") ? wasmUrl.toString() : filename;
		_modulePromise = createCCSDSModule(opts);
	}
	return _modulePromise;
}
/**
* Decode a CCSDS-compressed data block into an array of unsigned integers.
*
* @param {Uint8Array}  compressed      - Raw compressed bytes (Section 7 data)
* @param {number}      nValues         - Number of values to decode
* @param {number}      bitsPerSample   - Bits per decoded sample (e.g. 16)
* @param {number}      blockSize       - AEC block size (e.g. 32)
* @param {number}      rsi             - Reference Sample Interval (e.g. 128)
* @param {number}      [flags]         - LibAEC flags (default: AEC_FLAGS_LE = 8)
* @returns {Promise<Uint8Array|Uint16Array|Uint32Array>} decoded integer samples
*/
async function ccsdsDecodeBuffer(compressed, nValues, bitsPerSample, blockSize, rsi, flags = 8) {
	const mod = await loadCCSDSModule();
	let bytesPerSample;
	if (bitsPerSample <= 8) bytesPerSample = 1;
	else if (bitsPerSample <= 16) bytesPerSample = 2;
	else bytesPerSample = 4;
	const inLen = compressed.length;
	const outLen = nValues * bytesPerSample;
	const inPtr = mod._ccsds_malloc(inLen);
	const outPtr = mod._ccsds_malloc(outLen);
	if (!inPtr || !outPtr) {
		if (inPtr) mod._ccsds_free(inPtr);
		if (outPtr) mod._ccsds_free(outPtr);
		throw new Error("CCSDS: WASM malloc failed");
	}
	try {
		mod.HEAPU8.set(compressed, inPtr);
		const rc = mod._ccsds_decode_buffer(inPtr, inLen, outPtr, outLen, bitsPerSample, blockSize, rsi, flags);
		if (rc !== 0) throw new Error(`CCSDS: aec_buffer_decode failed with code ${rc}`);
		let result;
		if (bytesPerSample === 1) result = new Uint8Array(mod.HEAPU8.buffer, outPtr, nValues).slice();
		else if (bytesPerSample === 2) {
			const raw = mod.HEAPU8.slice(outPtr, outPtr + outLen);
			result = new Uint16Array(raw.buffer);
		} else {
			const raw = mod.HEAPU8.slice(outPtr, outPtr + outLen);
			result = new Uint32Array(raw.buffer);
		}
		return result;
	} finally {
		mod._ccsds_free(inPtr);
		mod._ccsds_free(outPtr);
	}
}
//#endregion
//#region src/templates/drt-ccsds.js
var drt_ccsds_exports = /* @__PURE__ */ __exportAll({
	decode: () => decode$1,
	parseParams: () => parseParams$1
});
function parseParams$1(data, t) {
	if (t + 10 > data.length) return {};
	const result = {
		referenceValue: f32be(data, t),
		binaryScaleFactor: sm16(data, t + 4),
		decimalScaleFactor: sm16(data, t + 6),
		bitsPerValue: u8(data, t + 8),
		ccsdsFlags: 8,
		ccsdsBlockSize: 32,
		ccsdsRsi: 128
	};
	if (t + 14 <= data.length) {
		result.ccsdsFlags = u8(data, t + 10) & -7;
		result.ccsdsBlockSize = u8(data, t + 11);
		result.ccsdsRsi = u16(data, t + 12);
	}
	return result;
}
async function decode$1(data, dataStart, dataLen, s5, totalPoints, bitmap) {
	const values = new Float64Array(totalPoints).fill(MISSING_VALUE);
	if (s5.bitsPerValue === 0) {
		for (let i = 0; i < totalPoints; i++) if (!bitmap || bitmap[i] !== 0) values[i] = s5.referenceValue;
		return values;
	}
	const decoded = await ccsdsDecodeBuffer(data.slice(dataStart, dataStart + dataLen), s5.numberOfPackedValues, s5.bitsPerValue, s5.ccsdsBlockSize, s5.ccsdsRsi, s5.ccsdsFlags);
	const R = s5.referenceValue;
	const bScale = Math.pow(2, s5.binaryScaleFactor);
	const dScale = Math.pow(10, -s5.decimalScaleFactor);
	let valIdx = 0;
	for (let i = 0; i < totalPoints; i++) {
		if (bitmap && bitmap[i] === 0) continue;
		if (valIdx >= s5.numberOfPackedValues) break;
		values[i] = (R + decoded[valIdx] * bScale) * dScale;
		valIdx++;
	}
	return values;
}
//#endregion
//#region src/templates/drt-ieee754.js
var drt_ieee754_exports = /* @__PURE__ */ __exportAll({
	decode: () => decode,
	parseParams: () => parseParams
});
function parseParams(_data, _t) {
	return {};
}
async function decode(data, dataStart, _dataLen, s5, totalPoints, _bitmap) {
	const values = new Float64Array(totalPoints).fill(MISSING_VALUE);
	const view = new DataView(data.buffer, data.byteOffset);
	for (let i = 0; i < s5.numberOfPackedValues; i++) {
		const offset = dataStart + i * 4;
		if (offset + 4 <= data.length) values[i] = view.getFloat32(offset, false);
	}
	return values;
}
//#endregion
//#region src/templates/registry.js
const TEMPLATES = {
	0: drt_simple_exports,
	2: drt_complex_exports,
	3: drt_complex_exports,
	40: drt_jpeg2000_exports,
	42: drt_ccsds_exports,
	254: drt_ieee754_exports,
	255: drt_constant_exports
};
function getTemplate(n) {
	const t = TEMPLATES[n];
	if (!t) throw new Error(`Unsupported Data Representation Template: ${n}`);
	return t;
}
//#endregion
//#region src/decoder.js
/**
* GRIB2 Decoder — browser-compatible pure JavaScript implementation.
*
* Based on the WMO FM-92 GRIB Edition 2 specification and the eccodes C source.
*
* Supported data representation templates:
*   0   – Simple packing
*   40  – Constant field (all values equal)
*   42  – CCSDS lossless compression (Golomb-Rice via libaec WASM)
*   254 – Grid IEEE 754 (32-bit floats, big-endian)
*   255 – All values missing
*
* GRIB2 message structure (per WMO FM-92):
*   Section 0  (16 bytes) : "GRIB" + reserved + discipline + edition + 8-byte length
*   Section 1  (variable) : Identification (centre, time, discipline …)
*   Section 2  (optional) : Local Use
*   Section 3  (variable) : Grid Definition Template
*   Section 4  (variable) : Product Definition Template
*   Section 5  (variable) : Data Representation Template (packing parameters)
*   Section 6  (variable) : Bitmap (1 bit per grid point, or absent)
*   Section 7  (variable) : Packed / compressed data values
*   Section 8  (4 bytes)  : "7777" end marker
*
* Each section 1–7 header:
*   [0-3] 4 bytes — total section length in octets (including this header)
*   [4]   1 byte  — section number (1–7)
*   [5…]          — section-specific content
*/
const i32 = (d, i) => {
	const v = u32(d, i);
	return v >= 2147483648 ? v - 4294967296 : v;
};
/**
* Parse Section 0 and walk Sections 1–7, returning their byte boundaries.
*
* Section 0 layout (16 bytes):
*   [0-3]  = "GRIB"
*   [4-5]  = Reserved (ignore; Météo-France writes 0xFF 0xFF)
*   [6]    = Discipline
*   [7]    = Edition (must be 2)
*   [8-15] = Total message length (8 bytes big-endian)
*
* Section 1–7 header (5 bytes):
*   [0-3]  = Total section length (4 bytes big-endian)
*   [4]    = Section number
*/
function walkSections(data) {
	if (data.length < 16) throw new Error("Buffer too short for GRIB2 Section 0");
	if (String.fromCharCode(data[0], data[1], data[2], data[3]) !== "GRIB") throw new Error("Invalid GRIB signature");
	const edition = data[7];
	if (edition !== 2) throw new Error(`Expected GRIB edition 2, got ${edition}`);
	const discipline = data[6];
	const msgLenHi = u32(data, 8);
	const msgLenLo = u32(data, 12);
	const messageLength = msgLenHi * 4294967296 + msgLenLo;
	const sections = {};
	let offset = 16;
	while (offset + 5 <= data.length) {
		const secLen = u32(data, offset);
		const secNum = data[offset + 4];
		if (secLen < 5) throw new Error(`Invalid section length ${secLen} at offset ${offset}`);
		sections[secNum] = {
			number: secNum,
			offset,
			secLen,
			dataStart: offset + 5
		};
		if (secNum === 7) break;
		offset += secLen;
	}
	return {
		edition,
		discipline,
		messageLength,
		sections
	};
}
/**
* Parse Section 1 (Identification Section).
*
* Data layout (0-indexed from dataStart, i.e. after the 5-byte section header):
*   [0-1]  Centre (Uint16 BE) — WMO code table 0.1 (85 = Météo-France)
*   [2-3]  Sub-centre (Uint16 BE)
*   [4]    Master tables version number
*   [5]    Local tables version number
*   [6]    Significance of reference time (code table 1.2)
*   [7-8]  Year (Uint16 BE)
*   [9]    Month
*   [10]   Day
*   [11]   Hour
*   [12]   Minute
*   [13]   Second
*   [14]   Production status (code table 1.3)
*   [15]   Type of processed data (code table 1.4)
*/
function parseSection1(data, dataStart) {
	if (dataStart + 16 > data.length) return {};
	const d = dataStart;
	return {
		centre: u16(data, d),
		subCentre: u16(data, d + 2),
		masterTablesVersion: u8(data, d + 4),
		localTablesVersion: u8(data, d + 5),
		referenceTimeSignificance: u8(data, d + 6),
		year: u16(data, d + 7),
		month: u8(data, d + 9),
		day: u8(data, d + 10),
		hour: u8(data, d + 11),
		minute: u8(data, d + 12),
		second: u8(data, d + 13),
		productionStatus: u8(data, d + 14),
		typeOfData: u8(data, d + 15)
	};
}
/**
* Parse Section 3, Template 3.0 (Latitude/Longitude grid).
*
* Generic Section 3 header (9 bytes from dataStart):
*   [0]    Source of grid definition (0 = WMO table 3.0)
*   [1-4]  Number of data points (Ni × Nj, Uint32 BE)
*   [5]    Number of octets for optional list
*   [6]    Interpretation of optional list
*   [7-8]  Grid Definition Template Number (Uint16 BE)
*
* Template 3.0 data (from dataStart + 9):
*   [0]    Shape of Earth (code table 3.2)
*   [1]    Scale factor of radius of spherical Earth
*   [2-5]  Scaled value of radius
*   [6]    Scale factor of Earth major axis
*   [7-10] Scaled value of major axis
*   [11]   Scale factor of Earth minor axis
*   [12-15]Scaled value of minor axis
*   [16-19] Ni (Uint32 BE)
*   [20-23] Nj (Uint32 BE)
*   [24-27] Basic angle (Uint32 BE; 0 → unit = 10^-6 degrees)
*   [28-31] Subdivisions of basic angle
*   [32-35] La1: latitude of first point (Int32 BE, 10^-6 degrees)
*   [36-39] Lo1: longitude of first point (Int32 BE, 10^-6 degrees, 0..360×10^6)
*   [40]    Resolution and component flags
*   [41-44] La2: latitude of last point (Int32 BE)
*   [45-48] Lo2: longitude of last point (Int32 BE)
*   [49-52] Di: i-direction increment (Uint32 BE, 10^-6 degrees)
*   [53-56] Dj: j-direction increment (Uint32 BE, 10^-6 degrees)
*   [57]    Scanning mode flags
*/
function parseSection3(data, dataStart) {
	const result = {
		templateNumber: 0,
		totalPoints: 0,
		ni: 0,
		nj: 0,
		latitudeOfFirstPoint: 0,
		longitudeOfFirstPoint: 0,
		latitudeOfLastPoint: 0,
		longitudeOfLastPoint: 0,
		di: 0,
		dj: 0,
		scanningMode: 0
	};
	const d = dataStart;
	if (d + 9 > data.length) return result;
	result.templateNumber = u16(data, d + 7);
	result.totalPoints = u32(data, d + 1);
	if (result.templateNumber !== 0) return result;
	const t = d + 9;
	if (t + 58 > data.length) return result;
	result.ni = u32(data, t + 16);
	result.nj = u32(data, t + 20);
	if (result.totalPoints === 0) result.totalPoints = result.ni * result.nj;
	const lo1raw = i32(data, t + 36);
	const lo2raw = i32(data, t + 45);
	result.latitudeOfFirstPoint = i32(data, t + 32) / 1e6;
	result.longitudeOfFirstPoint = lo1raw > 18e7 ? (lo1raw - 36e7) / 1e6 : lo1raw / 1e6;
	result.latitudeOfLastPoint = i32(data, t + 41) / 1e6;
	result.longitudeOfLastPoint = lo2raw > 18e7 ? (lo2raw - 36e7) / 1e6 : lo2raw / 1e6;
	result.di = u32(data, t + 49) / 1e6;
	result.dj = u32(data, t + 53) / 1e6;
	result.scanningMode = u8(data, t + 57);
	return result;
}
/**
* Parse Section 4 (Product Definition Section).
*
* Generic Section 4 header (4 bytes from dataStart):
*   [0-1]  Number of coordinate values after template (Uint16 BE)
*   [2-3]  Product Definition Template Number (Uint16 BE) — code table 4.0
*
* Template 4.0 and 4.8 share the same first 19 octets of template data
* (starting at dataStart + 4):
*   [0]    parameterCategory
*   [1]    parameterNumber
*   [2]    typeOfGeneratingProcess
*   [3]    backgroundGeneratingProcessIdentifier
*   [4]    analysisOrForecastGeneratingProcessIdentifier
*   [5-6]  hoursAfterDataCutoff (Uint16 BE)
*   [7]    minutesAfterDataCutoff
*   [8]    indicatorOfUnitOfTimeRange (code table 4.4)
*   [9-12] forecastTime (Uint32 BE; units per byte [8])
*   [13]   typeOfFirstFixedSurface (code table 4.5)
*   [14]   scaleFactorOfFirstFixedSurface
*   [15-18] scaledValueOfFirstFixedSurface (Uint32 BE)
*
* @param {Uint8Array} data
* @param {number} dataStart - byte offset of the first post-header byte
* @param {number} discipline - discipline byte from Section 0
* @returns {{
*   pdtNumber:               number,
*   parameterCategory:       number,
*   parameterNumber:         number,
*   typeOfGeneratingProcess: number,
*   timeUnit:                number,
*   forecastTime:            number,
*   typeOfFirstFixedSurface: number,
*   levelScaleFactor:        number,
*   levelScaledValue:        number,
*   levelValue:              number,
*   name:                    string,
*   shortName:               string,
*   units:                   string,
* }}
*/
function parseSection4(data, dataStart, discipline) {
	const result = {
		pdtNumber: 0,
		parameterCategory: 255,
		parameterNumber: 255,
		typeOfGeneratingProcess: 255,
		timeUnit: 255,
		forecastTime: 0,
		typeOfFirstFixedSurface: 255,
		levelScaleFactor: 0,
		levelScaledValue: 0,
		levelValue: 0,
		name: "Unknown",
		shortName: "unknown",
		units: "unknown"
	};
	if (dataStart + 4 > data.length) return result;
	const d = dataStart;
	result.pdtNumber = u16(data, d + 2);
	const t = d + 4;
	if (t + 19 > data.length) return result;
	result.parameterCategory = u8(data, t);
	result.parameterNumber = u8(data, t + 1);
	result.typeOfGeneratingProcess = u8(data, t + 2);
	result.timeUnit = u8(data, t + 8);
	result.forecastTime = u32(data, t + 9);
	result.typeOfFirstFixedSurface = u8(data, t + 13);
	result.levelScaleFactor = u8(data, t + 14);
	result.levelScaledValue = u32(data, t + 15);
	result.levelValue = result.levelScaleFactor === 0 || result.levelScaleFactor === 255 ? result.levelScaledValue : result.levelScaledValue * Math.pow(10, -result.levelScaleFactor);
	const param = lookupParameter(discipline, result.parameterCategory, result.parameterNumber);
	result.name = param.name;
	result.shortName = param.shortName;
	result.units = param.units;
	return result;
}
/**
* Parse Section 5.
*
* Generic header (6 bytes from dataStart):
*   [0-3]  Number of packed values (Uint32 BE)
*   [4-5]  Data Representation Template Number (Uint16 BE)
*
* Template 5.0 — Simple Packing (from dataStart + 6):
*   [0-3]  Reference value R (IEEE 754 float32 big-endian)
*   [4-5]  Binary scale factor E  (sign-magnitude Int16 BE)
*   [6-7]  Decimal scale factor D (sign-magnitude Int16 BE)
*   [8]    Number of bits per value
*   [9]    Type of original field values
*
* Template 5.40 — JPEG 2000 (not implemented)
*
* Template 5.42 — CCSDS lossless compression (from dataStart + 6):
*   [0-3]  Reference value R (IEEE 754 float32 big-endian)
*   [4-5]  Binary scale factor E  (sign-magnitude Int16 BE)
*   [6-7]  Decimal scale factor D (sign-magnitude Int16 BE)
*   [8]    Number of bits per value
*   [9]    Type of original field values
*   [10]   CCSDS compression options mask (= LibAEC flags bitmask)
*   [11]   CCSDS block size
*   [12-13]CCSDS Reference Sample Interval (Uint16 BE)
*/
function parseSection5(data, dataStart) {
	const d = dataStart;
	if (d + 6 > data.length) return {
		templateNumber: 0,
		numberOfPackedValues: 0
	};
	const numberOfPackedValues = u32(data, d);
	const templateNumber = u16(data, d + 4);
	const t = d + 6;
	let tmplParams = {};
	try {
		tmplParams = getTemplate(templateNumber).parseParams(data, t);
	} catch {}
	return {
		templateNumber,
		numberOfPackedValues,
		...tmplParams
	};
}
/**
* Parse Section 6 (Bitmap Section).
*
* Data layout (from dataStart):
*   [0]   Bitmap indicator (code table 6.0)
*           255 = no bitmap (all values present)
*           0   = bitmap present
*   [1…]  Bitmap bytes (one bit per grid point, MSB first)
*/
function parseSection6(data, dataStart, totalPoints) {
	if (dataStart >= data.length) return {
		hasBitmap: false,
		bitmap: null
	};
	if (u8(data, dataStart) === 255) return {
		hasBitmap: false,
		bitmap: null
	};
	const bitmap = new Uint8Array(totalPoints);
	for (let i = 0; i < totalPoints; i++) {
		const byteIdx = dataStart + 1 + (i >>> 3);
		const bitIdx = 7 - (i & 7);
		if (byteIdx < data.length) bitmap[i] = data[byteIdx] >> bitIdx & 1;
	}
	return {
		hasBitmap: true,
		bitmap
	};
}
const MISSING_PRODUCT = {
	shortName: "unknown",
	name: "Unknown",
	units: "unknown",
	pdtNumber: 255,
	parameterCategory: 255,
	parameterNumber: 255
};
/**
* Parse Sections 1, 3 and 4 from an already-walked GRIB2 message.
* Centralises the repeated ternary pattern used by decodeGRIB2,
* parseGRIB2Header and iterateGRIB2Messages.
*/
function parseHeaderSections(data, walked) {
	const { sections: secs, discipline } = walked;
	return {
		s1: secs[1] ? parseSection1(data, secs[1].dataStart) : {},
		s3: secs[3] ? parseSection3(data, secs[3].dataStart) : {},
		s4: secs[4] ? parseSection4(data, secs[4].dataStart, discipline) : { ...MISSING_PRODUCT }
	};
}
/**
* Decode a GRIB2 message.
*
* @param {ArrayBuffer|Buffer} buffer - Raw GRIB2 message bytes
* @returns {Promise<{ header, product, grid, values, bitmap }>}
*   header  : parsed Section 1 fields
*   product : parsed Section 4 fields (parameterCategory, parameterNumber,
*             name, shortName, units, levelValue, forecastTime…)
*   grid    : parsed Section 3 fields (Ni, Nj, lat/lon bounds, …)
*   values  : Float64Array of physical values (length = totalPoints,
*             missing values = -1e100)
*   bitmap  : Uint8Array | null (1 = valid value, 0 = missing)
*/
async function decodeGRIB2(buffer) {
	const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
	const walked = walkSections(data);
	const secs = walked.sections;
	const { s1, s3, s4 } = parseHeaderSections(data, walked);
	if (!secs[5]) throw new Error("Section 5 (Data Representation) not found");
	const s5 = parseSection5(data, secs[5].dataStart);
	const totalPoints = s3.totalPoints || s5.numberOfPackedValues;
	const bitmap = (secs[6] ? parseSection6(data, secs[6].dataStart, totalPoints) : {
		hasBitmap: false,
		bitmap: null
	}).bitmap;
	if (!secs[7]) throw new Error("Section 7 (Data) not found");
	const dataStart = secs[7].dataStart;
	const dataLen = secs[7].secLen - 5;
	const values = await getTemplate(s5.templateNumber).decode(data, dataStart, dataLen, s5, totalPoints, bitmap);
	return {
		header: {
			...s1,
			discipline: walked.discipline,
			messageLength: walked.messageLength
		},
		product: s4,
		grid: s3,
		values,
		bitmap
	};
}
/**
* Parse only Section 0/1/3/4 (fast path — no data decoding).
*
* @param {ArrayBuffer|Buffer} buffer
* @returns {{ header, product, grid, dataOffset, dataLength, messageLength }}
*/
function parseGRIB2Header(buffer) {
	const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
	const walked = walkSections(data);
	const { s1, s3, s4 } = parseHeaderSections(data, walked);
	const s7 = walked.sections[7];
	return {
		header: {
			...s1,
			discipline: walked.discipline,
			messageLength: walked.messageLength
		},
		product: s4,
		grid: s3,
		dataOffset: s7 ? s7.dataStart : 0,
		dataLength: s7 ? s7.secLen - 5 : 0
	};
}
/**
* Iterate over all GRIB2 messages in a concatenated GRIB2 file.
*
* A GRIB2 file may contain multiple independent messages concatenated end-to-end.
* Each message starts with the 4-byte "GRIB" signature and encodes its total
* length as an 8-byte big-endian integer at bytes 8-15.
*
* This generator is synchronous and lightweight — it parses Section 0/1/3/4
* headers only (no data decoding). Pass the yielded `buffer` to `decodeGRIB2()`
* when you need the actual values for a specific message.
*
* @param {ArrayBuffer|Uint8Array} buffer - Raw bytes of the concatenated file
* @yields {{
*   index:   number,     - Zero-based message index
*   buffer:  Uint8Array, - Self-contained copy of this message (byteOffset = 0)
*   header:  object,     - Section 1 identification fields + discipline
*   product: object,     - Section 4 product fields (shortName, name, units…)
*   grid:    object,     - Section 3 grid definition fields
* }}
*/
function* iterateGRIB2Messages(buffer) {
	const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
	let offset = 0;
	let index = 0;
	while (offset + 16 <= data.length) {
		if (data[offset] !== 71 || data[offset + 1] !== 82 || data[offset + 2] !== 73 || data[offset + 3] !== 66) break;
		const msgLenHi = u32(data, offset + 8);
		const msgLenLo = u32(data, offset + 12);
		const msgLen = msgLenHi * 4294967296 + msgLenLo;
		if (msgLen < 16 || offset + msgLen > data.length) break;
		const msgData = data.slice(offset, offset + msgLen);
		const walked = walkSections(msgData);
		const { s1, s3, s4 } = parseHeaderSections(msgData, walked);
		yield {
			index,
			buffer: msgData,
			header: {
				...s1,
				discipline: walked.discipline,
				messageLength: walked.messageLength
			},
			product: s4,
			grid: s3
		};
		offset += msgLen;
		index++;
	}
}
//#endregion
//#region src/stats.js
/**
* Grid statistics helpers — browser and Node.js compatible.
*/
/**
* Compute statistics over a decoded values array.
*
* @param {Float64Array} values - Physical values as returned by decodeGRIB2().
*   Missing grid points are encoded as MISSING_VALUE (-1e100).
* @returns {{ min: number, max: number, mean: number, stddev: number, count: number }}
*/
function computeStats(values) {
	let min = Infinity, max = -Infinity, sum = 0, sum2 = 0, count = 0;
	for (const v of values) if (v > -1e100) {
		if (v < min) min = v;
		if (v > max) max = v;
		sum += v;
		sum2 += v * v;
		count++;
	}
	const mean = count ? sum / count : NaN;
	const stddev = count ? Math.sqrt(sum2 / count - mean * mean) : NaN;
	return {
		min,
		max,
		mean,
		stddev,
		count
	};
}
//#endregion
//#region src/wmo-tables.js
/**
* WMO FM-92 GRIB2 code tables — browser and Node.js compatible.
*/
const CENTRES = {
	7: "NCEP",
	54: "Canadian Met Centre",
	74: "Met Office (UK)",
	84: "Toulouse",
	85: "Météo-France",
	96: "ECMWF",
	98: "ECMWF",
	255: "Missing"
};
const DISCIPLINES = {
	0: "Meteorological",
	1: "Hydrological",
	2: "Land surface",
	3: "Space",
	4: "Space weather",
	10: "Oceanographic"
};
const REF_TIME_SIGNIFICANCE = {
	0: "Analysis",
	1: "Start of forecast",
	2: "Verifying time of forecast",
	3: "Observation time"
};
const TYPE_OF_DATA = {
	0: "Analysis",
	1: "Forecast",
	2: "Analysis and forecast",
	3: "Control forecast",
	4: "Perturbed forecast",
	5: "Control and perturbed forecast",
	6: "Processed satellite observations",
	7: "Processed radar observations",
	192: "Experimental products"
};
const TYPE_OF_LEVEL = {
	1: "Ground surface",
	2: "Cloud base",
	3: "Cloud top",
	6: "Maximum wind",
	7: "Tropopause",
	8: "Top of atmosphere",
	10: "Sea surface",
	100: "Isobaric surface (Pa)",
	101: "Mean sea level",
	102: "Specific altitude above MSL (m)",
	103: "Specific height above ground (m)",
	104: "Sigma level",
	105: "Hybrid level",
	106: "Depth below land surface (m)",
	107: "Isentropic level (K)",
	108: "Pressure difference from ground (Pa)",
	200: "Entire atmosphere",
	204: "Highest tropospheric freezing level"
};
const TIME_UNIT = {
	0: "min",
	1: "h",
	2: "d",
	10: "3h",
	11: "6h",
	12: "12h",
	13: "s"
};
const TIME_UNIT_SECONDS = {
	0: 60,
	1: 3600,
	2: 86400,
	10: 10800,
	11: 21600,
	12: 43200,
	13: 1
};
const GENERATING_PROCESS = {
	0: "Analysis",
	1: "Initialization",
	2: "Forecast",
	3: "Bias-corrected forecast",
	4: "Ensemble forecast"
};
const DATA_REPR_TEMPLATES = {
	0: "Simple packing",
	2: "Complex packing",
	3: "Complex packing with spatial differencing",
	40: "JPEG 2000 code stream format",
	41: "PNG code stream",
	42: "CCSDS recommended lossless compression",
	254: "Grid point data – IEEE 754 floats",
	255: "All values missing"
};
const SCAN_MODE_BITS = {
	128: "i scans negatively (E→W)",
	64: "j scans positively (S→N)",
	32: "adjacent points in j direction",
	16: "rows scan alternately (boustrophedon)"
};
const _pad = (n) => String(n).padStart(2, "0");
function _fmtUTC(d) {
	return `${d.toLocaleString("en-US", {
		month: "short",
		timeZone: "UTC"
	})} ${d.getUTCDate()}, ${d.getUTCFullYear()} ${_pad(d.getUTCHours())}:${_pad(d.getUTCMinutes())} UTC`;
}
/**
* Format the reference datetime from a Section 1 header object.
* Returns a human-readable US date string (e.g. "Apr 25, 2026 03:00 UTC").
*/
function fmtRefTime(h) {
	return _fmtUTC(new Date(Date.UTC(h.year, h.month - 1, h.day, h.hour, h.minute, h.second ?? 0)));
}
/**
* Format the level description from a product object.
*/
function fmtLevel(p) {
	if (p.typeOfFirstFixedSurface === 103) return `${p.levelValue} m above ground`;
	if (p.typeOfFirstFixedSurface === 100) return `${p.levelValue} Pa`;
	if (p.typeOfFirstFixedSurface === 1) return "Ground surface";
	if (p.typeOfFirstFixedSurface === 10) return "Sea surface";
	return `${TYPE_OF_LEVEL[p.typeOfFirstFixedSurface] ?? `type ${p.typeOfFirstFixedSurface}`}${p.levelValue ? " · " + p.levelValue : ""}`;
}
/**
* Compute and format the valid time (reference time + forecast offset).
* Returns a human-readable US date string (e.g. "Apr 25, 2026 04:00 UTC").
*/
function fmtValidTime(header, product) {
	const refMs = Date.UTC(header.year, header.month - 1, header.day, header.hour, header.minute, header.second ?? 0);
	const secs = (TIME_UNIT_SECONDS[product.timeUnit] ?? 3600) * product.forecastTime;
	return _fmtUTC(new Date(refMs + secs * 1e3));
}
/**
* Format the scanning mode byte as a human-readable string.
*/
function fmtScanMode(mode) {
	if (mode === 0) return "0 (i W→E, j N→S, rows left-to-right)";
	const flags = Object.entries(SCAN_MODE_BITS).filter(([bit]) => mode & Number(bit)).map(([, desc]) => desc);
	return `0x${mode.toString(16).padStart(2, "0")} (${flags.join("; ") || "default"})`;
}
//#endregion
export { CENTRES, DATA_REPR_TEMPLATES, DISCIPLINES, GENERATING_PROCESS, MISSING_VALUE, PARAMETERS, REF_TIME_SIGNIFICANCE, SCAN_MODE_BITS, TIME_UNIT, TYPE_OF_DATA, TYPE_OF_LEVEL, computeStats, decodeGRIB2, fmtLevel, fmtRefTime, fmtScanMode, fmtValidTime, iterateGRIB2Messages, lookupParameter, parseGRIB2Header, parseSection1, parseSection3, parseSection4, parseSection5, parseSection6, walkSections };

//# sourceMappingURL=grib2-decoder.js.map