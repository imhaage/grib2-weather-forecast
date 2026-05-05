import * as drtConstant from './drt-constant.js';
import * as drtSimple   from './drt-simple.js';
import * as drtComplex  from './drt-complex.js';
import * as drtCcsds    from './drt-ccsds.js';
import * as drtIeee754  from './drt-ieee754.js';

const TEMPLATES = {
    0:   drtSimple,
    2:   drtComplex,
    3:   drtComplex,
    42:  drtCcsds,
    254: drtIeee754,
    255: drtConstant,
};

export function getTemplate(n) {
    const t = TEMPLATES[n];
    if (!t) throw new Error(`Unsupported Data Representation Template: ${n}`);
    return t;
}

export function registerTemplate(n, module) {
    TEMPLATES[n] = module;
}
