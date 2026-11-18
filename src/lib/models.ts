// Modelos exportados desde Blender (carpeta Burger\glb, con compresión Draco).
// Cada GLB tiene su base en y=0 y la propiedad personalizada stack_height (metros)
// que indica cuánto sube la pila al añadir la capa.

export const MODELS: Record<string, string> = {
  bun_bottom: "/models/bun_bottom.glb",
  bun_top: "/models/bun_top.glb",
  patty: "/models/patty_angus_250g.glb",
  grilled: "/models/chicken_grilled.glb",
  crispy: "/models/chicken_crispy.glb",
  cheddar: "/models/cheese_cheddar.glb",
  lettuce: "/models/lettuce_leaf.glb",
  tomato: "/models/tomato_slices.glb",
  bacon: "/models/bacon_strips.glb",
  egg: "/models/egg_fried.glb",
  ketchup: "/models/sauce_ketchup.glb",
  mustard: "/models/sauce_mustard.glb",
  bbq: "/models/sauce_bbq.glb",
  house: "/models/sauce_house.glb",
  swiss: "/models/cheese_swiss.glb",
  onion: "/models/onion_red_rings.glb",
  caramel: "/models/onion_caramelized.glb",
  pickles: "/models/pickle_slices.glb",
  jalapeno: "/models/jalapeno_rings.glb",
};

export const TRAY = "/models/bandeja_madera.glb";
export const DRACO = "/draco/";

/** Alturas que se ajustan a mano (metros) para que la hamburguesa quede compacta. */
export const HEIGHT_OVERRIDE: Record<string, number> = { egg: 0.0045, jalapeno: 0.0032, pickles: 0.0032 };

/** Aplastado vertical por modelo: el huevo con la yema plana. */
export const SCALE_Y: Record<string, number> = { egg: 0.38 };

/** Altura por defecto si algún ingrediente futuro aún no tiene modelo (metros). */
export const PROCEDURAL_HEIGHT: Record<string, number> = {};
