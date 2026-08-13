from django.conf import settings
from django.db import models


class PlantillaCriterio(models.Model):
    """Ej. 'Manuales', 'Eléctricas Inalámbricas', 'Eléctricas con cable'."""
    nombre = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.nombre

class Criterio(models.Model):
    plantilla = models.ForeignKey(
        PlantillaCriterio, on_delete=models.CASCADE, related_name="criterios"
    )
    texto = models.CharField(max_length=255)
    orden = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["orden"]

    def __str__(self):
        return f"{self.plantilla.nombre}: {self.texto}"

class Inspeccion(models.Model):
    TIPO_CHOICES = [
        ("individual", "Individual"),
        ("grupal", "Grupal"),
    ]
    RESULTADO_CHOICES = [
        ("apta", "Apta"),
        ("requiere_reparacion", "Requiere reparación"),
        ("fuera_servicio", "Fuera de servicio"),
    ]
    ACCION_CHOICES = [
        ("continua_servicio", "Continúa en servicio"),
        ("enviar_reparacion", "Enviar a reparación"),
        ("retirar_servicio", "Retirar del servicio"),
        ("dar_baja", "Dar de baja"),
        ("reemplazar", "Reemplazar"),
    ]

    inspector = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="inspecciones_realizadas",
    )

    tipo = models.CharField(max_length=10, choices=TIPO_CHOICES)
    material = models.ForeignKey(
        "catalogo.Material", on_delete=models.PROTECT, related_name="inspecciones"
    )
    pieza = models.ForeignKey(
        "catalogo.Pieza", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="inspecciones",
    )
    piezas_lote = models.ManyToManyField(
        "catalogo.Pieza", blank=True, related_name="inspecciones_grupales",
    )

    plantilla = models.ForeignKey("PlantillaCriterio", on_delete=models.PROTECT)
    fecha = models.DateTimeField(auto_now_add=True)
    proxima_inspeccion = models.DateField(null=True, blank=True)

    # Solo para inspección grupal (según la hoja "Manuales")
    cantidad_inspeccionada = models.PositiveIntegerField(null=True, blank=True)
    cantidad_apta = models.PositiveIntegerField(null=True, blank=True)
    cantidad_no_apta = models.PositiveIntegerField(null=True, blank=True)

    resultado_general = models.CharField(max_length=25, choices=RESULTADO_CHOICES, blank=True)
    accion_tomada = models.CharField(max_length=25, choices=ACCION_CHOICES, blank=True)
    observaciones = models.TextField(blank=True)

    class Meta:
        ordering = ["-fecha"]

    def __str__(self):
        objetivo = self.pieza.codigo if self.pieza else self.material.codigo
        return f"Inspección {objetivo} - {self.fecha.date()}"

class RespuestaCriterio(models.Model):
    VALOR_CHOICES = [
        ("cumple", "Cumple"),
        ("no_cumple", "No cumple"),
        ("no_aplica", "No aplica"),
    ]

    inspeccion = models.ForeignKey(
        Inspeccion, on_delete=models.CASCADE, related_name="respuestas"
    )
    criterio = models.ForeignKey(Criterio, on_delete=models.PROTECT)
    valor = models.CharField(max_length=10, choices=VALOR_CHOICES)
    observacion = models.CharField(max_length=255, blank=True)

    class Meta:
        unique_together = ("inspeccion", "criterio")

class PlanInspeccionAnual(models.Model):
    ESTADO_CHOICES = [
        ("borrador", "Borrador"),
        ("aprobado", "Aprobado"),
        ("cerrado", "Cerrado"),
    ]

    anio = models.PositiveIntegerField(unique=True)
    fecha_inicio = models.DateField()
    fecha_fin = models.DateField()
    estado = models.CharField(max_length=10, choices=ESTADO_CHOICES, default="borrador")
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-anio"]

    def __str__(self):
        return f"Plan de inspección {self.anio}"


class ProgramacionInspeccion(models.Model):
    ESTADO_CHOICES = [
        ("pendiente", "Pendiente"),
        ("realizada", "Realizada"),
    ]

    plan = models.ForeignKey(PlanInspeccionAnual, on_delete=models.CASCADE, related_name="programaciones")
    material = models.ForeignKey("catalogo.Material", null=True, blank=True, on_delete=models.CASCADE, related_name="programaciones_inspeccion")
    pieza = models.ForeignKey("catalogo.Pieza", null=True, blank=True, on_delete=models.CASCADE, related_name="programaciones_inspeccion")
    periodicidad_dias = models.PositiveIntegerField()
    fecha_programada = models.DateField()
    estado = models.CharField(max_length=10, choices=ESTADO_CHOICES, default="pendiente")
    inspeccion = models.ForeignKey(Inspeccion, null=True, blank=True, on_delete=models.SET_NULL, related_name="programacion")

    class Meta:
        ordering = ["fecha_programada"]

    def __str__(self):
        objetivo = self.pieza.codigo if self.pieza else self.material.codigo
        return f"{objetivo} - {self.fecha_programada}"

    @property
    def estado_calculado(self):
        """vencida / proxima / pendiente / realizada — calculado en el momento, no se guarda."""
        from datetime import date, timedelta
        if self.inspeccion_id:
            return "realizada"
        hoy = date.today()
        if self.fecha_programada < hoy:
            return "vencida"
        if self.fecha_programada <= hoy + timedelta(days=15):
            return "proxima"
        return "pendiente"