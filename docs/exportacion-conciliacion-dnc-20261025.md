# Exportación y reporte DNC completo

## Corrección de exportación

Se verificaron descargas en una sesión nueva con un build Vite real y el logo institucional. También se comprobó que algunos archivos de ExcelJS de despliegues anteriores ya devolvían 404 en la dirección de producción: una pantalla abierta antes del despliegue podía conservar esa referencia dinámica obsoleta. Este escenario está descrito por Vite: https://vite.dev/guide/build#load-error-handling.

ExcelJS se incorpora ahora al bundle inicial utilizado por la pantalla: exportar ya no depende de descargar después ese fragmento de una versión anterior. Se evita recargar automáticamente la página y perder un borrador. El coste es un bundle inicial mayor; se prioriza la disponibilidad de las descargas en sesiones abiertas durante actualizaciones.

Los enlaces de descarga se adjuntan al documento y sus URL temporales se liberan después de 30 segundos. El mismo tratamiento se aplica a Excel y CSV. La notificación de error incluye una acción comprensible y se conserva el detalle técnico en consola.

Validación en Chromium: las ocho opciones descargaron archivos .xlsx. Se repitió con nuevas solicitudes de JavaScript bloqueadas después de cargar la pantalla. Los archivos se reabrieron con ExcelJS. No se simula una descarga correcta si falla la generación.

## DNC completo y ejecución presupuestaria

Nuevo reporte administrativo, con los filtros existentes y una fila por DNC. Incluye identificadores, registro/actualización, tipo, factor, competencia, brecha, objetivo, cargo, grupo, área, departamento, participantes, horas por participante, indicador, meta, evidencia, prioridad/justificación, fechas, trimestre, modalidad, costo estimado, proveedor, observaciones y estado. Añade fondo, asignado, utilizado vinculado, saldo, referencia financiera y datos pendientes.

Si varias DNC comparten una actividad presupuestaria, sus importes se contabilizan una sola vez en la DNC vinculada. Las otras filas remiten a esa referencia; no se distribuye dinero entre solicitudes sin una regla expresa. El costo estimado de cada DNC permanece independiente de su asignación presupuestaria.

El Excel contiene:

1. Reporte: detalle completo y totales financieros sin duplicar importes compartidos.
2. Conciliación: presupuesto del alcance, asignado a temas, asignado a DNC representadas, utilizado vinculado, saldo, pendiente hasta temas, gastos sin cruce y horas.
3. Gastos sin cruce: registros ejecutados que todavía no tienen actividad/fondo identificados, para no esconderlos dentro de un total atribuido a DNC.

## Revisión de valores entre módulos

Se cotejaron, por período, DNC, asignaciones jerárquicas, ejecución, sumas por área, reporte de capacitaciones recibidas, reporte DNC completo y horas. Se verificó que fondos = asignado a grupos + pendiente en el nivel raíz, y que asignaciones de actividades = importes representados en DNC sin repetir subtotales de grupos/áreas/departamentos.

Planificado por área, asignación a temas y presupuesto total no son magnitudes intercambiables: el remanente queda por distribuir. Los costos estimados DNC tampoco sustituyen el presupuesto asignado. Las horas son horas por participante × participantes en planificación, y duración por registro individual en ejecución.

Se retiró el límite visual de 999 % en cumplimiento de horas para que el porcentaje mostrado conserve su valor real. No se alteran datos registrados, fondos, asignaciones ni registros ejecutados.

La revisión corresponde a una instantánea de lectura, no bloquea nuevos registros de los usuarios. Los datos de producción no se incluyen en el repositorio ni en las pruebas.

## Validación

101 pruebas automatizadas aprobadas y compilación TypeScript/Vite. Casos adicionales: DNC completo con campos originales, distribución financiera compartida una sola vez, hojas de conciliación y gastos sin cruce, descarga con enlace adjunto, costo desconocido frente a cero y cumplimiento de horas por encima de 999 %.

## Gráficos adicionales propuestos, aún no incorporados

- Barras de presupuesto por grupo ocupacional, distinguiendo asignado, utilizado y saldo.
- Pareto de gasto por tema para identificar concentración de inversión.
- Barras de necesidades por modalidad, separando planificación de ejecución.
- Comparativo por proveedor de gasto, horas y registros ejecutados.
- Barras apiladas de completitud por departamento, con registros completos y pendientes.
- Tendencia de gasto acumulado por mes frente al presupuesto del período, sin suponer un calendario mensual de desembolsos que no exista.

### Identificadores institucionales

El DNC completo presenta el código estable `ATU-DO-001-2027` y el solicitante `LSOSA-TALENTO HUMANO`, compuesto por usuario y departamento de la solicitud. El código usa un correlativo global único (mínimo tres dígitos, sin truncarse), con el año de inicio del período. Se conserva tras modificaciones; no se reinicia ni se reutiliza al eliminar filas. Los UUID internos y relaciones presupuestarias permanecen intactos.

Los usuarios se consultan mediante la relación existente con perfiles, respetando RLS. Si el perfil no está disponible se indica expresamente, sin sustituirlo por el UUID. Las referencias de presupuestos compartidos muestran también el código institucional.

El Panel ejecutivo y los reportes administrativos de temas, DNC completo y ejecución incluyen «Pendiente de asignar a temas»: presupuesto del alcance menos asignaciones a actividades, sin sumar niveles jerárquicos ni descontar logística. Sin presupuesto guardado se muestra «Por definir». Los filtros de los reportes aplican a esta tarjeta igual que al detalle.
