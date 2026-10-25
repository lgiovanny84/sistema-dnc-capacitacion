# Presupuestos: navegación por grupo y logística adicional

## Flujo del administrador

1. Seleccionar el período e ingresar el presupuesto de capacitación de cada fondo: Institucional, Broker y Otros son independientes.
2. Se muestran todos los grupos ocupacionales activos de la estructura institucional. Distribuir por porcentaje, monto, partes iguales o metodología.
3. Pulsar un grupo para mostrar sus áreas; un área para sus departamentos; un departamento para sus temas.
4. Cada nivel permite distribuir a todos sus elementos en una operación. La ruta superior permite regresar sin perder el borrador.
5. Los temas se cargan únicamente de las necesidades DNC del período, filtradas por grupo, área y departamento. No se ofrecen temas de la matriz sin selección DNC ni creación de temas externos en Presupuestos.
6. Completar la distribución del presupuesto de capacitación hasta los temas. El dinero aún sin distribuir se muestra en cada nivel. Se puede guardar un avance incompleto.
7. Al contar con temas DNC vinculados se habilita Generar presupuesto adicional de logística, incluso con distribución parcial en otros fondos. Registrar alimentación, hospedajes y movilización por tema. Sus sumas generan el presupuesto adicional por fondo.
8. Guardar todos los cambios confirma una revisión completa. La exportación utiliza datos guardados y conserva el formato institucional.

Los campos logísticos vacíos permanecen por definir; cero significa que no existe ese gasto. Los totales conocidos son parciales mientras falten campos. La inversión total final queda pendiente hasta completar ese desglose. Cambiar la distribución de capacitación conserva abierta la etapa logística y los importes digitados.

## Cálculos

- Jerarquía: fondo → grupo ocupacional → área → departamento → tema.
- Los porcentajes se aplican al padre inmediato y suman como máximo 100 %. Los montos fijos no pueden superar el presupuesto del padre. Los cambios del padre recalculan hijos porcentuales; los montos fijos se conservan y se validan.
- Partes iguales concilia centavos por mayor resto. La metodología combina base por personas y variable por puntaje: brecha 40 %, criticidad 30 %, riesgo 20 %, impacto 10 %. El porcentaje base es editable; no se inventan personas ni puntajes faltantes. Los pesos nulos dejan dinero sin distribuir.
- Presupuesto de capacitación: total definido en el fondo.
- Presupuesto adicional de logística: alimentación + hospedajes + movilización de los temas del fondo.
- Inversión total planificada: capacitación + logística completa. La logística no resta ni se limita al presupuesto de capacitación.
- No se supone que COSTO del Excel incluya un desglose de logística. Los registros ejecutados conservan su tratamiento actual; no se inventa ejecución de alimentación, hospedajes o movilización.

## Catálogos y ejecución

Los grupos, áreas y departamentos se obtienen de organizational_structure activa. Se deduplican las relaciones organizacionales repetidas. Los elementos de un grupo no muestran áreas de otro. Se conservan las restricciones de departamento/área institucional y el grupo se hereda durante toda la distribución.

Los cruces automáticos de ejecución requieren correspondencia única entre AREA REQUIRIENTE/departamento, tema y grupo ocupacional si el registro lo informa. Se conservan reglas de recategorización. Cuando no hay coincidencia única, queda pendiente hasta asignar manualmente una actividad. Cada registro se contabiliza una sola vez. Cancelados/anulados/rechazados conservan su exclusión existente.

Las tarjetas por grupo ocupacional utilizan la asignación directa al grupo, consolidada entre fondos. No suman los subtotales de áreas, departamentos o temas sobre ese mismo monto. El costo estimado de cada necesidad permanece separado.

## Datos, seguridad y compatibilidad

training_budget_plans conserva un documento por período (fondos, nodos, vínculos y estado de generación logística). training_budget_revisions guarda autor, fecha y revisión. save_training_budget valida grupo/área/departamento, jerarquía, porcentajes, fondos, relaciones, desglose, existencia de temas DNC antes de registrar logística y revisión esperada. Una transacción con bloqueo del período evita guardados parciales y sobrescrituras concurrentes.

RLS restringe el acceso al administrador activo, no eliminado y con cambio de clave inicial completado. No se permite escritura directa del cliente a tablas; el guardado pasa por la RPC. Se conservan permisos de usuarios y datos históricos. Las tablas del administrador pueden contraerse; la lista principal se muestra abierta para facilitar la distribución. El usuario común no dispone de controles de contracción.

Migraciones: 20261023_independent_budgets.sql, 20261024_budget_organizational_hierarchy.sql y 20261024_budget_groups_and_logistics.sql. Durante la actualización se guardó una asignación con la pantalla anterior. La migración 20261024_preserve_existing_budget_groups.sql añade grupos solo cuando el catálogo identifica uno de forma única; convierte las áreas a montos fijos para conservar exactamente sus valores y todos los descendientes. El presupuesto original queda en el historial. Los fondos permanecen intactos. El archivo Excel original es referencia metodológica; no se importan sus montos de ejemplo.

## Validación

Pruebas de catálogo: todos los grupos, deduplicación, áreas/departamentos dependientes, temas por grupo y necesidades del período. Pruebas de cálculo: reparto masivo, centavos, cuatro niveles y logística superior al presupuesto de capacitación sin reducirlo. Pruebas PostgreSQL: permisos, revisiones, atomicidad, jerarquía, límites y rechazo de logística si queda capacitación por distribuir. Los datos de prueba en producción se verifican dentro de transacciones revertidas.

## Temas exclusivamente desde DNC

La migración 20261024_budget_topics_from_dnc.sql exige vínculo a una necesidad del mismo período, área y departamento cuyo tema coincida. El cliente deduplica temas repetidos y vincula una DNC representativa de forma determinista. Los cambios de nombre de una DNC vinculada se reflejan al cargar la pantalla. Las asignaciones cuyo origen ya no exista se conservan para revisión, fuera de la lista de temas disponibles: no se borran importes automáticamente y no se permite guardarlas sin retirarlas o corregir primero la DNC. El retiro explícito conserva registros ejecutados e historial y deja la asignación por redistribuir.

## Corrección de habilitación de logística

La migración 20261025_logistics_partial_distribution.sql elimina el requisito de distribuir el 100 % de todos los fondos. La logística sigue siendo presupuesto adicional por tema DNC, con controles de importes no negativos y pertenencia al período/departamento. No permite generar logística sin un tema DNC vinculado. Cambiar la distribución de otras áreas no oculta ni borra los gastos logísticos. No modifica montos guardados.

### Matriz consolidada en el Panel ejecutivo

- Resume temas por grupo ocupacional, área y departamento, con participaciones previstas y costo estimado DNC.
- Respeta el período seleccionado y las filas autorizadas por RLS. Además, aplica el alcance del perfil: departamento o área completa según `can_view_entire_area`; sin perfil no presenta filas.
- El administrador consulta asignado, utilizado vinculado y saldo, usando los mismos cálculos de Reportes. Los usuarios conservan el acceso consultivo DNC existente; no se amplían permisos financieros.
- Diez temas por página; sin filtros ni acciones de edición. La contracción sigue siendo exclusiva de tablas del administrador. Los valores desconocidos se distinguen de cero.

### Logística según departamento seleccionado

El editor de logística sigue el departamento de la ruta de distribución y el fondo actual. Al consultar un grupo o área, permite elegir un departamento dentro de ese nivel. La lista de temas, los importes editables y el total adicional corresponden exclusivamente a ese departamento y fondo. Sin departamento seleccionado no se muestran importes de otro departamento. La navegación reinicia la selección del tema; los valores de todos los departamentos se conservan en el borrador y se guardan con «Guardar todos los cambios». Los resúmenes generales por fondo y las exportaciones mantienen su alcance completo del período.

### Períodos cerrados y limpieza de demostración

`closed` controla el cierre administrativo, independiente de `active` (visibilidad). Cerrado o inactivo bloquea altas, modificaciones y eliminaciones de DNC, registros, lotes Excel, presupuesto por departamento, planes/revisiones presupuestarias y solicitudes de corrección. Los disparadores verifican tanto el período original como el destino y comparten bloqueo de fila con la operación de cierre. El acceso consultivo y las exportaciones permanecen disponibles según los permisos existentes. El administrador abre/cierra desde Períodos y guarda los cambios generales.

La operación expresamente solicitada para los datos demo de 2026 está en `supabase/operations/purge_demo_2026.sql`: conserva el período, usuarios y auditoría; elimina los datos operativos de ese período y verifica por hash que los demás períodos permanezcan intactos. No se ejecuta como migración automática ni al ingresar al sistema.

### Presupuestos DNC como propuesta y señales de distribución

La tabla de distribución y su Excel muestran el presupuesto estimado DNC consolidado para cada grupo, área, departamento y tema, dentro del período seleccionado. Las solicitudes del mismo tema se suman una vez por solicitud, sin mezclar estructuras. Costos pendientes no equivalen a cero.

Los temas nuevos del fondo Institucional toman el monto DNC como propuesta inicial editable; si el tema ya tiene asignación en otro fondo, no se duplica automáticamente. Broker y Otros conservan asignación expresa. Las asignaciones ya existentes, incluso cero, se conservan al abrir o actualizar listas. «Usar monto DNC» o «Usar presupuestos DNC de este nivel» reemplaza expresamente la propuesta seleccionada y verifica que siga cumpliendo todos los límites, incluidos los compromisos de niveles inferiores. No incrementa fondos ni modifica la DNC de origen. El guardado general conserva validación de administrador, período, revisión concurrente y jerarquía institucional.

El formulario DNC consulta señales de distribución del grupo, área, departamento y tema. Si la propuesta consolidada difiere de la asignación, o un administrador recategoriza una DNC ya presupuestada, solicita reconocer que debe revisarse la asignación en Presupuestos. Cambiar la propuesta no modifica automáticamente los montos guardados. Las respuestas tardías de otro alcance se descartan y los errores no se presentan como ausencia de presupuesto.

La RPC `dnc_budget_signals` es exclusivamente de lectura, requiere un perfil activo y restringe a cada usuario a su propio grupo, área y departamento. Devuelve únicamente señales booleanas; no expone montos, personas, fondos ni el plan institucional. El administrador mantiene su alcance existente. La comparación reemplaza la estimación de la DNC editada al consolidar solicitudes repetidas, evitando duplicarla.
