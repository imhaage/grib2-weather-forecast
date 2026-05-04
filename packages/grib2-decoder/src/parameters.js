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
    // ── Discipline 0: Meteorological ────────────────────────────────────────────

    // Category 0: Temperature
    '0:0:0':  { shortName: 't',      name: 'Temperature',                           units: 'K'           },
    '0:0:1':  { shortName: 'tv',     name: 'Virtual temperature',                   units: 'K'           },
    '0:0:2':  { shortName: 'pt',     name: 'Potential temperature',                 units: 'K'           },
    '0:0:3':  { shortName: 'eqpt',   name: 'Equivalent potential temperature',      units: 'K'           },
    '0:0:4':  { shortName: 'tmax',   name: 'Maximum temperature',                   units: 'K'           },
    '0:0:5':  { shortName: 'tmin',   name: 'Minimum temperature',                   units: 'K'           },
    '0:0:6':  { shortName: 'td',     name: 'Dewpoint temperature',                  units: 'K'           },
    '0:0:7':  { shortName: 'dptd',   name: 'Dewpoint depression',                   units: 'K'           },
    '0:0:10': { shortName: 'slhf',   name: 'Latent heat net flux',                  units: 'W m-2'       },
    '0:0:11': { shortName: 'sshf',   name: 'Sensible heat net flux',                units: 'W m-2'       },
    '0:0:17': { shortName: 'skt',    name: 'Skin temperature',                      units: 'K'           },
    '0:0:18': { shortName: 'tsn',    name: 'Snow temperature (top of snow)',        units: 'K'           },
    '0:0:21': { shortName: 'atmp',   name: 'Apparent temperature',                  units: 'K'           },
    '0:0:27': { shortName: 'twb',    name: 'Wet-bulb temperature',                  units: 'K'           },
    '0:0:32': { shortName: 'wbpt',   name: 'Wet-bulb potential temperature',        units: 'K'           },

    // Category 1: Moisture
    '0:1:0':  { shortName: 'q',      name: 'Specific humidity',                     units: 'kg kg-1'     },
    '0:1:1':  { shortName: 'r',      name: 'Relative humidity',                     units: '%'           },
    '0:1:2':  { shortName: 'mixr',   name: 'Humidity mixing ratio',                 units: 'kg kg-1'     },
    '0:1:3':  { shortName: 'pwat',   name: 'Precipitable water',                    units: 'kg m-2'      },
    '0:1:4':  { shortName: 'vp',     name: 'Vapour pressure',                       units: 'Pa'          },
    '0:1:6':  { shortName: 'e',      name: 'Evaporation',                           units: 'kg m-2'      },
    '0:1:7':  { shortName: 'prate',  name: 'Precipitation rate',                    units: 'kg m-2 s-1'  },
    '0:1:8':  { shortName: 'tp',     name: 'Total precipitation',                   units: 'kg m-2'      },
    '0:1:9':  { shortName: 'lsp',    name: 'Large-scale precipitation',             units: 'kg m-2'      },
    '0:1:10': { shortName: 'cp',     name: 'Convective precipitation',              units: 'kg m-2'      },
    '0:1:11': { shortName: 'sd',     name: 'Snow depth',                            units: 'm'           },
    '0:1:12': { shortName: 'sr',     name: 'Snowfall rate water equivalent',        units: 'kg m-2 s-1'  },
    '0:1:13': { shortName: 'swe',    name: 'Water equiv of accum snow depth',       units: 'kg m-2'      },
    '0:1:51': { shortName: 'tcw',    name: 'Total column water',                    units: 'kg m-2'      },
    '0:1:64': { shortName: 'tcwv',   name: 'Total column integrated water vapour',  units: 'kg m-2'      },
    '0:1:65': { shortName: 'rrate',  name: 'Rain precipitation rate',               units: 'kg m-2 s-1'  },
    '0:1:66': { shortName: 'srate',  name: 'Snow precipitation rate',               units: 'kg m-2 s-1'  },
    '0:1:69': { shortName: 'tclw',   name: 'Total column integrated cloud water',   units: 'kg m-2'      },
    '0:1:70': { shortName: 'tciw',   name: 'Total column integrated cloud ice',     units: 'kg m-2'      },
    '0:1:75': { shortName: 'tgrp',   name: 'Graupel (snow pellets) precipitation',  units: 'kg m-2'      },
    '0:1:83': { shortName: 'clwc',   name: 'Specific cloud liquid water content',   units: 'kg kg-1'     },
    '0:1:84': { shortName: 'ciwc',   name: 'Specific cloud ice water content',      units: 'kg kg-1'     },
    '0:1:85': { shortName: 'crwc',   name: 'Specific rain water content',           units: 'kg kg-1'     },
    '0:1:86': { shortName: 'cswc',   name: 'Specific snow water content',           units: 'kg kg-1'     },

    // Category 2: Momentum / Wind
    '0:2:0':  { shortName: 'wdir',   name: 'Wind direction (from which blowing)',   units: 'degree true' },
    '0:2:1':  { shortName: 'wspd',   name: 'Wind speed',                            units: 'm s-1'       },
    '0:2:2':  { shortName: 'u',      name: 'U-component of wind',                   units: 'm s-1'       },
    '0:2:3':  { shortName: 'v',      name: 'V-component of wind',                   units: 'm s-1'       },
    '0:2:4':  { shortName: 'strm',   name: 'Stream function',                       units: 'm2 s-1'      },
    '0:2:5':  { shortName: 'vpot',   name: 'Velocity potential',                    units: 'm2 s-1'      },
    '0:2:8':  { shortName: 'w',      name: 'Vertical velocity (pressure)',           units: 'Pa s-1'      },
    '0:2:9':  { shortName: 'wz',     name: 'Vertical velocity (geometric)',          units: 'm s-1'       },
    '0:2:10': { shortName: 'absv',   name: 'Absolute vorticity',                    units: 's-1'         },
    '0:2:11': { shortName: 'absD',   name: 'Absolute divergence',                   units: 's-1'         },
    '0:2:12': { shortName: 'relv',   name: 'Relative vorticity',                    units: 's-1'         },
    '0:2:13': { shortName: 'd',      name: 'Relative divergence',                   units: 's-1'         },
    '0:2:14': { shortName: 'pvort',  name: 'Potential vorticity',                   units: 'K m2 kg-1 s-1'},
    '0:2:15': { shortName: 'dudz',   name: 'Vertical u-component shear',            units: 's-1'         },
    '0:2:16': { shortName: 'dvdz',   name: 'Vertical v-component shear',            units: 's-1'         },
    '0:2:20': { shortName: 'bdis',   name: 'Boundary layer dissipation',            units: 'W m-2'       },
    '0:2:21': { shortName: 'maxws',  name: 'Maximum wind speed',                    units: 'm s-1'       },
    '0:2:22': { shortName: 'gust',   name: 'Wind speed (gust)',                     units: 'm s-1'       },
    '0:2:23': { shortName: 'ugust',  name: 'U-component of wind (gust)',            units: 'm s-1'       },
    '0:2:24': { shortName: 'vgust',  name: 'V-component of wind (gust)',            units: 'm s-1'       },

    // Category 3: Mass / Pressure
    '0:3:0':  { shortName: 'p',      name: 'Pressure',                              units: 'Pa'          },
    '0:3:1':  { shortName: 'msl',    name: 'Pressure reduced to MSL',               units: 'Pa'          },
    '0:3:2':  { shortName: 'ptend',  name: 'Pressure tendency',                     units: 'Pa s-1'      },
    '0:3:4':  { shortName: 'z',      name: 'Geopotential',                          units: 'm2 s-2'      },
    '0:3:5':  { shortName: 'gh',     name: 'Geopotential height',                   units: 'gpm'         },
    '0:3:6':  { shortName: 'geomh',  name: 'Geometric height',                      units: 'm'           },
    '0:3:10': { shortName: 'den',    name: 'Density',                               units: 'kg m-3'      },
    '0:3:12': { shortName: 'thick',  name: 'Thickness',                             units: 'm'           },
    '0:3:18': { shortName: 'blh',    name: 'Planetary boundary layer height',       units: 'm'           },
    '0:3:25': { shortName: 'lnsp',   name: 'Natural log of pressure',               units: 'Numeric'     },

    // Category 4: Short-wave radiation
    '0:4:0':  { shortName: 'nswrs',  name: 'Net short-wave radiation flux (surface)',  units: 'W m-2'    },
    '0:4:1':  { shortName: 'nswrt',  name: 'Net short-wave radiation flux (TOA)',      units: 'W m-2'    },
    '0:4:7':  { shortName: 'dswrf',  name: 'Downward short-wave radiation flux',       units: 'W m-2'    },
    '0:4:8':  { shortName: 'uswrf',  name: 'Upward short-wave radiation flux',         units: 'W m-2'    },
    '0:4:9':  { shortName: 'ssr',    name: 'Net short-wave radiation flux',            units: 'W m-2'    },
    '0:4:11': { shortName: 'nsrscs', name: 'Net short-wave radiation flux, clear sky', units: 'W m-2'    },
    '0:4:52': { shortName: 'dsrfcs', name: 'Downward short-wave radiation flux, clear sky', units: 'W m-2'},

    // Category 5: Long-wave radiation
    '0:5:0':  { shortName: 'nlwrs',  name: 'Net long-wave radiation flux (surface)',   units: 'W m-2'    },
    '0:5:1':  { shortName: 'nlwrt',  name: 'Net long-wave radiation flux (TOA)',       units: 'W m-2'    },
    '0:5:3':  { shortName: 'dlwrf',  name: 'Downward long-wave radiation flux',        units: 'W m-2'    },
    '0:5:4':  { shortName: 'ulwrf',  name: 'Upward long-wave radiation flux',          units: 'W m-2'    },
    '0:5:5':  { shortName: 'lwrf',   name: 'Net long-wave radiation flux',             units: 'W m-2'    },
    '0:5:6':  { shortName: 'nlwrcs', name: 'Net long-wave radiation flux, clear sky',  units: 'W m-2'    },
    '0:5:8':  { shortName: 'dlwrcs', name: 'Downward long-wave radiation flux, clear sky', units: 'W m-2'},

    // Category 6: Cloud
    '0:6:0':  { shortName: 'cice',   name: 'Cloud ice',                              units: 'kg m-2'     },
    '0:6:1':  { shortName: 'tcc',    name: 'Total cloud cover',                      units: '%'          },
    '0:6:3':  { shortName: 'lcc',    name: 'Low cloud cover',                        units: '%'          },
    '0:6:4':  { shortName: 'mcc',    name: 'Medium cloud cover',                     units: '%'          },
    '0:6:5':  { shortName: 'hcc',    name: 'High cloud cover',                       units: '%'          },
    '0:6:6':  { shortName: 'cw',     name: 'Cloud water',                            units: 'kg m-2'     },
    '0:6:11': { shortName: 'cb',     name: 'Cloud base',                             units: 'm'          },
    '0:6:12': { shortName: 'cto',    name: 'Cloud top',                              units: 'm'          },
    '0:6:18': { shortName: 'tcolw',  name: 'Total column-integrated cloud water',    units: 'kg m-2'     },
    '0:6:19': { shortName: 'tcoli',  name: 'Total column-integrated cloud ice',      units: 'kg m-2'     },

    // Category 7: Thermodynamic stability indices
    '0:7:0':  { shortName: 'pli',    name: 'Parcel lifted index (to 500 hPa)',       units: 'K'          },
    '0:7:1':  { shortName: 'bli',    name: 'Best lifted index (to 500 hPa)',         units: 'K'          },
    '0:7:2':  { shortName: 'kx',     name: 'K index',                               units: 'K'          },
    '0:7:4':  { shortName: 'tt',     name: 'Total totals index',                     units: 'K'          },
    '0:7:6':  { shortName: 'cape',   name: 'Convective available potential energy',  units: 'J kg-1'     },
    '0:7:7':  { shortName: 'cin',    name: 'Convective inhibition',                  units: 'J kg-1'     },
    '0:7:8':  { shortName: 'hlcy',   name: 'Storm relative helicity',               units: 'J kg-1'     },

    // Category 14: Trace gases
    '0:14:0': { shortName: 'toz',    name: 'Total ozone',                            units: 'DU'         },
    '0:14:1': { shortName: 'o3',     name: 'Ozone mixing ratio',                     units: 'kg kg-1'    },
    '0:14:2': { shortName: 'tco3',   name: 'Total column integrated ozone',          units: 'DU'         },

    // ── Discipline 2: Land surface ───────────────────────────────────────────────

    // Category 0: Vegetation / Biomass
    '2:0:0':  { shortName: 'lsm',    name: 'Land cover (0=sea, 1=land)',             units: 'Proportion'  },
    '2:0:2':  { shortName: 'stl',    name: 'Soil temperature',                       units: 'K'           },
    '2:0:3':  { shortName: 'soilw',  name: 'Soil moisture content',                  units: 'kg m-2'      },
    '2:0:9':  { shortName: 'swvl',   name: 'Volumetric soil moisture content',       units: 'Proportion'  },
    '2:0:10': { shortName: 'ghf',    name: 'Ground heat flux',                       units: 'W m-2'       },
    '2:0:25': { shortName: 'vswvl',  name: 'Volumetric soil moisture',               units: 'm3 m-3'      },
    '2:0:50': { shortName: 'src',    name: 'Skin reservoir content',                 units: 'kg m-2'      },

    // Category 3: Soil products
    '2:3:18': { shortName: 'soilt',  name: 'Soil temperature (multi-layer)',         units: 'K'           },
    '2:3:19': { shortName: 'soilm',  name: 'Soil moisture (multi-layer)',            units: 'kg m-3'      },
    '2:3:20': { shortName: 'csoilw', name: 'Column-integrated soil moisture',        units: 'kg m-2'      },

    // ── Discipline 10: Oceanographic ────────────────────────────────────────────

    // Category 0: Waves
    '10:0:3': { shortName: 'swh',    name: 'Significant height of wind waves',       units: 'm'           },
    '10:0:5': { shortName: 'mpww',   name: 'Mean period of wind waves',              units: 's'           },
};

/**
 * Look up a GRIB2 parameter by discipline, category, and number.
 *
 * @param {number} discipline        - From Section 0 (0=Meteorological, 10=Oceanographic…)
 * @param {number} parameterCategory - From Section 4, template offset +0
 * @param {number} parameterNumber   - From Section 4, template offset +1
 * @returns {{ name: string, shortName: string, units: string }}
 */
export function lookupParameter(discipline, parameterCategory, parameterNumber) {
    const key = `${discipline}:${parameterCategory}:${parameterNumber}`;
    return PARAMETERS[key] ?? {
        name:      `Unknown (D${discipline} C${parameterCategory} N${parameterNumber})`,
        shortName: `par_d${discipline}_c${parameterCategory}_n${parameterNumber}`,
        units:     'unknown',
    };
}

export { PARAMETERS };
