# Presupuestos independientes y vista compacta

## Alcance y decisión del administrador

Institucional, Broker y Otros son recursos independientes por período. El Excel es una referencia metodológica: no se importan automáticamente los USD 30.000, USD 10.000 adicionales ni sus poblaciones. Los tres fondos empiezan en cero. La distribución por personas y prioridades conserva las ponderaciones de referencia (40/30/20/10); el porcentaje base se selecciona antes de calcular.

## Uso

1. Administración → Períodos mantiene el período institucional existente. Seleccionarlo en el encabezado.
2. Presupuestos → Fondos independientes: ingresar los montos propios de cada fondo.
3. Distribuir: elegir fondo y nivel, agregar áreas o departamentos; dentro del departamento agregar actividades o vincular necesidades del mismo período/área/departamento.
4. Cada asignación utiliza porcentaje del padre inmediato o monto fijo. El cambio del padre recalcula los porcentajes; los montos fijos se conservan. Si dejan de caber, el guardado se bloquea.
5. La herramienta de personas y prioridades propone montos fijos en el borrador. Al cambiar sus datos, ejecutar nuevamente el cálculo; no se ocultan cambios automáticos en esos montos. El porcentaje base usado queda en cada departamento calculado.
6. Desglose de inversión: capacitación, hospedajes, alimentación y movilización dentro del monto asignado a la actividad. Vacío significa por definir; cero significa sin gasto. No se suman dos veces al presupuesto del fondo.
7. Vincular gastos: el cruce automático requiere departamento/AREA REQUIRIENTE y tema únicos. Se conservan las reglas de recategorización actuales. Si el mismo tema aparece en dos fondos, queda pendiente hasta escoger uno. Una selección manual prevalece y puede quitarse para volver al cruce automático.
8. Guardar todos los cambios confirma el período completo en una transacción. Los errores conservan el borrador. Se advierte al cambiar de módulo/período o cerrar la página con cambios pendientes.
9. Exportar utiliza los valores guardados. El reporte presupuestario del módulo Reportes abarca el período completo y lo indica expresamente: los filtros de necesidades no se trasladan implícitamente a ese reporte.

Un registro ejecutado se asigna a una sola actividad/fondo. La división de un mismo registro entre varios fondos no se incorpora en esta versión. Los gastos cancelados/anulados/rechazados conservan la exclusión utilizada por la aplicación existente.

## Datos y seguridad

- `training_budget_plans`: una cabecera por período con revisión y documento estructurado (fondos, nodos, vínculos). El documento constituye una unidad transaccional y permite guardar la sección completa sin actualizaciones parciales de un árbol.
- `training_budget_revisions`: historial inmutable para el cliente, con documento, autor, fecha y revisión.
- `save_training_budget`: RPC de guardado, exclusivamente para administrador activo, no eliminado y con clave temporal ya cambiada. Valida estructura, jerarquía, pertenencia al fondo, período de las relaciones, suma de porcentajes y montos, desglose de inversión y unicidad de gastos.
- RLS restringe lectura a ese administrador. El cliente no tiene permisos de escritura directa: no puede saltarse la RPC. La función usa un `search_path` explícito.
- Bloqueo del período y revisión esperada evitan carreras en la primera creación y sobrescrituras de versiones anteriores.
- Los importes se almacenan en centavos enteros y los porcentajes en centésimas de porcentaje. PostgreSQL calcula con `numeric`; JavaScript usa `BigInt` para multiplicación porcentual exacta. Las fracciones de centavo de asignaciones porcentuales quedan sin distribuir. La propuesta por personas/puntaje distribuye los residuos de su fondo calculado por mayor resto.
- Límite: 10.000 nodos y documento de 10 MB por período. No se admite dependencia circular ni jerarquía distinta de área → departamento → actividad (área opcional).

No hay migración automática de costos estimados a asignaciones. Los períodos sin presupuesto independiente conservan sus comparaciones anteriores. Guardar un presupuesto independiente activa ese origen en el resumen financiero. El banco de horas conserva su metodología: horas por participante × participantes; ejecutadas según filas individuales cargadas.

Las tarjetas de grupo ocupacional toman asignaciones de actividades cuando hay un presupuesto independiente; el dinero aún no distribuido a actividades no se atribuye a un grupo. El costo estimado de la necesidad permanece separado y no se sobreescribe. La edición de una necesidad vinculada muestra su asignación por fondo.

## Vista compacta

`CompactSection` mantiene los hijos montados al contraerlos: preserva formularios y estados. `CompactWorkspace` ofrece expansión/contracción conjunta, también de tablas. La configuración central `compactLayout` permite título, orden visual y estado inicial por identificador; el valor predeterminado es contraído. Al detectar un campo obligatorio inválido se expanden secciones y se enfoca el primer campo. Navegación por teclado y foco visible permanecen disponibles.

Se aplica a indicadores, formularios esenciales, tablas, reportes, usuarios, períodos, catálogos, actividades pendientes y presupuestos. Los controles de navegación, guardado y avisos globales permanecen visibles. Los diálogos de edición conservan su comportamiento.

## Despliegue

1. Aplicar `supabase/migrations/20261023_independent_budgets.sql` en el proyecto existente mediante conexión autorizada.
2. Publicar frontend y comprobar lectura/guardado/recarga con administrador y rechazo con usuario común.
3. Si se publica primero el frontend, los módulos previos siguen operativos y Presupuestos identifica la ausencia de migración/acceso y deshabilita Guardar. No se simula persistencia mediante almacenamiento local.

La migración de presupuestos es independiente de la migración previa de seguridad de autenticación. No implica que dicha migración de autenticación esté aplicada.

## Verificación

- Pruebas automatizadas del proyecto, incluyendo ejecución real de la nueva migración en PostgreSQL embebido (PGlite): permisos, atomicidad, revisión obsoleta, exceso de monto/porcentajes, jerarquía, factores, redondeos, desglose y vínculos.
- Navegador Chromium con React real y datos sintéticos: apertura contraída, conservación al expandir/contraer, creación departamental/actividad, guardado, cambio de fondo y ocultación del módulo para usuario.
- Vista de escritorio 1440 px y móviles 390/320 px sin desbordamiento del documento. Tablas con desplazamiento interno.
- Envío de formulario vacío: expansión y foco visible en Factor.
- Descarga del Excel real y reapertura: hojas Distribución, Resumen por fondo y Gastos sin vincular, con identificación institucional y período.
- Las pruebas de navegador usan una API simulada; no prueban persistencia en Supabase de producción. Esa comprobación requiere aplicar la migración y disponer de la conexión.
