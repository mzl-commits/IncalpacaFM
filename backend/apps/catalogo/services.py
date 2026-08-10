from apps.catalogo.models import Pieza, Material
import random
import string

def generar_codigo_material(categoria):
    """Genera código correlativo: prefijo + consecutivo de 4 dígitos (ej. H0013).
    Cuenta TODOS los materiales con ese prefijo (visibles y componentes/ocultos),
    porque el código debe ser único en toda la tabla sin importar visibilidad."""

    largo_prefijo = len(categoria.prefijo)
    ultimo = (
        Material.objects.filter(
            codigo__regex=rf"^{categoria.prefijo}\d+$",
        )
        .order_by("-codigo")
        .first()
    )
    if ultimo:
        numero = int(ultimo.codigo[largo_prefijo:]) + 1
    else:
        numero = 1
    return f"{categoria.prefijo}{numero:04d}"

def generar_codigo_pieza():
    caracteres = string.ascii_uppercase + string.digits
    while True:
        codigo = "".join(random.choices(caracteres, k=5))
        if not Pieza.objects.filter(codigo=codigo).exists():
            return codigo


def generar_codigo_material_componente():
    """Código aleatorio para materiales-componente (creados automáticamente
    al registrar piezas hijas inline). Misma lógica que generar_codigo_pieza(),
    pero verificando unicidad contra Material en vez de Pieza."""
    caracteres = string.ascii_uppercase + string.digits
    while True:
        codigo = "".join(random.choices(caracteres, k=5))
        if not Material.objects.filter(codigo=codigo).exists():
            return codigo

def crear_piezas_sueltas(material, cantidad):
    """Crea `cantidad` piezas sueltas (sin contenedor) de un mismo Material."""

    creadas = [Pieza.objects.create(material=material) for _ in range(cantidad)]
    material.recalcular_cantidad()
    return creadas


def crear_estuche_con_piezas(material_contenedor, piezas_hijas_spec, num_estuches=1):
    """
    Crea uno o más estuches (piezas contenedoras) con sus piezas hijas,
    permitiendo que cada hija sea de un Material distinto (ej. medidas mixtas).

    material_contenedor: Material del estuche en sí (ej. "Estuche llaves Allen").
    piezas_hijas_spec: lista de dicts, uno por cada Material distinto dentro del estuche:
        [
            {"material": <Material 5mm>, "cantidad": 2},
            {"material": <Material 8mm>, "cantidad": 1},
        ]
    num_estuches: cuántos estuches idénticos crear (cada uno con el mismo set de hijas).
    """

    creadas = []
    materiales_afectados = {material_contenedor}

    for _ in range(num_estuches):
        contenedor = Pieza.objects.create(material=material_contenedor)
        creadas.append(contenedor)

        for spec in piezas_hijas_spec:
            mat_hija = spec["material"]
            materiales_afectados.add(mat_hija)
            for _ in range(spec["cantidad"]):
                hija = Pieza.objects.create(material=mat_hija, padre=contenedor)
                creadas.append(hija)

    for m in materiales_afectados:
        m.recalcular_cantidad()

    return creadas

def ajustar_stock(material, cantidad):
    """
    Aumenta (o disminuye, si cantidad es negativa) el stock manual de un
    material sin control individual. No aplica a materiales con
    control_individual=True, cuyo cantidad_total se recalcula solo desde las piezas.
    """
    if material.control_individual:
        raise ValueError(
            "Este material tiene control individual; el stock se calcula "
            "automáticamente a partir de sus piezas."
        )
    nuevo_total = material.cantidad_total + cantidad
    if nuevo_total < 0:
        raise ValueError("El stock no puede quedar en negativo.")
    Material.objects.filter(pk=material.pk).update(cantidad_total=nuevo_total)
    material.refresh_from_db(fields=["cantidad_total"])
    return material