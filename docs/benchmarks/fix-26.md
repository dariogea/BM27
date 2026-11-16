# Corrección #26: excepción del salario mínimo (comprobación de no regresión)

> Ejecutado con `pnpm stability` y `pnpm calibrate` (sin `--write`, para no sobrescribir los informes
> de T-006) sobre la rama de la corrección. Entorno: el mismo contenedor de CI-like de las tareas anteriores.

## Qué cambia el arreglo

Solo `signFreeAgent` y `renewContract` (acciones del **usuario**) en `packages/core/src/market/actions.ts`.
La simulación de los clubes de la IA no pasa por esas funciones, así que **no se espera ningún cambio**
en las medias de la liga; se ha medido para comprobarlo en vez de suponerlo.

## Resultado

- `pnpm stability` (30 temporadas, semilla `stability-t004`): **resumen idéntico** al de
  `T-006-estabilidad.md` (p. ej. habilidad media N1 73,6 → 71,6; edad media 27,2; mercado 329,5 / 665,8 /
  457,8 por temporada). Duración: 1 min 16 s.
- `pnpm calibrate`: se ejecuta sin errores; el reparto de play types y zonas de tiro coincide con el
  informe `T-006-calibracion.md` (no se ha tocado el motor de partido).
- `pnpm bench`: ejecutado; ver `fix-26-rendimiento.md` (temporada completa del universo 2,16 s frente a 2,14 s en T-006; guardado a 10 temporadas idéntico, 16,77 MB).
  vigente sigue siendo el de T-006.

## Limitación

La comparación es manual (lectura de las cifras), no un test automático. Si quieres que la comparación
con el informe anterior sea automática, habría que añadir una opción `--check` a la herramienta.
