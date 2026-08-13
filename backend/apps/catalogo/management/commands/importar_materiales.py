"""
Management command: importar_materiales
Lee la plantilla Excel y carga los datos vía el ORM de Django.

Uso:
    python manage.py importar_materiales ruta/al/archivo.xlsx --dry-run
    python manage.py importar_materiales ruta/al/archivo.xlsx --fotos-dir ruta/a/fotos/

MEJORAS respecto a la versión anterior:
- Los encabezados de columna ahora se comparan ignorando tildes, mayúsculas/minúsculas,
  espacios extra y el asterisco (*). Ej: "categoria", "Categoría", "CATEGORÍA *" son lo mismo.
- "Tipo de control" y "Frecuencia inspección - unidad" también aceptan variaciones
  (con/sin tilde, mayúsculas, guion bajo o espacio: "no retornable" == "no_retornable").
- Si faltan varias columnas obligatorias, se listan TODAS de una vez (antes se detenía
  en la primera).
- Los campos numéricos (precio, grosor, largo, cantidades, frecuencia) ahora dan un
  mensaje de error específico ("'Precio (S/)' debe ser un número, se recibió: 'abc'")
  en vez de un traceback críptico de Python.
"""
import os
import re
import unicodedata

import openpyxl
from django.core.files import File
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.catalogo.models import Categoria, Subcategoria, Material, Pieza
from apps.catalogo.services import crear_piezas_sueltas, crear_estuche_con_piezas, ajustar_stock

COLS = {
    "categoria": "Categoría*",
    "subcategoria": "Subcategoría*",
    "nombre": "Nombre*",
    "marca": "Marca",
    "modelo": "Modelo",
    "medida": "Medida",
    "unidad_medida": "Unidad medida (grosor/largo)",
    "grosor": "Grosor / Diámetro",
    "largo": "Largo",
    "precio": "Precio (S/)",
    "periodicidad_valor": "Frecuencia inspección - valor*",
    "periodicidad_unidad": "Frecuencia inspección - unidad*",
    "ubicacion_fisica": "Ubicación física*",
    "tipo_control": "Tipo de control*",
    "control_individual": "Control por pieza individual*",
    "unidad_manejo": "Unidad de manejo (si no es individual)",
    "unidades_por_caja": "Unidades por empaque",
    "cantidad_piezas": "Cantidad de piezas sueltas a crear",
    "foto": "Foto representativa (ruta archivo)*",
    "notas": "Notas / observaciones",
}
REQUIRED_KEYS = [
    "categoria", "subcategoria", "nombre", "periodicidad_valor",
    "periodicidad_unidad", "ubicacion_fisica", "tipo_control",
    "control_individual", "foto",
]


def _norm(value):
    return "" if value is None else str(value).strip()


def _slug(value):
    """Minúsculas, sin tildes, sin '*', espacios colapsados. Para comparar de forma tolerante."""
    s = _norm(value).lower()
    s = "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))
    s = s.replace("*", "")
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _si_no_a_bool(value):
    v = _slug(value)
    if v in ("si", "true", "1", "x", "yes"):
        return True
    if v in ("no", "false", "0", ""):
        return False
    raise ValueError(f"Valor de 'Control por pieza individual' no reconocido: {value!r}. Usa Sí/No.")


def _match_choice(value, opciones, field_label):
    """opciones: dict slug_tolerante -> valor_final. Lanza error claro si no matchea."""
    v = _slug(value).replace("_", " ")
    if v in opciones:
        return opciones[v]
    validos = ", ".join(sorted(set(opciones.values())))
    raise ValueError(f"'{field_label}' inválido: {value!r}. Valores válidos: {validos}.")


TIPO_CONTROL_OPCIONES = {
    "retornable": "retornable",
    "no retornable": "no_retornable",
}
PERIODICIDAD_UNIDAD_OPCIONES = {
    "dias": "dias",
    "meses": "meses",
}


def _to_number(value, field_label, cast=float, required=False):
    if value in (None, ""):
        if required:
            raise ValueError(f"'{field_label}' es obligatorio y no puede estar vacío.")
        return None
    try:
        return cast(value)
    except (TypeError, ValueError):
        raise ValueError(f"'{field_label}' debe ser un número, se recibió: {value!r}")


class Command(BaseCommand):
    help = "Importa materiales (y piezas) desde la plantilla Excel usando el ORM de Django."

    def add_arguments(self, parser):
        parser.add_argument("archivo", type=str)
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--fotos-dir", type=str, default=None)

    def handle(self, *args, **options):
        ruta = options["archivo"]
        dry_run = options["dry_run"]
        fotos_dir = options["fotos_dir"]

        if not os.path.exists(ruta):
            raise CommandError(f"No se encontró el archivo: {ruta}")

        wb = openpyxl.load_workbook(ruta, data_only=True)
        if "Materiales" not in wb.sheetnames:
            raise CommandError("El archivo no tiene una hoja llamada 'Materiales'.")

        ws = wb["Materiales"]
        header = [_norm(c.value) for c in ws[1]]
        header_slugs = [_slug(h) for h in header]

        col_idx = {}
        faltantes = []
        for key, label in COLS.items():
            label_slug = _slug(label)
            if label_slug in header_slugs:
                col_idx[key] = header_slugs.index(label_slug)
            elif key in REQUIRED_KEYS:
                faltantes.append(label)

        if faltantes:
            raise CommandError(
                "Faltan columnas obligatorias en la hoja 'Materiales': "
                + ", ".join(f"'{f}'" for f in faltantes)
                + ". (No importan tildes/mayúsculas/asterisco, pero el texto debe ser el mismo.)"
            )

        ws_est = wb["Piezas_Estuche"] if "Piezas_Estuche" in wb.sheetnames else None
        piezas_estuche_por_material = {}
        if ws_est is not None:
            for row in ws_est.iter_rows(min_row=2, values_only=True):
                if row is None or all(v is None for v in row):
                    continue
                mat_nombre = _norm(row[0]); pieza_nombre = _norm(row[1])
                medida = _norm(row[2]) if len(row) > 2 else ""
                cantidad = int(row[3]) if len(row) > 3 and row[3] else 0
                if not mat_nombre or not pieza_nombre or cantidad <= 0:
                    continue
                piezas_estuche_por_material.setdefault(mat_nombre, []).append(
                    {"nombre": pieza_nombre, "medida": medida, "cantidad": cantidad}
                )

        creados, saltados, errores = 0, 0, []

        with transaction.atomic():
            sid = transaction.savepoint()
            for i, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
                if row is None or all(v is None for v in row):
                    continue
                nombre = _norm(row[col_idx["nombre"]])
                if not nombre:
                    saltados += 1
                    continue
                try:
                    cat_nombre = _norm(row[col_idx["categoria"]])
                    sub_nombre = _norm(row[col_idx["subcategoria"]])
                    if not cat_nombre or not sub_nombre:
                        raise ValueError("Categoría y Subcategoría son obligatorias.")

                    categoria = Categoria.objects.filter(nombre__iexact=cat_nombre).first()
                    if categoria is None:
                        raise ValueError(f"Categoría no encontrada: '{cat_nombre}'.")

                    subcategoria = Subcategoria.objects.filter(
                        categoria=categoria, nombre__iexact=sub_nombre
                    ).first()
                    if subcategoria is None:
                        raise ValueError(f"Subcategoría '{sub_nombre}' no existe para '{cat_nombre}'.")

                    tipo_control = _match_choice(
                        row[col_idx["tipo_control"]], TIPO_CONTROL_OPCIONES, COLS["tipo_control"]
                    )
                    control_individual = _si_no_a_bool(row[col_idx["control_individual"]])

                    periodicidad_unidad = _match_choice(
                        row[col_idx["periodicidad_unidad"]],
                        PERIODICIDAD_UNIDAD_OPCIONES,
                        COLS["periodicidad_unidad"],
                    )
                    periodicidad_valor = int(_to_number(
                        row[col_idx["periodicidad_valor"]], COLS["periodicidad_valor"],
                        cast=float, required=True,
                    ))

                    ubicacion = _norm(row[col_idx["ubicacion_fisica"]])
                    if not ubicacion:
                        raise ValueError("Ubicación física es obligatoria.")

                    foto_ref = _norm(row[col_idx["foto"]])
                    if not foto_ref:
                        raise ValueError("Foto representativa es obligatoria.")

                    grosor = _to_number(row[col_idx["grosor"]], COLS["grosor"])
                    largo = _to_number(row[col_idx["largo"]], COLS["largo"])
                    precio = _to_number(row[col_idx["precio"]], COLS["precio"])

                    material_kwargs = dict(
                        subcategoria=subcategoria,
                        nombre=nombre,
                        marca=_norm(row[col_idx["marca"]]),
                        modelo=_norm(row[col_idx["modelo"]]),
                        medida=_norm(row[col_idx["medida"]]),
                        unidad_medida=_norm(row[col_idx["unidad_medida"]]) or "mm",
                        grosor=grosor,
                        largo=largo,
                        precio=precio,
                        ubicacion_fisica=ubicacion,
                        tipo_control=tipo_control,
                        control_individual=control_individual,
                        periodicidad_valor=periodicidad_valor,
                        periodicidad_unidad=periodicidad_unidad,
                    )
                    if not control_individual:
                        unidad_manejo = _norm(row[col_idx["unidad_manejo"]]).lower() or "unidad"
                        material_kwargs["unidad_manejo"] = unidad_manejo
                        if unidad_manejo != "unidad":
                            upc = _to_number(
                                row[col_idx["unidades_por_caja"]], COLS["unidades_por_caja"],
                                cast=int, required=False,
                            )
                            if not upc:
                                raise ValueError(
                                    "'Unidades por empaque' es obligatorio si la unidad de manejo no es 'unidad'."
                                )
                            material_kwargs["unidades_por_caja"] = upc

                    if dry_run:
                        creados += 1
                        continue

                    material = Material.objects.create(**material_kwargs)

                    foto_path = _resolver_foto(foto_ref, fotos_dir)
                    if foto_path:
                        with open(foto_path, "rb") as f:
                            material.foto.save(os.path.basename(foto_path), File(f), save=True)
                    else:
                        self.stdout.write(self.style.WARNING(f"  Fila {i}: no se encontró la foto '{foto_ref}'."))

                    if not control_individual:
                        cantidad_inicial = _to_number(
                            row[col_idx["cantidad_piezas"]], COLS["cantidad_piezas"], cast=int
                        )
                        if cantidad_inicial:
                            ajustar_stock(material, cantidad_inicial)
                    else:
                        if nombre in piezas_estuche_por_material:
                            spec = []
                            for item in piezas_estuche_por_material[nombre]:
                                mat_hija, _ = Material.objects.get_or_create(
                                    subcategoria=subcategoria,
                                    nombre=item["nombre"],
                                    medida=item["medida"],
                                    es_componente=True,
                                    defaults=dict(tipo_control=tipo_control, control_individual=True),
                                )
                                spec.append({"material": mat_hija, "cantidad": item["cantidad"]})
                            crear_estuche_con_piezas(material, spec, num_estuches=1)
                        else:
                            cantidad = _to_number(
                                row[col_idx["cantidad_piezas"]], COLS["cantidad_piezas"], cast=int
                            )
                            if cantidad:
                                crear_piezas_sueltas(material, cantidad)

                    creados += 1

                except Exception as e:
                    errores.append(f"Fila {i} ('{nombre}'): {e}")

            if errores or dry_run:
                transaction.savepoint_rollback(sid)
            else:
                transaction.savepoint_commit(sid)

        self.stdout.write("")
        if dry_run:
            self.stdout.write(self.style.NOTICE(f"[DRY RUN] Filas válidas: {creados} | Filas vacías: {saltados}"))
        else:
            self.stdout.write(self.style.SUCCESS(f"Materiales creados: {creados} | Filas vacías: {saltados}"))

        if errores:
            self.stdout.write(self.style.ERROR(f"\nSe encontraron {len(errores)} error(es). No se guardó nada:"))
            for err in errores:
                self.stdout.write(self.style.ERROR(f"  - {err}"))
            raise CommandError("Importación abortada por errores. Corrige el Excel y vuelve a intentar.")


def _resolver_foto(foto_ref, fotos_dir):
    if os.path.isabs(foto_ref) and os.path.exists(foto_ref):
        return foto_ref
    if os.path.exists(foto_ref):
        return foto_ref
    if fotos_dir:
        candidato = os.path.join(fotos_dir, foto_ref)
        if os.path.exists(candidato):
            return candidato
        candidato2 = os.path.join(fotos_dir, os.path.basename(foto_ref))
        if os.path.exists(candidato2):
            return candidato2
    return None