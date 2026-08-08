from django.db import models

class Categoria(models.Model):
    nombre = models.CharField(max_length=100, unique=True)
    prefijo = models.CharField(
        max_length=3,
        unique=True,
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


class Material(models.Model):
    TIPO_CONTROL_CHOICES = [
        ("retornable", "Retornable"),
        ("no_retornable", "No retornable"),
    ]

    subcategoria = models.ForeignKey(
        Subcategoria, on_delete=models.PROTECT, related_name="materiales"
    )
    codigo = models.CharField(max_length=20, unique=True, blank=True)
    nombre = models.CharField(max_length=150)
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
    grosor_mm = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True,
        help_text="Grosor/diámetro, si aplica (ej. brocas, pernos)."
    )
    largo_mm = models.DecimalField(
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
    tipo_control = models.CharField(max_length=15, choices=TIPO_CONTROL_CHOICES)
    control_individual = models.BooleanField(default=False)

    # Editable solo cuando control_individual=False (consumibles).
    # Cuando control_individual=True, se recalcula automáticamente
    # contando piezas activas (ver services.py / signals.py).
    cantidad_total = models.PositiveIntegerField(default=0)

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


    class Meta:
        ordering = ["codigo"]

    def __str__(self):
        return f"{self.codigo} - {self.nombre}"

    def save(self, *args, **kwargs):
        if not self.pk:
            self.activo = True
        if not self.codigo:
            if self.es_componente:
                from apps.catalogo.services import generar_codigo_material_componente
                self.codigo = generar_codigo_material_componente()
            else:
                from apps.catalogo.services import generar_codigo_material
                self.codigo = generar_codigo_material(self.subcategoria.categoria)
        super().save(*args, **kwargs)

    def recalcular_cantidad(self):
        """Recalcula cantidad_total contando piezas activas (no 'Baja').
        Incluye piezas sueltas de este material + items dentro de estuches de este material."""
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
        return f"{self.codigo or '—'} ({self.material.nombre})"

    def save(self, *args, **kwargs):
        if not self.codigo:
            from apps.catalogo.services import generar_codigo_pieza
            self.codigo = generar_codigo_pieza()
        super().save(*args, **kwargs)