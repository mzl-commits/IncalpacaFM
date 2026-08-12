from django.conf import settings
from django.db import models

from apps.catalogo.models import Material, Pieza


class Movimiento(models.Model):
    TIPO_CHOICES = [
        ("salida", "Salida"),
        ("entrada", "Entrada"),
        ("baja", "Baja"),
    ]

    material = models.ForeignKey(Material, on_delete=models.PROTECT, related_name="movimientos")
    pieza = models.ForeignKey(
        Pieza, null=True, blank=True, on_delete=models.SET_NULL, related_name="movimientos"
    )
    tipo = models.CharField(max_length=10, choices=TIPO_CHOICES)
    cantidad = models.PositiveIntegerField(
        default=1,
        help_text="Para materiales sin control individual, cantidad que sale/entra/se da de baja "
                   "SIEMPRE expresada en unidades. Para piezas individuales, siempre 1."
    )
    cantidad_cajas = models.PositiveIntegerField(
        null=True, blank=True,
        help_text="Si el material se maneja por empaque, número de empaques que originaron este "
                   "movimiento. 'cantidad' sigue siendo el total en unidades (empaques × unidades/empaque).",
    )
    fecha = models.DateTimeField(auto_now_add=True)
    responsable = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="movimientos_realizados"
    )
    referencia_externa = models.CharField(
        max_length=50, blank=True,
        help_text="Código de Orden de Trabajo/Solicitud de otro módulo, ej. 'OT-2026-045'."
    )
    lote_id = models.CharField(
        max_length=40, blank=True,
        help_text="Identificador compartido cuando varios movimientos pertenecen a la misma "
                   "salida de un estuche completo (contenedor + hijas)."
    )
    observaciones = models.TextField(blank=True)

    class Meta:
        ordering = ["-fecha"]

    def __str__(self):
        objetivo = self.pieza.codigo if self.pieza else self.material.codigo
        return f"{self.get_tipo_display()} - {objetivo} ({self.fecha.date()})"


class SolicitudMovimiento(models.Model):
    """Solicitud de salida o baja de stock iniciada por un ALMACENERO.
    Permanece en estado PENDIENTE hasta que un ADMINISTRADOR la apruebe o rechace.
    Al aprobarse, se crea el Movimiento real y se vincula mediante FK.
    """

    class Tipo(models.TextChoices):
        SALIDA_MATERIAL = "salida_material", "Salida de material"
        SALIDA_PIEZA    = "salida_pieza",    "Salida de pieza"
        BAJA_MATERIAL   = "baja_material",   "Baja de material"
        BAJA_PIEZA      = "baja_pieza",      "Baja de pieza"

    class Estado(models.TextChoices):
        PENDIENTE  = "pendiente",  "Pendiente"
        APROBADA   = "aprobada",   "Aprobada"
        RECHAZADA  = "rechazada",  "Rechazada"

    tipo = models.CharField(max_length=20, choices=Tipo.choices)
    material = models.ForeignKey(
        Material, null=True, blank=True,
        on_delete=models.PROTECT, related_name="solicitudes_movimiento",
    )
    pieza = models.ForeignKey(
        Pieza, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="solicitudes_movimiento",
    )
    # Para salida_pieza con selección parcial de hijas (JSON con lista de IDs)
    piezas_hijas_ids = models.JSONField(
        default=list, blank=True,
        help_text="IDs de piezas hijas a mover en una salida parcial de estuche.",
    )
    cantidad = models.PositiveIntegerField(default=1)
    cantidad_cajas = models.PositiveIntegerField(null=True, blank=True)
    referencia_externa = models.CharField(max_length=50, blank=True)
    observaciones = models.TextField(blank=True)

    solicitado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="solicitudes_movimiento_creadas",
    )
    estado = models.CharField(
        max_length=10, choices=Estado.choices, default=Estado.PENDIENTE,
    )
    creado_en = models.DateTimeField(auto_now_add=True)
    resuelto_en = models.DateTimeField(null=True, blank=True)
    resuelto_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="solicitudes_movimiento_resueltas",
    )
    motivo_rechazo = models.TextField(blank=True)

    # FK al Movimiento real creado al aprobar (para trazabilidad completa)
    movimiento = models.ForeignKey(
        Movimiento, null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="solicitud_origen",
    )

    class Meta:
        ordering = ["-creado_en"]

    def __str__(self):
        objetivo = (
            self.pieza.codigo if self.pieza
            else (self.material.codigo if self.material else "—")
        )
        return f"[{self.get_estado_display()}] {self.get_tipo_display()} · {objetivo}"