from datetime import timedelta
from django.db import transaction
from django.db.models import Q
from django.utils import timezone


def generar_codigo_inspeccion(fecha=None):
    """
    Genera el código correlativo mensual del formato SST:
    FOR-SST-YYMM-00001, reiniciando el correlativo cada mes.

    Se llama desde Inspeccion.save(), dentro de una transacción
    (select_for_update() evita duplicados ante creaciones concurrentes).
    """
    from apps.inspeccion.models import Inspeccion  # import perezoso: evita ciclo con models.py

    fecha = fecha or timezone.now()
    prefijo = f"FOR-SST-{fecha.strftime('%y%m')}-"

    with transaction.atomic():
        ultimo = (
            Inspeccion.objects.select_for_update()
            .filter(codigo_inspeccion__startswith=prefijo)
            .order_by("-codigo_inspeccion")
            .first()
        )
        if ultimo:
            numero = int(ultimo.codigo_inspeccion[len(prefijo):]) + 1
        else:
            numero = 1
        return f"{prefijo}{numero:05d}"

def obtener_materiales_para_inspeccion(almacen_id=None, incluir_inspeccionados=False, q=None):
    """
    Lista materiales/piezas inspeccionables junto a su estado de inspección
    vigente. Por defecto (incluir_inspeccionados=False) solo devuelve los
    pendientes. Con incluir_inspeccionados=True también devuelve los que
    ya están al día (con última fecha/resultado), habilitando re-inspección.
    """
    from apps.catalogo.models import Material

    materiales = Material.objects.inspeccionables()
    if almacen_id:
        materiales = materiales.filter(almacen_id=almacen_id)
    if q:
        materiales = materiales.filter(Q(nombre__icontains=q) | Q(codigo__icontains=q))

    ahora = timezone.now()
    resultado = []

    # Materiales con control individual → se evalúa por pieza (hoja del árbol)
    for material in materiales.filter(control_individual=True):
        limite = ahora - timedelta(days=material.periodicidad_inspeccion_dias)
        piezas_hoja = material.piezas.exclude(estado="Baja").filter(piezas_hijas__isnull=True)

        for pieza in piezas_hoja:
            ultima_ind = pieza.inspecciones.order_by("-fecha").first()
            ultima_lote = pieza.inspecciones_grupales.order_by("-fecha").first()
            if ultima_ind and ultima_lote:
                ultima = ultima_ind if ultima_ind.fecha >= ultima_lote.fecha else ultima_lote
            else:
                ultima = ultima_ind or ultima_lote

            al_dia = ultima is not None and ultima.fecha >= limite
            if al_dia and not incluir_inspeccionados:
                continue

            resultado.append({
                "material_id": material.id,
                "material_codigo": material.codigo,
                "material_nombre": material.nombre,
                "pieza_id": pieza.id,
                "pieza_codigo": pieza.codigo,
                "plantilla_id": material.subcategoria.plantilla_inspeccion_id,
                "plantilla_nombre": material.subcategoria.plantilla_inspeccion.nombre,
                "estado_inspeccion": "al_dia" if al_dia else "pendiente",
                "ultima_fecha": ultima.fecha if ultima else None,
                "ultimo_resultado": ultima.resultado_general if ultima else None,
                "ultima_inspeccion_id": ultima.id if ultima else None,
            })

    # Materiales sin control individual → se evalúa a nivel material
    for material in materiales.filter(control_individual=False):
        limite = ahora - timedelta(days=material.periodicidad_inspeccion_dias)
        ultima = material.inspecciones.order_by("-fecha").first()
        al_dia = ultima is not None and ultima.fecha >= limite

        if al_dia and not incluir_inspeccionados:
            continue

        resultado.append({
            "material_id": material.id,
            "material_codigo": material.codigo,
            "material_nombre": material.nombre,
            "pieza_id": None,
            "pieza_codigo": None,
            "plantilla_id": material.subcategoria.plantilla_inspeccion_id,
            "plantilla_nombre": material.subcategoria.plantilla_inspeccion.nombre,
            "estado_inspeccion": "al_dia" if al_dia else "pendiente",
            "ultima_fecha": ultima.fecha if ultima else None,
            "ultimo_resultado": ultima.resultado_general if ultima else None,
            "ultima_inspeccion_id": ultima.id if ultima else None,
        })

    return resultado