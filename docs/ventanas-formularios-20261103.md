# Creación y edición en ventanas emergentes

La creación de necesidades y la gestión de usuarios, períodos, competencias, solicitudes, catálogos, estructura organizacional, presupuestos, importaciones y registros recibidos se presentan en diálogos nativos. Los filtros consultivos y las vistas de períodos cerrados conservan su presentación.

`FormWindow` controla únicamente la presentación y utiliza `requestLeave` antes de cerrar. Los formularios existentes mantienen sus validaciones, permisos, solicitudes y guardados generales. Al cerrar, la sección conserva un botón para volver a abrirla.

Los mensajes administrativos y las credenciales recién generadas permanecen dentro de la ventana de usuarios. Los diálogos internos de perfiles y registros conservan el aviso de cambios pendientes. Escape detiene su propagación para evitar cerrar también la ventana superior. Los controles ya situados en un diálogo no necesitan activar un segundo lápiz.

Se usa la capa superior de `dialog.showModal()` para enfoque, teclado y superposición, sin trasladar los formularios a otra raíz de React. El foco vuelve al control de origen al cerrar.

Validación: compilación, 137 pruebas automatizadas y comprobación en Chromium con datos sintéticos de apertura, edición de perfil, protección de borradores, cierre, reapertura y ancho móvil. No se cambian funciones de base de datos, autenticación ni configuración de acceso.
