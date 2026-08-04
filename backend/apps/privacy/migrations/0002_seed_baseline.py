from datetime import date

from django.db import migrations


def seed_baseline(apps, schema_editor):
    Notice = apps.get_model("privacy", "PrivacyNotice")
    Notice.objects.get_or_create(
        version="2026.08",
        defaults={
            "title": "Aviso de privacidad SGTB Incalpaca",
            "content": "Tratamos datos de identificación, contacto, evidencias fotográficas y firmas para gestionar bienes, incidencias, mantenimiento y obligaciones de seguridad. Puedes ejercer tus derechos ARCO mediante el canal publicado en esta plataforma.",
            "contexts": ["GENERAL", "LOGIN", "REPORTE", "EVIDENCIA", "FIRMA"],
            "effective_from": date(2026, 8, 4),
            "active": True,
        },
    )
    Inventory = apps.get_model("privacy", "ProcessingInventory")
    defaults = [
        ("Gestión de cuentas", "Autenticar usuarios y asignar permisos.", ["identificación", "credenciales", "registro de acceso"], "Personal y usuarios autorizados", "Mientras exista la cuenta y 2 años adicionales"),
        ("Reportes y órdenes de trabajo", "Atender incidencias y mantener trazabilidad del servicio.", ["contacto", "ubicación", "descripción", "fotografías"], "Solicitantes, técnicos y responsables", "5 años desde el cierre de la orden"),
        ("Actas y firmas", "Evidenciar entrega, recepción y conformidad.", ["identificación", "firma", "evidencias"], "Responsables de bienes y técnicos", "5 años desde la emisión del acta"),
    ]
    for name, purpose, categories, subjects, retention in defaults:
        Inventory.objects.get_or_create(name=name, defaults={"purpose": purpose, "legal_basis": "Ejecución de la relación laboral, contractual y obligaciones legales aplicables.", "data_categories": categories, "data_subjects": subjects, "recipients": "Administración FM y proveedores autorizados cuando corresponda.", "systems": "SGTB Incalpaca, PostgreSQL y almacenamiento privado.", "retention_rule": retention, "security_measures": "Control de acceso por roles, auditoría, cifrado en tránsito, respaldos verificados y minimización de acceso.", "owner": "Facility Management", "active": True})


class Migration(migrations.Migration):
    dependencies = [("privacy", "0001_initial")]
    operations = [migrations.RunPython(seed_baseline, migrations.RunPython.noop)]
