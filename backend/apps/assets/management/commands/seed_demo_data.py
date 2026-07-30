from datetime import datetime, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.accounts.models import AccountProfile
from apps.assets.models import (
    Asset,
    AssetAssignment,
    AssignableResponsible,
    Location,
    Taxonomy,
)
from apps.incidents.models import Incident
from apps.maintenance.models import RepairRecord
from apps.workorders.models import WorkOrder


class Command(BaseCommand):
    help = "Carga 30 bienes de prueba idempotentes coherentes con el modelo del SGTB."

    def handle(self, *args, **options):
        user, _ = get_user_model().objects.update_or_create(
            username="facility.demo",
            defaults={
                "first_name": "Rosa",
                "last_name": "Medina",
                "email": "facility.demo@incalpaca.test",
            },
        )
        user.set_password("DemoSGTB2026!")
        user.save(update_fields=("password",))
        AccountProfile.objects.update_or_create(
            user=user,
            defaults={
                "worker_code": "FM-DEMO",
                "role": AccountProfile.Role.ADMIN,
                "must_change_password": False,
                "active": True,
            },
        )

        user_model = get_user_model()
        admin_user = (
            user_model.objects.filter(username="admin").first()
            or user_model.objects.filter(username="ADM-001").first()
        )
        if admin_user is None:
            admin_user = user_model()
        admin_user.username = "admin"
        admin_user.first_name = "Rosa"
        admin_user.last_name = "Medina"
        admin_user.email = "administrador@incalpaca.test"
        admin_user.is_active = True
        admin_user.is_staff = True
        admin_user.set_password("Montescoli3")
        admin_user.save()
        AccountProfile.objects.update_or_create(
            user=admin_user,
            defaults={
                "worker_code": "admin",
                "role": AccountProfile.Role.ADMIN,
                "specialty": "Facility Management",
                "must_change_password": False,
                "active": True,
            },
        )

        technician_user = (
            user_model.objects.filter(username="tecnico").first()
            or user_model.objects.filter(username="TEC-001").first()
        )
        if technician_user is None:
            technician_user = user_model()
        technician_user.username = "tecnico"
        technician_user.first_name = "Luis"
        technician_user.last_name = "Fernández"
        technician_user.email = "tecnico@incalpaca.test"
        technician_user.is_active = True
        technician_user.set_password("Montescoli3")
        technician_user.save()
        AccountProfile.objects.update_or_create(
            user=technician_user,
            defaults={
                "worker_code": "tecnico",
                "role": AccountProfile.Role.TECHNICIAN,
                "specialty": "Mantenimiento eléctrico y mecánico",
                "must_change_password": False,
                "active": True,
            },
        )

        locations = {}
        for zone, building, area, room, common_space in [
            ("Zona Industrial", "Edificio Administrativo", "Sistemas", "Oficina 204", False),
            (
                "Zona Industrial",
                "Planta Principal",
                "Mantenimiento",
                "Taller mecánico",
                False,
            ),
            (
                "Zona Industrial",
                "Edificio Administrativo",
                "Administración",
                "Sala de reuniones principal",
                True,
            ),
            (
                "Zona Comercial",
                "Centro de distribución",
                "Logística",
                "Almacén central",
                True,
            ),
            ("Zona Industrial", "Planta Principal", "Producción", "Línea 1", False),
            (
                "Zona Industrial",
                "Planta Principal",
                "Calidad",
                "Control de calidad",
                False,
            ),
            (
                "Zona Industrial",
                "Planta Principal",
                "Mantenimiento",
                "Taller eléctrico",
                False,
            ),
            (
                "Zona Comercial",
                "Centro de distribución",
                "Logística",
                "Despacho",
                False,
            ),
        ]:
            location, _ = Location.objects.update_or_create(
                zone=zone,
                building=building,
                area=area,
                room=room,
                defaults={"common_space": common_space, "active": True},
            )
            locations[room] = location

        taxonomies = {}
        for asset_type, category, subcategory, specialty in [
            ("Tecnología", "Equipos de cómputo", "Laptop", "TI"),
            ("Tecnología", "Equipos de cómputo", "Servidor", "TI"),
            ("Tecnología", "Periféricos", "Monitor", "TI"),
            ("Tecnología", "Periféricos", "Impresora", "TI"),
            ("Tecnología", "Periféricos", "Escáner", "TI"),
            ("Tecnología", "Periféricos", "Teclado", "TI"),
            ("Tecnología", "Periféricos", "Proyector", "TI"),
            (
                "Herramientas y equipos",
                "Herramienta eléctrica",
                "Taladro",
                "Eléctrica",
            ),
            (
                "Herramientas y equipos",
                "Herramienta eléctrica",
                "Esmeril",
                "Eléctrica",
            ),
            (
                "Herramientas y equipos",
                "Herramienta eléctrica",
                "Sierra",
                "Mecánica",
            ),
            (
                "Herramientas y equipos",
                "Herramienta eléctrica",
                "Compresora",
                "Mecánica",
            ),
            (
                "Herramientas y equipos",
                "Equipo industrial",
                "Bomba",
                "Mecánica",
            ),
            (
                "Herramientas y equipos",
                "Equipo industrial",
                "Motor",
                "Eléctrica",
            ),
            (
                "Herramientas y equipos",
                "Equipo industrial",
                "Generador",
                "Eléctrica",
            ),
            (
                "Herramientas y equipos",
                "Equipo industrial",
                "Tablero eléctrico",
                "Eléctrica",
            ),
            ("Mobiliario", "Oficina", "Escritorio", "No aplica"),
            ("Mobiliario", "Oficina", "Silla", "No aplica"),
            ("Mobiliario", "Oficina", "Archivador", "No aplica"),
            ("Mobiliario", "Oficina", "Estante", "No aplica"),
        ]:
            taxonomy, _ = Taxonomy.objects.update_or_create(
                asset_type=asset_type,
                category=category,
                subcategory=subcategory,
                defaults={"specialty": specialty, "active": True},
            )
            taxonomies[subcategory] = taxonomy

        responsibles = {}
        for ref, kind, name, area, room in [
            ("P-0142", "PERSONA", "Ana Torres", "Sistemas", None),
            ("P-0277", "PERSONA", "Marco Quispe", "Mantenimiento", None),
            ("P-0319", "PERSONA", "Rosa Medina", "Facility Management", None),
            ("A-SIS", "AREA", "Área de Sistemas", "Sistemas", None),
            ("A-MAN", "AREA", "Área de Mantenimiento", "Mantenimiento", None),
            ("A-LOG", "AREA", "Área de Logística", "Logística", None),
            (
                "E-COM-01",
                "ESPACIO_COMUN",
                "Sala de reuniones principal",
                "",
                "Sala de reuniones principal",
            ),
            (
                "E-COM-03",
                "ESPACIO_COMUN",
                "Almacén de uso común",
                "",
                "Almacén central",
            ),
        ]:
            responsible, _ = AssignableResponsible.objects.update_or_create(
                external_reference=ref,
                defaults={
                    "type": kind,
                    "display_name": name,
                    "area_name": area,
                    "location": locations[room] if room else None,
                    "active": True,
                },
            )
            responsibles[ref] = responsible

        samples = [
            {
                "code": "INC-BIEN-2026-000188",
                "entry_type": "purchase",
                "name": "Laptop Lenovo ThinkPad T14",
                "description": "Equipo portátil para infraestructura y soporte.",
                "brand": "Lenovo",
                "model": "ThinkPad T14",
                "condition": "Nuevo",
                "criticality": "Alta",
                "taxonomy": "Laptop",
                "room": "Oficina 204",
                "responsible": "P-0142",
                "assignment_status": "Asignado",
            },
            {
                "code": "INC-BIEN-2026-000189",
                "entry_type": "purchase",
                "name": "Taladro percutor industrial",
                "description": "Herramienta para mantenimiento de planta.",
                "brand": "Bosch",
                "model": "GSB 20-2",
                "condition": "Bueno",
                "criticality": "Alta",
                "taxonomy": "Taladro",
                "room": "Taller mecánico",
                "responsible": "P-0277",
                "assignment_status": "En traslado",
            },
            {
                "code": "INC-BIEN-2026-000190",
                "entry_type": "own_creation",
                "name": "Mueble archivador metálico",
                "description": "Archivador fabricado por mantenimiento.",
                "brand": "",
                "model": "",
                "condition": "Bueno",
                "criticality": "Baja",
                "taxonomy": "Archivador",
                "room": "Oficina 204",
                "responsible": "A-SIS",
                "assignment_status": "Asignado",
            },
            {
                "code": "INC-BIEN-2026-000191",
                "entry_type": "donation",
                "name": "Monitor industrial 27 pulgadas",
                "description": "Monitor para tablero de supervisión.",
                "brand": "LG",
                "model": "27UL500",
                "condition": "Regular",
                "criticality": "Media",
                "taxonomy": "Monitor",
                "room": "Sala de reuniones principal",
                "responsible": "E-COM-01",
                "assignment_status": "Entregado",
            },
            {
                "code": "INC-BIEN-2026-000192",
                "entry_type": "purchase",
                "name": "Impresora multifuncional",
                "description": "Equipo de impresión y digitalización administrativa.",
                "brand": "HP",
                "model": "LaserJet Pro M428",
                "condition": "Nuevo",
                "criticality": "Media",
                "taxonomy": "Impresora",
                "room": "Oficina 204",
                "responsible": "A-SIS",
                "assignment_status": "Asignado",
            },
            {
                "code": "INC-BIEN-2026-000193",
                "entry_type": "rental",
                "name": "Proyector Epson corporativo",
                "description": "Proyector alquilado para capacitaciones.",
                "brand": "Epson",
                "model": "PowerLite X49",
                "condition": "Bueno",
                "criticality": "Baja",
                "taxonomy": "Proyector",
                "room": "Almacén central",
                "responsible": None,
                "assignment_status": "Sin asignar",
            },
            {
                "code": "INC-BIEN-2026-000194",
                "entry_type": "purchase",
                "name": "Laptop Dell Latitude 5440",
                "description": "Equipo disponible para una próxima asignación.",
                "brand": "Dell",
                "model": "Latitude 5440",
                "condition": "Nuevo",
                "criticality": "Media",
                "taxonomy": "Laptop",
                "room": "Almacén central",
                "responsible": None,
                "assignment_status": "Sin asignar",
            },
            {
                "code": "INC-BIEN-2026-000195",
                "entry_type": "purchase",
                "name": "Servidor rack Dell PowerEdge",
                "description": "Servidor para servicios internos de planta.",
                "brand": "Dell",
                "model": "PowerEdge R550",
                "condition": "Nuevo",
                "criticality": "Crítica",
                "taxonomy": "Servidor",
                "room": "Oficina 204",
                "responsible": "A-SIS",
                "assignment_status": "Entregado",
            },
            {
                "code": "INC-BIEN-2026-000196",
                "entry_type": "purchase",
                "name": "Escáner documental",
                "description": "Escáner de alto volumen para archivo central.",
                "brand": "Fujitsu",
                "model": "fi-8170",
                "condition": "Bueno",
                "criticality": "Media",
                "taxonomy": "Escáner",
                "room": "Oficina 204",
                "responsible": "P-0319",
                "assignment_status": "Asignado",
            },
            {
                "code": "INC-BIEN-2026-000197",
                "entry_type": "purchase",
                "name": "Esmeril angular",
                "description": "Herramienta para corte y acabado de metal.",
                "brand": "Makita",
                "model": "GA4530",
                "condition": "Bueno",
                "criticality": "Alta",
                "taxonomy": "Esmeril",
                "room": "Taller mecánico",
                "responsible": "A-MAN",
                "assignment_status": "En traslado",
            },
            {
                "code": "INC-BIEN-2026-000198",
                "entry_type": "purchase",
                "name": "Sierra circular",
                "description": "Equipo portátil para trabajos de corte.",
                "brand": "DeWalt",
                "model": "DWE575",
                "condition": "Requiere revisión",
                "criticality": "Alta",
                "taxonomy": "Sierra",
                "room": "Almacén central",
                "responsible": None,
                "assignment_status": "Sin asignar",
                "operational_status": "En mantenimiento",
            },
            {
                "code": "INC-BIEN-2026-000199",
                "entry_type": "own_creation",
                "name": "Compresora industrial",
                "description": "Compresora ensamblada para herramientas neumáticas.",
                "brand": "Incalpaca",
                "model": "CI-120",
                "condition": "Bueno",
                "criticality": "Alta",
                "taxonomy": "Compresora",
                "room": "Taller mecánico",
                "responsible": "A-MAN",
                "assignment_status": "Asignado",
            },
            {
                "code": "INC-BIEN-2026-000200",
                "entry_type": "donation",
                "name": "Escritorio modular",
                "description": "Módulo de trabajo para oficina administrativa.",
                "brand": "Ofimueble",
                "model": "OM-160",
                "condition": "Bueno",
                "criticality": "Baja",
                "taxonomy": "Escritorio",
                "room": "Sala de reuniones principal",
                "responsible": "E-COM-01",
                "assignment_status": "Entregado",
            },
            {
                "code": "INC-BIEN-2026-000201",
                "entry_type": "purchase",
                "name": "Silla ergonómica",
                "description": "Silla regulable para puesto de trabajo.",
                "brand": "Ofisillas",
                "model": "Ergo Pro",
                "condition": "Nuevo",
                "criticality": "Baja",
                "taxonomy": "Silla",
                "room": "Oficina 204",
                "responsible": "P-0142",
                "assignment_status": "Asignado",
            },
            {
                "code": "INC-BIEN-2026-000202",
                "entry_type": "own_creation",
                "name": "Estante metálico reforzado",
                "description": "Estante para almacenamiento de repuestos.",
                "brand": "Incalpaca",
                "model": "EMR-04",
                "condition": "Bueno",
                "criticality": "Media",
                "taxonomy": "Estante",
                "room": "Almacén central",
                "responsible": None,
                "assignment_status": "Sin asignar",
            },
            {
                "code": "INC-BIEN-2026-000203",
                "entry_type": "purchase",
                "name": "Teclado mecánico",
                "description": "Periférico para estación de diseño.",
                "brand": "Logitech",
                "model": "MX Mechanical",
                "condition": "Nuevo",
                "criticality": "Baja",
                "taxonomy": "Teclado",
                "room": "Oficina 204",
                "responsible": "P-0142",
                "assignment_status": "Asignado",
            },
            {
                "code": "INC-BIEN-2026-000204",
                "entry_type": "purchase",
                "name": "Bomba centrífuga",
                "description": "Bomba de recirculación para línea de proceso.",
                "brand": "Pedrollo",
                "model": "HFm 70B",
                "condition": "Bueno",
                "criticality": "Crítica",
                "taxonomy": "Bomba",
                "room": "Línea 1",
                "responsible": "A-MAN",
                "assignment_status": "Entregado",
            },
            {
                "code": "INC-BIEN-2026-000205",
                "entry_type": "purchase",
                "name": "Motor eléctrico trifásico",
                "description": "Motor de respaldo para maquinaria de producción.",
                "brand": "Siemens",
                "model": "1LE0142",
                "condition": "Nuevo",
                "criticality": "Crítica",
                "taxonomy": "Motor",
                "room": "Taller eléctrico",
                "responsible": "A-MAN",
                "assignment_status": "En traslado",
            },
            {
                "code": "INC-BIEN-2026-000206",
                "entry_type": "rental",
                "name": "Generador eléctrico",
                "description": "Generador alquilado para contingencias.",
                "brand": "Caterpillar",
                "model": "DE33E0",
                "condition": "Bueno",
                "criticality": "Crítica",
                "taxonomy": "Generador",
                "room": "Taller eléctrico",
                "responsible": "A-MAN",
                "assignment_status": "Asignado",
            },
            {
                "code": "INC-BIEN-2026-000207",
                "entry_type": "own_creation",
                "name": "Tablero eléctrico de control",
                "description": "Tablero fabricado para automatización de proceso.",
                "brand": "Incalpaca",
                "model": "TEC-07",
                "condition": "Requiere revisión",
                "criticality": "Alta",
                "taxonomy": "Tablero eléctrico",
                "room": "Control de calidad",
                "responsible": None,
                "assignment_status": "Sin asignar",
                "operational_status": "En evaluación",
            },
            {
                "code": "INC-BIEN-2026-000208",
                "entry_type": "purchase",
                "name": "Laptop HP EliteBook 840",
                "description": "Equipo portátil para supervisión de operaciones.",
                "brand": "HP",
                "model": "EliteBook 840 G10",
                "condition": "Nuevo",
                "criticality": "Media",
                "taxonomy": "Laptop",
                "room": "Oficina 204",
                "responsible": "P-0319",
                "assignment_status": "Asignado",
            },
            {
                "code": "INC-BIEN-2026-000209",
                "entry_type": "purchase",
                "name": "Monitor Samsung 32 pulgadas",
                "description": "Pantalla para seguimiento de indicadores operativos.",
                "brand": "Samsung",
                "model": "ViewFinity S6",
                "condition": "Nuevo",
                "criticality": "Baja",
                "taxonomy": "Monitor",
                "room": "Sala de reuniones principal",
                "responsible": "E-COM-01",
                "assignment_status": "Entregado",
            },
            {
                "code": "INC-BIEN-2026-000210",
                "entry_type": "purchase",
                "name": "Impresora térmica de etiquetas",
                "description": "Impresora destinada al etiquetado de bienes y repuestos.",
                "brand": "Zebra",
                "model": "ZD421",
                "condition": "Bueno",
                "criticality": "Media",
                "taxonomy": "Impresora",
                "room": "Despacho",
                "responsible": "A-LOG",
                "assignment_status": "Asignado",
            },
            {
                "code": "INC-BIEN-2026-000211",
                "entry_type": "rental",
                "name": "Proyector láser para auditorio",
                "description": "Equipo alquilado para reuniones y capacitaciones.",
                "brand": "BenQ",
                "model": "LU930",
                "condition": "Bueno",
                "criticality": "Baja",
                "taxonomy": "Proyector",
                "room": "Almacén central",
                "responsible": None,
                "assignment_status": "Sin asignar",
            },
            {
                "code": "INC-BIEN-2026-000212",
                "entry_type": "purchase",
                "name": "Taladro inalámbrico profesional",
                "description": "Herramienta portátil para intervenciones de mantenimiento.",
                "brand": "DeWalt",
                "model": "DCD996",
                "condition": "Bueno",
                "criticality": "Alta",
                "taxonomy": "Taladro",
                "room": "Taller mecánico",
                "responsible": "P-0277",
                "assignment_status": "En traslado",
            },
            {
                "code": "INC-BIEN-2026-000213",
                "entry_type": "purchase",
                "name": "Esmeril de banco industrial",
                "description": "Equipo fijo para afilado y acabado de componentes.",
                "brand": "Metabo",
                "model": "DS 200 Plus",
                "condition": "Requiere revisión",
                "criticality": "Alta",
                "taxonomy": "Esmeril",
                "room": "Taller mecánico",
                "responsible": "A-MAN",
                "assignment_status": "Asignado",
                "operational_status": "En mantenimiento",
            },
            {
                "code": "INC-BIEN-2026-000214",
                "entry_type": "purchase",
                "name": "Bomba sumergible de drenaje",
                "description": "Bomba de contingencia para evacuación de agua.",
                "brand": "Grundfos",
                "model": "Unilift AP50B",
                "condition": "Nuevo",
                "criticality": "Crítica",
                "taxonomy": "Bomba",
                "room": "Línea 1",
                "responsible": "A-MAN",
                "assignment_status": "Entregado",
            },
            {
                "code": "INC-BIEN-2026-000215",
                "entry_type": "purchase",
                "name": "Motor eléctrico de respaldo",
                "description": "Motor de contingencia almacenado para línea productiva.",
                "brand": "WEG",
                "model": "W22 IE3",
                "condition": "Nuevo",
                "criticality": "Crítica",
                "taxonomy": "Motor",
                "room": "Almacén central",
                "responsible": None,
                "assignment_status": "Sin asignar",
            },
            {
                "code": "INC-BIEN-2026-000216",
                "entry_type": "own_creation",
                "name": "Estante móvil para herramientas",
                "description": "Estructura fabricada para organizar herramientas de taller.",
                "brand": "Incalpaca",
                "model": "EMT-02",
                "condition": "Bueno",
                "criticality": "Baja",
                "taxonomy": "Estante",
                "room": "Taller eléctrico",
                "responsible": "A-MAN",
                "assignment_status": "Asignado",
            },
            {
                "code": "INC-BIEN-2026-000217",
                "entry_type": "donation",
                "name": "Servidor de respaldo Lenovo",
                "description": "Servidor recibido para respaldo de aplicaciones internas.",
                "brand": "Lenovo",
                "model": "ThinkSystem SR630",
                "condition": "Regular",
                "criticality": "Crítica",
                "taxonomy": "Servidor",
                "room": "Oficina 204",
                "responsible": "A-SIS",
                "assignment_status": "Asignado",
                "operational_status": "En evaluación",
            },
        ]

        now = timezone.now()
        previous_responsibles = list(responsibles.values())

        for index, sample in enumerate(samples):
            taxonomy = taxonomies[sample["taxonomy"]]
            location = locations[sample["room"]]
            responsible_ref = sample["responsible"]
            responsible = responsibles.get(responsible_ref)
            serial_number = f"DEMO-{sample['code'][-6:]}"
            entry_payload = {
                "source": "seed_demo_data",
                "currentStep": 6,
                "entryType": sample["entry_type"],
                "name": sample["name"],
                "description": sample["description"],
                "brand": sample["brand"],
                "model": sample["model"],
                "serialNumber": serial_number,
                "condition": sample["condition"],
                "criticality": sample["criticality"],
                "assetType": taxonomy.asset_type,
                "category": taxonomy.category,
                "subcategory": taxonomy.subcategory,
                "technicalSpecialty": taxonomy.specialty,
                "zone": location.zone,
                "building": location.building,
                "locationArea": location.area,
                "room": location.room,
                "locationPending": False,
                "classificationPending": False,
                "assigneeId": responsible_ref or "",
                "assigneeName": responsible.display_name if responsible else "",
                "assignmentReason": (
                    "Asignación operativa de datos de prueba" if responsible else ""
                ),
                "confirmInspected": True,
                "confirmAssignment": bool(responsible),
            }
            asset, _ = Asset.objects.update_or_create(
                code=sample["code"],
                defaults={
                    "entry_type": sample["entry_type"],
                    "name": sample["name"],
                    "description": sample["description"],
                    "brand": sample["brand"],
                    "model": sample["model"],
                    "serial_number": serial_number,
                    "condition": sample["condition"],
                    "criticality": sample["criticality"],
                    "administrative_status": "Registrado",
                    "operational_status": sample.get("operational_status", "Operativo"),
                    "assignment_status": sample["assignment_status"],
                    "taxonomy": taxonomy,
                    "location": location,
                    "registered_by": user,
                    "entry_payload": entry_payload,
                },
            )

            if responsible:
                AssetAssignment.objects.update_or_create(
                    asset=asset,
                    status="ACTIVA",
                    defaults={
                        "responsible": responsible,
                        "location": location,
                        "start_date": timezone.make_aware(datetime(2026, 7, 22, 9, 0))
                        + timedelta(days=index),
                        "change_reason": "Asignación vigente de datos de prueba",
                        "registered_by": user,
                    },
                )
            else:
                AssetAssignment.objects.filter(asset=asset, status="ACTIVA").delete()

            previous_responsible = previous_responsibles[(index + 2) % len(previous_responsibles)]
            AssetAssignment.objects.update_or_create(
                asset=asset,
                status="FINALIZADA",
                change_reason="Dato de prueba: custodia anterior",
                defaults={
                    "responsible": previous_responsible,
                    "location": location,
                    "start_date": now - timedelta(days=300 + index * 5),
                    "end_date": now - timedelta(days=120 + index * 3),
                    "registered_by": user,
                },
            )

            repair_samples = [
                {
                    "suffix": "01",
                    "type": RepairRecord.Type.PREVENTIVE,
                    "reported_at": now - timedelta(days=95 + index),
                    "completed_at": now - timedelta(days=93 + index),
                    "issue": "Mantenimiento preventivo programado.",
                    "work_performed": "Inspección, limpieza, ajuste y prueba funcional.",
                    "technician_name": "Carlos Mendoza",
                    "provider": "Mantenimiento interno",
                    "cost": Decimal("180.00") + index * Decimal("7.50"),
                    "resulting_condition": "Bueno",
                },
                {
                    "suffix": "02",
                    "type": RepairRecord.Type.CORRECTIVE,
                    "reported_at": now - timedelta(days=40 + index),
                    "completed_at": now - timedelta(days=37 + index),
                    "issue": "Desgaste detectado durante la operación.",
                    "work_performed": "Cambio de componente, calibración y validación final.",
                    "technician_name": "Luis Fernández",
                    "provider": "Servicio técnico homologado",
                    "cost": Decimal("320.00") + index * Decimal("12.00"),
                    "resulting_condition": "Operativo",
                },
            ]
            for repair in repair_samples:
                RepairRecord.objects.update_or_create(
                    work_order=f"OT-DEMO-{sample['code'][-6:]}-{repair['suffix']}",
                    defaults={
                        "asset": asset,
                        "type": repair["type"],
                        "status": RepairRecord.Status.COMPLETED,
                        "reported_at": repair["reported_at"],
                        "completed_at": repair["completed_at"],
                        "issue": repair["issue"],
                        "work_performed": repair["work_performed"],
                        "technician_name": repair["technician_name"],
                        "provider": repair["provider"],
                        "cost": repair["cost"],
                        "resulting_condition": repair["resulting_condition"],
                        "registered_by": user,
                    },
                )

        seeded_assets = list(Asset.objects.filter(code__in=[item["code"] for item in samples]))
        incident_samples = [
            ("FALLA_EQUIPO", "El equipo presenta vibración y pérdida de rendimiento.", "ALTA"),
            ("MANTENIMIENTO", "Se solicita revisión preventiva antes del siguiente turno.", "MEDIA"),
            ("FALLA_ELECTRICA", "El equipo no enciende después de una interrupción eléctrica.", "ALTA"),
            ("INSPECCION", "Se detectó ruido inusual durante la inspección diaria.", "MEDIA"),
            ("DAÑO_FISICO", "La carcasa presenta una fisura que requiere evaluación.", "BAJA"),
            ("OTRO", "Validar funcionamiento y actualizar la ficha técnica.", "BAJA"),
        ]
        seeded_incidents = []
        for index, (request_type, description, priority) in enumerate(incident_samples, start=1):
            asset = seeded_assets[(index * 3) % len(seeded_assets)]
            incident, _ = Incident.objects.update_or_create(
                code=f"SOL-2026-{index:04d}",
                defaults={
                    "asset": asset,
                    "requester": admin_user,
                    "request_type": request_type,
                    "description": description,
                    "requester_priority": priority,
                    "location_snapshot": {
                        "locationId": str(asset.location_id or ""),
                        "zone": asset.location.zone if asset.location else "",
                        "building": asset.location.building if asset.location else "",
                        "area": asset.location.area if asset.location else "",
                        "room": asset.location.room if asset.location else "",
                    },
                    "evidence": [
                        {
                            "id": f"EV-{index:03d}",
                            "name": f"evidencia-incidencia-{index}.jpg",
                            "mimeType": "image/jpeg",
                            "size": 184000 + index * 1000,
                        }
                    ],
                    "status": (
                        Incident.Status.IN_PROGRESS if index <= 4 else Incident.Status.RECEIVED
                    ),
                },
            )
            seeded_incidents.append(incident)

        for index, incident in enumerate(seeded_incidents[:4], start=1):
            WorkOrder.objects.update_or_create(
                code=f"OT-2026-{index:04d}",
                defaults={
                    "incident": incident,
                    "technician": technician_user,
                    "supervisor": admin_user,
                    "specialty": (
                        "ELECTRICIDAD" if index % 2 else "SOLDADURA"
                    ),
                    "admin_priority": incident.requester_priority,
                    "status": (
                        WorkOrder.Status.IN_PROGRESS
                        if index <= 2
                        else WorkOrder.Status.SCHEDULED
                    ),
                    "scheduled_date": timezone.localdate() + timedelta(days=index),
                    "started_at": now if index <= 2 else None,
                    "administrator_notes": "Prioridad y técnico confirmados por Administrador/FM.",
                    "progress_percentage": 35 * index if index <= 2 else 0,
                    "advances": [],
                    "recommendation_snapshot": {
                        "selected": "tecnico",
                        "score": 100,
                        "criteria": [
                            "Especialidad compatible",
                            "Disponibilidad confirmada",
                            "Carga dentro del límite",
                        ],
                        "confirmed_by_administrator": True,
                    },
                    "created_by": admin_user,
                },
            )

        self.stdout.write(
            self.style.SUCCESS(
                "Datos de prueba cargados: 30 bienes, 6 incidencias, 4 OT y usuarios "
                "Administrador/Técnico."
            )
        )
