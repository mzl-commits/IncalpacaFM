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


def registrar_salida_pieza(pieza: Pieza, responsable, referencia_externa="", observaciones=""):
    """
    Si la pieza es un contenedor (estuche) con hijas activas, la salida se
    propaga en cascada a todas sus hijas, vinculadas por un lote_id común.
    Si es una pieza suelta o una hija individual, solo afecta a esa pieza.
    """
    if pieza.estado != "Disponible":
        raise ValidationError(f"La pieza {pieza.codigo} no está disponible (estado: {pieza.estado}).")

    lote = str(uuid.uuid4())[:8]
    hijas = list(pieza.piezas_hijas.all())
    piezas_a_mover = [pieza] + [h for h in hijas if h.estado == "Disponible"]
    # Hijas que quedaron fuera de la salida por no estar disponibles (para avisar al usuario)
    hijas_excluidas = [
        {"id": h.id, "codigo": h.codigo, "estado": h.estado}
        for h in hijas if h.estado != "Disponible"
    ]

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
    """Confirma la baja definitiva (daño irreparable/pérdida) de una pieza individual."""
    with transaction.atomic():
        mov = Movimiento.objects.create(
            material=pieza.material, pieza=pieza, tipo="baja",
            responsable=responsable, observaciones=observaciones,
        )
        Pieza.objects.filter(pk=pieza.pk).update(estado="Baja")
        pieza.material.recalcular_cantidad()
    return mov