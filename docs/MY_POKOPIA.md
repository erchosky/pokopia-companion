# My Pokopia

La primera experiencia permite confirmar Pokémon y recetas con un clic. Solo persiste IDs estables (`pokemon:slug`, `recipe:slug`) en `localStorage`; no guarda inventarios cuantitativos ni infiere progresión ambigua.

Este modo local es privado por dispositivo y permite probar el flujo antes de habilitar cuentas. No es sincronización multiusuario ni sustituye la capa PostgreSQL.

La siguiente fase migrará el mismo contrato a tablas privadas protegidas con Auth/RLS. La migración debe importar optativamente el estado local, conservar `user_confirmed | inferred | unknown`, registrar la regla que originó cada inferencia y permitir revocarla.
