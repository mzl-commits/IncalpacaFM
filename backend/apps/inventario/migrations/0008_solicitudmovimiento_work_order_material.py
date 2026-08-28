from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        # ── AJUSTAR ──────────────────────────────────────────────────────────
        # Reemplazá estas dos líneas por tus últimas migraciones reales de
        # cada app. No las adiviné a propósito: usá makemigrations para que
        # Django las resuelva solo.
        ('inventario', '0007_merge_20260814_0626'),
        ('workorders', '0023_workordermaterial_cantidad_comprometida'),
        # ─────────────────────────────────────────────────────────────────────
    ]

    operations = [
        migrations.AddField(
            model_name="solicitudmovimiento",
            name="work_order_material",
            field=models.ForeignKey(
                blank=True,
                help_text=(
                    "Renglón exacto de WorkOrderMaterial que originó esta solicitud, "
                    "cuando viene de 'Cargar materiales de la OT'. Null si la solicitud "
                    "no está vinculada a un renglón específico de la OT."
                ),
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="solicitudes",
                to="workorders.workordermaterial",
            ),
        ),
    ]