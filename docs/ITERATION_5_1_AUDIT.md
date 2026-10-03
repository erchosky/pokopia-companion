# Iteration 5.1 — auditoría cuantitativa

## Veredicto

El corpus permite recuperar 115 registros de evidencia para 114 hechos cuantitativos únicos. No
contiene cantidades de salida para ninguna de las 882 recetas. El anterior `outputQuantity = 1` era
un default sin evidencia: ahora las 882 quedan `null / unknown` en SQLite y PostgreSQL.

| Área                                        |       Resultado |
| ------------------------------------------- | --------------: |
| páginas / tablas examinadas                 |  2.532 / 12.183 |
| recetas                                     |             882 |
| outputs recuperados                         |               0 |
| exact / partial / structural / disputed     | 0 / 880 / 2 / 0 |
| ingredient quantities recuperadas / unknown |           0 / 2 |
| sistemas originales con parámetros          |            9/11 |
| sistemas tras discovery con parámetros      |           13/15 |

## Cadena de custodia

- baseline ZIP SHA-256: `47a57a0c945c66c7381a3f6e5d61cfaf3fa337fc262ce0811fda9c6f71113bcf`;
- master archive SHA-256: `251f4b0e5d87a3857d6ddf98294a99a2f9f682f3f022fb93be4ffd95bf00987c`;
- master verificado: 2.532 RAW pages y referencias archive/index/SQLite/REVIEW intactas;
- el master se usó en lectura y queda fuera del REVIEW ZIP.

## Recipe pattern analysis

Hay 881 item-detail pages con tabla Recipe y una receta solo en overview. Los detail templates tienen
4, 8, 10, 12 o 14 celdas y declaran receta, location e ingredientes. El overview declara picture,
name, unlock/location y requirements. Ninguno define yield/output batch.

Se buscaron celdas y labels, heading, alt/title, RAW HTML, Markdown, TABLES, STRUCTURED, facts, RAG y
sibling relations: cero output quantities. No se activó OCR porque las imágenes son iconos, no una
interfaz con un candidato numérico P0 probable.

Las dos quantities incompletas son `confectionery-wall-lower → lumber` y `gold-wall → gold-ingot`.
Overview y detail terminan el marcador sin número. Siguen `measurement_required`, nunca 0 o 1.

## Automation y electricidad

Los 11 sistemas originales se re-auditaron; nueve reciben parámetros. Floor Switch y Portal Pod
siguen estructurales. Se incorporan cuatro candidates con página build: Windmill, Waterwheel,
Furnace y Charging Station Kit.

Se recuperan generación 5/10/20/30, Windmill 10 estándar/20 en altura, distancias 10/15 bloques, 20
conexiones, límites 64/1.024/256, vertical 5, sprinkler axial 5/hasta 60 bloques y cuatro builds de una
hora con dos Pokémon Build. El cambio 512 → 1.024 está versionado 1.1.0. Provisión, consumo,
transporte, conexión y rango permanecen predicados distintos.

No hay capacidad general de storage, throughput/cycle, consumo Furnace ni compatibilidad negativa
por town. Una lista vacía sigue siendo unknown.

## Provenance y promoción

Parser confidence, evidence confidence, source verification, aceptación local y promoción son
dimensiones separadas. Las 115 evidencias generan 114 hechos únicos en PostgreSQL como candidates;
ninguno se autopromueve. Las 273 source records preexistentes conservan `unverified`.

Datos completos: `audit-data/iteration-5-1/`.
