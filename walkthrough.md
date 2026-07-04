# Resumen de Cambios (Walkthrough): Sistema de Gestión de Refugios 5.21

Hemos implementado el sistema completo de **Gestión de Usuarios y Control de Acceso basado en Roles (RBAC)** tanto en el Backend (API) como en el Frontend (interfaz de usuario), cumpliendo detalladamente con la jerarquía de permisos y reglas de exclusión de sedes.

---

## Cambios Realizados

### 1. Migración Automática de Base de Datos
*   **[schema.sql](file:///Users/sergiovladimirjimenezvizcaya/Documents/TRABAJO/control-refugios/backend/schema.sql) y [server.js](file:///Users/sergiovladimirjimenezvizcaya/Documents/TRABAJO/control-refugios/backend/server.js):**
    *   Se reordenaron las tablas de la base de datos para definir `refugios` antes de `users`.
    *   Se añadió la columna `refugio_id` a la tabla `users` para vincular cuentas de personal con sedes específicas.
    *   Se agregó la lógica de migración automática en `initDb` para inyectar la columna de forma transparente si no existe.

### 2. Autenticación y Middlewares en el Backend (API)
*   **JWT Payload:** Se inyectó `refugio_id` en el payload del token firmado durante el inicio de sesión y en `/api/auth/me`.
*   **Middleware Global de Acceso (`checkRefugioAccess`):** Intercepta todas las peticiones a la API. Si el usuario pertenece a una sede específica (ej. Gerente o Personal Operativo), bloquea con un `403 Forbidden` cualquier consulta o mutación que apunte a un `refugio_id` diferente (por ejemplo, mediante la ruta `/api/refugios/:refugio_id/*` o en los parámetros de consulta y cuerpo).
*   **Middleware de Solo Lectura para Supervisor (`restrictSupervisorModify`):** Impide que usuarios con rol `supervisor` realicen peticiones `POST`, `PUT` o `DELETE` sobre datos operativos internos de los refugios (residentes, camas, inventarios, etc.), permitiéndoles únicamente gestionar cuentas de usuarios (Gerentes) y sedes (`/refugios`).
*   **Endpoints de Usuarios (`GET`, `POST`, `DELETE` `/api/users`):**
    *   Se valida la jerarquía: un Supervisor solo puede crear/eliminar Gerentes. Un Gerente solo puede crear/eliminar personal operativo de su propia sede (`medico`, `seguridad`, `cocina`, `almacen`, `registro`, `apoyo`).

### 3. Seguridad de Rutas y Redirecciones en Frontend
*   **[App.jsx](file:///Users/sergiovladimirjimenezvizcaya/Documents/TRABAJO/control-refugios/frontend/src/App.jsx):**
    *   Se implementó el ayudante de permisos `hasAccess(user, path, refugioId)`.
    *   Se creó el componente `<ProtectedRoute>` que envuelve a cada ruta en React Router. Si un usuario intenta ingresar manualmente escribiendo la URL de un módulo al que no tiene acceso, es redirigido de inmediato a su pantalla de inicio designada (ej: el médico al triaje, el cocinero al comedor, el gerente al panel general).
    *   **Corrección de Sincronización:** Se añadió un `useEffect` reactivo dentro de `<ProtectedRoute>` para detectar la Sede de la URL (`:refugioId`) y disparar la hidratación automática de `selectedRefugio`. Esto asegura que cuando un médico, cocinero o gerente ingrese directamente a sus paneles específicos (bypasseando el selector general de sedes), la barra lateral y el encabezado reconozcan correctamente la Sede activa y muestren todos sus accesos.
    *   **Control de Estado de Carga:** Se implementó una pantalla de carga para evitar que la interfaz de la barra lateral se renderice antes de recibir el perfil de usuario del backend, evitando errores de referencia nula.
*   **[Welcome.jsx](file:///Users/sergiovladimirjimenezvizcaya/Documents/TRABAJO/control-refugios/frontend/src/pages/Welcome.jsx):**
    *   Se configuró una redirección automática para usuarios que pertenecen a una sede fija, impidiendo que accedan al selector general de sedes y enviándolos directo a su panel.
    *   Se ocultaron los botones de creación y edición de sedes para usuarios que no sean administradores o supervisores.
*   **[Sidebar.jsx](file:///Users/sergiovladimirjimenezvizcaya/Documents/TRABAJO/control-refugios/frontend/src/components/Sidebar.jsx):**
    *   Se condicionó la visualización de los enlaces laterales en base al rol del usuario logueado.
    *   Se ocultó por completo el botón "Cambiar Sede" para gerentes y personal operativo.
*   **[server.js](/Users/sergiovladimirjimenezvizcaya/Documents/TRABAJO/control-refugios/backend/server.js):**
    *   **Corrección de `/api/auth/me`:** Ahora consulta directamente la base de datos para obtener el registro del usuario en lugar de solo descodificar el token JWT de forma estática. Esto soluciona problemas de inconsistencias cuando un usuario cambia de rol o de Sede en la base de datos y su token local aún no ha sido regenerado.

### 4. Interfaz de Gestión de Usuarios
*   **[Configuracion.jsx](file:///Users/sergiovladimirjimenezvizcaya/Documents/TRABAJO/control-refugios/frontend/src/pages/Configuracion.jsx):**
    *   Se rediseñó la página usando pestañas premium ("Distribución Física y Camas" y "Gestión de Personal y Cuentas").
    *   Se integró un formulario de creación de personal y una tabla de personal registrado, respetando estrictamente las jerarquías (los supervisores solo ven/crean gerentes; los gerentes solo ven/crean su personal local).

### 5. Planificación de Menús y Requerimientos de Cocina
*   **[LogisticsMenus.jsx](file:///Users/sergiovladimirjimenezvizcaya/Documents/TRABAJO/control-refugios/frontend/src/pages/LogisticsMenus.jsx):**
    *   **Eliminación de Calorías:** Se eliminaron las referencias a kcal en las celdas, el promedio diario nutricional y el campo de entrada en el modal.
    *   **Especificación de Ingredientes:** Se añadió un área de texto para ingresar los insumos de cada comida (ej: `Harina PAN: 5, Pollo: 2 kg`). Los ingredientes configurados ahora se visualizan directamente en la celda del calendario semanal.
    *   **Cálculo e Integración de Inventario:** Se sumaron los ingredientes requeridos para la semana, comparándolos con el stock real de alimentos. Se renderiza un cuadro con la cantidad *Requerida*, *Stock* y *Faltante*.
    *   **Pedidos Automáticos y Manuales:**
        *   Se incorporó un botón dinámico para pedir las cantidades exactas faltantes de ingredientes al almacén central en un solo lote.
        *   Se añadió un panel de solicitud manual para pedir alimentos adicionales por unidad y cantidad al almacén central.
    *   **Desglose del Estado de Dietas:** Se expandió el cuadro agregando contadores específicos analizando las condiciones médicas de los residentes activos: Lactantes (fórmulas), Hipertensos (bajos en sodio), Diabéticos (bajos en azúcar) y Alergias alimentarias.

---

## Verificación de Calidad

*   La aplicación compila limpiamente (`npm run build` en 900ms).
*   Se desarrolló y ejecutó un **script de pruebas de integración backend (`test_rbac_api.js`)** que valida todas las restricciones del API:
    *   Admin crea Supervisor (Pasa).
    *   Supervisor intenta crear Cocina (Falla con 403 - Pasa).
    *   Supervisor crea Gerente Sede 4 (Pasa).
    *   Gerente Sede 4 intenta leer camas Sede 1 (Falla con 403 - Pasa).
    *   Gerente intenta crear Gerente (Falla con 403 - Pasa).
    *   Gerente crea Cocinero Sede 4 (Pasa).
*   *Todas las pruebas pasaron con éxito.*

---

## Cambios Adicionales (Versión 5.22): Escolarización, Control de Visitas, Historial de Incidencias de Seguridad y Centro de Comando de Reportes

Hemos implementado con éxito todas las funcionalidades de censo escolar, bitácora de incidencias de seguridad, consulta de visitas autorizadas, e integración de reportes de comando.

### 1. Migración y Endpoints de Incidencias en el Backend
*   **[schema.sql](file:///Users/sergiovladimirjimenezvizcaya/Documents/TRABAJO/control-refugios/backend/schema.sql) y [server.js](file:///Users/sergiovladimirjimenezvizcaya/Documents/TRABAJO/control-refugios/backend/server.js):**
    *   Se creó la tabla `incidents` para llevar la bitácora de novedades, altercados y emergencias de seguridad vinculando opcionalmente al residente involucrado.
    *   Se implementaron los endpoints `GET /api/refugios/:refugio_id/incidents`, `POST /api/refugios/:refugio_id/incidents`, y `GET /api/residents/:resident_id/incidents`.

### 2. Captura de Datos de Escolarización y Familiares en Caracas
*   **[Registration.jsx](file:///Users/sergiovladimirjimenezvizcaya/Documents/TRABAJO/control-refugios/frontend/src/pages/Registration.jsx) y [Residents.jsx](file:///Users/sergiovladimirjimenezvizcaya/Documents/TRABAJO/control-refugios/frontend/src/pages/Residents.jsx):**
    *   **Escolarización para menores:** Si el residente ingresado tiene menos de 18 años, el sistema de registro y edición muestra los campos: ¿Está escolarizado?, Centro Educativo y Grado Cursado.
    *   **Familiares en Caracas:** Se habilitó un campo de texto detallado de familiares en Caracas que se despliega si se responde "Sí" a tener familia en la ciudad.
    *   Todos estos campos extendidos se guardan y leen directamente dentro de la metadata en la columna `special_needs`.

### 3. Control de Acceso, Visitas e Incidencias (Seguridad)
*   **[ControlAcceso.jsx](file:///Users/sergiovladimirjimenezvizcaya/Documents/TRABAJO/control-refugios/frontend/src/pages/ControlAcceso.jsx):**
    *   **Botones de Alto Contraste:** Se rediseñaron los botones de ingreso y salida con esquemas cromáticos verde (ingreso) y rojo (salida) de alto contraste visual.
    *   **Estructura de Tres Pestañas:**
        1.  *Tránsito de Residentes:* Panel con el lector QR y la bitácora de accesos.
        2.  *Consultar Visitas y Apoyos:* Buscador interactivo de residentes que muestra quiénes son los familiares autorizados para visitas, si tiene parientes en Caracas (con el detalle de ubicación) y números de emergencia.
        3.  *Reportar Incidencias:* Formulario para registrar novedades, altercados o emergencias vinculando opcionalmente a un residente de la sede, además de un log de incidencias recientes de la sede.

### 4. Historial Operativo en Ficha de Residente
*   **[Residents.jsx](file:///Users/sergiovladimirjimenezvizcaya/Documents/TRABAJO/control-refugios/frontend/src/pages/Residents.jsx):**
    *   Se integró una sección destacada de "Historial de Incidencias / Alertas de Seguridad" en la ficha modal de detalles y edición del residente, listando cronológicamente las alertas asociadas a la persona con fecha, hora, tipo de alerta, detalles y acciones correctivas.

### 5. Centro de Comando de Reportes de Sede
*   **[Reports.jsx](file:///Users/sergiovladimirjimenezvizcaya/Documents/TRABAJO/control-refugios/frontend/src/pages/Reports.jsx):**
    *   Se reestructuró la página en un panel de control con métricas en tiempo real: Ocupación física de camas, porcentaje de escolarización de menores de edad, incidencias operativas y demografía general.
    *   **Desglose detallado de menores:** Tabla interactiva que divide a los menores de 18 años en rangos adaptados: Primera Infancia (0-2 años), Preescolar (3-5 años), Primaria (6-11 años) y Adolescentes (12-17 años) desglosados por sexo.
    *   **Ficha Clínica y Salud:** Listado unificado de patologías crónicas del refugio (hipertensión, asma, diabetes, renal) y tabla de pacientes en observación médica activa con detalles y tratamientos sin exponer JSON plano.
    *   **Logística de escuelas:** Muestra un recuento de estudiantes activos por cada centro educativo representado.

---

## Cambios Recientes (Versión 5.23): Historial Epidemiológico Completo, Integración Médica/Inventarios en Dashboard de Gerente y Exportación PDF

Hemos implementado las mejoras de visualización médica e inventarios consolidando la información de la sede para el Gerente y facilitando la exportación del reporte:

### 1. Historial Epidemiológico Completo (Médico)
*   **[MedicalReport.jsx](file:///Users/sergiovladimirjimenezvizcaya/Documents/TRABAJO/control-refugios/frontend/src/pages/MedicalReport.jsx):**
    *   Se modificó el botón **Ver Historial Epidemiológico Completo**. En lugar de redirigir al reporte general del gerente, ahora despliega un modal interactivo dentro del mismo módulo médico.
    *   El modal incluye un buscador en tiempo real y una tabla detallada con todos los residentes de la sede, mostrando su edad, sexo, estado de salud actual, patologías preexistentes diagnosticadas (diabetes, hipertensión, asma, etc.), alergias alimentarias/médicas y su tratamiento activo o indicaciones médicas vigentes.

### 2. Consolidado de Salud en Dashboard de Gerente
*   **[Reports.jsx](file:///Users/sergiovladimirjimenezvizcaya/Documents/TRABAJO/control-refugios/frontend/src/pages/Reports.jsx):**
    *   Se integró una sección completa con el **Resumen Consolidado del Módulo de Salud** mostrando métricas de mujeres embarazadas activas, contadores agrupados de enfermedades crónicas de la población (hipertensión, asma, diabetes, insuficiencia renal) y la tabla de fichas clínicas de pacientes bajo observación médica con tratamientos vigentes.

### 3. Consolidado de Inventarios y Alertas Críticas
*   **[Reports.jsx](file:///Users/sergiovladimirjimenezvizcaya/Documents/TRABAJO/control-refugios/frontend/src/pages/Reports.jsx):**
    *   Se añadió un **Resumen de Inventarios** que expone el total de unidades de insumos en stock general y su distribución por categorías (Medicinas, Alimentos, Higiene, etc.).
    *   Se implementó un bloque de **Alertas Críticas de Insumos** dividido en dos secciones:
        1.  *Medicinas y Medicamentos Críticos:* Insumos de farmacia agotados o por debajo de su umbral mínimo de seguridad.
        2.  *Alimentos y Otros Insumos Críticos:* Alimentos, productos de higiene u otros insumos con stock crítico.
    *   Esto permite al Gerente anticipar y coordinar donaciones o compras de manera directa y ágil.

### 4. Exportación PDF del Reporte de Sede
*   **[Reports.jsx](file:///Users/sergiovladimirjimenezvizcaya/Documents/TRABAJO/control-refugios/frontend/src/pages/Reports.jsx):**
    *   Se integró un botón de **Exportar a PDF / Imprimir** en el encabezado del panel de control que activa `window.print()`.
    *   Se diseñó una hoja de estilos de impresión avanzada (`@media print`) que oculta elementos innecesarios (barra lateral de navegación, cabecera general de la app, botones de sincronizar y exportar) y expande el reporte a pantalla completa con colores e identificadores optimizados para generar un documento PDF limpio, profesional y listo para compartir.
    *   **Corrección de Margenes y Encabezado:** Se mejoró la hoja de estilos de impresión para ocultar el header superior de navegación (`header.fixed`), eliminar el margen lateral izquierdo del sidebar (`margin-left: 0`) y definir márgenes físicos de impresión uniformes (`@page { size: letter portrait; margin: 18mm; }`), asegurando un documento PDF balanceado y estéticamente impecable.

---

## Cambios Recientes (Versión 5.24): Reporte Consolidado Nacional / Estadal, Filtro por Rango de Tiempo y Ajuste de Márgenes de Impresión (1 cm)

Hemos implementado el sistema completo de reportes nacionales consolidables y filtros temporales de monitoreo para la toma de decisiones al más alto nivel:

### 1. Nuevos Endpoints Globales en el Backend
*   **[server.js](file:///Users/sergiovladimirjimenezvizcaya/Documents/TRABAJO/control-refugios/backend/server.js):**
    *   **`GET /api/incidents`:** Permite a los usuarios supervisor global y administrador obtener el historial de novedades de seguridad y emergencias registradas en todos los centros de refugio del país en un solo llamado.
    *   **`GET /api/inventory`:** Permite obtener el stock total consolidado de todas las sedes operativas del país para detectar faltantes de forma masiva.

### 2. Módulo de Reporte Consolidado Nacional y Estadal (Presidente de la República)
*   **[ConsolidatedReports.jsx](file:///Users/sergiovladimirjimenezvizcaya/Documents/TRABAJO/control-refugios/frontend/src/pages/ConsolidatedReports.jsx):**
    *   Se creó una nueva interfaz analítica y gerencial premium para el supervisor global y el superusuario.
    *   **Selector de Ámbito:** Permite elegir entre un análisis consolidado de **Todo el País (Nacional)** o filtrar por un **Estado Específico** (Zulia, Miranda, Distrito Capital, etc.).
    *   **Listado Detallado de Sedes:** Muestra una tabla comparativa con la capacidad, ocupación real, alertas críticas de stock y pacientes bajo observación de cada refugio del ámbito seleccionado.
    *   **Censo, Demografía de Menores y Colegios:** Agrupa y consolida los rangos de edad de menores de 18 años cruzados por sexo y el listado de colegios con sus respectivas matrículas activas.
    *   **Consolidado de Salud y Observación Médica:** Centraliza las patologías crónicas de la población y expone la ficha de pacientes bajo observación detallando en qué sede está albergada la persona.
    *   **Consolidado de Almacén e Incidencias:** Sumariza los insumos en stock, agrupa las alertas de medicamentos y alimentos críticos identificando la sede correspondiente, y lista las novedades de seguridad nacionales.

### 3. Filtro por Rango de Tiempo Reactivo
*   **[Reports.jsx](file:///Users/sergiovladimirjimenezvizcaya/Documents/TRABAJO/control-refugios/frontend/src/pages/Reports.jsx) y [ConsolidatedReports.jsx](file:///Users/sergiovladimirjimenezvizcaya/Documents/TRABAJO/control-refugios/frontend/src/pages/ConsolidatedReports.jsx):**
    *   Se incorporó una fila con selectores de fecha (**Desde** y **Hasta**) en la cabecera de ambos reportes.
    *   Al seleccionar fechas, los reportes recalculan reactivamente en el cliente todos los censores demográficos, tasas de escolaridad, recuentos de salud, tránsitos, incidencias de seguridad y alertas de insumos dentro de ese periodo, permitiendo analizar la variabilidad histórica.

### 4. Ajuste Definitivo de Márgenes de PDF (1 cm Mínimo)
*   **Estilos de Impresión (`@media print`):**
    *   Se ajustó el espaciado global de impresión a **`padding: 10mm !important`** en las envolturas del reporte.
    *   Esto garantiza un margen de **1 cm** uniforme a los cuatro lados (superior, inferior, izquierdo, derecho) al exportar a formato PDF Carta/A4, eliminando cualquier corte o amontonamiento contra los bordes de la página.

### 5. Integración de Navegación y Rutas
*   **[App.jsx](file:///Users/sergiovladimirjimenezvizcaya/Documents/TRABAJO/control-refugios/frontend/src/App.jsx) y [Sidebar.jsx](file:///Users/sergiovladimirjimenezvizcaya/Documents/TRABAJO/control-refugios/frontend/src/components/Sidebar.jsx):**
    *   Se importó e integró la ruta protegida `/reportes-consolidados`.
    *   Se configuró el acceso para que el menú de "Reporte Consolidado" se muestre de forma permanente en la barra lateral para el Administrador y el Supervisor Global, tanto si están consultando una sede específica como si están en la pantalla general de selección.

---

## Cambios Recientes (Versión 5.25): Modal Interactivo de Salud, Indicadores Socioeconómicos (SAIME, Empleo y Vivienda Colapsada) y Selector de Estado en Sede

Hemos completado la optimización UX del módulo de salud y la adición de indicadores socioeconómicos clave:

### 1. Modales Interactivos de Patologías (UX Optimizada)
*   **[Reports.jsx](file:///Users/sergiovladimirjimenezvizcaya/Documents/TRABAJO/control-refugios/frontend/src/pages/Reports.jsx) y [ConsolidatedReports.jsx](file:///Users/sergiovladimirjimenezvizcaya/Documents/TRABAJO/control-refugios/frontend/src/pages/ConsolidatedReports.jsx):**
    *   Se reemplazaron las tablas infinitas del módulo de salud por **tarjetas interactivas de patología**.
    *   Al hacer clic en cualquier patología (Hipertensión, Diabetes, Asma, Renal, Otras), el sistema abre una **ventana modal flotante premium** que renderiza el listado detallado de esos pacientes, su documento de identidad, su estado clínico y su tratamiento.
    *   En el reporte consolidado nacional, el modal también indica la sede/refugio exacta donde está albergado cada paciente.

### 2. Nuevos Indicadores Socioeconómicos e Identificación
*   **Censo SAIME (Identificación):** Métrica que consolida a los residentes que no poseen cédula o cuya documentación física se encuentra extraviada (se lee desde la propiedad `documento_perdido` en metadata o cuando el campo `document_id` no está definido), listos para los operativos de identidad.
*   **Situación Laboral (Solo Mayores de Edad):** Segmenta a la población adulta en personas **Con Empleo** y **Sin Empleo** activo para planificar programas de inserción productiva.
*   **Pérdida de Vivienda:** Calcula la cantidad de familias que reportaron pérdida total o colapso de su hogar (`Colapso total / Destruida`), y suma a todos los integrantes de sus grupos familiares para dar un número real de personas damnificadas en esa categoría.

### 3. Registro Territorial de Sedes (Selector de Estado)
*   **[Welcome.jsx](file:///Users/sergiovladimirjimenezvizcaya/Documents/TRABAJO/control-refugios/frontend/src/pages/Welcome.jsx) y [server.js](file:///Users/sergiovladimirjimenezvizcaya/Documents/TRABAJO/control-refugios/backend/server.js):**
    *   Se implementó el selector dropdown de estados de Venezuela en la ventana de creación y edición de sedes operativas.
    *   El campo `estado` se persiste en la base de datos (con migraciones automáticas) y alimenta de forma precisa la agrupación y filtrado de reportes territoriales en el panel consolidado.

### 4. Registro Multilateral de Incidencias con Roles
*   **Buscador y Selección Múltiple:** Se reemplazó el selector simple de un único residente por un buscador reactivo que permite agregar a múltiples personas involucradas en una incidencia (médica, convivencia o seguridad).
*   **Asignación de Roles Específicos:** Se puede definir el rol de cada persona en los hechos: **Víctima**, **Denunciante**, **Agresor** o **Testigo**.
*   **Historial en la Ficha del Residente:** La base de datos y la API se modificaron (`involved_residents TEXT`) para almacenar esta estructura JSON. En **[`Residents.jsx`](file:///Users/sergiovladimirjimenezvizcaya/Documents/TRABAJO/control-refugios/frontend/src/pages/Residents.jsx)** se visualizan las incidencias y denuncias donde el residente estuvo involucrado, destacando su rol registrado. Esto sirve como respaldo legal ante la Fiscalía o cuerpos de seguridad.

### 5. Corrección de la Pestaña "Consultar Visitas y Apoyos"
*   Se corrigió un error de referencia al declarar el helper de filtrado reactivo `filteredResidentsForVisits` en **[`ControlAcceso.jsx`](file:///Users/sergiovladimirjimenezvizcaya/Documents/TRABAJO/control-refugios/frontend/src/pages/ControlAcceso.jsx)**, restableciendo el correcto funcionamiento de la pestaña de consulta de autorizaciones de visitas y familiares de apoyo en Caracas.




