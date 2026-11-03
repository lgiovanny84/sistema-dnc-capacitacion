# Fechas consistentes en reportes

Los reportes de pantalla, CSV y Excel presentan las fechas en día/mes/año. Los campos de fecha del formulario y la base de datos mantienen su representación ISO para validar y ordenar correctamente.

Los valores de registro y actualización permanecen sin convertir dentro del modelo analítico. La presentación usa la zona horaria de Ecuador y el Excel contiene fechas nativas con formatos `dd/mm/yyyy` y `dd/mm/yyyy hh:mm`. Esto evita exportar cadenas ISO o fechas de registro convertidas previamente a texto local ambiguo. La fecha de generación también utiliza el formato común.

Se verifican fechas sin desplazamiento de día, marcas de tiempo que cruzan el límite UTC, tipos y formatos de celdas después de guardar y cargar el archivo, y concordancia del CSV con la pantalla. No se modifican permisos, períodos ni reglas de asignación.
