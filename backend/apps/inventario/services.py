from django.db import transaction
from django.core.exceptions import ValidationError

from apps.catalogo.models import Material, Pieza
from apps.inventario.models import Movimiento
import uuid

def registrar_salida_material(material: Material, cantidad: int, responsable, referencia_externa="", observaciones=""):
    """
    Para materiales NO retornables (o retornables sin control individual, ej. brocas sueltas):
    descuenta cantidad_total de inmediato y deja el registro histórico.
    """
    if material.control_individual:
        raise ValidationError(
            "Este material tiene control individual; usa registrar_salida_pieza en su lugar."
        )
    if cantidad > material.cantidad_total:
        raise ValidationError(
            f"Stock insuficiente: hay {material.cantidad_total}, se pidieron {cantidad}."
        )

    with transaction.atomic():
        mov = Movimiento.objects.create(
            material=material,
            tipo="salida",
            cantidad=cantidad,
            responsable=responsable,
            referencia_externa=referencia_externa,
            observaciones=observaciones,
        )
        Material.objects.filter(pk=material.pk).update(
            cantidad_total=material.cantidad_total - cantidad
        )
    return mov


def registrar_entrada_material(material: Material, cantidad: int, responsable, observaciones=""):
    """Reingreso de stock (ej. compra nueva, o una pieza que finalmente aparece)."""
    with transaction.atomic():
        mov = Movimiento.objects.create(
            material=material, tipo="entrada", cantidad=cantidad,
            responsable=responsable, observaciones=observaciones,
        )
        Material.objects.filter(pk=material.pk).update(
            cantidad_total=material.cantidad_total + cantidad
        )
    return mov


def registrar_baja_material(material: Material, cantidad: int, responsable, observaciones=""):
    """Confirma pérdida/rotura de cantidad no reconciliada (ej. brocas)."""
    # No se puede dar de baja más de lo que hay en stock
    if cantidad > material.cantidad_total:
        raise ValidationError(
            f"Stock insuficiente para dar de baja: hay {material.cantidad_total}, se pidieron {cantidad}."
        )
    with transaction.atomic():
        mov = Movimiento.objects.create(
            material=material, tipo="baja", cantidad=cantidad,
            responsable=responsable, observaciones=observaciones,
        )
        Material.objects.filter(pk=material.pk).update(
            cantidad_total=material.cantidad_total - cantidad
        )
    return mov


def registrar_salida_pieza(pieza: Pieza, responsable, referencia_externa="", observaciones="", piezas_hijas_ids=None):
    """
    Si la pieza es un contenedor (estuche) con hijas activas, la salida se
    propaga en cascada a sus hijas, vinculadas por un lote_id común.
    Si es una pieza suelta o una hija individual, solo afecta a esa pieza.

    piezas_hijas_ids:
      - None  → comportamiento por defecto: salen todas las hijas disponibles.
      - []    → solo sale el contenedor; ninguna hija incluida.
      - [id1, id2, ...] → solo salen las hijas con esos IDs (si están disponibles).
    """
    if pieza.estado != "Disponible":
        raise ValidationError(f"La pieza {pieza.codigo} no está disponible (estado: {pieza.estado}).")

    lote = str(uuid.uuid4())[:8]
    hijas = list(pieza.piezas_hijas.all())

    if piezas_hijas_ids is None:
        # Comportamiento original: todas las hijas disponibles
        hijas_a_mover = [h for h in hijas if h.estado == "Disponible"]
        hijas_excluidas = [
            {"id": h.id, "codigo": h.codigo, "estado": h.estado}
            for h in hijas if h.estado != "Disponible"
        ]
    else:
        # El usuario especificó qué hijas incluir
        ids_set = set(piezas_hijas_ids)
        hijas_a_mover = [h for h in hijas if h.id in ids_set and h.estado == "Disponible"]
        hijas_excluidas = [
            {"id": h.id, "codigo": h.codigo, "estado": h.estado}
            for h in hijas
            if h.id in ids_set and h.estado != "Disponible"
        ]

    piezas_a_mover = [pieza] + hijas_a_mover

    movimientos = []
    with transaction.atomic():
        for p in piezas_a_mover:
            movimientos.append(Movimiento.objects.create(
                material=p.material, pieza=p, tipo="salida",
                responsable=responsable, referencia_externa=referencia_externa,
                lote_id=lote, observaciones=observaciones,
            ))
            Pieza.objects.filter(pk=p.pk).update(estado="Prestado")
    return movimientos, hijas_excluidas


def registrar_entrada_pieza(pieza: Pieza, responsable, observaciones=""):
    """Devolución de una pieza individual (no propaga a hermanas; el checklist marca una por una)."""
    with transaction.atomic():
        mov = Movimiento.objects.create(
            material=pieza.material, pieza=pieza, tipo="entrada",
            responsable=responsable, observaciones=observaciones,
        )
        Pieza.objects.filter(pk=pieza.pk).update(estado="Disponible")
    return mov


def registrar_baja_pieza(pieza: Pieza, responsable, observaciones=""):
    """
    Confirma la baja definitiva (daño irreparable/pérdida) de una pieza individual.

    Si la pieza es un estuche con hijas:
    - Hijas ya en "Baja" → se ignoran (no se tocan).
    - Hijas en buen estado (Disponible/Mantenimiento/Prestado) → se "liberan":
      se les quita el padre (quedan como piezas sueltas) y se registra una entrada
      informativa para trazabilidad.
    Solo el estuche/pieza principal pasa a estado "Baja".
    """
    with transaction.atomic():
        hijas = list(pieza.piezas_hijas.exclude(estado="Baja"))
        for hija in hijas:
            # Liberar la hija: quita el vínculo con el estuche dado de baja
            Pieza.objects.filter(pk=hija.pk).update(padre=None)
            # Registrar trazabilidad: si la hija estaba prestada, sigue prestada
            # pero ahora independiente. Si estaba disponible/mantenimiento, queda igual.
            # Solo creamos el movimiento de observación si estaba Disponible/Mantenimiento
            # (evitar registrar "entrada" de una pieza que sigue prestada).
            if hija.estado in ("Disponible", "Mantenimiento"):
                Movimiento.objects.create(
                    material=hija.material,
                    pieza=hija,
                    tipo="entrada",
                    responsable=responsable,
                    observaciones=(
                        f"Liberada del estuche {pieza.codigo} dado de baja. "
                        + (observaciones or "")
                    ).strip(),
                )
                hija.material.recalcular_cantidad()

        # Dar de baja el estuche/pieza principal
        mov = Movimiento.objects.create(
            material=pieza.material, pieza=pieza, tipo="baja",
            responsable=responsable, observaciones=observaciones,
        )
        Pieza.objects.filter(pk=pieza.pk).update(estado="Baja")
        pieza.material.recalcular_cantidad()
    return mov