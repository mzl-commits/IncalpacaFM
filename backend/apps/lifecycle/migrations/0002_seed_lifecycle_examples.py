from django.db import migrations


def seed_lifecycle(apps, schema_editor):
    Asset = apps.get_model("assets", "Asset")
    TechnicalDiagnosis = apps.get_model("lifecycle", "TechnicalDiagnosis")
    RetirementRequest = apps.get_model("lifecycle", "RetirementRequest")
    assets = list(Asset.objects.order_by("created_at")[:2])
    examples = [
        {
            "result": "NO_REPARABLE",
            "description": "Motor bloqueado y sistema eléctrico con daño irreversible confirmado durante las pruebas.",
            "technical_justification": "El reemplazo de motor, engranajes y componentes eléctricos supera el valor actual del bien.",
            "estimated_repair_cost": "1850.00",
            "estimated_current_value": "800.00",
            "recommendation": "RECICLAJE",
        },
        {
            "result": "REPAIR_NOT_VIABLE",
            "description": "Equipo con obsolescencia tecnológica y repuestos fuera de fabricación.",
            "technical_justification": "La reparación no es viable por falta de repuestos y costo superior al valor recuperable.",
            "estimated_repair_cost": "1200.00",
            "estimated_current_value": "650.00",
            "recommendation": "DONACION",
        },
    ]
    for index, asset in enumerate(assets):
        example = examples[index]
        diagnosis, _ = TechnicalDiagnosis.objects.get_or_create(
            work_order_id=f"OT-LIFECYCLE-DEMO-{index + 1}",
            defaults={
                "work_order_code": f"OT-2026-{87 - index:06d}",
                "asset": asset,
                "evaluator_name": "Carlos Mendoza",
                "result": example["result"],
                "description": example["description"],
                "probable_cause": "Desgaste acumulado de componentes críticos.",
                "operational_risk": "ALTO",
                "affected_components": "Motor, transmisión y sistema eléctrico",
                "technical_justification": example["technical_justification"],
                "estimated_repair_cost": example["estimated_repair_cost"],
                "estimated_current_value": example["estimated_current_value"],
                "evidence": ["informe_tecnico.pdf", "evidencia_fotografica.jpg"],
            },
        )
        RetirementRequest.objects.get_or_create(
            diagnosis=diagnosis,
            defaults={
                "code": f"SOL-BAJA-2026-{23 - index:06d}",
                "asset": asset,
                "recommendation": example["recommendation"],
                "requested_by": "Carlos Mendoza",
                "supervisor_name": "Rosa Medina",
                "status": "PENDIENTE" if index == 0 else "EN_EVALUACION",
            },
        )


def remove_examples(apps, schema_editor):
    apps.get_model("lifecycle", "RetirementRequest").objects.filter(
        code__in=["SOL-BAJA-2026-000023", "SOL-BAJA-2026-000022"]
    ).delete()
    apps.get_model("lifecycle", "TechnicalDiagnosis").objects.filter(
        work_order_id__startswith="OT-LIFECYCLE-DEMO-"
    ).delete()


class Migration(migrations.Migration):
    dependencies = [("lifecycle", "0001_initial")]
    operations = [migrations.RunPython(seed_lifecycle, remove_examples)]
