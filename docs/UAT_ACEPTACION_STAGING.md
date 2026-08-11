# Acta UAT — SGTB Incalpaca

**Ambiente:** Staging  
**Release/commit:** ____________________  
**URL:** ____________________  
**Fecha de ejecución:** ____ / ____ / ______

## Condiciones previas

- [ ] Datos sintéticos o anonimizados cargados; no se usó información productiva.
- [ ] HTTPS activo y QR bajo el dominio exclusivo de staging.
- [ ] Los perfiles de prueba están activos: Administrador/FM, Planner, Supervisor,
  Técnico y Usuario solicitante.
- [ ] Las evidencias de prueba incluyen al menos una foto **antes** y una **después**.

## Casos de aceptación obligatorios

| ID | Flujo y resultado esperado | Evidencia / URL | Resultado | Aprobador |
| --- | --- | --- | --- | --- |
| UAT-01 | Registrar bien, obtener código y QR; la ficha pública no expone datos personales. | | ☐ OK ☐ Hallazgo | Administrador/FM |
| UAT-02 | QR en móvil inicia reporte y asocia correctamente al bien. | | ☐ OK ☐ Hallazgo | Usuario solicitante |
| UAT-03 | Asignar a persona, área y ambiente; se mantiene historial y acta. | | ☐ OK ☐ Hallazgo | Planner |
| UAT-04 | Planner confirma técnico y ve disponibilidad/horario. | | ☐ OK ☐ Hallazgo | Planner |
| UAT-05 | Técnico registra diagnóstico, materiales, tiempo y fotos antes/después. | | ☐ OK ☐ Hallazgo | Técnico |
| UAT-06 | Supervisor visualiza ambas evidencias, aprueba o devuelve con observación. | | ☐ OK ☐ Hallazgo | Supervisor |
| UAT-07 | Administrador revisa la OT cerrada y las evidencias sin necesidad de descarga. | | ☐ OK ☐ Hallazgo | Administrador/FM |
| UAT-08 | Permisos: cada rol ve solo menús, datos y acciones autorizados. | | ☐ OK ☐ Hallazgo | Todos |
| UAT-09 | Exportar reporte/documento/auditoría produce un archivo XLSX válido. | | ☐ OK ☐ Hallazgo | Administrador/FM |
| UAT-10 | Simular caída/recuperación y verificar alerta de health; backup verificable presente. | | ☐ OK ☐ Hallazgo | Administrador/FM |

## Hallazgos y decisión

| ID | Severidad (crítica/alta/media/baja) | Descripción | Responsable | Fecha objetivo | Estado |
| --- | --- | --- | --- | --- | --- |
| | | | | | |

**Decisión:** ☐ Aprobado para piloto limitado ☐ Aprobado con observaciones ☐ Rechazado  
**Restricciones del piloto (usuarios, sedes, horario):** __________________________________________

## Conformidad

La firma confirma que se ejecutaron los casos aplicables, se adjuntaron las
evidencias y se registraron los hallazgos. No autoriza producción si existe un
hallazgo crítico o alto sin un plan de mitigación aprobado.

| Rol | Nombre | Firma | Fecha |
| --- | --- | --- | --- |
| Administrador / FM | | | |
| Planner | | | |
| Supervisor | | | |
| Técnico | | | |
| Usuario solicitante | | | |
| Responsable de integración | | | |
