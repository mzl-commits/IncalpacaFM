"""CÃ¡lculo idempotente de costos para consumibles registrados en una OT."""

from collections import defaultdict
from decimal import Decimal

from django.db import transaction

from .models import WorkOrderCost, WorkOrderMaterial


@transaction.atomic
def sync_material_costs(order, *, actor):
    """Mantiene los costos de materiales alineados con los usos de la OT.

    Herramientas y EPP se registran para trazabilidad, pero nunca generan un
    costo. Un precio unitario editado en el uso tiene prioridad sobre el precio
    de referencia del catÃ¡logo.
    """
    usages = (
        order.materiales_usados.filter(
            tipo=WorkOrderMaterial.Tipo.USADO,
            material__clasificacion_operativa="CONSUMIBLE",
        )
        .select_related("material")
        .order_by("material_id")
    )
    grouped = defaultdict(lambda: {"material": None, "amount": Decimal("0"), "without_price": False})
    for usage in usages:
        entry = grouped[usage.material_id]
        entry["material"] = usage.material
        unit_price = usage.precio_unitario if usage.precio_unitario is not None else usage.material.precio
        if unit_price is None:
            entry["without_price"] = True
            continue
        entry["amount"] += Decimal(unit_price) * usage.cantidad

    existing = {
        item.source_material_id: item
        for item in order.cost_items.filter(
            category=WorkOrderCost.Category.MATERIAL,
            source_material__isnull=False,
        )
    }
    created = updated = 0
    for material_id, entry in grouped.items():
        material = entry["material"]
        amount = None if entry["without_price"] else entry["amount"]
        cost = existing.pop(material_id, None)
        if cost is None:
            WorkOrderCost.objects.create(
                work_order=order,
                category=WorkOrderCost.Category.MATERIAL,
                description=material.nombre,
                amount=amount,
                source_material=material,
                created_by=actor,
            )
            created += 1
        elif cost.amount != amount or cost.description != material.nombre:
            cost.amount = amount
            cost.description = material.nombre
            cost.save(update_fields=("amount", "description"))
            updated += 1

    # Si un material se eliminÃ³ o pasÃ³ a herramienta/EPP, su costo deja de existir.
    removed, _ = order.cost_items.filter(id__in=[cost.id for cost in existing.values()]).delete()
    return {
        "created": created,
        "updated": updated,
        "removed": removed,
        "materials": len(grouped),
        "without_price": sum(1 for entry in grouped.values() if entry["without_price"]),
    }
