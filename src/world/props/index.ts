/**
 * Procedural prop library. Every factory returns a THREE.Group, origin at floor-centre
 * (or the mounting point for wall items), +Y up, front facing +Z. See individual files.
 */
export const PROP_VERSION = 1;

export { grandfatherClock } from './clock';
export { bookshelf, table, diningChair, armchair, sofa, deskWithLamp, pianoUpright } from './furniture';
export { cabinet, wardrobe, chest, barrel, crate, wineRack, kitchenRange, hangingPots, workTable } from './furniture2';
export { suitOfArmor, globe, gramophone, pedestal, brassPlaque, rugRect, statue, urn, vase, skull } from './objects';
export { fireplace } from './fireplace';
export { candleHolder, pillarCandle, candelabra, chandelier, wallSconce, candleCluster } from './candles';
export { jackOLantern, pumpkin, pumpkinPile, doorLantern } from './pumpkins';
export { paintingFrame, mirrorFrame, handMirror, coffin, sarcophagus, gravestone, cobwebs, spiderweb, plantPot, hangingPlant, leafPile } from './decor';
export { staircase, grandStair, fallenChandelier } from './stairs';
export { ceilingBeam, windowFrame, curtains, archTrim, doorLeaf } from './arch';
export { pressurePlate, lever } from './mech';
export { ghost } from './ghost';
