# Aviso de edición y protección de cambios pendientes

Los controles de sección muestran «Hacer doble clic para editar». Se conserva el acceso por botón para teclado y pantallas táctiles. La edición habilita solo los campos permitidos; los períodos cerrados y controles deshabilitados permanecen protegidos.

La aplicación registra los borradores de cada sección junto con su propio guardado y descarte. Cambiar de módulo, sección administrativa, período, editor o cerrar sesión abre un diálogo con Guardar y continuar, Salir sin guardar y Seguir editando. Guardar ejecuta los mismos validadores y operaciones existentes, espera su confirmación y solo navega cuando no quedan borradores pendientes. Si hay errores de validación, conexión o guardados parciales, permanece en la pantalla sin descartar los registros fallidos.

Se cubren DNC (alta y edición), presupuesto, estructura, matriz de competencias, períodos, catálogos, usuarios/perfiles, registros recibidos, cruces e importaciones pendientes. Los filtros y la paginación de una tabla no se consideran ediciones de datos. La creación de usuarios conserva la pantalla para revisar/copiar las credenciales iniciales antes de continuar.

Al recargar, cerrar la pestaña o abandonar el sitio se usa el aviso nativo beforeunload. Por restricciones del navegador no se puede personalizar ese diálogo ni ejecutar un guardado asíncrono fiable durante el cierre; el guardado con tres opciones corresponde a la navegación interna.

No modifica esquema, permisos ni cálculos financieros. Pruebas: diálogo completo, guardado exitoso/fallido, validación, excepción, descarte explícito, aviso nativo y retención de credenciales; suite existente para permisos y períodos.
