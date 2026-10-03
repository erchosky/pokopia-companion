# Gaps de datos

Generado: 2026-08-12T00:16:16.990Z

## Bloqueos y huecos observados

- Hay 202 errores registrados durante la captura original. No se reintentaron para respetar el pipeline local y el snapshot inmutable.
- 61 enlaces internos relevantes no tienen página fuente equivalente en este snapshot. Pueden ser páginas fuera del alcance Pokopia, errores históricos o contenido ausente; requieren revisión, no relleno inventado.
- 146 assets referenciados desde tablas no se resolvieron en las rutas offline esperadas.
- 51 páginas tienen extracción corta y requieren inspección antes de promover sus datos.
- 2 tablas están vacías o sin texto. Una tabla basada sólo en imagen puede ser legítima, por lo que se marca y no se descarta.
- 18 entidades no participan en una relación. Esto incluye documentos sin links útiles y no implica automáticamente un error.
- La versión de juego no está expresada de forma uniforme en el HTML. V3.1 conserva fecha/hash/fuente, pero no inventa `introduced_version` ni `removed_version`.
- Los tipos de dominio (Pokémon, receta, habilidad, ubicación, condición de desbloqueo) necesitan parsers especializados y revisión humana antes de promoción. Esta pasada produce staging documental trazable, no afirmaciones canónicas validadas.

## Muestras para revisión

Enlaces internos sin snapshot:

- `https://www.serebii.net/pokemonpokopia/bleakbeach.shtml`
- `https://www.serebii.net/pokemonpokopia/bubblybasin.shtml`
- `https://www.serebii.net/pokemonpokopia/coffeeparfaitsmoothie.shtml`
- `https://www.serebii.net/pokemonpokopia/explosivehamburgersteak.shtml`
- `https://www.serebii.net/pokemonpokopia/favorites/.shtml`
- `https://www.serebii.net/pokemonpokopia/favorites/none.shtml`
- `https://www.serebii.net/pokemonpokopia/items/.shtml`
- `https://www.serebii.net/pokemonpokopia/items/a.shtml`
- `https://www.serebii.net/pokemonpokopia/items/b.shtml`
- `https://www.serebii.net/pokemonpokopia/items/beautifulflowerseeds.shtml`
- `https://www.serebii.net/pokemonpokopia/items/build/altaroftheflamekit.shtml`
- `https://www.serebii.net/pokemonpokopia/items/c.shtml`
- `https://www.serebii.net/pokemonpokopia/items/copperdeposit.shtml`
- `https://www.serebii.net/pokemonpokopia/items/d.shtml`
- `https://www.serebii.net/pokemonpokopia/items/decoratepokeball.shtml`
- `https://www.serebii.net/pokemonpokopia/items/e.shtml`
- `https://www.serebii.net/pokemonpokopia/items/elegantflowerseed.shtml`
- `https://www.serebii.net/pokemonpokopia/items/elegantflowerseeds.shtml`
- `https://www.serebii.net/pokemonpokopia/items/f.shtml`
- `https://www.serebii.net/pokemonpokopia/items/g.shtml`

Assets no resueltos:

- `https://www.serebii.net/pokedex-sv/type/icon/.png`
- `https://www.serebii.net/pokemonpokopia/coffeeparfaitsmoothie.png`
- `https://www.serebii.net/pokemonpokopia/dlcoverage.jpg`
- `https://www.serebii.net/pokemonpokopia/explosivehamburgersteak.png`
- `https://www.serebii.net/pokemonpokopia/hideandsneak.jpg`
- `https://www.serebii.net/pokemonpokopia/items/.png`
- `https://www.serebii.net/pokemonpokopia/items/aged-stonedwall.png`
- `https://www.serebii.net/pokemonpokopia/items/beautifulflowers.png`
- `https://www.serebii.net/pokemonpokopia/items/beautifulflowerseeds.png`
- `https://www.serebii.net/pokemonpokopia/items/bed.png`
- `https://www.serebii.net/pokemonpokopia/items/berrytree.png`
- `https://www.serebii.net/pokemonpokopia/items/boo-in-thebox.png`
- `https://www.serebii.net/pokemonpokopia/items/brokentimbermetalfragment.png`
- `https://www.serebii.net/pokemonpokopia/items/carboadboxes.png`
- `https://www.serebii.net/pokemonpokopia/items/cardboardbox.png`
- `https://www.serebii.net/pokemonpokopia/items/closet.png`
- `https://www.serebii.net/pokemonpokopia/items/colorfulanchorprint(wallpape).png`
- `https://www.serebii.net/pokemonpokopia/items/coppeingot.png`
- `https://www.serebii.net/pokemonpokopia/items/decoratepokeball.png`
- `https://www.serebii.net/pokemonpokopia/items/dresser.png`

Errores de captura:

- `https://www.serebii.net/pokemonpokopia/pokedex/specialty/ — page: HTTPError('403 Client Error: Forbidden for url: https://www.serebii.net/pokemonpokopia/pokedex/specialty/')`
- `https://www.serebii.net/pokemonpokopia/items/ironignot.shtml — page: HTTPError('404 Client Error: Not Found for url: https://www.serebii.net/pokemonpokopia/items/ironignot.shtml')`
- `https://www.serebii.net/pokemonpokopia/items/ironscaffoldplank.shtml — page: HTTPError('404 Client Error: Not Found for url: https://www.serebii.net/pokemonpokopia/items/ironscaffoldplank.shtml')`
- `https://www.serebii.net/pokemonpokopia/items/light-brownrock.shtml — page: HTTPError('404 Client Error: Not Found for url: https://www.serebii.net/pokemonpokopia/items/light-brownrock.shtml')`
- `https://www.serebii.net/pokemonpokopia/items/linestone.shtml — page: HTTPError('404 Client Error: Not Found for url: https://www.serebii.net/pokemonpokopia/items/linestone.shtml')`
- `https://www.serebii.net/pokemonpokopia/items/poké.shtml — page: HTTPError('404 Client Error: Not Found for url: https://www.serebii.net/pokemonpokopia/items/pok%C3%A9.shtml')`
- `https://www.serebii.net/pokemonpokopia/items/stones.shtml — page: HTTPError('404 Client Error: Not Found for url: https://www.serebii.net/pokemonpokopia/items/stones.shtml')`
- `https://www.serebii.net/pokemonpokopia/coffeeparfaitsmoothie.shtml — page: HTTPError('404 Client Error: Not Found for url: https://www.serebii.net/pokemonpokopia/coffeeparfaitsmoothie.shtml')`
- `https://www.serebii.net/pokemonpokopia/explosivehamburgersteak.shtml — page: HTTPError('404 Client Error: Not Found for url: https://www.serebii.net/pokemonpokopia/explosivehamburgersteak.shtml')`
- `https://www.serebii.net/pokemonpokopia/leppasmoothie.shtml — page: HTTPError('404 Client Error: Not Found for url: https://www.serebii.net/pokemonpokopia/leppasmoothie.shtml')`
- `https://www.serebii.net/pokemonpokopia/poppingsalad.shtml — page: HTTPError('404 Client Error: Not Found for url: https://www.serebii.net/pokemonpokopia/poppingsalad.shtml')`
- `https://www.serebii.net/pokemonpokopia/poppingsoup.shtml — page: HTTPError('404 Client Error: Not Found for url: https://www.serebii.net/pokemonpokopia/poppingsoup.shtml')`
- `https://www.serebii.net/pokemonpokopia/rarecandy.shtml — page: HTTPError('404 Client Error: Not Found for url: https://www.serebii.net/pokemonpokopia/rarecandy.shtml')`
- `https://www.serebii.net/pokemonpokopia/red-hotsmoothie.shtml — page: HTTPError('404 Client Error: Not Found for url: https://www.serebii.net/pokemonpokopia/red-hotsmoothie.shtml')`
- `https://www.serebii.net/pokemonpokopia/refreshingsodasmoothie.shtml — page: HTTPError('404 Client Error: Not Found for url: https://www.serebii.net/pokemonpokopia/refreshingsodasmoothie.shtml')`
- `https://www.serebii.net/pokemonpokopia/seagrapes.shtml — page: HTTPError('404 Client Error: Not Found for url: https://www.serebii.net/pokemonpokopia/seagrapes.shtml')`
- `https://www.serebii.net/pokemonpokopia/seagrapesmoothie.shtml — page: HTTPError('404 Client Error: Not Found for url: https://www.serebii.net/pokemonpokopia/seagrapesmoothie.shtml')`
- `https://www.serebii.net/pokemonpokopia/watermelonbread.shtml — page: HTTPError('404 Client Error: Not Found for url: https://www.serebii.net/pokemonpokopia/watermelonbread.shtml')`
- `https://www.serebii.net/pokemonpokopia/watermelonslice.shtml — page: HTTPError('404 Client Error: Not Found for url: https://www.serebii.net/pokemonpokopia/watermelonslice.shtml')`
- `https://www.serebii.net/pokemonpokopia/watermelonsmoothie.shtml — page: HTTPError('404 Client Error: Not Found for url: https://www.serebii.net/pokemonpokopia/watermelonsmoothie.shtml')`
