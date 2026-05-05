import * as drtConstant from './drt-constant.js';

const TEMPLATES = {
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
