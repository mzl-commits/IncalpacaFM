import random
import string

from apps.catalogo.models import Material, Pieza


def generar_codigo_material(categoria):
    """Código correlativo: prefijo + 4 dígitos (ej. H0013).
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
    numero = int(ultimo.codigo[largo_prefijo:]) + 1 if ultimo else 1
    return f"{categoria.prefijo}{numero:04d}"

def generar_codigo_pieza():
    caracteres = string.ascii_uppercase + string.digits
    while True:
        codigo = "".join(random.choices(caracteres, k=5))
        if not Pieza.objects.filter(codigo=codigo).exists():
            return codigo


def generar_codigo_material_componente():
    """Código aleatorio único para materiales-componente (mismo patrón que generar_codigo_pieza, pero contra Material)."""
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
    """Crea uno o más estuches con piezas hijas (cada hija puede ser de un Material
    distinto, ej. medidas mixtas). piezas_hijas_spec: [{"material": Material, "cantidad": int}, ...]"""

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
    """Suma o resta stock manual (cantidad negativa resta). Solo para materiales sin control_individual."""
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
