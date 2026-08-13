from django.db import models

class Almacen(models.Model):
    nombre = models.CharField(max_length=150)
    codigo = models.CharField(max_length=20, unique=True)
    ubicacion = models.CharField(max_length=200, blank=True)
    activo = models.BooleanField(default=True)

    class Meta:
        ordering = ["nombre"]
        verbose_name_plural = "Almacenes"

    def __str__(self):
        return f"{self.codigo} - {self.nombre}"
    

class UnidadMedida(models.Model):
    """Catálogo editable de unidades de medida (mm, cm, m, in, kg, etc.).

    'factor_a_base' convierte 1 unidad de esta fila a la unidad de referencia
    de su 'familia' (ej. familia 'longitud' usa mm como referencia interna).
    Esto permite convertir entre cualquier par de unidades de la misma
    familia (ej. cm <-> m para materiales tipo Rollo) sin tablas de conversión
    manuales por par.
    """

    FAMILIA_CHOICES = [
        ("longitud", "Longitud"),
        ("peso", "Peso"),
        ("volumen", "Volumen"),
        ("otro", "Otro"),
    ]

    codigo = models.SlugField(
        max_length=20, unique=True,
        help_text="Identificador interno estable (ej. 'cm'). No se muestra al usuario.",
    )
    nombre = models.CharField(max_length=50, help_text="Ej. 'Centímetros'.")
    abreviatura = models.CharField(max_length=10, help_text="Ej. 'cm'.")
    familia = models.CharField(
        max_length=10, choices=FAMILIA_CHOICES, default="otro",
        help_text="Solo se puede convertir entre unidades de la misma familia.",
    )
    factor_a_base = models.DecimalField(
        max_digits=14, decimal_places=6, default=1,
        help_text="Cuántas unidades de referencia de la familia equivalen a 1 de esta unidad.",
    )
    activo = models.BooleanField(default=True)
    orden = models.PositiveSmallIntegerField(default=0)

    class Meta:
        verbose_name = "Unidad de medida"
        verbose_name_plural = "Unidades de medida"
        ordering = ["familia", "orden", "nombre"]

    def __str__(self):
        return f"{self.nombre} ({self.abreviatura})"


class TipoManejoStock(models.Model):
    """Catálogo editable de formas de manejar el stock de un material
    (Por Unidad, Por Caja/Paquete, Por Rollo, Por Kit/Juego, etc.)."""

    codigo = models.SlugField(
        max_length=20, unique=True,
        help_text="Identificador interno estable (ej. 'rollo'). No se muestra al usuario.",
    )
    nombre = models.CharField(max_length=50, help_text="Ej. 'Por Rollo'.")
    requiere_multiplicador = models.BooleanField(
        default=False,
        help_text="Si está activo, al crear el material se debe indicar cuántas unidades "
                   "trae cada empaque (caja, bolsa, kit, docena, etc.).",
    )
    permite_conversion_unidad = models.BooleanField(
        default=False,
        help_text="Si está activo, el material guarda su stock en una unidad base fija "
                   "(ej. cm) y en cada movimiento se puede elegir otra unidad compatible "
                   "(ej. m) para registrar la salida/entrada; se convierte automáticamente.",
    )
    activo = models.BooleanField(default=True)
    orden = models.PositiveSmallIntegerField(default=0)

    class Meta:
        verbose_name = "Tipo de manejo de stock"
        verbose_name_plural = "Tipos de manejo de stock"
        ordering = ["orden", "nombre"]

    def __str__(self):
        return self.nombre


def _default_unidad_medida():
    return UnidadMedida.objects.filter(codigo="mm").values_list("pk", flat=True).first()


def _default_tipo_manejo_stock():
    return TipoManejoStock.objects.filter(codigo="unidad").values_list("pk", flat=True).first()


class Categoria(models.Model):
    almacen = models.ForeignKey(
        Almacen,
        on_delete=models.PROTECT,
        related_name="categorias",
    )
    nombre = models.CharField(max_length=100)
    prefijo = models.CharField(
        max_length=3,
        help_text="Prefijo de letras usado en el código de catálogo (ej. H, G, C)."
    )
    descripcion = models.TextField(blank=True)
    activo = models.BooleanField(
        default=True,
        help_text="Si se desactiva, los materiales de esta categoría dejarán de aparecer en préstamos, inspecciones y demás procesos operativos.",
    )
    requiere_inspeccion = models.BooleanField(
        default=False,
        help_text="Si está activo, los materiales de esta categoría pueden ser "
                   "inspeccionados (ej. Herramientas). Categorías como consumibles "
                   "o eléctricos no retornables deben dejarlo desactivado.",
    )

    class Meta:
        verbose_name_plural = "Categorías"
        ordering = ["nombre"]
        unique_together = [("almacen", "nombre"), ("almacen", "prefijo")]

    def __str__(self):
        return f"{self.nombre} ({self.prefijo})"

class Subcategoria(models.Model):
    categoria = models.ForeignKey(
        Categoria, on_delete=models.PROTECT, related_name="subcategorias"
    )
    nombre = models.CharField(max_length=100)
    plantilla_inspeccion = models.ForeignKey(
        "inspeccion.PlantillaCriterio",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="subcategorias",
        help_text="Plantilla de criterios a usar para inspeccionar materiales de esta "
                   "subcategoría. Vacío si no aplica inspección (ej. consumibles)."
    )
    activo = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = "Subcategorías"
        unique_together = ("categoria", "nombre")
        ordering = ["categoria__nombre", "nombre"]

    def __str__(self):
        return f"{self.categoria.nombre} → {self.nombre}"
class MaterialQuerySet(models.QuerySet):
    def inspeccionables(self):
        return self.filter(
            activo=True,
            es_componente=False,
            subcategoria__activo=True,
            subcategoria__categoria__activo=True,
            subcategoria__categoria__requiere_inspeccion=True,
            subcategoria__plantilla_inspeccion__isnull=False,
        )
    
class Material(models.Model):
    TIPO_CONTROL_CHOICES = [
        ("retornable", "Retornable"),
        ("no_retornable", "No retornable"),
    ]


    subcategoria = models.ForeignKey(
        Subcategoria, on_delete=models.PROTECT, related_name="materiales"
    )
    almacen = models.ForeignKey(
        Almacen,
        on_delete=models.PROTECT,
        related_name="materiales",
    )
    codigo = models.CharField(max_length=20, blank=True)
    nombre = models.CharField(max_length=150)
    codigo_quipu = models.CharField(
        max_length=50,
        blank=True,
        verbose_name="Código QUIPU",
        help_text="Código de referencia manual del sistema QUIPU (opcional).",
    )
    marca = models.CharField(max_length=100, blank=True)
    modelo = models.CharField(
        max_length=100, blank=True,
        help_text="Código o número de modelo del fabricante, si la herramienta lo tiene (ej. 'GSB 550')."
    )
    medida = models.CharField(max_length=100, blank=True)
    foto = models.ImageField(
        upload_to="materiales/",
        blank=True,
        null=True,
        help_text="Foto representativa del material (ej. foto genérica de un tornillo, "
                   "o del modelo de taladro antes de generar sus piezas)."
    )
    unidad_medida = models.ForeignKey(
        UnidadMedida,
        on_delete=models.PROTECT,
        related_name="materiales_medida",
        default=_default_unidad_medida,
        help_text="Unidad usada para grosor y largo.",
    )
    grosor = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True,
        help_text="Grosor/diámetro, si aplica (ej. brocas, pernos)."
    )
    largo = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True,
        help_text="Largo, si aplica (ej. brocas, pernos)."
    )
    ubicacion_fisica = models.CharField(
        max_length=100, blank=True,
        help_text="Dónde encontrar este material físicamente, ej. 'Caja de brocas, Estante 3'."
    )
    precio = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        help_text="Precio de referencia de este material. Para estuches, es el precio del conjunto completo (no de piezas hijas individuales)."
    )
    MONEDA_CHOICES = [
        ("PEN", "Soles (PEN)"),
        ("USD", "Dólares (USD)"),
    ]

    moneda = models.CharField(
        max_length=3, choices=MONEDA_CHOICES, blank=True, default="PEN",
        help_text="Moneda en la que está expresado el precio."
    )
    tipo_control = models.CharField(max_length=15, choices=TIPO_CONTROL_CHOICES)
    control_individual = models.BooleanField(default=False)

    # Editable solo si control_individual=False; si es True, se recalcula solo (ver services.py/signals.py).
    cantidad_total = models.PositiveIntegerField(default=0)
    stock_minimo = models.PositiveIntegerField(
        default=0,
        help_text="Si el stock cae a este nivel o por debajo se genera una notificación. 0 = desactivado.",
    )

    # Solo aplica a consumibles (control_individual=False). Indica si el stock
    # de este material se maneja contando unidades sueltas o cajas cerradas.
    # cantidad_total SIEMPRE queda expresado en unidades, sin importar el modo.
    unidad_manejo = models.ForeignKey(
        TipoManejoStock,
        on_delete=models.PROTECT,
        related_name="materiales",
        default=_default_tipo_manejo_stock,
        help_text="Cómo se cuenta el stock de este consumible: por unidad suelta, por empaque "
                   "(caja, bolsa, kit, millar, etc.) o por rollo con conversión de unidad.",
    )
    unidades_por_caja = models.PositiveIntegerField(
        null=True, blank=True,
        help_text="Cuántas unidades trae cada empaque. Requerido si unidad_manejo.requiere_multiplicador.",
    )
    unidad_movimiento_base = models.ForeignKey(
        UnidadMedida,
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name="materiales_base_movimiento",
        help_text="Unidad en la que se guarda internamente el stock (ej. 'cm' para un Rollo). "
                   "Solo aplica si unidad_manejo.permite_conversion_unidad.",
    )

    activo = models.BooleanField(default=True)
    es_componente = models.BooleanField(
        default=False,
        help_text=(
            "True si este material es un tipo de pieza componente de un estuche "
            "(creado autom\u00e1ticamente al registrar piezas hijas inline). "
            "Los componentes no aparecen en el cat\u00e1logo general."
        ),
    )
    creado_en = models.DateTimeField(auto_now_add=True)

    PERIODICIDAD_UNIDAD_CHOICES = [
        ("dias", "Días"),
        ("meses", "Meses"),
    ]

    periodicidad_valor = models.PositiveIntegerField(
        default=3,
        help_text="Número de la frecuencia de inspección (usar junto con periodicidad_unidad).",
    )
    periodicidad_unidad = models.CharField(
        max_length=5,
        choices=PERIODICIDAD_UNIDAD_CHOICES,
        default="meses",
        help_text="Unidad de la frecuencia: 'dias' o 'meses'.",
    )
    periodicidad_inspeccion_dias = models.PositiveIntegerField(
        default=90,
        editable=False,
        help_text="Calculado automáticamente desde periodicidad_valor/unidad. No se edita directo.",
    )

    objects = MaterialQuerySet.as_manager()

    class Meta:
        ordering = ["codigo"]
        unique_together = ("almacen", "codigo")

    def __str__(self):
        return f"{self.codigo} - {self.nombre}"

    def save(self, *args, **kwargs):
        if not self.pk:
            self.activo = True
        if self.control_individual:
            # El manejo por empaque/rollo solo tiene sentido para consumibles
            # sin control individual; para piezas individuales se normaliza a
            # "unidad" sin múltiplo ni conversión.
            if not (self.unidad_manejo_id and self.unidad_manejo.codigo == "unidad"):
                self.unidad_manejo_id = _default_tipo_manejo_stock()
            self.unidades_por_caja = None
            self.unidad_movimiento_base = None
        else:
            if not (self.unidad_manejo_id and self.unidad_manejo.requiere_multiplicador):
                self.unidades_por_caja = None
            if not (self.unidad_manejo_id and self.unidad_manejo.permite_conversion_unidad):
                self.unidad_movimiento_base = None
        if not self.codigo:
            if self.es_componente:
                from apps.catalogo.services import generar_codigo_material_componente
                self.codigo = generar_codigo_material_componente()
            else:
                from apps.catalogo.services import generar_codigo_material
                self.codigo = generar_codigo_material(self.subcategoria.categoria)
        self.periodicidad_inspeccion_dias = (
                    self.periodicidad_valor * 30
                    if self.periodicidad_unidad == "meses"
                    else self.periodicidad_valor
                )
        super().save(*args, **kwargs)

    def recalcular_cantidad(self):
        """Recalcula cantidad_total contando piezas activas (no 'Baja'), sueltas + hijas de estuches propios."""
        if self.control_individual:
            directas = self.piezas.exclude(estado="Baja").filter(piezas_hijas__isnull=True).count()
            hijas_en_estuches = Pieza.objects.filter(
                padre__material=self
            ).exclude(estado="Baja").exclude(padre__estado="Baja").count()
            total = directas + hijas_en_estuches
            Material.objects.filter(pk=self.pk).update(cantidad_total=total)

class Pieza(models.Model):
    ESTADO_CHOICES = [
        ("Disponible", "Disponible"),
        ("Prestado", "Prestado"),
        ("Mantenimiento", "Mantenimiento"),
        ("Baja", "Baja"),
    ]

    material = models.ForeignKey(
        Material, on_delete=models.PROTECT, related_name="piezas"
    )
    codigo = models.CharField(max_length=5, unique=True, blank=True, null=True, default=None)
    detalle = models.CharField(
        max_length=150,
        blank=True,
        help_text="Nombre o descripción libre para identificar esta pieza suelta "
                   "individualmente (ej. 'Taladro de Juan', 'Estuche azul chico'). Opcional; "
                   "se completa después de creada, no al momento del alta masiva.",
    )
    estado = models.CharField(
        max_length=15, choices=ESTADO_CHOICES, default="Disponible"
    )
    foto = models.ImageField(
        upload_to="piezas/",
        blank=True,
        null=True,
        help_text="Foto de esta pieza específica. Si es un estuche, es la foto del estuche completo; si es una pieza hija, es la foto de esa unidad."
    )
    padre = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="piezas_hijas",
        help_text="Si esta pieza es contenedora (ej. estuche), aquí no aplica. Si esta pieza pertenece a un contenedor, aquí va la pieza padre.",
    )
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "Piezas"
        ordering = ["codigo"]

    def __str__(self):
        base = f"{self.codigo or '—'} ({self.material.nombre})"
        return f"{base} — {self.detalle}" if self.detalle else base

    def save(self, *args, **kwargs):
        if not self.codigo:
            from apps.catalogo.services import generar_codigo_pieza
            self.codigo = generar_codigo_pieza()
        super().save(*args, **kwargs)