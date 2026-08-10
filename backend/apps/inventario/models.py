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
        help_text="Si el material se maneja por caja, número de cajas que originaron este "
                   "movimiento. 'cantidad' sigue siendo el total en unidades (cajas × unidades/caja).",
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