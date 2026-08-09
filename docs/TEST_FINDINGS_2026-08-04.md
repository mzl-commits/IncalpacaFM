# Hallazgos de pruebas — 2026-08-04

## Cobertura ejecutada

Se realizaron más de 50 verificaciones: la suite backend ejecutó 92 casos, además de comprobaciones de `check`, migraciones y endpoints `health/live`, aviso de privacidad y esquema API. Los tres endpoints devolvieron HTTP 200 y no se detectaron migraciones pendientes.

## Fallos reproducibles

### P1 — La suite no se aísla al reutilizar la base de pruebas

`BootstrapTaxonomySafetyTests.test_requires_explicit_flag_before_replacing_pristine_bootstrap` invoca `_prepare_empty_target(..., True)`, que elimina la taxonomía bootstrap. Al usar `--keepdb`, esa modificación persiste y las pruebas posteriores esperan los 47 prefijos y 225 filas de taxonomía, produciendo 25 errores y 6 fallos.

Impacto: no afecta la base operativa; sí hace que la suite completa sea no determinista cuando se reutiliza `test_incalpaca_fm`.

Acción: convertir esas pruebas a `TransactionTestCase` con limpieza explícita, restaurar el bootstrap al final, o ejecutar la suite sin `--keepdb` en CI. La opción recomendada es restaurar los fixtures/seed al finalizar el test para conservar pruebas rápidas y aisladas.

### P2 — Contrato OpenAPI incompleto

`spectacular` emite errores porque varias `APIView` no declaran serializer de entrada/salida: health, ubicaciones públicas, conformidad, notificaciones manuales, fotos e informes de OT. También hay advertencias por métodos `SerializerMethodField` sin tipo y colisiones de `operationId`.

Impacto: la aplicación funciona, pero el contrato OpenAPI no documenta completamente esos endpoints y puede afectar integraciones o generación de clientes.

Acción: añadir `@extend_schema` con serializers/responses explícitos y normalizar los `operationId`.

## Limitaciones de esta ronda

Las pruebas Playwright están configuradas, pero Chromium no está instalado localmente todavía. El pipeline CI sí instala Chromium antes de ejecutarlas.
