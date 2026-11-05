# Visibilidad por DNC y presentación de Ejecución y KPIs

## Alcance

Los selectores de Reportes, tarjetas de grupo, navegación de Presupuestos y listados analíticos usan las DNC del período seleccionado y alcance autorizado. Se comprueba la ruta grupo → área → departamento, sin exigir costo, horas o participantes positivos. La ausencia de DNC no elimina catálogos ni registros.

Administración, configuración de perfiles y creación/edición de necesidades conservan la estructura institucional completa para permitir registrar la primera DNC. Las reglas de cruce y la carga original se conservan para conciliación.

Los nodos presupuestarios guardados no se borran ni recalculan por quedar ocultos. Una reserva sin DNC se muestra como importe agregado y se descuenta de lo disponible para distribución conjunta; las validaciones financieras siguen considerando todos los nodos. Los reportes y Excel omiten sus filas organizacionales. Los gastos de unidades sin DNC se identifican separadamente por total y en la conciliación, sin atribuirlos a otras unidades. El gasto general institucional conserva todos los registros.

## Diseño limitado a Ejecución y KPIs

Contenedor `.execution-workspace`, sin estilos globales nuevos. Se mantienen los cuatro destinos, acciones de importación/exportación, permisos, reglas, modo claro y tablas contraíbles solo del administrador.

| Token o componente | Especificación |
|---|---|
| Texto / navegación activa | #252C57 |
| Texto secundario | #526078 |
| Acento y foco | #006F54 |
| Borde / fondo secundario | #D8E1ED / #F3F6FA |
| Tipografía | Fuente institucional heredada; título 24 px / 700, sección 18 px, etiquetas 13 px, cifras 28 px con números tabulares |
| Espaciado | 8, 16, 24 px |
| Tarjetas | Tres columnas; dos a 900 px; una a 600 px |
| Navegación | Estado aria-pressed, controles de 44 px, foco exterior de 3 px |
| Movimiento | 160 ms; desactivado con prefers-reduced-motion |
| Vacío | Cifras y gráficos existentes sin inventar resultados; filas originales disponibles en carga |

Se consultaron las referencias oficiales de [reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) y [foco visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html) el 5 de noviembre de 2026. No se declara conformidad WCAG completa.

## Validación

- Compilación TypeScript y Vite correcta.
- Pruebas del catálogo presupuestario ajustadas a la presencia de DNC.
- Pruebas de ruta organizacional, DNC sin costo, conservación de asignaciones, exclusión en reportes, conciliación de gasto y conservación de cancelados.
- La vista previa gestionada arrancó, pero Vite rechazó el host terminal.local. La inspección visual móvil/escritorio y con lector de pantalla permanece pendiente; no se modificó la configuración de desarrollo para eludir ese bloqueo.
