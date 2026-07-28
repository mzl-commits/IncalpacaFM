from django.db import models


class Usuario(models.Model):
    ROL_CHOICES = [
        ("trabajador", "Trabajador/Operario"),
        ("encargado", "Encargado de Almacén"),
        ("admin", "Administrador"),
    ]
    nombre = models.CharField(max_length=150)
    rol = models.CharField(max_length=20, choices=ROL_CHOICES)
    activo = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.nombre} ({self.get_rol_display()})"