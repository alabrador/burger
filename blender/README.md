# Fuentes de Blender

Archivos originales con los que se modelaron y hornearon todos los ingredientes de **Crea tu Burger**. Hechos con Blender 5.2.

> El repositorio incluye el `.blend` (65 MB) y las texturas originales, así que el primer clon pesa unos 250 MB.

## Contenido

| Ruta | Qué es |
| --- | --- |
| `hamburguesa_brioche_angus.blend` | Escena completa con todos los ingredientes, materiales procedurales y la bandeja de nogal |
| `texturas/` | Texturas horneadas a 2048 px de cada pieza: `_color`, `_rough` y `_normal` |
| `scripts/helpers.py` | Utilidades de modelado: materiales, rampas de color, perfiles de revolución, colecciones |
| `scripts/bake_pipeline.py` | Primer pipeline de horneado y exportación (pan y carne) |
| `scripts/bake_pipeline_2.py` | Pipeline general: hornea color, rugosidad y normal, y exporta un GLB con Draco más una versión `web_preview` |
| `scripts/sauce_gen.py` | Salsas con metaballs: charco y chorreos pegados al borde de la carne |
| `scripts/chicken_gen.py` | Pechuga a la plancha con marcas de parrilla y pollo crispy empanizado |
| `scripts/bacon_egg_gen.py` | Tiras de tocino onduladas y huevo frito con clara y yema separadas |
| `scripts/veg_gen.py` | Cebolla morada, cebolla caramelizada, pepinillos, jalapeños y queso suizo con agujeros |

El pan brioche, la carne Angus, el cheddar, la lechuga, el tomate y la bandeja se modelaron directamente en la escena. Están dentro del `.blend`.

## Cómo usarlos

1. Abre `hamburguesa_brioche_angus.blend` en Blender 5.2 o superior.
2. Ejecuta los scripts desde el editor de texto de Blender. Buscan `helpers.py` y las carpetas `texturas/` y `glb/` junto al `.blend`, así que funcionan sin cambiar rutas.
3. Para hornear y exportar una pieza, edita la lista `PIECES` de `bake_pipeline_2.py` con el formato `(nombre, [objetos], z_base, resolución, ...)` y ejecútalo. Los GLB salen en `blender/glb/`. Cópialos a `public/models/` para usarlos en la app.

### Convenciones

- Escala real en metros. Cada pieza tiene la base en `z = 0` al exportar.
- Cada pieza lleva la propiedad personalizada `stack_height` (en metros), que la app usa para apilar las capas.
- Antes de hornear, todas las piezas que se unen deben tener las mismas ranuras de material en el mismo orden, porque el pipeline une los objetos sin reasignar los índices de material.
- Los horneados largos se lanzan con `bpy.app.timers` para no bloquear Blender, y el progreso se escribe en `bake_status.json`.
