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
};

export const TRAY = "/models/bandeja_madera.glb";
export const DRACO = "/draco/";

/** Alturas que se ajustan a mano (metros): el huevo deja ver la yema bajo el pan. */
export const HEIGHT_OVERRIDE: Record<string, number> = { egg: 0.013 };

/** Alturas de los ingredientes que aún no tienen modelo de Blender (metros). */
export const PROCEDURAL_HEIGHT: Record<string, number> = {
  swiss: 0.0025,
  onion: 0.003,
  caramel: 0.004,
  pickles: 0.0025,
  jalapeno: 0.003,
};
