# Sistema DNC de Capacitación

Aplicación web para levantar, priorizar, aprobar y reportar necesidades de capacitación con enfoque en brechas y desarrollo de competencias.

## Funcionalidades

- Capacitación interna y externa; fecha obligatoria para las internas.
- Catálogos configurables: factores, competencias, grupos ocupacionales, áreas, departamentos y modalidades.
- Brecha, objetivo, meta, indicador de transferencia y medio de verificación.
- Participantes, horas, horas-persona, costo, prioridad, trimestre y estado.
- Roles `admin` y `user`, seguridad por fila y bitácora de cambios.
- Panel ejecutivo, filtros, impresión/PDF y CSV compatible con Excel.

## Puesta en marcha

1. Cree un proyecto en Supabase y ejecute `supabase/schema.sql` en SQL Editor.
2. Cree el primer usuario y conviértalo en administrador con la instrucción al final del SQL.
3. Copie `.env.example` como `.env.local` y complete URL y clave pública `anon`.
4. Ejecute `npm install` y `npm run dev`.

## Despliegue

Importe este repositorio en Vercel o Netlify, configure las dos variables de entorno y despliegue. Nunca publique la clave `service_role`.

## Seguridad

La autorización efectiva reside en PostgreSQL mediante Row Level Security. Los usuarios solo consultan sus registros; los administradores gestionan el consolidado y los catálogos. Las modificaciones relevantes generan auditoría. Para producción se recomienda MFA, política institucional de contraseñas, HTTPS, copias de seguridad y revisión periódica de accesos.
