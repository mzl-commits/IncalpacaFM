from django.core.management.base import BaseCommand
from apps.inspeccion.models import PlantillaCriterio, Criterio

CRITERIOS = {
    "Manuales": [
        "Estado general de limpieza.",
        "Ausencia de grietas.",
        "Ausencia de deformaciones.",
        "Ausencia de corrosión.",
        "Mango firme y sin daños.",
        "Partes completas.",
        "Uniones firmes.",
        "Filo o punta en buen estado (cuando aplique).",
        "Superficie de agarre en buen estado.",
        "Libre de rebabas.",
        "Funcionamiento correcto.",
        "Herramienta apta para uso seguro.",
        "No presenta modificaciones improvisadas.",
        "Identificación legible.",
        "Código patrimonial visible.",
        "Identificación de inspección vigente (cinta o etiqueta trimestral).",
    ],
    "Eléctricas Inalámbricas": [
        "Estado general de limpieza.",
        "Carcasa íntegra, sin grietas ni deformaciones.",
        "Empuñadura en buen estado.",
        "Gatillo o interruptor funciona correctamente.",
        "Selector de velocidad o giro funciona correctamente (si aplica).",
        "Mandril en buen estado y con ajuste correcto (si aplica).",
        "Batería sin golpes, fisuras o deformaciones.",
        "Batería correctamente fijada a la herramienta.",
        "Contactos de la batería limpios y sin corrosión.",
        "Cargador en buen estado.",
        "Indicadores de carga funcionan correctamente (si aplica).",
        "No presenta ruidos ni vibraciones anormales.",
        "Funcionamiento correcto durante la prueba.",
        "Accesorio instalado en buen estado y compatible (broca, punta, etc.), si aplica.",
        "Etiquetas del fabricante legibles.",
        "Código patrimonial visible.",
        "Identificación de inspección vigente (cinta o etiqueta trimestral).",
        "Herramienta apta para un uso seguro.",
    ],
    "Eléctricas con cable": [
        "Estado general de limpieza de la herramienta.",
        "Carcasa íntegra, sin grietas ni deformaciones.",
        "Cable de alimentación en buen estado, sin cortes ni empalmes.",
        "Enchufe en buen estado, sin roturas ni pines dañados.",
        "Interruptor de encendido y apagado funciona correctamente.",
        "Guarda o protector de seguridad instalado y en buen estado (si aplica).",
        "Empuñaduras firmes y sin daños.",
        "Accesorios de fijación completos (tuercas, bridas, mandril, etc.).",
        "Ventilas de refrigeración limpias y libres de obstrucciones.",
        "No presenta ruidos ni vibraciones anormales.",
        "Funciona correctamente durante la prueba de encendido.",
        "Accesorio instalado en buen estado y compatible (disco, broca, cuchilla, etc.), si aplica.",
        "Etiquetas del fabricante legibles.",
        "Código patrimonial visible.",
        "Identificación de inspección vigente (cinta o etiqueta trimestral).",
        "Herramienta apta para un uso seguro.",
    ],
}

class Command(BaseCommand):
    help = "Carga las plantillas de criterios de inspección desde el formato Excel de Incalpaca."

    def handle(self, *args, **options):
        for nombre_plantilla, criterios in CRITERIOS.items():
            plantilla, creada = PlantillaCriterio.objects.get_or_create(nombre=nombre_plantilla)
            estado = "creada" if creada else "ya existía"
            self.stdout.write(f"Plantilla '{nombre_plantilla}' {estado}.")

            for orden, texto in enumerate(criterios, start=1):
                Criterio.objects.update_or_create(
                    plantilla=plantilla, texto=texto, defaults={"orden": orden}
                )
            self.stdout.write(f"  → {len(criterios)} criterios cargados.")

        self.stdout.write(self.style.SUCCESS("Carga de criterios completada."))