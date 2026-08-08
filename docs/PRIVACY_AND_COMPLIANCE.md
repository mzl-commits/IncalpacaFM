# Privacidad y cumplimiento

Este módulo aporta controles operativos para el tratamiento de datos de FM Incalpaca. Antes de producción, el responsable legal debe revisar textos, plazos y destinatarios conforme a la normativa peruana aplicable y a las políticas de Incalpaca.

## Avisos y trazabilidad

- `GET /api/v1/privacy/notices/active/?context=LOGIN|REPORTE|EVIDENCIA|FIRMA` entrega el aviso vigente y versionado.
- `POST /api/v1/privacy/acknowledgements/` conserva versión, contexto, fecha, IP, agente de usuario y referencia del sujeto. Los eventos aparecen además en auditoría.
- El inicio de sesión informa el uso y enlaza al canal de privacidad. Los formularios de reporte, fotos y firmas deben enviar el aviso mostrado y registrar su aceptación antes de producción.

## Canal ARCO

El endpoint público `POST /api/v1/privacy/arco/` recibe solicitudes de acceso, rectificación, cancelación u oposición. Se asigna un código y un plazo inicial de 20 días. Administración gestiona la bandeja en `GET/PATCH /api/v1/admin/privacy/arco/<id>/`.

Publicar en la interfaz el correo institucional del responsable de privacidad y una URL a este formulario. Validar identidad fuera de la respuesta automática antes de revelar datos.

## Inventario y retención

`/api/v1/admin/privacy/inventory/` contiene los tratamientos iniciales: cuentas, reportes/OT y actas. Cada registro incluye finalidad, base, categorías, destinatarios, sistemas, seguridad y regla de retención. Revisa la matriz al incorporar integraciones, cámaras, proveedores o nuevos datos.

| Tratamiento | Conservación inicial |
| --- | --- |
| Cuentas y accesos | Vigencia de cuenta + 2 años |
| Reportes, evidencias y OT | 5 años desde cierre |
| Actas y firmas | 5 años desde emisión |

La eliminación deberá ser aprobada, auditable y compatible con obligaciones laborales, tributarias, contractuales o litigios vigentes.

## Incidentes de datos personales

`/api/v1/admin/privacy/incidents/` registra detección, severidad, categorías afectadas, personas potencialmente afectadas, contención, notificación y cierre.

Procedimiento: detectar y registrar; contener y preservar evidencias; evaluar alcance y riesgo; informar al responsable legal; notificar autoridad o titulares cuando corresponda; cerrar con causa raíz, medidas preventivas y auditoría. No borres evidencia ni backups durante la investigación.
