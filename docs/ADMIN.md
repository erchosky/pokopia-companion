# Pokopia Data Admin

`apps/admin` es una aplicación Next.js separada, servida por defecto en el puerto 3001. Muestra salud de datos, conteos de entidades fuente, snapshot activo y gaps conocidos.

## Acceso

El panel falla cerrado. Requiere:

- `POKOPIA_ADMIN_PASSWORD`: contraseña privada, nunca expuesta al cliente.
- `POKOPIA_ADMIN_SESSION_SECRET`: secreto aleatorio largo para firmar la cookie.

El login crea una cookie HttpOnly, `SameSite=Strict`, con ocho horas de validez y `Secure` en producción. Next.js 16 aplica la protección en `proxy.ts`. Sin ambas variables solo se puede abrir la pantalla de configuración.

## Límites actuales

La SQLite del snapshot se abre en modo read-only. No hay botones de aprobación o edición simulados. Esas mutaciones se habilitarán mediante Server Actions cuando las tablas PostgreSQL de review, assertions y auditoría estén disponibles; toda edición deberá añadir una nueva revisión y conservar la evidencia histórica.
