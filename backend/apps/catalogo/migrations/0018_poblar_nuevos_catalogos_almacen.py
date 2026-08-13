from django.db import migrations


# ─── SÓLO LOS REGISTROS NUEVOS (no existentes en migration 0016) ─────────────
# La 0016 ya insertó: mm, cm, m, in, ft, g, kg, lb, ml, l, gal
# Se agregan los que faltan del prompt:
NUEVAS_UNIDADES_MEDIDA = [
    # codigo, nombre, abreviatura, familia, factor_a_base, orden
    # ── Peso
    ("ton", "Toneladas",           "ton",   "peso",     1000000,   21),
    ("oz",  "Onzas",               "oz",    "peso",     "28.3495", 22),
    # ── Volumen
    ("m3",  "Metros cubicos",      "m3",    "volumen",  1000000,   23),
    ("cc",  "Centimetros cubicos", "cc",    "volumen",  1,         24),
    ("ft3", "Pies cubicos",        "ft3",   "volumen",  "28316.8", 25),
    ("fl_oz","Onzas liquidas",     "fl oz", "volumen",  "29.5735", 26),
    # ── Longitud (km faltaba)
    ("km",  "Kilometros",          "km",    "longitud", 1000000,   27),
    # ── Superficie  → familia "otro" (no existe familia "superficie" en el modelo)
    ("m2",  "Metros cuadrados",    "m2",    "otro",     1,         28),
    ("ft2", "Pies cuadrados",      "ft2",   "otro",     "0.0929",  29),
]

# ─── SÓLO LOS REGISTROS NUEVOS de TipoManejoStock ────────────────────────────
# La 0016 ya insertó (con sus codigos exactos):
#   unidad, Paquete, Bolsa, Blister, Kit, Rollo, Docena, Millar,
#   Litro, Mililitro, Galon, Bidon, Kilogramo, Gramo, Libra,
#   Metro, Centimetro, Milimetro, MetroCuadrado, MetroCubico
#
# Del prompt se OMITEN los que ya existen bajo otro codigo:
#   "un"/Unidad  -> ya existe "unidad"
#   "kit"/Kit    -> ya existe "Kit"
#   "rll"/Rollo  -> ya existe "Rollo"
#   "dz"/Docena  -> ya existe "Docena"
#   "paq"/Paquete-> ya existe "Paquete"
#   "bd"/Bidon   -> ya existe "Bidon"
#
# NOTA requiere_multiplicador:
#   True  -> al crear el material se pide "unidades por empaque" y los
#            movimientos usan cantidad_cajas * unidades_por_caja.
#   False -> el conteo es directo (1 unidad = 1 stock).
NUEVOS_TIPOS_MANEJO = [
    # codigo,  nombre,               req_mult, permite_conv, orden
    ("pza",  "Por Pieza",            False, False, 30),
    ("par",  "Por Par",              True,  False, 31),
    ("lt",   "Por Lote",             False, False, 32),
    ("set",  "Por Set",              False, False, 33),
    ("cj",   "Por Caja",             True,  False, 34),
    ("blt",  "Por Bulto",            True,  False, 35),
    ("tmb",  "Por Tambor",           False, False, 36),
    ("plt",  "Por Pallet / Tarima",  False, False, 37),
    ("sc",   "Por Costal / Saco",    True,  False, 38),
    ("tub",  "Por Tubo",             False, False, 39),
]


def seed_nuevos_catalogos(apps, schema_editor):
    UnidadMedida    = apps.get_model("catalogo", "UnidadMedida")
    TipoManejoStock = apps.get_model("catalogo", "TipoManejoStock")

    for codigo, nombre, abrev, familia, factor, orden in NUEVAS_UNIDADES_MEDIDA:
        UnidadMedida.objects.get_or_create(
            codigo=codigo,
            defaults=dict(
                nombre=nombre,
                abreviatura=abrev,
                familia=familia,
                factor_a_base=factor,
                orden=orden,
                activo=True,
            ),
        )

    for codigo, nombre, req_mult, permite_conv, orden in NUEVOS_TIPOS_MANEJO:
        TipoManejoStock.objects.get_or_create(
            codigo=codigo,
            defaults=dict(
                nombre=nombre,
                requiere_multiplicador=req_mult,
                permite_conversion_unidad=permite_conv,
                orden=orden,
                activo=True,
            ),
        )


def noop(apps, schema_editor):
    pass  # No borrar datos en rollback


class Migration(migrations.Migration):

    dependencies = [
        ("catalogo", "0017_alter_material_unidades_por_caja"),
    ]

    operations = [
        migrations.RunPython(seed_nuevos_catalogos, noop),
    ]
