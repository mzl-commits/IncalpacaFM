import uuid
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from apps.assets.models import Asset, Taxonomy, Location, AssignableResponsible
from apps.accounts.models import AccountProfile

User = get_user_model()

class Command(BaseCommand):
    help = "Puebla la base de datos de SGTB Incalpaca con datos de prueba realistas."

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("Iniciando la carga de datos de prueba..."))

        # 1. Usuarios y Perfiles de Cuenta
        users_data = [
            {'username': 'admin', 'worker_code': 'admin', 'role': 'ADMINISTRADOR', 'email': 'admin@incalpaca.com', 'first_name': 'Facility', 'last_name': 'Management', 'is_staff': True, 'is_superuser': True},
            {'username': 'tecnico', 'worker_code': 'tecnico', 'role': 'TECNICO', 'email': 'tecnico@incalpaca.com', 'first_name': 'Técnico', 'last_name': 'Operaciones', 'is_staff': True, 'is_superuser': False},
            {'username': 'planner', 'worker_code': 'planner', 'role': 'PLANNER', 'email': 'planner@incalpaca.com', 'first_name': 'Planner', 'last_name': 'Mantenimiento', 'is_staff': True, 'is_superuser': False},
            {'username': 'usuario', 'worker_code': 'usuario', 'role': 'SOLICITANTE', 'email': 'usuario@incalpaca.com', 'first_name': 'Usuario', 'last_name': 'Solicitante', 'is_staff': False, 'is_superuser': False},
        ]

        admin_user = None
        for item in users_data:
            u, created = User.objects.get_or_create(
                username=item['username'],
                defaults={
                    'email': item['email'],
                    'first_name': item['first_name'],
                    'last_name': item['last_name'],
                    'is_staff': item['is_staff'],
                    'is_superuser': item['is_superuser'],
                }
            )
            u.set_password("Montescoli3")
            u.save()

            profile, _ = AccountProfile.objects.get_or_create(
                user=u,
                defaults={
                    'worker_code': item['worker_code'],
                    'role': item['role'],
                    'specialty': 'GENERAL',
                    'active': True,
                }
            )
            profile.worker_code = item['worker_code']
            profile.role = item['role']
            profile.active = True
            profile.save()

            if item['username'] == 'admin':
                admin_user = u

        self.stdout.write(self.style.SUCCESS("[OK] Perfiles de usuario inicializados (admin, tecnico, planner / Montescoli3)"))

        # 2. Taxonomías de activos
        taxonomies_data = [
            {"asset_type": "Equipo", "category": "Cómputo", "subcategory": "Laptops", "specialty": "Tecnología"},
            {"asset_type": "Equipo", "category": "Cómputo", "subcategory": "Monitores", "specialty": "Tecnología"},
            {"asset_type": "Mobiliario", "category": "Oficina", "subcategory": "Sillas Ergonómicas", "specialty": "Facility"},
            {"asset_type": "Maquinaria", "category": "Industrial", "subcategory": "Herramientas Eléctricas", "specialty": "Mantenimiento"},
            {"asset_type": "Maquinaria", "category": "Logística", "subcategory": "Montacargas", "specialty": "Almacén"},
        ]

        taxonomies = []
        for tax in taxonomies_data:
            obj, _ = Taxonomy.objects.get_or_create(
                asset_type=tax["asset_type"],
                category=tax["category"],
                subcategory=tax["subcategory"],
                defaults={"specialty": tax["specialty"]}
            )
            taxonomies.append(obj)

        self.stdout.write(self.style.SUCCESS(f"[OK] Taxonomías creadas/verificadas: {len(taxonomies)}"))

        # 3. Ubicaciones físicas
        locations_data = [
            {"site": "Arequipa", "level": "Piso 4", "zone": "Sede Principal", "building": "Edificio A", "area": "TI / Facility", "room": "Piso 4 - Oficina 402", "specific_location": "Escritorio 12", "headcount": 10, "square_meters": "45.50"},
            {"site": "Arequipa", "level": "Nivel 1", "zone": "Almacén Central", "building": "Nave Logística", "area": "Almacén de Entrada", "room": "Rack B-04", "specific_location": "Nivel 2", "headcount": 5, "square_meters": "200.00"},
            {"site": "Arequipa", "level": "Nivel 1", "zone": "Planta Industrial", "building": "Taller Central", "area": "Mantenimiento", "room": "Zona Herramientas", "specific_location": "Estante 01", "headcount": 15, "square_meters": "120.00"},
            {"site": "Arequipa", "level": "Piso 2", "zone": "Sede Principal", "building": "Edificio B", "area": "Gerencia General", "room": "Piso 2 - Sala A", "specific_location": "Mesa Directivo", "headcount": 8, "square_meters": "30.00"},
        ]

        locations = []
        for loc in locations_data:
            obj, _ = Location.objects.update_or_create(
                site=loc["site"],
                zone=loc["zone"],
                building=loc["building"],
                level=loc["level"],
                area=loc["area"],
                room=loc["room"],
                defaults={
                    "specific_location": loc["specific_location"],
                    "headcount": loc["headcount"],
                    "square_meters": loc["square_meters"],
                }
            )
            locations.append(obj)

        self.stdout.write(self.style.SUCCESS(f"[OK] Ubicaciones creadas/verificadas: {len(locations)}"))

        # 4. Responsables asignables
        responsibles_data = [
            {"external_reference": "EMP-00124", "display_name": "Juan Pérez Solís", "type": AssignableResponsible.Type.PERSON, "area_name": "Facility Management"},
            {"external_reference": "EMP-00189", "display_name": "Marco Quispe Flores", "type": AssignableResponsible.Type.PERSON, "area_name": "Mantenimiento"},
            {"external_reference": "EMP-00201", "display_name": "Rosa Medina Vargas", "type": AssignableResponsible.Type.PERSON, "area_name": "Gerencia General"},
            {"external_reference": "EMP-00342", "display_name": "Luis Salas Paredes", "type": AssignableResponsible.Type.PERSON, "area_name": "Sistemas & Infraestructura"},
            {"external_reference": "usuario", "display_name": "Usuario Solicitante", "type": AssignableResponsible.Type.PERSON, "area_name": "Operaciones"},
            {"external_reference": "AREA-ALM-01", "display_name": "Almacén Central de Bienes", "type": AssignableResponsible.Type.AREA, "area_name": "Logística"},
        ]

        responsibles = []
        for resp in responsibles_data:
            obj, _ = AssignableResponsible.objects.get_or_create(
                external_reference=resp["external_reference"],
                defaults={
                    "display_name": resp["display_name"],
                    "type": resp["type"],
                    "area_name": resp["area_name"],
                }
            )
            responsibles.append(obj)

        self.stdout.write(self.style.SUCCESS(f"[OK] Responsables creados/verificados: {len(responsibles)}"))

        # 5. Activos (Assets)
        assets_data = [
            {
                "code": "INC-BIEN-2026-001245",
                "name": "Laptop Lenovo ThinkPad T14 Gen 4",
                "description": "Laptop empresarial Intel i7 16GB RAM 512GB SSD para Facility Management",
                "brand": "Lenovo",
                "model": "ThinkPad T14 Gen 4",
                "serial_number": "PF-49X82Z-2026",
                "entry_type": Asset.EntryType.PURCHASE,
                "condition": "Excelente",
                "taxonomy": taxonomies[0],
                "location": locations[0],
                "assignment_status": "Asignado",
            },
            {
                "code": "INC-BIEN-2026-001246",
                "name": "Monitor Dell UltraSharp 27 4K",
                "description": "Monitor profesional de 27 pulgadas para estación de diseño e ingeniería",
                "brand": "Dell",
                "model": "U2723QE",
                "serial_number": "CN-093821-DEL",
                "entry_type": Asset.EntryType.PURCHASE,
                "condition": "Excelente",
                "taxonomy": taxonomies[1],
                "location": locations[1],
                "assignment_status": "Pendiente",
            },
            {
                "code": "INC-BIEN-2026-001247",
                "name": "Silla Ergonómica Herman Miller Aeron",
                "description": "Silla ejecutiva de alta gama ergonómica con malla transpirable",
                "brand": "Herman Miller",
                "model": "Aeron Chair Size B",
                "serial_number": "HM-AERON-2026-89",
                "entry_type": Asset.EntryType.PURCHASE,
                "condition": "Bueno",
                "taxonomy": taxonomies[2],
                "location": locations[3],
                "assignment_status": "Asignado",
            },
            {
                "code": "INC-BIEN-2026-001248",
                "name": "Taladro Percutor Industrial Bosch GSB 550",
                "description": "Herramienta eléctrica de alto impacto para trabajos de mantenimiento",
                "brand": "Bosch",
                "model": "GSB 550 Professional",
                "serial_number": "BSH-884920-IND",
                "entry_type": Asset.EntryType.OWN,
                "condition": "Regular",
                "taxonomy": taxonomies[3],
                "location": locations[2],
                "assignment_status": "En Mantenimiento",
            },
        ]

        assets = []
        for ast in assets_data:
            obj, _ = Asset.objects.get_or_create(
                code=ast["code"],
                defaults={
                    "name": ast["name"],
                    "description": ast["description"],
                    "brand": ast["brand"],
                    "model": ast["model"],
                    "serial_number": ast["serial_number"],
                    "entry_type": ast["entry_type"],
                    "condition": ast["condition"],
                    "taxonomy": ast["taxonomy"],
                    "location": ast["location"],
                    "assignment_status": ast["assignment_status"],
                    "registered_by": admin_user,
                }
            )
            assets.append(obj)

        self.stdout.write(self.style.SUCCESS(f"[OK] Activos creados/verificados: {len(assets)}"))
        self.stdout.write(self.style.SUCCESS("\n¡Base de datos sembrada con éxito de forma limpia!"))
