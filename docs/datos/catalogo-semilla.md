# Preparación de la base española — #61

El adaptador convierte la semilla del propietario en un **catálogo de investigación**, con
202 clubes, cuatro competiciones, 34 reglas de referencia y 30 fuentes. No cambia todavía la partida
ni produce un paquete de temporada cargable. No incluye personas.

## Uso

```bash
pnpm data:catalog
pnpm data:catalog --out /tmp/bm27-es-catalog.json
# Opcionales:
pnpm data:catalog --seed ruta/seed.json --aliases ruta/aliases.json --out ruta/catalog.json
```

El primer comando muestra el resumen y los obstáculos. El segundo escribe JSON validado: el archivo
de destino no debe existir. Un error de entrada no deja una salida parcial; el adaptador nunca
sobrescribe otro archivo. No consulta Internet ni cambia los originales.

## Identidad y nombres

- El ID del catálogo combina el ID de la semilla y el ID interno de origen. No depende del nombre,
  patrocinador, alias, posición en un array ni orden de lectura.
- Esa estabilidad vale **dentro de esta semilla**. No declara que el ID de investigación sea oficial
  ni que identifique por sí solo a la misma entidad en temporadas futuras. La conciliación entre
  temporadas y clubes/sociedades queda pendiente.
- `referenceName` conserva el nombre público, que puede contener patrocinadores y no es razón social.
- `displayName` aplica el alias de `data/reference/es/season-2026-27/aliases.json`. Si no hay alias,
  mantiene el nombre de referencia; no se afirma que todos los nombres hayan sido adaptados.
- El único alias inicial es el ejemplo solicitado por el propietario: `ACB-X-012` →
  **Real Chamartín Baloncesto**. No se usa aún en la demo. Cambiar el alias no acredita derechos de uso.
- Los nombres visibles se comprueban para evitar duplicados, incluidos cambios solo de mayúsculas.
  Un alias dirigido a un ID inexistente se rechaza.

## Agrupaciones y calendario

| Nivel       | Dato disponible                             | Resultado del adaptador                         |
| ----------- | ------------------------------------------- | ----------------------------------------------- |
| ACB         | 18 clubes en liga única                     | Grupo de liga único                             |
| Primera FEB | 18 clubes en liga única                     | Grupo de liga único                             |
| Segunda FEB | A/B, 14 clubes cada uno                     | Dos grupos de liga conservados                  |
| Tercera FEB | Conferencias A/B/C/E de 28 clubes y D de 26 | Conferencia conservada, `calendarGroupId: null` |

La semilla **no identifica los subgrupos de calendario de Tercera FEB**. El adaptador no transforma
las conferencias en cinco ligas de 28/26 equipos ni reparte sus clubes entre diez subgrupos por orden
alfabético o por posición en el listado. Esto necesita evidencia adicional y soporte de grupos explícitos; el cargador #21 y las identidades #79 ya existen.

## Procedencia y obstáculos

Se conservan las URLs, fechas de captura, orden de origen, nombres, cautelas y referencias de las
reglas. Las fuentes guardan `claimedVerification`: es la etiqueta aportada en la investigación, no una
comprobación nueva del adaptador. El resultado completo mantiene `status: research-only`.

La regla `RL-013` remite a `https://www.feb.es/primerafeb/`, que no tiene entrada propia en las 30
fuentes. Se conserva la URL con `sourceIds: []` y se informa del obstáculo; no se inventa una fuente
verificada. Las referencias de clubes sí deben figurar en el catálogo de fuentes.

Obstáculos para una temporada oficial: contraste independiente y condiciones de uso, traducción de
reglas a un formato ejecutable y subgrupos desconocidos. El cargador #21 y las identidades #79 están disponibles; este adaptador sigue sin generar un paquete de temporada. Los valores de reglas son
**evidencia textual**, nunca código a ejecutar ni instrucciones que pueda activar la importación.

Se rechazan IDs duplicados, referencias de competición inexistentes, recuentos contradictorios,
fechas inválidas o posteriores al corte y URLs ajenas a HTTP(S) o con credenciales. Se rechazan
registros de personas en esta fase. No se incorporan nombres privados, retratos ni atributos oficiales.

## Pruebas

`pnpm exec vitest run tools/data/test/seedCatalog.test.ts`: ocho pruebas correctas. Comprueban
integridad y errores, estabilidad al reordenar entradas, independencia de los alias y protección de
archivos mediante el comando real. El código y los tests tienen comprobación estricta de TypeScript
en `tools/data/tsconfig.json`, incluida en `pnpm typecheck`.

Validación de la entrega: `pnpm test --maxWorkers=2` (**257/257 pruebas**), lint, formato,
TypeScript, compilación web y `roadmap:check` correctos. Se ejecutó el comando real con salida JSON
en `/tmp`; no se cambió el universo ni se hizo una simulación de una liga real.
