# Espacios y ambientes

## Qué resuelve

El módulo administra la infraestructura física sin cambiar la identidad de los
bienes. Separa explícitamente tres dominios:

```text
Sede (N1) → macroárea / sector / edificio / nivel / área / módulo / ambiente
                                              └→ Location heredada → mapas y bienes existentes

Taxonomía del bien (familia, tipo, conjunto, componente) → Taxonomy actual
SKU o inventario de repuesto → catálogo de materiales / inventario actual
```

La ruta espacial se calcula en el servidor, por ejemplo
`INC1-AD-MKT-M04-OF1`. No sustituye `Asset.code`, `fm_code`, QR ni número de
serie: esos identificadores físicos permanecen estables si el activo cambia de
lugar.

## Modelo y CRUD

- `FacilitySite`: sede (N1), código fijo `LLL0` como `INC1`, nombre y dirección.
- `SpaceNode`: árbol de macroárea, sector, edificio, nivel, área, módulo,
  ambiente o punto específico. Cada nodo tiene segmento de código, nombre,
  m², aforo y marca de espacio común.
- Solo administradores pueden crear, editar, archivar o restaurar. No hay
  borrado físico; las acciones quedan auditadas.
- Los tipos permitidos se consultan al servidor según el padre. Se admite la
  rama institucional `sede → macroárea → sector → módulo → ambiente` y la
  rama física `sede → edificio → nivel → área → ambiente`.
- Un `ENVIRONMENT` nuevo crea una `Location` compatible para mantener mapas,
  asignaciones y formularios existentes. Un `BUILDING` nuevo crea su
  `BuildingArea` compatible para sus m².

La interfaz está en **Administración → Espacios y ambientes**. Permite crear
primero una sede y luego navegar, editar, archivar/restaurar y abrir el gestor
de mapas heredado desde la ficha de un ambiente.

## API

Todas las rutas requieren sesión de administrador y están bajo `/api/v1/`:

- `GET, POST /spaces/sites/`
- `GET, PATCH, PUT /spaces/sites/{id}/`
- `POST /spaces/sites/{id}/archive/` y `/restore/`
- `GET, POST /spaces/nodes/`
- `GET, PATCH, PUT /spaces/nodes/{id}/`
- `POST /spaces/nodes/{id}/archive/` y `/restore/`
- `GET /spaces/tree/?site_id=&active=true|false|all`
- `GET /spaces/search/?q=&site_id=&node_type=&active=`
- `GET /spaces/options/?site_id=&parent_id=`
- `GET /spaces/nodes/{id}/impact/`

## Migración segura

Las migraciones son aditivas: crean el árbol y enlaces opcionales desde
`Location` y `BuildingArea`; no cambian los bienes ni los mapas existentes.

```powershell
cd backend
.\.venv-win\Scripts\python.exe manage.py migrate
.\.venv-win\Scripts\python.exe manage.py audit_legacy_locations
```

No se ejecuta un backfill automático. El catálogo histórico contiene rutas
incompletas y códigos repetidos; inferir padres o adueñarse de una ubicación
por coincidencia de texto podría mover activos, mapas o asignaciones. Si una
ruta nueva coincide con una ubicación histórica, se crea una ubicación propia
marcada **Requiere revisión**; el registro anterior y sus dependencias quedan
intactos para una conciliación posterior.

## Decisiones pendientes para una segunda fase

Los apuntes son claros para la estructura espacial, pero aún no para la
clasificación de repuestos. Antes de implementar N5–N9 hay que confirmar:

1. si el macro-código es `AD` o `ADC`;
2. si la garrucha se codifica `GA` o `6A`;
3. si el módulo ejemplo es `M04` o `MT04`;
4. si `SKU10` es un catálogo reutilizable o una unidad física;
5. si la secuencia espacial debe ser estricta o admite las dos ramas físicas
   y operativas anteriores.

Por ello, familia/tipo/conjunto/componente/SKU no se guardan en `SpaceNode`.
Mezclarlos con una ubicación física haría que el traslado de un bien altere
indebidamente su clasificación o su QR.
