# Taxonomía FM y mapa de instalaciones

## Propósito y alcance

Este documento define cómo conciliar la información textual y espacial de un plano
DWG con el catálogo de taxonomía FM y los bienes registrados en FM Incalpaca. Su objetivo es
preservar la trazabilidad sin convertir coincidencias de texto en ubicaciones o
activos de manera automática.

La regla conceptual que gobierna toda la integración es:

> **La taxonomía responde qué es el bien; la ubicación responde dónde está; el
> responsable responde quién lo tiene.**

Estas tres dimensiones son independientes. Una clasificación puede utilizarse para
filtrar o representar bienes en el mapa, pero nunca determina por sí sola un área,
un ambiente, una coordenada o un responsable.

Este análisis documenta la relación ya implementada entre el plano, la taxonomía y
el inventario. También deja explícitos los límites del modelo actual para evitar que
una coincidencia textual se interprete como un bien o una ubicación confirmada.

## Evidencia técnica del DWG analizado

Los siguientes valores forman la línea base verificable de la versión inspeccionada:

| Evidencia | Resultado |
|---|---:|
| Versión DWG | `AC1032`, familia AutoCAD `R2018` |
| Capas devueltas por `dwglayers` | 91 |
| Objetos del JSON derivado | 54,646 |
| Entidades `TEXT` | 1,612 |
| Entidades `MTEXT` | 240 |
| Total `TEXT` + `MTEXT` | 1,852 |
| Coincidencias reportadas por `dwggrep` | 2,127 |
| Candidatos con forma `PREFIJO-(dígitos|XXXX)` | 126 |
| Marcadores con prefijo vigente en `Taxonomy` | 22 |

La cifra operativa de capas es **91**. Cualquier inventario preliminar que indique
95 capas debe considerarse reemplazado por el resultado de `dwglayers` y volver a
comprobarse si cambia el archivo fuente.

Los 2,127 resultados de `dwggrep` no equivalen a 2,127 entidades de texto. Esa
herramienta también encuentra coincidencias dentro de bloques y una misma entidad
puede producir más de una coincidencia. Para inventariar texto se utiliza el total
de 1,852 entidades `TEXT`/`MTEXT`; para descubrir candidatos se conserva el conteo
de ocurrencias de `dwggrep` junto con su contexto.

Todos estos valores corresponden exclusivamente a la versión analizada. Una nueva
versión del plano debe identificarse por su propia versión y huellas SHA-256 antes
de comparar conteos.

## Capas relevantes

### Texto y candidatos de identificación

| Capa | Evidencia y uso esperado |
|---|---|
| `TEXTO-clave` | 849 entidades `TEXT`/`MTEXT`; concentra principalmente equipos y mobiliario. Es la primera fuente de candidatos FM. |
| `TEXTO` | 466 entidades; contiene ambientes, rótulos generales y códigos FM. Requiere distinguir identificadores completos de texto descriptivo. |
| `ROTULO` | 280 entidades; predominan áreas administrativas y valores en m². Sirve para proponer nombres espaciales, no para crear áreas sin revisión. |
| `CODIGOS DETALLE` | Capa candidata para códigos y referencias de detalle; toda coincidencia debe pasar por las mismas reglas de validación. |

Las tres primeras capas reúnen 1,595 de las 1,852 entidades de texto. Las 257
restantes se distribuyen entre otras capas y no deben descartarse únicamente por
su nombre de capa.

### Elementos de bienes e instalaciones

- `MOBILIARIO`, con 5 objetos observados en el inventario de capas.
- `MUEBLES`.
- `SANITARIOS`.
- `INSTALACIONES AA`.

Estas capas ayudan a contextualizar el tipo de elemento dibujado. No demuestran que
un texto cercano corresponda al mismo objeto ni reemplazan la coincidencia exacta
con `Asset.fm_code`.

### Estructura espacial y cerramientos

- `MUROS`, `MUROS_` y `MURO`.
- `PISOS`, `A-PISOS` y `HATCH PISO`.
- `PUERTAS` y `4.- Puertas`.
- `VIDRIOS`.

Estas capas pueden ayudar a construir una representación visual o delimitar
ambientes, pero no contienen por sí mismas la jerarquía de sedes, edificios y
niveles. La geometría inferida debe revisarse antes de publicarse.

### Referencias, cotas y planos base

- `C- COTAS`, `Cotas` y `Cotas - General`.
- `PLANO BASE GRIS`.
- `PLANO 1` y `PLANO 3`.

Las cotas, cajetines, leyendas, detalles y planos base son fuentes frecuentes de
falsos positivos. No deben generar activos ni marcadores operativos.

## Relación entre taxonomía, bien y posición

La relación se resuelve en dos pasos distintos:

1. El prefijo del texto normalizado debe existir en el catálogo `Taxonomy`. Esto
   confirma únicamente que el candidato pertenece a una familia FM conocida.
2. El código completo debe coincidir exactamente con un `Asset.fm_code`. Solo esa
   coincidencia identifica una instancia concreta del bien.

Por ejemplo, `ME` permite reconocer la familia “Mesa de escritorio”, pero no indica
qué mesa es ni dónde se encuentra. `ME-0396` puede vincularse a una instancia solo
si existe un bien cuyo `fm_code` sea exactamente `ME-0396`.

No se debe conciliar por nombre, descripción, modelo, proximidad visual, código
interno `INC-BIEN-*` ni similitud parcial. Esos datos pueden presentarse como apoyo
para revisión manual, pero no sustituyen el identificador FM.

## Códigos FM reconocidos en el plano

La inspección encontró 19 códigos numéricos con prefijos válidos del catálogo:

| Prefijo | Taxonomía | Códigos observados | Cantidad |
|---|---|---|---:|
| `CD` | Credenza | `CD-0098` a `CD-0101` | 4 |
| `MA` | Mueble alto | `MA-0028` a `MA-0031` | 4 |
| `MB` | Mueble bajo | `MB-0184` a `MB-0185` | 2 |
| `ME` | Mesa de escritorio | `ME-0396` a `ME-0399` | 4 |
| `MS` | Mueble estante | `MS-0124` a `MS-0125` | 2 |
| `MT` | Mesa de trabajo | `MT-0100` a `MT-0101` | 2 |
| `SL` | Familia de sillas | `SL-0507` | 1 |

También existen textos `SL-XXXX`. Son marcadores de plantilla o posición pendiente,
no códigos emitidos. Validan que el prefijo `SL` pertenece al catálogo, pero no
identifican un bien y no pueden ocupar una secuencia ni crear un activo.

## Candidatos descartados y falsos positivos

### Textos `SHIMA-*` y modelos

Los textos `SHIMA-*` se tratan como nombres, referencias comerciales o modelos, no
como códigos FM. `SHIMA` no forma parte de los prefijos reconocidos en esta línea
base y esos textos no deben crear taxonomías, bienes o posiciones automáticamente.

Aunque en el futuro se añadiera un prefijo con el mismo texto, los hallazgos
históricos deben volver a revisarse: la creación posterior de una taxonomía no
convierte retroactivamente una anotación de modelo en identificador de activo.

### Criterios de exclusión

Un texto se descarta como vínculo automático cuando ocurre cualquiera de estos
casos:

- el prefijo no existe en `Taxonomy`;
- el texto contiene `XXXX` u otro valor no numérico de plantilla;
- la expresión aparece dentro de una descripción más larga y no ocupa el texto
  normalizado completo;
- proviene de una cota, leyenda, cajetín, nombre de bloque, referencia de detalle o
  espacio de papel sin evidencia de que represente un activo;
- el mismo código aparece repetido en bloques o vistas sin poder determinar cuál
  representa la posición vigente;
- existe el prefijo, pero no hay coincidencia exacta en `Asset.fm_code`;
- la coordenada no puede transformarse de forma válida a los límites del plano.

El patrón de descubrimiento puede admitir conceptualmente
`PREFIJO-(dígitos|XXXX)`, pero la publicación automática exige el texto completo,
un sufijo numérico, un prefijo existente y una coincidencia exacta con un bien.

Las entidades dentro de bloques requieren aplicar la transformación de cada
inserción. Las coordenadas de la definición del bloque no deben publicarse como si
fueran coordenadas finales del plano.

## Comparación con los datos de demostración

La base de demostración actual contiene 31 bienes. La comparación exacta entre sus
`fm_code` y los 19 códigos numéricos reconocidos en el plano produce **cero
coincidencias**.

Este resultado es válido y no debe “corregirse” por similitud de nombres. Durante
la importación:

- ningún bien demo debe recibir una posición del plano;
- ningún código del plano debe reasignarse a un bien demo;
- los 19 códigos quedan como candidatos no conciliados hasta cargar o identificar
  los activos reales correspondientes;
- los `SL-XXXX` quedan como placeholders y no participan en el conteo de códigos
  conciliables.

## Estrategia de conciliación

La conciliación debe separar descubrimiento, validación y publicación:

1. **Identificar la fuente.** Registrar código del plano, nombre, versión, nivel,
   límites y huellas de sus archivos.
2. **Extraer entidades.** Leer `TEXT`/`MTEXT`, capa, identificador de entidad,
   espacio, bloque, texto original y coordenadas transformadas.
3. **Normalizar sin inventar.** Recortar espacios, unificar mayúsculas y validar el
   texto completo. No corregir prefijos o correlativos por aproximación.
4. **Validar el prefijo.** Aceptar como candidato únicamente un prefijo ya existente
   en `Taxonomy`.
5. **Resolver el bien.** Buscar igualdad exacta con `Asset.fm_code`.
6. **Clasificar resultados.** Como mínimo: conciliado, activo inexistente,
   placeholder, prefijo desconocido, duplicado, coordenada inválida o descartado.
7. **Revisar conflictos.** Un administrador valida duplicados, ubicación espacial,
   ambiente y correspondencia con el inventario real.
8. **Publicar atómicamente.** Activar una versión y sus posiciones solo cuando la
   validación completa haya terminado. Un error revierte toda la operación. Para
   conservar una versión anterior se debe importar con otro código; `--replace`
   actualiza deliberadamente el mismo plano.
9. **Auditar.** Conservar quién importó, quién aprobó, cuándo se publicó, hashes,
   resumen de resultados y decisiones manuales.

Una ejecución sin `--replace` falla si el código del plano ya existe. El reemplazo
conserva el UUID y sustituye imagen, metadatos y marcadores dentro de una transacción.
El modelo actual no almacena internamente versiones históricas del plano: si se
requiere compararlas, cada versión debe tener un código propio o respaldarse antes
de usar `--replace`. La operación no altera movimientos ni asignaciones de bienes.

## Jerarquía espacial propuesta

La ubicación física necesita su propio catálogo, separado de `Taxonomy`:

1. Sede.
2. Zona.
3. Edificio.
4. Nivel o piso.
5. Área física.
6. Ambiente.
7. Punto o posición específica.

Cada nodo debe tener identificador estable, nombre normalizado, estado activo y
relación con su padre. La unicidad debe evaluarse entre hermanos, sin depender de
comparaciones libres de cadenas en cada alta de bien.

Un plano pertenece a un nivel y a una versión. Debe conservar al menos:

- código estable del plano;
- nombre y versión;
- nivel asociado;
- límites originales `min_x`, `min_y`, `max_x`, `max_y`;
- unidad o sistema de referencia, cuando pueda determinarse;
- archivo visual derivado autorizado;
- hashes de cada fuente y fecha de importación;
- estado de revisión y publicación.

La posición de un bien debe conservar el plano, la entidad de origen, capa, texto
original, código normalizado, coordenadas originales, coordenadas normalizadas,
resultado de conciliación y el bien vinculado cuando corresponda.

Las coordenadas normalizadas se calculan conceptualmente como:

```text
x = (source_x - min_x) / (max_x - min_x)
y = 1 - ((source_y - min_y) / (max_y - min_y))
```

La inversión de `y` adapta el origen habitual del dibujo al origen superior de una
imagen o SVG en pantalla. Los límites degenerados, valores no finitos o resultados
fuera de `[0, 1]` deben detener o marcar la entidad como inválida; no se deben
ajustar silenciosamente.

La posición del plano complementa la ubicación administrativa del activo. No debe
reemplazar el historial de asignaciones ni convertirse en ubicación vigente hasta
que una operación autorizada la confirme.

## Importación backend implementada

El backend incorpora el comando de gestión `import_facility_plan` y los modelos
`FacilityPlan` y `FacilityPlanMarker`. La migración correspondiente es
`assets.0005_facility_plans`.

El comando recibe:

- JSON derivado mediante LibreDWG con entidades y coordenadas;
- SVG o imagen de representación autorizada;
- DWG original para custodia privada y verificación;
- código, nombre, versión y nivel del plano;
- límites espaciales explícitos o verificables;
- una opción explícita de reemplazo o actualización segura cuando corresponda.

El procesamiento se ejecuta dentro de una transacción, calcula SHA-256, valida la
fuente y el SVG, resuelve capas por sus handles de LibreDWG y genera un resumen de
conciliación. `--replace` es obligatorio para sustituir un plano existente.

La API administrativa expone listado, detalle, conciliación e imagen bajo
`/api/v1/facility-plans/`. Todos los recursos exigen el rol `ADMINISTRADOR`; el
personal técnico no puede consultar el plano. La imagen se obtiene con
`GET /api/v1/facility-plans/{id}/image/` y no se sirve desde `/media/`.

## Privacidad y custodia del plano

El DWG revela distribución física, nombres de ambientes, instalaciones y posibles
posiciones de bienes. Debe tratarse como información sensible de infraestructura.

- **No subir el DWG a Git**, ni siquiera temporalmente o dentro de un commit que
  después se revierta.
- No incluirlo en los archivos estáticos del frontend, rutas públicas, respuestas
  del QR, almacenamiento del navegador, logs, incidencias o artefactos públicos de
  CI.
- Guardar el original en almacenamiento privado con control de acceso, cifrado,
  auditoría, retención y copias de respaldo acordes con la política interna.
- Servir al frontend únicamente una representación derivada y revisada. Deben
  ocultarse cajetines, nombres personales, referencias sensibles o detalles que no
  sean necesarios para la operación.
- La implementación actual guarda el derivado en `PRIVATE_MEDIA_ROOT` y lo transmite
  solo a administradores mediante Bearer, con `no-store`, `nosniff` y política de
  mismo origen. La existencia de un QR público de un bien no autoriza el acceso al
  plano.
- Registrar hashes sin publicar el contenido del archivo ni rutas locales del
  equipo donde se realizó la conversión.

## Criterios de aceptación

Antes de publicar una versión del mapa se debe comprobar:

- [ ] El encabezado corresponde a `AC1032`/`R2018`.
- [ ] El inventario de la fuente analizada contiene 91 capas.
- [ ] El JSON contiene 54,646 objetos.
- [ ] Se contabilizan 1,612 `TEXT` y 240 `MTEXT`.
- [ ] Las 2,127 coincidencias de `dwggrep` se conservan como ocurrencias, sin
      confundirlas con entidades únicas.
- [ ] Cada fuente y derivado tiene una huella SHA-256 registrada.
- [ ] Solo se consideran prefijos ya existentes en `Taxonomy`.
- [ ] Cada vínculo publicado coincide exactamente con `Asset.fm_code`.
- [ ] `SL-XXXX`, `SHIMA-*`, modelos y falsos positivos permanecen sin vincular.
- [ ] Los códigos duplicados o no conciliados aparecen en un reporte de revisión.
- [ ] Las coordenadas normalizadas pertenecen a `[0, 1]` y usan `y` invertida.
- [ ] Ninguno de los 31 bienes demo recibe una posición por similitud.
- [ ] Las versiones que deban conservarse usan códigos distintos o se respaldan
      antes de ejecutar `--replace`, y la conciliación queda auditada.
- [ ] El DWG original no está versionado ni expuesto públicamente.
- [ ] La imagen derivada permanece en almacenamiento privado y devuelve `401` sin
      sesión, `403` para técnico y `200` únicamente para administrador.
