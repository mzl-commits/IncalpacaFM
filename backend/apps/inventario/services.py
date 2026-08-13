from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.catalogo.models import Material, Pieza
from apps.inventario.models import Movimiento
import uuid

def _sincronizar_estado_contenedor(contenedor: Pieza):
    """Recalcula el estado del contenedor según sus hijas activas (no-Baja):
    'Disponible' si al menos una hija está Disponible, si no 'Prestado'.
    Sin hijas activas, no se toca."""
    hijas_activas = list(contenedor.piezas_hijas.exclude(estado="Baja"))
    if not hijas_activas:
        return

    if any(h.estado == "Disponible" for h in hijas_activas):
        nuevo_estado = "Disponible"
    else:
        nuevo_estado = "Prestado"

    Pieza.objects.filter(pk=contenedor.pk).update(estado=nuevo_estado)

def registrar_salida_material(material: Material, cantidad: int, responsable, referencia_externa="", observaciones="", cantidad_cajas=None, lote_id="", unidad_movimiento=None, cantidad_en_unidad_movimiento=None):
    """
    Para materiales NO retornables (o retornables sin control individual, ej. brocas sueltas):
    descuenta cantidad_total de inmediato y deja el registro histórico.
    'cantidad' siempre está en la unidad base del material (unidades sueltas, o
    unidad_movimiento_base para materiales tipo Rollo). 'cantidad_cajas' y
    'unidad_movimiento'/'cantidad_en_unidad_movimiento' son solo trazabilidad
    opcional de cómo se originó esa cantidad (por empaque, o convertida desde
    otra unidad de la misma familia).
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
            cantidad_cajas=cantidad_cajas,
            unidad_movimiento=unidad_movimiento,
            cantidad_en_unidad_movimiento=cantidad_en_unidad_movimiento,
            responsable=responsable,
            referencia_externa=referencia_externa,
            lote_id=lote_id,
            observaciones=observaciones,
            almacen=material.almacen,
        )
        Material.objects.filter(pk=material.pk).update(
            cantidad_total=material.cantidad_total - cantidad
        )
    return mov


def registrar_entrada_material(material: Material, cantidad: int, responsable, observaciones="", cantidad_cajas=None, unidad_movimiento=None, cantidad_en_unidad_movimiento=None):
    """Reingreso de stock (ej. compra nueva, o una pieza que finalmente aparece)."""
    if material.control_individual:
        raise ValidationError(
            "Este material tiene control individual; usa registrar_entrada_pieza en su lugar."
        )
    with transaction.atomic():
        mov = Movimiento.objects.create(
            material=material, tipo="entrada", cantidad=cantidad,
            cantidad_cajas=cantidad_cajas,
            unidad_movimiento=unidad_movimiento,
            cantidad_en_unidad_movimiento=cantidad_en_unidad_movimiento,
            responsable=responsable, observaciones=observaciones,
            almacen=material.almacen,
        )
        Material.objects.filter(pk=material.pk).update(
            cantidad_total=material.cantidad_total + cantidad
        )
    return mov


def registrar_baja_material(material: Material, cantidad: int, responsable, observaciones="", cantidad_cajas=None, unidad_movimiento=None, cantidad_en_unidad_movimiento=None):
    """Confirma pérdida/rotura de cantidad no reconciliada (ej. brocas)."""
    if material.control_individual:
        raise ValidationError(
            "Este material tiene control individual; usa registrar_baja_pieza en su lugar."
        )
    if cantidad > material.cantidad_total:
        raise ValidationError(
            f"Stock insuficiente para dar de baja: hay {material.cantidad_total}, se pidieron {cantidad}."
        )
    with transaction.atomic():
        mov = Movimiento.objects.create(
            material=material, tipo="baja", cantidad=cantidad,
            cantidad_cajas=cantidad_cajas,
            unidad_movimiento=unidad_movimiento,
            cantidad_en_unidad_movimiento=cantidad_en_unidad_movimiento,
            responsable=responsable, observaciones=observaciones,
            almacen=material.almacen,
        )
        nuevo_total = material.cantidad_total - cantidad
        Material.objects.filter(pk=material.pk).update(cantidad_total=nuevo_total)

    # Notificar si stock queda en 0
    if nuevo_total == 0:
        _notify_zero_stock(material)
    return mov

def registrar_salida_pieza(pieza: Pieza, responsable, referencia_externa="", observaciones="", piezas_hijas_ids=None):
    """
    Si la pieza es un contenedor con hijas activas, la salida se propaga en
    cascada (vinculadas por lote_id). El contenedor no se marca 'Prestado' a
    ciegas: su estado final se recalcula según cuántas hijas quedaron libres.

    piezas_hijas_ids: None = todas las hijas disponibles; [] = solo el
    contenedor; [id1, id2...] = solo esas hijas (si están disponibles).
    """
    if pieza.estado != "Disponible":
        raise ValidationError(f"La pieza {pieza.codigo} no está disponible (estado: {pieza.estado}).")

    lote = str(uuid.uuid4())[:8]
    hijas = list(pieza.piezas_hijas.all())
    es_contenedor = len(hijas) > 0

    if piezas_hijas_ids is None:
        # Todas las hijas disponibles
        hijas_a_mover = [h for h in hijas if h.estado == "Disponible"]
        hijas_excluidas = [
            {"id": h.id, "codigo": h.codigo, "estado": h.estado}
            for h in hijas if h.estado != "Disponible"
        ]
    else:
        # Solo las hijas especificadas
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
                almacen=p.material.almacen,
            ))
            if p.pk == pieza.pk and es_contenedor:
                # Su estado se recalcula abajo según sus hijas
                continue
            Pieza.objects.filter(pk=p.pk).update(estado="Prestado")

        if es_contenedor:
            _sincronizar_estado_contenedor(pieza)

    return movimientos, hijas_excluidas

def registrar_entrada_pieza(pieza: Pieza, responsable, observaciones=""):
    """Devolución de una pieza individual (no propaga a hermanas). Si es hija
    de un contenedor, recalcula el estado del contenedor."""
    with transaction.atomic():
        mov = Movimiento.objects.create(
            material=pieza.material, pieza=pieza, tipo="entrada",
            responsable=responsable, observaciones=observaciones,
            almacen=pieza.material.almacen,
        )
        Pieza.objects.filter(pk=pieza.pk).update(estado="Disponible")

        if pieza.padre_id:
            _sincronizar_estado_contenedor(pieza.padre)
    return mov

def registrar_baja_pieza(pieza: Pieza, responsable, observaciones=""):
    """
    Baja definitiva de una pieza. Si es un estuche con hijas: las hijas ya en
    "Baja" se ignoran; las demás se liberan (quedan sueltas, sin padre) y se
    registra una entrada informativa. Solo el estuche pasa a "Baja".
    Si la pieza es una hija individual, recalcula el estado del padre.
    """
    padre_a_resincronizar = pieza.padre

    with transaction.atomic():
        hijas = list(pieza.piezas_hijas.exclude(estado="Baja"))
        for hija in hijas:
            # Libera la hija del estuche dado de baja
            Pieza.objects.filter(pk=hija.pk).update(padre=None)
            # Solo registra entrada informativa si estaba libre (no si sigue prestada)
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
                    almacen=hija.material.almacen,
                )
                hija.material.recalcular_cantidad()

        mov = Movimiento.objects.create(
            material=pieza.material, pieza=pieza, tipo="baja",
            responsable=responsable, observaciones=observaciones,
            almacen=pieza.material.almacen,
        )
        Pieza.objects.filter(pk=pieza.pk).update(estado="Baja")
        pieza.material.recalcular_cantidad()

        if padre_a_resincronizar:
            _sincronizar_estado_contenedor(padre_a_resincronizar)

    # Notificar baja definitiva de pieza a Inspectores + Admin
    _notify_pieza_retirada(pieza, mov)
    return mov


def _notify_pieza_retirada(pieza: "Pieza", movimiento: "Movimiento"):
    """Notifica a Inspectores y Administradores cuando una pieza es retirada definitivamente."""
    try:
        from apps.accounts.models import AccountProfile
        from apps.notifications.services import queue_for_roles
        queue_for_roles(
            event="PIEZA_RETIRADA",
            roles=[AccountProfile.Role.INSPECTOR, AccountProfile.Role.ADMIN],
            subject=f"Pieza retirada: {pieza.codigo}",
            body=(
                f"La pieza {pieza.codigo} ({pieza.material.nombre}) fue dada de baja definitivamente. "
                f"Revisar si estaba en programación de inspección activa."
            ),
            entity=movimiento,
            context={
                "piezaId": pieza.id,
                "piezaCodigo": pieza.codigo,
                "materialNombre": pieza.material.nombre,
            },
            discriminator=f"pieza-baja-{pieza.id}",
        )
    except Exception:
        pass  # No bloquear la baja por un fallo de notificación


def _notify_zero_stock(material: "Material"):
    """Notifica a Almaceneros y Administradores cuando el stock de un material llega a 0."""
    try:
        from apps.accounts.models import AccountProfile
        from apps.notifications.services import queue_for_roles
        queue_for_roles(
            event="STOCK_AGOTADO",
            roles=[AccountProfile.Role.ALMACENERO, AccountProfile.Role.ADMIN],
            subject=f"Stock agotado: {material.nombre}",
            body=(
                f"El material «{material.nombre}» (código: {material.codigo}) "
                f"ha alcanzado stock 0. Revisar reposición."
            ),
            entity=material,
            context={
                "materialId": material.id,
                "materialNombre": material.nombre,
                "materialCodigo": material.codigo,
            },
            discriminator=f"stock-agotado-{material.id}",
        )
    except Exception:
        pass  # No bloquear la baja por un fallo de notificación