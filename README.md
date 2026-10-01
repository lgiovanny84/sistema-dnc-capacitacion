# Sistema de Gestión Integral de Capacitación

Aplicación web para gestionar la Detección de Necesidades de Capacitación (DNC), priorizar y aprobar necesidades, administrar la ejecución y reportar resultados con enfoque en brechas y desarrollo de competencias.

## Funcionalidades

- Capacitación interna y externa con fechas planificadas de inicio y fin vinculadas al período institucional.
- Matriz de competencias filtrada por departamento y factor, actualizable por Excel o manualmente.
- Catálogos configurables: factores, competencias, grupos ocupacionales, áreas, departamentos y modalidades.
- Brecha, objetivo, meta, indicador y medio de verificación.
- Participantes, horas, horas-persona, costo, prioridad, trimestre y estado.
- Roles `admin` y `user`, seguridad por fila y bitácora de cambios.
- Administración de usuarios, invitaciones, cambio de rol y activación/desactivación.
- Creación de usuarios con clave temporal individual y cambio obligatorio en el primer ingreso.
- Recuperación segura de contraseña por correo electrónico.
- Panel ejecutivo, filtros, impresión/PDF y CSV compatible con Excel.

## Puesta en marcha

1. Cree un proyecto en Supabase y ejecute `supabase/schema.sql` en SQL Editor.
2. Si el esquema ya estaba instalado, ejecute `supabase/migrations/20260918_permissions_and_admin.sql`.
3. Despliegue la función `supabase/functions/admin-users` como `admin-users`.
4. Cree el primer usuario y conviértalo en administrador con la instrucción al final del SQL.
5. Copie `.env.example` como `.env.local` y complete URL y clave pública `anon`.
6. Ejecute `npm install` y `npm run dev`.

Para activar el ingreso por nombre de usuario en una instalación existente, ejecute
`supabase/migrations/20260929_username_login.sql` y despliegue
`supabase/functions/username-login` con la verificación JWT habilitada. La clave
pública que envía el cliente permite llamar la función antes de iniciar sesión.
Los usuarios existentes
reciben inicialmente el prefijo de su correo; el administrador puede cambiarlo en
“Usuarios y accesos”. El correo sigue siendo necesario para invitaciones y recuperación.

Para la creación con clave temporal, ejecute
`supabase/migrations/20261001_initial_credentials.sql` y despliegue una nueva
versión de `supabase/functions/admin-users`. El administrador define el usuario
o deja que se genere a partir del correo; la clave aleatoria se devuelve una
sola vez para copiar los datos o preparar un correo. El nuevo usuario debe
cambiar esa clave en el primer acceso. La opción «Preparar correo» abre el
cliente de correo del administrador; el envío requiere su confirmación.

## Despliegue

Importe este repositorio en Vercel o Netlify, configure las dos variables de entorno y despliegue. Nunca publique la clave `service_role`.

## Seguridad

La autorización efectiva reside en PostgreSQL mediante Row Level Security. Los usuarios solo consultan sus registros; los administradores gestionan el consolidado y los catálogos. Las modificaciones relevantes generan auditoría. Para producción se recomienda MFA, política institucional de contraseñas, HTTPS, copias de seguridad y revisión periódica de accesos.
