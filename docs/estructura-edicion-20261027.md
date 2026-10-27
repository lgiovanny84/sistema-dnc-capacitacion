# Estructura de TI y edición por sección

La estructura activa de COLABORADORES / TECNOLOGÍA DE LA INFORMACIÓN mantiene cuatro departamentos: TECNOLOGÍA DE LA INFORMACIÓN, DESARROLLO DE SOFTWARE, SISTEMAS E INFRAESTRUCTURA y SEGURIDAD INFORMÁTICA. INFRAESTRUCTURA y SISTEMA Y BASE DE DATOS se consolidan en SISTEMAS E INFRAESTRUCTURA, sin reinterpretar los temas solicitados.

Administración → Estructura organizacional permite crear relaciones, modificar grupo/área/departamento, activar o inactivar y guardar todos los cambios de forma atómica. Los originales se comparan antes de escribir para evitar sobrescrituras. Las relaciones en uso no se pueden inactivar. Cambiar grupo o área con presupuesto vinculado requiere reasignar primero la distribución; los conflictos financieros y temas duplicados se rechazan sin escrituras parciales.

Los cambios de nombre propagan perfiles, relaciones de competencias y DNC/registros de períodos abiertos. Los períodos cerrados y las revisiones presupuestarias anteriores se conservan. Las fusiones convierten las asignaciones afectadas a montos exactos antes de unirlas, mantienen los identificadores de temas, vínculos de gastos y logística y generan revisiones a través del validador financiero existente. La matriz conserva las relaciones duplicadas de origen inactivas; no elimina sus contenidos. Los cruces departamentales ambiguos requieren conciliación explícita.

El RPC save_organization_structure es SECURITY DEFINER con search_path vacío, exige un administrador activo que haya cambiado su clave temporal y no está permitido a anon/PUBLIC. La bitácora nueva tiene RLS y lectura solo para administradores. El aviso de advisor sobre ejecución autenticada del RPC corresponde a este acceso deliberado y validado.

La edición de campos existentes admite doble clic o un botón Editar por sección, conserva controles deshabilitados y permite navegación/búsqueda sin activar edición. La matriz ofrece además edición conjunta de sus relaciones; el doble clic abre el editor existente de una relación. Los reportes consultivos y permisos originales no se amplían. El guardado general existente continúa siendo necesario para persistir cambios.

Validación: pruebas de integración PostgreSQL con el validador financiero real (montos, redondeo, logística, historial cerrado, propagación, concurrencia por originales, permisos y rollback de lote), pruebas de interacción de sección y suite completa.
