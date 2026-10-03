# Knowledge Graph orphans

## Resultado

La auditoría real actual encuentra 726 nodos aislados sobre 3.652 nodos semánticos:

| Clasificación             | Conteo | Acción                           |
| ------------------------- | -----: | -------------------------------- |
| `LEGITIMATELY_ISOLATED`   |    711 | Mantener; no inventar relaciones |
| `INSUFFICIENT_DATA`       |     15 | Research backlog                 |
| `MISSING_RELATION_PARSER` |      0 | Sin auto-fix actual              |
| `MISSING_RELATION_TYPE`   |      0 | Sin auto-fix actual              |
| `POSSIBLE_DATA_BUG`       |      0 | Sin incidencias actuales         |

La cifra procede de `audit-data/iteration-3.5/knowledge-graph-cases.json`; no es un porcentaje inflado de cobertura.

## Criterio

- Un item descrito pero sin requisito, receta, automatización ni relación gameplay documentada puede estar legítimamente aislado.
- Una ficha sin descripción/localización/specialty suficiente queda como `INSUFFICIENT_DATA`.
- `craftable=true` sin receta sería `MISSING_RELATION_PARSER`.
- Relevancia directa de automatización sin predicado sería `MISSING_RELATION_TYPE`.
- Una entidad principal con datos estructurados que no genera su relación sería `POSSIBLE_DATA_BUG`.

No se usa co-ocurrencia, enlaces de navegación ni similitud de texto para conectar nodos automáticamente. Sólo se corrigen casos donde existe evidencia estructurada clara.

## Semántica de traversal

- `recipe_produces_item` conserva dirección receta→item.
- Al iniciar en un item, el traversal puede seguir esa arista en sentido inverso para localizar su receta; la arista no se reescribe.
- `recipe_requires_item` distingue ingredientes fabricables de materiales base.
- El lineage evita ciclos y el resultado informa cualquier ciclo observado.
- La identidad semántica es `from + predicate + to`; evidencias repetidas se fusionan, no se descartan.
