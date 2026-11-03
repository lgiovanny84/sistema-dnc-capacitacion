# Reporte completo institucional

La hoja principal conserva las 28 columnas del plan institucional. «Detalle completo» mantiene los 38 campos del reporte ampliado, incluida la referencia financiera. Se agregan hojas por grupo ocupacional con resumen por área y departamento, fondos independientes, conciliación, gastos sin cruce, distribución jerárquica, Gantt y gráficos ejecutivos.

Los filtros y el período autorizado se aplican a todas las hojas. Las fechas se exportan como fechas nativas con formato día/mes/año. El Gantt muestra intervalos planificados; no calcula avance. Los gráficos son imágenes generadas localmente al exportar, con tablas fuente incluidas, sin transmitir datos a servicios externos ni conectarse a Power BI.

La distribución de pantalla y su exportación independiente presentan un solo nivel hijo del alcance seleccionado: grupos, áreas, departamentos o temas. Esto evita sumar varias veces los mismos recursos de los niveles superiores. La hoja jerárquica completa no incorpora una suma global de niveles. Saldo utilizado y recursos pendientes de distribuir se distinguen expresamente.

Las necesidades con presupuesto compartido identifican el fondo de la actividad coincidente por tema, grupo, área y departamento. Los montos continúan contabilizados una sola vez en la DNC vinculada. Una necesidad sin coincidencia real conserva la etiqueta de asignación pendiente; no se inventa un fondo ni se cambia la base de datos.

Validación: pruebas de exportación y recarga XLSX, estructura de columnas, fechas, presupuestos compartidos, fondos, alcance de filtros, conciliación y distribución sin duplicaciones. Se verifica descarga real en Chromium con la política CSP de producción y cuatro imágenes de gráficos. No se modifican permisos, configuración, datos institucionales ni reglas de asignación.
