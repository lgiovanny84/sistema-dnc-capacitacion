# Interfaz institucional y controles de acceso

## Experiencia visual

Gestión de necesidades permite abrir la edición autorizada con doble clic sobre la fila. La nueva DNC se registra directamente, sin bloqueo de campos por sección. Se elimina la leyenda repetida y se conserva un botón de lápiz con nombre accesible para teclado y dispositivos táctiles. La confirmación de cambios pendientes continúa activa.

Las tablas del administrador recuerdan su apertura por cuenta, pantalla y esquema de tabla. Los controles globales expandir/contraer también persisten; la preferencia más reciente prevalece. Se guardan únicamente apertura y marca de actualización bajo claves derivadas, sin filas, búsquedas, nombres ni valores financieros. El bloqueo o agotamiento de localStorage no impide operar. Las tablas consultivas del usuario siguen visibles sin controles administrativos.

La capa visual aplica el manual de marca proporcionado, apartados 3.5 y 3.7: azul #252C57, verde #009F4D, naranja #FF6A13 y familia Acto como primera opción local. El PDF no incluye un archivo web completo de la fuente: se conserva una alternativa local Aptos/Segoe UI/Arial hasta disponer de archivos web licenciados. No se extraen ni redistribuyen las muestras de fuente incrustadas en el manual y no se envían peticiones a proveedores externos de fuentes.

## Seguridad y privacidad

La migración refuerza el acceso de cuentas activas con primer ingreso completado, mantiene las autorizaciones departamentales e incluye el área al resolver departamentos del mismo nombre. Los perfiles propios siguen disponibles para el flujo de acceso inicial y estado de la cuenta. Los períodos inactivos quedan fuera de las lecturas ordinarias.

Las funciones internas de disparadores no admiten ejecución directa de clientes. Los RPC destinados al cliente conservan su autorización explícita; ser SECURITY DEFINER es deliberado cuando deben leer datos privados o aplicar transacciones controladas. Las identidades nuevas se crean sin acceso operativo hasta el aprovisionamiento administrativo, ignorando metadatos editables para decisiones de rol/activación. No se cambian contraseñas ni expiraciones existentes.

Las cabeceras de publicación limitan scripts, conexiones e imágenes, impiden incrustar el sistema en marcos ajenos, deshabilitan cámara/micrófono/geolocalización y omiten la referencia de navegación. Se mantiene estilo en línea por los gráficos existentes. Se evita cachear el documento de entrada y se refuerza la exclusión de archivos de entorno y metadatos locales.

La entrega remota de SQL se realizó por operaciones pequeñas ante errores de transporte en el lote completo y terminó con la validación privacy_access_hardening. La migración del repositorio contiene el estado completo, reproducible e idempotente. No hubo cambios de registros o montos: se compararon firmas antes/después y se probaron accesos de solo lectura con los roles reales.

Verificación: pruebas PostgreSQL de aislamiento, primer ingreso, aprovisionamiento y privilegios; pruebas de preferencias; navegador con datos sintéticos y la política CSP de publicación (doble clic, edición directa DNC, apertura/cierre persistentes y vista móvil sin desbordamiento); auditoría de dependencias de producción sin vulnerabilidades reportadas al momento de revisión. La suite completa y compilación pasan.

## Límites de la revisión

El repositorio remoto sigue siendo público; cambiar su visibilidad exige acceso administrativo a GitHub, no disponible en este conector. No se publican el manual ni datos de auditoría, perfiles o presupuestos. La protección contra contraseñas filtradas aparece desactivada en Supabase y requiere configuración del proveedor; no se presenta como resuelta. Las advertencias del advisor sobre RPC autenticados intencionales, el contador privado sin políticas cliente y la extensión existente no equivalen a acceso anónimo.
