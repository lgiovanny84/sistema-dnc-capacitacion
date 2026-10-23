# Interfaz empresarial — Sistema de Gestión Integral de Capacitación

Fecha: 23 de octubre de 2026. Especificación de la capa visual y de la opción autorizada para proponer un tema.

## Alcance

El rediseño se implementa en `src/enterprise.css`, después de los estilos existentes. Conserva las acciones, las consultas, los cálculos, los períodos, las validaciones y los permisos. No agrega dependencias de producción ni preferencias de apariencia. Se mantiene el modo claro actual y la identidad de Cooperativa Atuntaqui.

La única ampliación funcional autorizada es **Mi tema no aparece**, en Nueva necesidad. El usuario puede seleccionar una competencia existente o escribir un tema. El texto se guarda en `training_needs.competency`, con el estado Pendiente y la asignación organizacional del usuario. No se escribe en `competency_matrix`. El administrador conserva la revisión y puede editar el tema o incorporarlo manualmente a la matriz desde Administración → Competencias. No requiere migración.

Al alternar entre los modos se conserva el borrador de cada uno. Cambiar factor, área o departamento limpia la competencia dependiente, como en el flujo existente. Los temas históricos que no están en la matriz se muestran como texto editable para el administrador. Se rechazan los temas vacíos o compuestos exclusivamente por espacios; se recortan los espacios de los extremos antes de guardar.

## Etapas y especificaciones por pantalla

| Prioridad | Pantalla o componente | Intervención implementada | Razón de diseño |
|---|---|---|---|
| 1 | Encabezado y navegación | Título de 28 px, descripción de 13 px, período claramente separado, lateral de 248 px y de 80 px contraído. Iconos SVG de línea de 20 px. Nombres accesibles y estado de página actual incluso con menú contraído. | Se distingue el propósito de la pantalla, su contexto temporal y la ubicación del usuario. |
| 1 | Resumen | Etiqueta de 12 px, cifra principal de 28 px, cifras tabulares, tarjetas de al menos 120 px. Mensajes como «Por estimar» de 16 px. Se eliminan adornos circulares y desplazamientos al pasar el cursor. | La cifra ocupa el primer nivel; el estado de ausencia de datos no compite con una cifra real ni simula una acción. |
| 1 | Presupuesto por grupo | Títulos de 13 px, montos de 24 px, pie separado para actividades y estado. Cinco o seis grupos usan tres columnas en escritorio; los anchos pequeños se adaptan a dos o una. | Mantiene alineación y tamaños equilibrados con nombres largos y montos parciales. |
| 1 | Tablas de necesidades, presupuesto y ejecución | Encabezados de 12 px, cuerpo de 13 px, relleno de 12–16 px, filas alternadas y estado de hover discreto. Moneda, duración y porcentajes del cruce alineados a la derecha. Se conserva el desplazamiento horizontal y la contracción. | Permite recorrer filas y comparar números sin perder columnas o acciones. |
| 2 | Nueva necesidad | Contexto organizacional arriba. Secciones numeradas, factor y competencia en un bloque completo, secciones intermedias en parejas y prioridad al final. Una columna en pantallas pequeñas. Planificación propuesta conserva su despliegue actual. | Separa contexto, diagnóstico y planificación sin cambiar la secuencia de lectura ni los campos. |
| 2 | Tema propuesto | Dos botones de selección con estado accesible: «Seleccionar de la lista» y «Mi tema no aparece». Campo de texto con ayuda sobre revisión e incorporación a la matriz. | Explica dónde registrar una necesidad que todavía no está catalogada y quién mantiene la matriz. |
| 2 | Administración | Menú de secciones con botones compactos y seleccionados claramente diferenciados. Indicadores de matriz de 24 px, barra de guardado agrupada, tabla de relaciones y acciones legibles. | Facilita identificar la sección activa y dónde guardar los cambios acumulados. |
| 2 | Reportes | Encabezado institucional, filtros sobre superficie tenue y acciones de exportación con jerarquía primaria/secundaria. En móvil el logo y el título se apilan. | Se distinguen identificación del reporte, alcance filtrado y acción de descarga. |
| 2 | Ejecución y KPIs | Tres columnas para los grupos de métricas en escritorio, cifras de 24 px y dos columnas en móvil. Se conserva la lógica de presupuesto y horas. | Mejora la comparación sin cambiar unidades, valores o fórmulas. |
| 3 | Ventanas emergentes y acceso | Radios de 14–16 px, sombra contenida, encabezado de diálogo separado y controles de 42 px. Se mantienen visibilidad de contraseña, cierre, guardado y protección de cambios pendientes. | Mantiene una presentación consistente en las tareas de edición e ingreso. |
| 3 | Estados y accesibilidad | Foco sólido de 2 px, estados expresados mediante texto además del color, contraste reforzado en campos, ayudas y pie. Animación reducida según la preferencia del dispositivo. | Mejora la orientación con teclado, la lectura y el uso sensible al movimiento. |

## Paleta y contraste

Los colores se centralizan como variables CSS. Las relaciones siguientes se calcularon con luminancia relativa sRGB: `(L_mayor + 0,05) / (L_menor + 0,05)`.

| Uso | Token / color | Fondo de comprobación | Contraste |
|---|---|---|---|
| Fondo general | `--canvas: #f4f7fb` | — | — |
| Panel | `--surface: #ffffff` | — | — |
| Superficie secundaria | `--surface-subtle: #f8fafc` | — | — |
| Texto principal | `--ink-950: #152b43` | `#ffffff` | 14,40:1 |
| Texto secundario | `--ink-600: #55667a` | `#f8fafc` | 5,63:1 |
| Texto auxiliar | `--ink-500: #5c6e83` | `#f4f7fb` | 4,87:1 |
| Acción primaria | Blanco sobre `--brand-700: #1f557f` | `#1f557f` | 7,88:1 |
| Éxito | `#146c4c` | `#eaf6ef` | 5,77:1 |
| Advertencia | `#845514` | `#fff5df` | 5,89:1 |
| Error | `#b02c35` | `#fff0f0` | 5,82:1 |
| Foco sobre superficies claras | `--focus: #176baf` | `#ffffff` | 5,59:1 |
| Borde identificador de campos | `--line-strong: #7c8da1` | `#f8fafc` | 3,25:1 |
| Texto de navegación | `#d5e0ed` | `#10263e` | 11,48:1 |

`--line: #dce3ec` se utiliza en separadores decorativos de paneles y filas. Los campos usan el borde más oscuro. En el lateral oscuro, el foco cambia a `#b5daf5`.

Se verificaron los umbrales de WCAG 2.2 AA de 4,5:1 para texto normal y de 3:1 para información visual necesaria de controles. Esto describe las comprobaciones realizadas, no una certificación integral de conformidad de toda la aplicación y todos sus estados.

Fuentes oficiales consultadas el 23 de octubre de 2026:

- [W3C — Understanding 1.4.3 Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
- [W3C — Understanding 1.4.11 Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).

## Tipografía

Familia: `Inter, "Segoe UI", Aptos, "DejaVu Sans", system-ui, sans-serif`. Se utilizan fuentes disponibles en el dispositivo, sin añadir cargas remotas.

| Nivel | Tamaño | Interlineado | Peso |
|---|---:|---:|---:|
| Título de pantalla | 28 px; 24 px en móvil | 1,25 | 700 |
| Título de panel | 18 px | 1,45 | 650 |
| Título de sección | 15 px | 1,50 | 650 |
| Cuerpo y campos | 14 px | 1,50–1,60 | 400 |
| Etiqueta de campo | 13 px | 1,50 | 600 |
| Texto auxiliar | 12 px | 1,50 | 400 |
| Encabezado de tabla | 12 px | 1,45 | 650 |
| Cuerpo de tabla | 13 px | 1,55 | 400 |
| Cifra principal | 28 px; 24 px en tarjetas secundarias | 1,20 | 700 |
| Estado sin cifra | 16 px | 1,50 | 550 |

Los números utilizan `font-variant-numeric: tabular-nums`. Los textos largos se envuelven en varias líneas; las tablas amplias conservan su desplazamiento horizontal.

## Espaciado, componentes y movimiento

- Escala: 4, 8, 12, 16, 20, 24 y 32 px. Separación entre paneles: 24 px. Relleno de panel: 24 px; 20 px en móvil. Separación entre campos: 20 px.
- Radios: controles 8 px, tarjetas internas 10–12 px, paneles y diálogos 14 px. Sombra de panel: `0 1px 3px rgba(21,43,67,.04)`; diálogo: `0 24px 64px rgba(21,43,67,.18)`.
- Primario: fondo azul y texto blanco. Secundario: fondo blanco y borde visible. Terciario: controles auxiliares como Contraer tabla, con fondo transparente. Destructivo: texto rojo y fondo rojo tenue al pasar el cursor; conserva sus confirmaciones.
- Campos: altura mínima 42 px; controles de acción de 40 px. Se diferencian foco, error nativo, error marcado y deshabilitado sin añadir reglas de validación.
- Transición: 160 ms, `cubic-bezier(.2,.8,.2,1)` para color, borde, fondo y sombra. Las tarjetas informativas permanecen inmóviles al pasar el cursor.
- Con `prefers-reduced-motion: reduce` se desactiva el desplazamiento suave y se reducen las transiciones a una duración imperceptible.
- Los mensajes existentes de guardado, carga y error conservan su contenido y sus condiciones de activación.

## Verificación

- 68 pruebas automatizadas aprobadas. Los nuevos casos comprueban alta de un tema propio, estado Pendiente, período y organización, ausencia de escritura en la matriz, preservación de borradores al alternar, limpieza al cambiar factor, edición histórica y rechazo de espacios vacíos.
- Compilación TypeScript y Vite correcta. Permanece la advertencia previa sobre el tamaño del paquete JavaScript.
- Revisión visual en Chromium con las pantallas reales y una base local de demostración. Se recorrieron Resumen, Nueva necesidad, Necesidades, Reportes, Administración/Competencias y Ejecución.
- Comprobación de anchos 1440, 1280, 1024, 768, 390 y 320 px. Las tablas se desplazan dentro de su contenedor; se corrigieron desbordamientos de acciones y del encabezado de reportes en móvil.
- Verificación de contraste con axe-core en las seis pantallas principales; revisión adicional de foco de teclado en menú contraído y de la preferencia de movimiento reducido.
- Acceso revisado a 1440, 390 y 320 px: sin fallos de contraste detectados ni desbordamiento de página en esas vistas. La opción Mostrar contraseña conserva su funcionamiento.
- Registro desde navegador con rol de usuario y datos sintéticos: una sola escritura en necesidades, estado Pendiente, grupo COLABORADORES y período de demostración 2027. No se modificaron registros de producción durante la prueba.

## Fuera del rediseño visual

No se incorporaron reglas nuevas de aprobación, modificaciones de presupuesto, cambios de permisos o ajustes de autenticación. Cualquier ampliación futura de esas funciones debe tratarse como trabajo funcional independiente. La documentación se refiere al diseño visual y a la opción de tema propio expresamente solicitada.
