# Catálogo de taxonomía FM

## Propósito

La taxonomía del archivo `TAXONOMIA FM 2026.xlsx` se migra al sistema como un catálogo maestro administrable. El Excel queda como fuente histórica de la carga inicial, pero no es una dependencia de ejecución ni el lugar donde se emitirán nuevos códigos.

## Identificadores que conviven

- `Asset.code`: identificador técnico interno (`INC-BIEN-2026-000189`). Se conserva para compatibilidad.
- `Asset.public_token`: token estable de la URL pública y del QR. No cambia al reclasificar un bien.
- `Asset.fm_code`: código operativo basado en taxonomía (`AAP-0047`). Es el código visible para el trabajo diario cuando el bien ya está clasificado.

## Regla de consecutivos

1. Cada prefijo posee su propio contador.
2. El contador inicia en el mayor correlativo histórico encontrado en el Excel.
3. El siguiente código se asigna únicamente al confirmar el alta del bien; la interfaz solo muestra el formato.
4. La numeración no se reinicia por año.
5. Los números anulados, retirados o históricos nunca se reutilizan.
6. La asignación ocurre dentro de una transacción y con bloqueo del contador para evitar duplicados concurrentes.
7. Los listados se ordenan por prefijo y valor numérico, no por el texto completo del código.

## Normalización aplicada

La lectura estricta encontró 2,262 códigos únicos reconocibles, 1,023 códigos repetidos y 30 filas mal formadas. La normalización controlada —que corrige separadores y espacios sin inventar un prefijo o correlativo— recupera un código adicional y consolida 2,263 códigos únicos, 1,025 grupos duplicados y 26 rechazados. Estas correcciones quedan auditadas; los registros repetidos e incompletos no incrementan los contadores. La hoja principal determina qué códigos fueron efectivamente usados y el mayor correlativo; las hojas específicas solo ayudan a resolver el significado de los prefijos, porque contienen listas precalculadas que no representan ocupación real.

Las variantes de escritura se conservan como alias de búsqueda. Los códigos de bienes existentes no se reescriben.

### Secuencias de control

Estos valores sirven como pruebas de regresión de la carga inicial:

| Prefijo | Último histórico consolidado | Primera emisión disponible |
|---|---:|---|
| `AAP` | 3 | `AAP-0004` |
| `BN` | 489 | `BN-0490` |
| `MC` | 14 | `MC-0015` |
| `MC1` | 14, incluyendo `MD` | `MC1-0015` |
| `ME` | 590 | `ME-0591` |
| `MN` | 15, incluyendo `MND` | `MN-0016` |
| `PI` | 35, incluyendo `P` | `PI-0036` |
| `RAD` | 12 | `RAD-013` |
| `RK` | 28, incluyendo `MK` | `RK-0029` |
| `SL` | 774 | `SL-0775` |
| `TR` | 2, incluyendo `TP` | `TR-0003` |
| `VP` | 239 | `VP-0240` |

`RAD` conserva tres dígitos por continuidad histórica. Los demás prefijos usan cuatro dígitos como mínimo.

### Prefijos históricos bloqueados para nuevas emisiones

| Prefijo histórico | Uso futuro | Motivo |
|---|---|---|
| `SLG`, `SLV`, `SLB`, `SLGV` | `SL` | Propuestas sin uso; el subtipo de silla no abre otra secuencia |
| `SILLA`, `SL-G1` | `SL` | Variantes históricas no normalizadas |
| `MC2` | `MC` | Propuesta sin uso para maceta |
| `MD` | `MC1` | Alias histórico de mesa de comedor; su máximo alimenta la secuencia canónica |
| `P` | `PI` | Alias histórico de pizarra |
| `MK` | `RK` | Alias histórico de rack |
| `TP` | `TR` | Alias histórico de trituradores |
| `MND` | `MN` | Alias histórico de menaje |

Los registros históricos con estos prefijos permanecen consultables. El catálogo impide usarlos en una nueva alta.

## Flujo operativo

1. El administrador mantiene prefijos y reglas en **Administración → Taxonomía → Clasificaciones**.
2. En **Entrada del bien**, el usuario busca por prefijo o nombre y selecciona una clasificación activa.
3. El sistema completa tipo, categoría, subcategoría, especialidad y reglas sugeridas.
4. Al confirmar el registro, el backend asigna el siguiente código FM disponible.
5. Si la clasificación queda pendiente, el bien recibe código técnico y QR, pero no código FM hasta que un administrador lo clasifique.
6. Desde **Administración → Taxonomía → Códigos FM**, el administrador puede consultar los códigos emitidos y asignar el siguiente correlativo a un bien pendiente.
7. La interfaz nunca acepta un correlativo escrito manualmente: el administrador elige el bien y la taxonomía, revisa la vista previa y el servidor emite el código dentro de una transacción.
8. Una taxonomía utilizada no se elimina: se desactiva para preservar la trazabilidad.

## Gobierno del catálogo

- Solo Administrador/FM puede crear o modificar taxonomías.
- Técnicos pueden consultarlas.
- El prefijo y la cantidad de dígitos quedan bloqueados después de emitir el primer código.
- Una taxonomía inactiva, en revisión o con emisión bloqueada no puede generar nuevos códigos.
- No se crean códigos huérfanos ni reservas sin bien: toda emisión queda vinculada a un activo existente y se registra en auditoría.
- Clasificar posteriormente un bien no cambia su código técnico ni el token público utilizado por el QR.
- Cualquier nueva versión de la carga debe ser idempotente y nunca reducir un contador existente.
