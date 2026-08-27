from django.core.management.base import BaseCommand
from apps.inspeccion.models import PlantillaCriterio, Criterio

CRITERIOS = {
    "Manual": [
        "¿Todas las herramientas están libres de aceites, grasas, materiales deslizantes y/o corrosivos?",
        "¿Las herramientas se trasladan en contenedores adecuados, diseñados para tal fin?",
        "¿Las herramientas se guardan de tal forma que no se deterioran unas con otras?",
        "¿Las herramientas presentan grietas, deformaciones o corrosión?",
        "¿Cuentas con sus mangos originales, firmes, sin daños o rajaduras?",
        "¿El filo o punta presenta un desgaste excesivo?",
        "¿Cuenta con todas sus partes completas, las uniones están firmes?",
        "¿Se encuentras libres de modificaciones (herramientas hechizas)?",
        "¿Cuenta con la identificación y código visible?",
        "¿Cuenta con la cinta de inspección del mes?",
        "¿Los mangos son dieléctricos?",
    ],
    "Inalámbrica": [
        "¿La carcasa está libre de grietas, deformaciones o daños visibles?",
        "¿La empuñadura está en buen estado y firme?",
        "¿El gatillo o interruptor funciona correctamente?",
        "¿El selector de velocidad/giro y el mandril funcionan y ajustan correctamente (si aplica)?",
        "¿La batería está libre de golpes, fisuras o deformaciones, y correctamente fijada?",
        "¿Los contactos de la batería y el cargador presentan corrosión o suciedad?",
        "¿El cargador y los indicadores de carga funcionan correctamente?",
        "¿Presenta ruidos, vibraciones o sobrecalentamiento anormal durante la prueba?",
        "¿Cuenta con accesorio compatible e instalado correctamente (broca, punta, disco, etc.), si aplica?",
        "¿Cuenta con etiquetas del fabricante, código patrimonial y cinta de inspección vigente?",
    ],
    "Eléctrica": [
        "¿La carcasa está libre de grietas, deformaciones o daños visibles?",
        "¿La empuñadura está en buen estado y firme?",
        "¿El gatillo o interruptor funciona correctamente?",
        "¿El cable de alimentación está libre de cortes, peladuras o empalmes improvisados?",
        "¿El enchufe (clavija) está en buen estado, sin roturas ni pines doblados/quemados?",
        "¿Cuenta con conexión a tierra (puesta a tierra) en buen estado, si aplica?",
        "¿El selector de velocidad/giro y el mandril funcionan y ajustan correctamente (si aplica)?",
        "¿Presenta ruidos, vibraciones, chispas o sobrecalentamiento anormal durante la prueba?",
        "¿Cuenta con accesorio compatible e instalado correctamente (broca, disco, punta, etc.), si aplica?",
        "¿Cuenta con etiquetas del fabricante, código patrimonial y cinta de inspección vigente?",
    ],
    "EPP (equipo de protección personal)": [
        "CASCO – ¿La carcaza se encuentra compacta, sin grietas o perforaciones?",
        "CASCO – ¿El arnés y/o tafilete se encuentra fijado en todas sus partes a la carcasa y en buenas condiciones?",
        "CASCO – ¿Posee barbiquejo para ser usado en trabajos en altura física?",
        "ANTEOJOS DE SEGURIDAD – ¿Se puede ver claramente a través de ellos?",
        "ANTEOJOS DE SEGURIDAD – ¿Las partes movibles se encuentran en buenas condiciones?",
        "ANTEOJOS DE SEGURIDAD – ¿Los lentes son herméticos?",
        "GUANTES – ¿Se encuentran sin roturas o costura cortada?",
        "GUANTES – ¿Se encuentra sin restos de grasa, aceite u otro solvente?",
        "ZAPATOS DE SEGURIDAD – ¿Las huellas de la planta tienen profundidad (no lisa)?",
        "ZAPATOS DE SEGURIDAD – ¿La planta se encuentra sin perforaciones o partiduras?",
        "ZAPATOS DE SEGURIDAD – ¿Las costuras se encuentran sin cortes?",
        "ZAPATOS DE SEGURIDAD – ¿La puntera está totalmente cubierta por el cuero (no se ve)?",
        "CARETAS DE PROTECCIÓN FACIAL – ¿El visor se encuentra libre de rayaduras profundas o fisuras que obstruyan la visión?",
        "CARETAS DE PROTECCIÓN FACIAL – ¿El arnés de cabeza está ajustado correctamente y no presenta daños?",
        "PROTECTORES AUDITIVOS – ¿Las almohadillas se encuentran en buen estado, sin grietas o endurecimiento?",
        "PROTECTORES AUDITIVOS – ¿El mecanismo de ajuste o banda sujeta correctamente y no presenta deformaciones?",
    ],
    "Escaleras": [
        "Revisión General de la escalera – ¿La escalera se encuentra limpia, seca, sin grietas y daños estructurales?",
        "Parales – ¿Son fijos y sin deformaciones?",
        "Remaches – ¿Están encuentran asegurados?",
        "Ganchos de Sujeción – ¿Están en buen estado y son ajustables?",
        "Tramos Extensibles – ¿El izamiento de los cuerpos es el adecuado? ¿Se implementa polea?",
        "Cuerdas para Sistema de extensión – ¿La cuerda está libre de fibras o hebras rotas?",
        "Polea – ¿Se encuentra instalada, en buen estado y se desliza?",
        "Zapatas de Apoyo – ¿Son completas y en buen estado?",
    ],
    "Equipos de protección contra caídas": [
        "CONDICIÓN DEL TEJIDO O CORREA – ¿Fibras externas cortadas, desgastadas o desgarradas?",
        "CONDICIÓN DEL TEJIDO O CORREA – ¿Costuras, cortes o rotura del tejido?",
        "CONDICIÓN DEL TEJIDO O CORREA – ¿Grietas?",
        "CONDICIÓN DEL TEJIDO O CORREA – ¿Estiramiento excesivo?",
        "CONDICIÓN DEL TEJIDO O CORREA – ¿Deterioro general?",
        "CONDICIÓN DEL TEJIDO O CORREA – ¿Corrosión por exposición a ácidos o productos químicos?",
        "CONDICIÓN DEL TEJIDO O CORREA – ¿Quemaduras?",
        "CONDICIÓN DEL TEJIDO O CORREA – Otros",
        "ARGOLLAS EN \"D\" O ANILLOS – ¿Con deformaciones o desgastes excesivos?",
        "ARGOLLAS EN \"D\" O ANILLOS – ¿Picaduras o grietas?",
        "ARGOLLAS EN \"D\" O ANILLOS – ¿Deterioro general?",
        "ARGOLLAS EN \"D\" O ANILLOS – ¿Corrosión por exposición a ácidos o productos químicos?",
        "ARGOLLAS EN \"D\" O ANILLOS – Otros",
        "HEBILLAS – ¿Desgastes excesivos o deformación?",
        "HEBILLAS – ¿Picaduras o grietas?",
        "HEBILLAS – ¿Deterioro general?",
        "HEBILLAS – ¿Defecto de funcionamiento?",
        "HEBILLAS – ¿Corrosión por exposición a ácidos o productos químicos?",
        "HEBILLAS – Otros",
        "LÍNEA DE SUJECIÓN – ¿Cortes o roturas del tejido de correa, deshilachadas o destrenzadas?",
        "LÍNEA DE SUJECIÓN – ¿Desgastes, deformación o desgarro?",
        "LÍNEA DE SUJECIÓN – ¿Estiramiento o elongación excesivos?",
        "LÍNEA DE SUJECIÓN – ¿Corrosión?",
        "LÍNEA DE SUJECIÓN – ¿Quemaduras?",
        "LÍNEA DE SUJECIÓN – Otros",
        "GANCHOS DE RESORTE (MOSQUETÓN) – ¿Desgaste excesivo o deformaciones?",
        "GANCHOS DE RESORTE (MOSQUETÓN) – ¿Picaduras o grietas?",
        "GANCHOS DE RESORTE (MOSQUETÓN) – ¿Resorte con fallas?",
        "GANCHOS DE RESORTE (MOSQUETÓN) – ¿Ajustes inadecuados o incorrectos de los cierres de resortes o de seguridad?",
        "GANCHOS DE RESORTE (MOSQUETÓN) – ¿Deterioro general?",
        "GANCHOS DE RESORTE (MOSQUETÓN) – ¿Corrosión?",
        "GANCHOS DE RESORTE (MOSQUETÓN) – ¿Abertura de garganta excesiva respecto al diámetro del elemento al cual se fija?",
        "AMORTIGUADOR – ¿Cortes o roturas del tejido de correa, deshilachadas o destrenzadas?",
        "AMORTIGUADOR – ¿Deformaciones?",
        "AMORTIGUADOR – ¿Deterioro general?",
    ],
    "Iluminaria (linternas / equipos de iluminación)": [
        "Carcasa sin fisuras ni roturas.",
        "Encendido y apagado funciona correctamente.",
        "Batería o pilas en buen estado.",
        "Sin parpadeos ni fallas de intensidad.",
        "Lente o difusor sin rajaduras.",
        "Correa o sujeción en buen estado (si aplica).",
        "Identificación o código visible.",
    ],
}

class Command(BaseCommand):
    help = "Carga los criterios de inspección en las plantillas (Manual, Inalámbrica, Eléctrica, EPP, Escaleras, Equipos de protección contra caídas, Iluminaria)."

    def handle(self, *args, **options):
        for nombre_plantilla, criterios in CRITERIOS.items():
            plantilla, creada = PlantillaCriterio.objects.get_or_create(nombre=nombre_plantilla)
            estado = "creada" if creada else "encontrada"
            self.stdout.write(f"Plantilla '{nombre_plantilla}' {estado} (id={plantilla.id}).")

            for orden, texto in enumerate(criterios, start=1):
                Criterio.objects.update_or_create(
                    plantilla=plantilla, texto=texto, defaults={"orden": orden}
                )
            orphans = Criterio.objects.filter(plantilla=plantilla).exclude(texto__in=criterios)
            from apps.inspeccion.models import RespuestaCriterio
            RespuestaCriterio.objects.filter(criterio__in=orphans).delete()
            eliminados, _ = orphans.delete()
            self.stdout.write(f"  -> {len(criterios)} criterios cargados (eliminados {eliminados} huérfanos).")

        self.stdout.write(self.style.SUCCESS("Carga de criterios completada."))