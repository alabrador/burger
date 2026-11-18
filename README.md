# Crea tu Burger

Configurador 3D de hamburguesas hecho con **Next.js**, **Tailwind CSS** y **React Three Fiber**.
El cliente elige proteína (Angus, pollo a la plancha o pollo crispy) e ingredientes, y la
hamburguesa se arma capa a capa con modelos realistas hechos en Blender.

## Empezar

```bash
npm install
npm run dev
```

Abre http://localhost:3000.

## Estructura

- `src/lib/catalog.ts`: ingredientes, precios, calorías, combos y orden de apilado.
- `src/lib/store.ts`: estado del pedido (Zustand).
- `src/lib/models.ts`: qué GLB usa cada ingrediente.
- `src/components/BurgerScene.tsx`: escena 3D, luces, bandeja y animación de las capas.
- `src/components/Configurator.tsx`: cabecera, visor y panel del pedido.
- `public/models/*.glb`: modelos exportados desde Blender con compresión Draco.
- `public/draco/`: decodificador Draco servido desde la propia app.

## Modelos de Blender

Cada GLB tiene la base en `y = 0` y la propiedad personalizada `stack_height` (en metros),
que la app usa para saber cuánto sube la pila. Para añadir un ingrediente nuevo:

1. Expórtalo desde Blender a `public/models/` con Draco y `stack_height`.
2. Añade su ruta en `src/lib/models.ts` con el mismo id que en `catalog.ts`.
