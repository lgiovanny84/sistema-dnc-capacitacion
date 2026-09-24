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
- Recuperación segura de contraseña por correo electrónico.
- Panel ejecutivo, filtros, impresión/PDF y CSV compatible con Excel.

## Puesta en marcha

1. Cree un proyecto en Supabase y ejecute `supabase/schema.sql` en SQL Editor.
2. Si el esquema ya estaba instalado, ejecute `supabase/migrations/20260918_permissions_and_admin.sql`.
3. Despliegue la función `supabase/functions/admin-users` como `admin-users`.
4. Cree el primer usuario y conviértalo en administrador con la instrucción al final del SQL.
5. Copie `.env.example` como `.env.local` y complete URL y clave pública `anon`.
6. Ejecute `npm install` y `npm run dev`.

## Despliegue

Importe este repositorio en Vercel o Netlify, configure las dos variables de entorno y despliegue. Nunca publique la clave `service_role`.

## Seguridad

La autorización efectiva reside en PostgreSQL mediante Row Level Security. Los usuarios solo consultan sus registros; los administradores gestionan el consolidado y los catálogos. Las modificaciones relevantes generan auditoría. Para producción se recomienda MFA, política institucional de contraseñas, HTTPS, copias de seguridad y revisión periódica de accesos.
