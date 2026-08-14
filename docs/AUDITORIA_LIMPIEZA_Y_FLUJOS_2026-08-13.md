# Auditoría de limpieza, funcionalidad y flujos

Fecha: 13 de agosto de 2026  
Alcance: backend Django, frontend Vite/React, rutas, dependencias, pruebas y el nuevo dominio de Espacios.

## Resultado ejecutivo

La plataforma compila y los flujos principales auditados tienen cobertura de backend: usuarios, bienes asignados, inspecciones, órdenes de trabajo, inventario y espacios. Se retiró código sin referencias, se eliminó un flujo visual roto del almacén y se redujeron dependencias directas sin uso.

No se recomienda hacer una eliminación masiva adicional. Hay piezas que parecen aisladas pero representan funcionalidad pendiente o datos históricos que no deben desaparecer: la cola offline, `RepairRecord`, `Location` legado y la taxonomía anterior.

## Limpieza aplicada

### Código y rutas sin uso

- Se retiró `ModulePlaceholderPage`, que no tenía ruta ni importación.
- Se retiró `CroquisCarrusel`, que no estaba integrado y apuntaba a tres imágenes inexistentes.
- La guía activa de registro de materiales ahora usa el croquis institucional real (`public/croquis_almacen.png`) en un panel desplegable accesible. Ya no hay referencias a `croquis_almacen_1.png`, `croquis_almacen_2.png` ni `croquis_almacen_3.png`.
- Se confirmó la retirada previa de páginas y datos mock sin rutas activas: escáner QR antiguo, importador aislado de usuarios, registro antiguo de reportantes, creación antigua de incidencias y colecciones mock de bienes, reportes y OT.
- Se conservaron redirecciones de compatibilidad de rutas antiguas hacia los módulos vigentes, para no romper enlaces existentes.

### Dependencias y configuración de frontend

- Se retiraron dependencias directas sin referencias en el código fuente: `date-fns`, `iconoir-react`, `react-hook-form` y `zod`.
- Se retiró la partición manual de Vite para `@zxing`, ya que el paquete y sus imports ya no existen.
- Los comandos `test` y `test:watch` usan ahora el mismo cargador de configuración nativo que desarrollo y build. Esto evita que la ejecución oficial falle por el cargador de configuración del entorno.
- Prettier deja de analizar artefactos generados: `dist`, `.vite`, `coverage`, `test-results`, `playwright-report` y `node_modules`.
- Git ignora desde ahora los nuevos resultados y reportes de Playwright. Los 26 rastros históricos ya versionados requieren retirarse en un commit de limpieza dedicado; no contienen código fuente ni son evidencia de una prueba de producción reproducible.

### Correcciones funcionales verificadas

- El directorio interno de usuarios (`/api/v1/users/`) dejó de ser público: requiere autenticación JWT.
- La búsqueda de inspecciones dejó de consultar un campo inexistente del inspector; busca nombre, apellidos, usuario y código laboral.
- El dashboard de usuario reconoce códigos de trabajador alternos, por lo que no oculta bienes asignados a un alias válido.
- El cálculo de horas de una OT cerrada ya no prolonga una sesión abierta hasta la hora actual. Esto corrige totales anómalos, por ejemplo 44 h 52 min.
- Se retiraron dos serializers OpenAPI sin referencias reales.
- Se retiraron los archivos vacíos de la capa HTTP y el stub de admin de `apps.maintenance`; se preservaron la app, sus migraciones y `RepairRecord`, que sí están en uso.

## Flujos revisados

| Flujo                             | Estado actual                      | Observación                                                                                                    |
| --------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Inicio de sesión y roles          | Correcto en pruebas focalizadas    | Detecta códigos duplicados durante el acceso y notifica a administración.                                      |
| Usuarios, DNI y códigos laborales | Funcional, con deuda de integridad | El alta puede consolidar códigos alternos por DNI; falta blindaje final a nivel de base de datos.              |
| Bienes y asignaciones             | Corregido                          | El panel de usuario resuelve el responsable por código principal o alias.                                      |
| Inspecciones                      | Corregido                          | La búsqueda por inspector ya no usa un campo inexistente.                                                      |
| OT, evidencias y horas            | Corregido                          | Una OT cerrada no suma tiempo indefinido desde una sesión abierta.                                             |
| Almacén y croquis                 | Corregido                          | La guía visual usa un único croquis existente; no se descarga ni muestra contenido inexistente.                |
| Espacios y ambientes              | CRUD nuevo operativo               | Requiere conciliación de ubicaciones históricas antes de producción.                                           |
| Offline                           | Incompleto, no eliminado           | Hay cola, reintento y detección de conflicto, pero no está conectada de extremo a extremo con los formularios. |

## Validación ejecutada

### Backend

- `manage.py check`: correcto.
- `manage.py makemigrations --check --dry-run`: sin migraciones pendientes.
- `ruff check apps config`: correcto.
- Suite focalizada final: **85 pruebas correctas, 5 omitidas** (`accounts`, `assets`, `inspeccion`, `workorders` y `spaces`).
- La suite completa ya había registrado **133 correctas y 5 omitidas** antes de esta limpieza; una repetición completa posterior fue interrumpida por el límite de tiempo del entorno sin registrar fallos antes de la interrupción.

### Frontend

- `npm run build`: correcto.
- `npm test`: **2/2 pruebas correctas**.
- `npm run lint`: correcto con 6 advertencias de hooks/fast-refresh, sin errores.
- Playwright detecta **145 escenarios** en 8 archivos, parametrizados para 360, 390, 768, 1024 y 1440 px. Se intentaron los 20 casos de `critical-flows` (4 casos × 5 tamaños), pero ninguno llegó a abrir la aplicación: falta el Chromium administrado por Playwright. El Chrome instalado en el sistema no se usa automáticamente.
- Los archivos modificados en esta continuidad pasan Prettier.

## Hallazgos que no deben resolverse con borrado

### P1 — Identidad de personas: DNI y códigos

`AccountProfile.dni` aún permite valores vacíos y no tiene unicidad garantizada en la base de datos. El comportamiento solicitado —un DNI como identidad principal y varios códigos laborales como alias— requiere una migración de saneamiento antes de imponer restricciones:

1. Normalizar DNI a 8 dígitos y detectar perfiles duplicados.
2. Elegir un perfil canónico por DNI y mover los códigos alternos sin duplicarlos.
3. Registrar los conflictos de DNI/código que apunten a perfiles distintos para revisión administrativa.
4. Agregar una restricción única condicional para DNI no vacío y preservar `AccountWorkerCode.code` como único global.
5. Usar transacciones y bloqueos al crear/importar para evitar consolidaciones simultáneas.

No se debe simplemente marcar el DNI como `unique=True`: podría bloquear datos históricos que la plataforma debe consolidar, no perder.

### P1 — Privacidad del autollenado público de reportes

El lookup anónimo de reportante por DNI o código devuelve nombre, correo y bienes asignados. Ese comportamiento facilita el formulario público, pero expone datos personales a quien conozca un DNI o código.

Antes de producción debe definirse una medida de protección: pedir DNI y código juntos, ocultar correo y detalles sensibles, añadir OTP/confirmación, aplicar rate limiting y generar auditoría de consultas. La decisión debe conservar el autollenado requerido sin convertir el endpoint en un directorio público.

### P1 — Nueva taxonomía espacial y datos existentes

El CRUD de Espacios separa correctamente sede y árbol espacial de la taxonomía de bienes, pero aún no migra automáticamente las ubicaciones existentes. Las nuevas tablas empezarían vacías en producción mientras `Location`, mapas y activos históricos siguen en el dominio legado.

Antes de activar el nuevo módulo:

1. Crear un comando idempotente de conciliación/backfill.
2. Vincular cada `Location` heredado con un nodo espacial o marcarlo como ambiguo para revisión.
3. Migrar mapas y marcadores sin alterar QR, asignaciones ni fichas públicas.
4. Emitir un reporte de conflictos, no inferir silenciosamente jerarquías institucionales.

También debe alinearse el puente PostgreSQL: nombres de `FacilitySite`/`SpaceNode` permiten 160 caracteres, mientras `Location` y `BuildingArea` conservan campos de 100; las precisiones de m² también difieren. Sin validación o migración de esquema, un dato válido del CRUD nuevo podría fallar al sincronizar al legado.

### P1 — Regla institucional de jerarquía

El árbol espacial actual es flexible. Las notas institucionales muestran una ruta de nueve niveles, pero mezclan ubicación (sede, macroárea, espacio, módulo) con clasificación de bien/componente/SKU. Se debe confirmar si la ruta espacial debe ser estricta o si se aceptan ramas alternativas. La regla debe existir en backend, no solo en la interfaz.

## Deuda priorizada

### P2 — Contratos y calidad

- OpenAPI/Spectacular mantiene 16 errores y 10 advertencias, concentrados en `AssetPdfView`, `BuildingAreaUpdateView`, `WorkOrderPlanningUpdateView` y `WorkOrderQuickAssignView`, además de varios `SerializerMethodField` sin tipo. Completar serializers de request/response y parámetros de los endpoints de Espacios.
- La cola offline detecta conflictos 409/412, pero no se inicializa globalmente ni se usa desde todos los formularios. Añadir estados de conflicto visibles, acción de comparar/reintentar/descartar y pruebas de reconexión.
- La cobertura unitaria frontend es muy baja frente a la superficie de la aplicación: 2 pruebas unitarias para 145 escenarios E2E declarados. Además, los E2E no son todavía una puerta de calidad fiable: varios usan IDs y rutas heredadas (`/ordenes-trabajo/1`, `OT-001`, `diag-1`), datos supuestos, estado de sesión antiguo y aserciones opcionales que pueden ocultar un fallo.
- Falta ampliar pruebas de permisos para supervisor y solicitante en Espacios, además de creación, edición, archivado/restauración, búsqueda y árbol.
- El build PWA precarga aproximadamente 2.57 MiB; CSS comprimido ~84 KiB y varios chunks de proveedor superan 90 KiB gzip. Hacer análisis de bundle y diferir componentes de administración/mapas/reportes si la medición real lo justifica.
- `npm uninstall` informó 32 vulnerabilidades transitivas (26 altas). Revisar `npm audit` en una rama dedicada y actualizar por familias con pruebas, no con `npm audit fix --force`.

### P3 — Mantenibilidad y experiencia

- Resolver las 6 advertencias de ESLint de dependencias de hooks y Fast Refresh.
- El chequeo global de Prettier aún informa deuda histórica de estilo en alrededor de 204 archivos de fuente. Corregirlo en un commit mecánico separado, después de estabilizar los cambios funcionales.
- La capa HTTP vacía de `apps/maintenance` ya se retiró. No eliminar `RepairRecord`, porque sigue alimentando historial y seeders.
- En formularios de Espacios, asociar errores a campos con `aria-invalid`, `aria-describedby` y foco al primer error. Añadir indicador directo de imagen/mapa del ambiente, ya que el mapa interactivo depende de esa evidencia.

## Plan recomendado antes de producción

1. Resolver privacidad del lookup público y consolidar la política DNI/código con una migración reversible y respaldada.
2. Implementar y ensayar el backfill de Espacios sobre una copia de PostgreSQL, con informe de ambigüedades.
3. Completar OpenAPI y ejecutar una prueba de contrato contra frontend.
4. Instalar Chromium de Playwright (`playwright install chromium`), reemplazar los IDs simulados por fixtures/seed E2E, autenticar por rol real y recién entonces ejecutar los 145 E2E en los cinco tamaños de viewport.
5. Corregir warnings de hooks, accesibilidad de formularios y conflictos offline.
6. Revisar dependencias vulnerables y el tamaño de bundle en una rama dedicada.
7. Ejecutar UAT por administrador, Planner, supervisor, técnico y solicitante; incluir asignaciones, fotos antes/después, reportes públicos, OT, bajas y permisos.

## Elementos conservados deliberadamente

- Cola offline y base Dexie: incompleta, pero necesaria para la funcionalidad de sincronización futura.
- `Location`, `BuildingArea`, mapas y taxonomía heredada: siguen siendo fuente de datos de activos, asignaciones e historial durante la transición a Espacios.
- `RepairRecord`: sigue utilizado por historial de bienes y datos de prueba.
- Redirecciones de rutas antiguas: preservan enlaces y QR emitidos anteriormente.
