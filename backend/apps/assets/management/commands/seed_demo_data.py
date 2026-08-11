import base64
import uuid
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import AccountProfile
from apps.assets.models import (
    Asset,
    AssetAssignment,
    AssetInternalSequence,
    AssignableResponsible,
    Location,
    Taxonomy,
    TaxonomySequence,
)
from apps.audit.models import AuditEvent
from apps.incidents.models import Incident
from apps.lifecycle.models import RetirementRequest, TechnicalDiagnosis
from apps.maintenance.models import RepairRecord
from apps.taxonomy.services import assign_fm_identifier, sync_taxonomy_catalog
from apps.workorders.models import WorkOrder


class Command(BaseCommand):
    help = "Carga datos de prueba idempotentes coherentes con el modelo del SGTB."

    @transaction.atomic
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
                "position": "Técnico especialista",
                "hourly_rate": 32.50,
                "must_change_password": False,
                "active": True,
            },
        )

        supervisor_user = (
            user_model.objects.filter(username="supervisor").first()
            or user_model.objects.filter(username="SUP-001").first()
        )
        if supervisor_user is None:
            supervisor_user = user_model()
        supervisor_user.username = "supervisor"
        supervisor_user.first_name = "Mariela"
        supervisor_user.last_name = "Quispe"
        supervisor_user.email = "supervisor@incalpaca.test"
        supervisor_user.is_active = True
        supervisor_user.set_password("12345")
        supervisor_user.save()
        AccountProfile.objects.update_or_create(
            user=supervisor_user,
            defaults={
                "worker_code": "supervisor",
                "role": AccountProfile.Role.SUPERVISOR,
                "specialty": "Supervision de mantenimiento",
                "must_change_password": False,
                "active": True,
            },
        )

        requester_user = (
            user_model.objects.filter(username="usuario").first()
            or user_model.objects.filter(username="REQ-001").first()
        )
        if requester_user is None:
            requester_user = user_model()
        requester_user.username = "usuario"
        requester_user.first_name = "Usuario"
        requester_user.last_name = "Solicitante"
        requester_user.email = "usuario@incalpaca.test"
        requester_user.is_active = True
        requester_user.set_password("Montescoli3")
        requester_user.save()
        AccountProfile.objects.update_or_create(
            user=requester_user,
            defaults={
                "worker_code": "usuario",
                "role": AccountProfile.Role.REQUESTER,
                "specialty": "Operaciones",
                "must_change_password": False,
                "active": True,
            },
        )
        locations = {}
        for zone, building, area, room, common_space in [
            (
                "Zona Industrial",
                "Edificio Administrativo",
                "Facility Management",
                "Oficina FM",
                False,
            ),
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

        sync_taxonomy_catalog()
        official_prefixes = {
            "Impresora": "IM",
            "Escritorio": "ME",
            "Silla": "SL",
            "Archivador": "MR",
            "Estante": "MS",
        }
        taxonomies = {
            sample_key: Taxonomy.objects.get(prefix=prefix)
            for sample_key, prefix in official_prefixes.items()
        }
        for sample_key, prefix, asset_type, category, specialty in [
            ("Laptop", "LAP", "Tecnología", "Equipos de cómputo", "TI"),
            ("Servidor", "SRV", "Tecnología", "Equipos de cómputo", "TI"),
            ("Monitor", "MON", "Tecnología", "Periféricos", "TI"),
            ("Escáner", "ESC", "Tecnología", "Periféricos", "TI"),
            ("Teclado", "TCL", "Tecnología", "Periféricos", "TI"),
            ("Proyector", "PRO", "Tecnología", "Periféricos", "TI"),
            ("Taladro", "TL", "Herramientas y equipos", "Herramienta eléctrica", "Eléctrica"),
            ("Esmeril", "ESM", "Herramientas y equipos", "Herramienta eléctrica", "Eléctrica"),
            ("Sierra", "SIE", "Herramientas y equipos", "Herramienta eléctrica", "Mecánica"),
            ("Compresora", "CMP", "Herramientas y equipos", "Equipo industrial", "Mecánica"),
            ("Bomba", "BOM", "Herramientas y equipos", "Equipo industrial", "Mecánica"),
            ("Motor", "MOT", "Herramientas y equipos", "Equipo industrial", "Eléctrica"),
            ("Generador", "GEN", "Herramientas y equipos", "Equipo industrial", "Eléctrica"),
            ("Tablero eléctrico", "TBE", "Herramientas y equipos", "Equipo industrial", "Eléctrica"),
        ]:
            taxonomy, _ = Taxonomy.objects.update_or_create(
                prefix=prefix,
                defaults={
                    "canonical_prefix": prefix,
                    "name": sample_key,
                    "asset_type": asset_type,
                    "category": category,
                    "subcategory": sample_key,
                    "specialty": specialty,
                    "sequence_digits": 4,
                    "default_criticality": "Media",
                    "issuance_enabled": True,
                    "review_status": Taxonomy.ReviewStatus.VALIDATED,
                    "aliases": [],
                    "source_version": "DEMO",
                    "notes": "Extensión exclusiva para datos demostrativos.",
                    "active": True,
                },
            )
            TaxonomySequence.objects.get_or_create(taxonomy=taxonomy)
            taxonomies[sample_key] = taxonomy

        responsibles = {}
        for ref, kind, name, area, room in [
            ("P-0142", "PERSONA", "Ana Torres", "Sistemas", None),
            ("P-0277", "PERSONA", "Marco Quispe", "Mantenimiento", None),
            ("P-0319", "PERSONA", "Rosa Medina", "Facility Management", None),
            ("usuario", "PERSONA", "Usuario Solicitante", "Operaciones", None),
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
                "room": "Oficina FM",
                "responsible": "P-0319",
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
                "room": "Oficina FM",
                "responsible": "P-0319",
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
                "room": "Oficina FM",
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
                "room": "Taller mecánico",
                "responsible": "usuario",
                "assignment_status": "Asignado",
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
        assignment_anchor = now - timedelta(days=45)
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
                "evidence": [
                    {
                        "id": f"DOC-ORIG-{index:03d}",
                        "name": f"sustento-ingreso-{sample['code'][-6:]}.pdf",
                        "category": "origin",
                        "mimeType": "application/pdf",
                        "size": 148000 + index * 1700,
                    },
                    {
                        "id": f"DOC-FOTO-{index:03d}",
                        "name": f"registro-fotografico-{sample['code'][-6:]}.jpg",
                        "category": "photo",
                        "mimeType": "image/jpeg",
                        "size": 264000 + index * 2300,
                    },
                    *([{
                        "id": f"DOC-COPIA-{index:03d}",
                        "name": f"constancia-digital-{sample['code'][-6:]}.txt",
                        "category": "other",
                        "mimeType": "text/plain",
                        "size": 96,
                        "dataUrl": "data:text/plain;base64," + base64.b64encode(
                            f"Constancia digital de prueba para {sample['code']}.".encode()
                        ).decode("ascii"),
                    }] if index <= 5 else []),
                ],
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
            if not asset.fm_code:
                asset = assign_fm_identifier(asset, taxonomy)

            office_marker = {
                "INC-BIEN-2026-000190": (Decimal("0.18000000"), Decimal("0.25000000")),
                "INC-BIEN-2026-000192": (Decimal("0.47000000"), Decimal("0.27000000")),
                "INC-BIEN-2026-000196": (Decimal("0.40000000"), Decimal("0.30000000")),
            }.get(asset.code)
            active_location_map = location.reference_maps.filter(active=True).first()
            if office_marker and active_location_map:
                asset.location_map = active_location_map
                asset.location_marker_x, asset.location_marker_y = office_marker
                asset.save(
                    update_fields=(
                        "location_map",
                        "location_marker_x",
                        "location_marker_y",
                    )
                )

            if responsible:
                AssetAssignment.objects.update_or_create(
                    asset=asset,
                    status="ACTIVA",
                    defaults={
                        "responsible": responsible,
                        "location": location,
                        "start_date": assignment_anchor + timedelta(days=index),
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

        pending_code = "INC-BIEN-2026-000218"
        pending_location = locations["Almacén central"]
        Asset.objects.get_or_create(
            code=pending_code,
            defaults={
                "entry_type": Asset.EntryType.PURCHASE,
                "name": "Equipo recibido pendiente de clasificación",
                "description": (
                    "Bien resguardado en almacén mientras se valida su ficha técnica "
                    "y la taxonomía FM correspondiente."
                ),
                "brand": "Por confirmar",
                "model": "Por confirmar",
                "serial_number": "DEMO-000218",
                "condition": "Requiere revisión",
                "criticality": "Media",
                "administrative_status": "Registrado",
                "operational_status": "No evaluado",
                "assignment_status": "Sin asignar",
                "taxonomy": None,
                "location": pending_location,
                "registered_by": user,
                "entry_payload": {
                    "source": "seed_demo_data",
                    "currentStep": 6,
                    "entryType": Asset.EntryType.PURCHASE,
                    "name": "Equipo recibido pendiente de clasificación",
                    "description": (
                        "Bien resguardado en almacén mientras se valida su ficha técnica "
                        "y la taxonomía FM correspondiente."
                    ),
                    "brand": "Por confirmar",
                    "model": "Por confirmar",
                    "serialNumber": "DEMO-000218",
                    "condition": "Requiere revisión",
                    "criticality": "Media",
                    "classificationPending": True,
                    "classificationPendingReason": (
                        "Ficha técnica y familia del bien pendientes de validación."
                    ),
                    "zone": pending_location.zone,
                    "building": pending_location.building,
                    "locationArea": pending_location.area,
                    "room": pending_location.room,
                    "locationPending": False,
                    "confirmInspected": True,
                    "confirmAssignment": False,
                },
            },
        )

        internal_max = max(
            max(int(item["code"].rsplit("-", 1)[-1]) for item in samples),
            int(pending_code.rsplit("-", 1)[-1]),
        )
        internal_counter, _ = AssetInternalSequence.objects.get_or_create(year=2026)
        if internal_counter.last_value < internal_max:
            internal_counter.last_value = internal_max
            internal_counter.save(update_fields=("last_value", "updated_at"))

        seeded_assets = list(
            Asset.objects.filter(
                code__in=[item["code"] for item in samples] + [pending_code]
            )
        )
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
                    "requester": requester_user if index <= 3 else admin_user,
                    "request_type": request_type,
                    "description": description,
                    "requester_priority": priority,
                    "location_snapshot": {
                        "locationId": str(asset.location_id or ""),
                        "zone": asset.location.zone if asset.location else "",
                        "building": asset.location.building if asset.location else "",
                        "area": asset.location.area if asset.location else "",
                        "room": asset.location.room if asset.location else "",
                        "locationMapId": (
                            str(asset.location_map_id) if asset.location_map_id else None
                        ),
                        "locationMarkerX": (
                            float(asset.location_marker_x)
                            if asset.location_marker_x is not None
                            else None
                        ),
                        "locationMarkerY": (
                            float(asset.location_marker_y)
                            if asset.location_marker_y is not None
                            else None
                        ),
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

        seeded_work_orders = []
        for index, incident in enumerate(seeded_incidents[:4], start=1):
            work_order, _ = WorkOrder.objects.update_or_create(
                code=f"OT-2026-{index:04d}",
                defaults={
                    "incident": incident,
                    "technician": technician_user,
                    "supervisor": supervisor_user,
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
            seeded_work_orders.append(work_order)

        lifecycle_samples = [
            {
                "result": TechnicalDiagnosis.Result.NOT_REPAIRABLE,
                "description": "Daño irreversible confirmado durante las pruebas técnicas.",
                "justification": (
                    "El reemplazo de los componentes críticos supera el valor actual del bien."
                ),
                "repair_cost": Decimal("1850.00"),
                "current_value": Decimal("800.00"),
                "recommendation": RetirementRequest.Method.RECYCLING,
                "status": RetirementRequest.Status.PENDING,
            },
            {
                "result": TechnicalDiagnosis.Result.NOT_VIABLE,
                "description": "Obsolescencia tecnológica con repuestos fuera de fabricación.",
                "justification": (
                    "La reparación no es viable por falta de repuestos y bajo valor recuperable."
                ),
                "repair_cost": Decimal("1200.00"),
                "current_value": Decimal("650.00"),
                "recommendation": RetirementRequest.Method.DONATION,
                "status": RetirementRequest.Status.IN_REVIEW,
            },
        ]
        seeded_retirement_requests = []
        for index, (work_order, sample) in enumerate(
            zip(seeded_work_orders[:2], lifecycle_samples, strict=True),
            start=1,
        ):
            diagnosis, _ = TechnicalDiagnosis.objects.update_or_create(
                work_order_id=str(work_order.id),
                defaults={
                    "work_order_code": work_order.code,
                    "asset": work_order.incident.asset,
                    "evaluator_name": technician_user.get_full_name()
                    or technician_user.username,
                    "result": sample["result"],
                    "description": sample["description"],
                    "probable_cause": "Desgaste acumulado de componentes críticos.",
                    "operational_risk": "ALTO",
                    "affected_components": "Sistema eléctrico y componentes mecánicos",
                    "technical_justification": sample["justification"],
                    "estimated_repair_cost": sample["repair_cost"],
                    "estimated_current_value": sample["current_value"],
                    "evidence": [
                        f"diagnostico-{work_order.code.lower()}.pdf",
                        f"evidencia-{work_order.code.lower()}.jpg",
                    ],
                },
            )
            retirement_request, _ = RetirementRequest.objects.update_or_create(
                diagnosis=diagnosis,
                defaults={
                    "code": f"SOL-BAJA-2026-{index:06d}",
                    "asset": diagnosis.asset,
                    "recommendation": sample["recommendation"],
                    "requested_by": technician_user.get_full_name()
                    or technician_user.username,
                    "supervisor_name": supervisor_user.get_full_name() or supervisor_user.username,
                    "status": sample["status"],
                },
            )
            seeded_retirement_requests.append(retirement_request)

        audit_samples = [
            ("ASSET_REGISTERED", "Asset", asset.id, {"code": asset.code})
            for asset in seeded_assets[:8]
        ]
        audit_samples.extend(
            ("INCIDENT_CREATED", "Incident", incident.id, {"code": incident.code})
            for incident in seeded_incidents
        )
        audit_samples.extend(
            ("WORK_ORDER_CREATED", "WorkOrder", work_order.id, {"code": work_order.code})
            for work_order in seeded_work_orders
        )
        audit_samples.extend(
            (
                "RETIREMENT_REQUEST_CREATED",
                "RetirementRequest",
                retirement_request.id,
                {"code": retirement_request.code, "status": retirement_request.status},
            )
            for retirement_request in seeded_retirement_requests
        )
        for action, entity, entity_id, after in audit_samples:
            correlation_id = uuid.uuid5(
                uuid.NAMESPACE_URL,
                f"incalpaca-demo:{action}:{entity_id}",
            )
            AuditEvent.objects.update_or_create(
                correlation_id=correlation_id,
                defaults={
                    "actor": admin_user,
                    "action": action,
                    "entity": entity,
                    "entity_id": str(entity_id),
                    "before": None,
                    "after": after,
                    "ip_address": "127.0.0.1",
                },
            )

        self.stdout.write(
            self.style.SUCCESS(
                "Datos de prueba cargados: 31 bienes, 6 incidencias, 4 OT, "
                "2 solicitudes de baja y usuarios Administrador/Técnico/Supervisor."
            )
        )
