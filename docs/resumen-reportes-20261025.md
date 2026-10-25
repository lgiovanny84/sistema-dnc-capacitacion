# Resumen y centro de reportes

## Resumen

Administrador: cuatro tarjetas (necesidades, participaciones previstas, presupuesto de capacitación y gasto registrado). Presupuesto por área con planificado/asignado, gastado y saldo. Pendientes prioritarios y avisos de registros incompletos/sin cruce. Los detalles y gráficos se trasladan a Reportes.

El usuario común conserva solo la información de su alcance. No se le expone ejecución nominal ni presupuestos administrativos. Las participaciones previstas no se presentan como personas únicas.

## Selección de reportes

Administrador: temas, distribución presupuestaria, presupuestado/ejecutado, recibidas, banco de horas, logística y datos pendientes. Cada tipo muestra sus tarjetas, tendencia, comparación y detalle. Filtros de grupo ocupacional, área, departamento y fondo. Cambiar grupo limpia área/departamento; cambiar área limpia departamento. Las opciones se construyen con la estructura activa y datos del período para permitir consulta histórica.

Usuario: reporte de temas en modo consultivo, sin selector de tipos ni filtros; período fijo dentro de Reportes. Se conservan impresión, Excel y CSV.

Los filtros nuevos son locales del centro de reportes: no dejan una selección invisible aplicada en Gestión de necesidades o Resumen.

## Conciliación

Las tarjetas, tabla, gráficos y exportaciones parten del mismo alcance. Reportes recibe datos completos del período (ya limitados por los permisos de la aplicación y de Supabase) y aplica su selección por igual a DNC, presupuesto y ejecución.

El plan por área suma solo nodos de área, nunca los mismos montos de grupos/departamentos/temas nuevamente. Al seleccionar departamento compara asignaciones del nivel departamento. Si no hay presupuesto independiente se identifica que se utilizan costos estimados de DNC; los costos faltantes dejan saldo/porcentaje pendientes.

El gasto utiliza registros ejecutados, excluyendo los estados cancelados/anulados/rechazados existentes. Se clasifica por la actividad presupuestaria vinculada; cuando no hay cruce, intenta identificar área/departamento por las reglas AREA REQUIRIENTE y la estructura institucional. Un área imposible de identificar se muestra por separado. Los gastos sin cruce no desaparecen de los totales generales; al filtrar un fondo solo se incluyen registros cuyo fondo se identificó y se explica esa limitación.

Las horas planificadas corresponden a horas por participante × participantes; ejecutadas según filas individuales. Filtrar por fondo selecciona DNC vinculadas al fondo, no distribuye horas según porcentajes monetarios. No deben sumarse entre fondos si financian una misma DNC.

Logística permanece adicional a capacitación. Campos vacíos y presupuesto logístico aún no generado se identifican como pendientes. No se deduce ejecución logística de un registro cuyo costo no tenga desglose.

## Gráficos y tablas

Tendencia: gasto mensual, horas ejecutadas o necesidades según fecha de inicio planificada, con títulos que distinguen planificación/ejecución. Los registros sin fecha se cuentan fuera de la tendencia; no se inventan meses. Los comparativos utilizan los datos del reporte elegido. Se muestran los diez valores mayores en comparativos extensos; el detalle y Excel incluyen todos.

Tabla con paginación de 25 filas, desplazamiento horizontal interno y montos alineados. La contracción continúa exclusiva de tablas del administrador. Los filtros y botones no se imprimen.

Excel institucional incluye tipo de reporte, período y filtros. Exporta todas las filas seleccionadas, no solo la página visible. El reporte de distribución indica que los niveles son subtotales que no deben sumarse entre sí. CSV conserva el mismo alcance y protege texto que podría interpretarse como fórmula.

## Validación

95 pruebas automatizadas, compilación TypeScript/Vite y navegador Chromium con datos sintéticos: siete reportes, selección de área, gráficos, ausencia de selectores para usuario y vistas móviles 390/320 px sin desbordamiento de página. Excel exportado y reabierto: encabezados institucionales, alcance aplicado y registros más allá de la primera página. Pruebas de conciliación por área, filtros compuestos, duplicación de necesidades, valores pendientes y fechas faltantes.

No se modifica la base de datos, la autenticación ni las asignaciones presupuestarias existentes.
