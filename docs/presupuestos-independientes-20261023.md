# Presupuestos: navegación por grupo y logística adicional

## Flujo del administrador

1. Seleccionar el período e ingresar el presupuesto de capacitación de cada fondo: Institucional, Broker y Otros son independientes.
2. Se muestran todos los grupos ocupacionales activos de la estructura institucional. Distribuir por porcentaje, monto, partes iguales o metodología.
3. Pulsar un grupo para mostrar sus áreas; un área para sus departamentos; un departamento para sus temas.
4. Cada nivel permite distribuir a todos sus elementos en una operación. La ruta superior permite regresar sin perder el borrador.
5. Los temas se cargan de las necesidades del período y la matriz activa, filtrados por grupo, área y departamento. También puede agregarse un tema externo.
6. Completar la distribución del presupuesto de capacitación hasta los temas. El dinero aún sin distribuir se muestra en cada nivel. Se puede guardar un avance incompleto.
7. Solo después se habilita Generar presupuesto adicional de logística. Registrar alimentación, hospedajes y movilización por tema. Sus sumas generan el presupuesto adicional por fondo.
8. Guardar todos los cambios confirma una revisión completa. La exportación utiliza datos guardados y conserva el formato institucional.

Los campos logísticos vacíos permanecen por definir; cero significa que no existe ese gasto. Los totales conocidos son parciales mientras falten campos. La inversión total final queda pendiente hasta completar ese desglose. Cambiar la distribución de capacitación requiere volver a generar la etapa logística; conserva los importes digitados.

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

training_budget_plans conserva un documento por período (fondos, nodos, vínculos y estado de generación logística). training_budget_revisions guarda autor, fecha y revisión. save_training_budget valida grupo/área/departamento, jerarquía, porcentajes, fondos, relaciones, desglose, finalización de capacitación antes de generar logística y revisión esperada. Una transacción con bloqueo del período evita guardados parciales y sobrescrituras concurrentes.

RLS restringe el acceso al administrador activo, no eliminado y con cambio de clave inicial completado. No se permite escritura directa del cliente a tablas; el guardado pasa por la RPC. Se conservan permisos de usuarios y datos históricos. Las tablas del administrador pueden contraerse; la lista principal se muestra abierta para facilitar la distribución. El usuario común no dispone de controles de contracción.

Migraciones: 20261023_independent_budgets.sql, 20261024_budget_organizational_hierarchy.sql y 20261024_budget_groups_and_logistics.sql. Durante la actualización se guardó una asignación con la pantalla anterior. La migración 20261024_preserve_existing_budget_groups.sql añade grupos solo cuando el catálogo identifica uno de forma única; convierte las áreas a montos fijos para conservar exactamente sus valores y todos los descendientes. El presupuesto original queda en el historial. Los fondos permanecen intactos. El archivo Excel original es referencia metodológica; no se importan sus montos de ejemplo.

## Validación

Pruebas de catálogo: todos los grupos, deduplicación, áreas/departamentos dependientes, temas por grupo y necesidades del período. Pruebas de cálculo: reparto masivo, centavos, cuatro niveles y logística superior al presupuesto de capacitación sin reducirlo. Pruebas PostgreSQL: permisos, revisiones, atomicidad, jerarquía, límites y rechazo de logística si queda capacitación por distribuir. Los datos de prueba en producción se verifican dentro de transacciones revertidas.
