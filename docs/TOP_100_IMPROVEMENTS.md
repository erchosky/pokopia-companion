# Top 100 improvements — audit-driven

Leyenda: `[x]` terminado en Iteration 3, `[~]` parcial con límites explícitos, `[ ]` backlog. El orden prioriza corrección de decisiones, evidencia y fricción; no volumen de features.

## P0 — verdad y decisiones

1. [x] Detectar tablas de zona por cabecera, no índice fijo.
2. [x] Corregir el falso conteo de 69 Pokémon exclusivos a 26.
3. [x] Añadir regression fixture con layout canonical real de zona.
4. [x] Auditar las 30.422 relaciones SQLite por tipo.
5. [x] Impedir que `links_to` se promocione como relación de gameplay.
6. [x] Medir self-links, orphan endpoints y duplicados exactos.
7. [x] Crear entidades y predicates tipados para Knowledge Graph.
8. [x] Separar direct fact, derived fact, inference y recommendation.
9. [x] Adjuntar confidence y evidence coverage a cada relación.
10. [x] Mantener game version `null` cuando sea desconocida.
11. [x] Implementar direction tests para relaciones.
12. [x] Implementar traversal limitado y detección de ciclos.
13. [x] No fabricar synergies desde coocurrencias.
14. [x] Exponer provenance desde relación hasta URL fuente.
15. [x] Sustituir porcentajes de confianza no calibrados por lenguaje humano.
16. [x] Tratar unknown como null, nunca como cero.
17. [x] Separar score, evidence coverage y confidence.
18. [x] Introducir recommendation bands sin afirmar verdad absoluta.
19. [x] Añadir ganancia marginal para composición de equipo.
20. [x] Distinguir mejor individuo de mejor incorporación.

## P0/P1 — Town Intelligence

21. [x] Separar Owned de residente de un pueblo.
22. [x] Persistir residents por town en My Pokopia V3.
23. [x] Implementar preset Balanced.
24. [x] Implementar Maximum Automation.
25. [x] Implementar Maximum Production.
26. [x] Implementar Progression.
27. [x] Implementar Compact.
28. [x] Implementar Endgame.
29. [x] Implementar Beautiful + Functional.
30. [x] Derivar roles requeridos con razón visible.
31. [x] Detectar roles cubiertos y missing.
32. [x] Detectar duplicate roles.
33. [x] Identificar roles únicos por residente.
34. [x] Clasificar essential/recommended/situational.
35. [x] Clasificar mobile specialist/decoration-social/redundant.
36. [x] Proponer reemplazo solo si gana cobertura.
37. [x] Mostrar why/benefit/tradeoff/confidence/evidence.
38. [x] Crear Town Health de siete dimensiones.
39. [x] Evitar porcentajes de “salud” sin denominador.
40. [x] Mover el optimizer antes del catálogo largo.

## P1 — Automation, goals y personalización

41. [x] Crear Automation Planner por sistema y pueblo.
42. [x] Separar requisitos satisfied, missing y unknown.
43. [x] Generar orden recomendado conservador.
44. [x] Marcar systems Built explícitamente.
45. [x] No asumir cantidades de inventario.
46. [x] No afirmar compatibilidad sin evidencia.
47. [x] Añadir known unknowns por plan.
48. [x] Convertir My Pokopia en dashboard de decisión.
49. [x] Reducir My Pokopia de ~294 KB a ~29 KB.
50. [x] Añadir Next Actions ordenadas por goal e impacto.
51. [x] Mostrar esfuerzo y confianza por acción.
52. [x] Detectar goals satisfechos por estado confirmado.
53. [x] Permitir quitar goals.
54. [x] Mostrar resumen de todos los pueblos.
55. [x] Mantener confirmed e inferred separados.
56. [x] Mostrar rule ID de inferencias.
57. [x] Permitir revertir una inferencia.
58. [x] Migrar V1/V2 a V3 sin perder estado.
59. [x] Añadir recently viewed.
60. [x] Añadir favoritos locales.

## P1/P2 — Search, comparación e IA

61. [x] Conectar aliases españoles al adapter de búsqueda.
62. [x] Resolver “pokemon para regar”.
63. [x] Resolver typo limitado “portal pot”.
64. [x] Inferir kind sin devolver tipos irrelevantes.
65. [x] Detectar intent “mejor Pokémon para construir”.
66. [x] Detectar intent “cómo conseguir portal pod”.
67. [x] Detectar intent de subir Palette Town.
68. [x] Detectar intent de automatizar agricultura.
69. [x] Detectar intent de comparar storage.
70. [x] Mostrar respuesta directa antes de resultados.
71. [x] Guardar historial de búsquedas local.
72. [x] Crear command palette Cmd/Ctrl+K.
73. [x] Añadir trigger móvil accesible.
74. [x] Crear hub de herramientas.
75. [x] Crear comparación storage vs storage.
76. [x] Crear comparación Pokémon vs Pokémon.
77. [x] No declarar ganador si el eje clave es unknown.
78. [x] Mostrar unknowns y fuentes en comparación.
79. [x] Integrar panel de relaciones en items.
80. [x] Integrar panel de relaciones en Pokémon.

## P2 — UX, performance, seguridad y cierre

81. [x] Aplicar progressive disclosure a relaciones largas.
82. [x] Aplicar progressive disclosure a facilities/plantas.
83. [x] Añadir Continue/Next Actions en home.
84. [x] Añadir actividad reciente en home.
85. [x] Mantener targets táctiles de al menos 42 px.
86. [x] Mantener foco visible y reduced motion.
87. [x] Medir payloads reales antes/después.
88. [x] Establecer budget 200 KB para town y 150 KB para automation.
89. [x] Establecer budget cold graph de 500 ms local.
90. [x] Cachear repository y graph por proceso server-only.
91. [x] Verificar que DB handles no crucen al cliente.
92. [x] Auditar service/secret keys en código cliente.
93. [x] Revalidar RLS, grants, ownership y admin claim.
94. [x] Añadir tests de migration/local state V3.
95. [x] Añadir seis flows críticos desktop+Pixel 7.
96. [x] Generar screenshots de desktop y móvil.
97. [~] Revisar valores de electricidad como assertion candidates.
98. [ ] Medir capacities, radius, batch sizes y throughput in-game.
99. [ ] Virtualizar/buscar el selector de residentes si analytics muestra fricción.
100.  [ ] Validar advisors/RLS en el proyecto Supabase alojado cuando exista target.
