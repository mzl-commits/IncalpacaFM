from datetime import datetime

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.assets.models import Asset, AssetAssignment, AssignableResponsible, Location, Taxonomy


class Command(BaseCommand):
    help = 'Carga datos de prueba idempotentes coherentes con el modelo ER del SGTB.'

    def handle(self, *args, **options):
        user, _ = get_user_model().objects.update_or_create(
            username='facility.demo',
            defaults={'first_name': 'Rosa', 'last_name': 'Medina', 'email': 'facility.demo@incalpaca.test'},
        )
        locations = {}
        for row in [
            ('Zona Industrial', 'Edificio Administrativo', 'Sistemas', 'Oficina 204', False),
            ('Zona Industrial', 'Planta Principal', 'Mantenimiento', 'Taller mecánico', False),
            ('Zona Industrial', 'Edificio Administrativo', 'Administración', 'Sala de reuniones principal', True),
            ('Zona Comercial', 'Centro de distribución', 'Logística', 'Almacén central', True),
        ]:
            obj, _ = Location.objects.update_or_create(
                zone=row[0], building=row[1], area=row[2], room=row[3],
                defaults={'common_space': row[4], 'active': True},
            )
            locations[row[3]] = obj

        taxonomies = {}
        for row in [
            ('Tecnología', 'Equipos de cómputo', 'Laptop', 'TI'),
            ('Herramientas y equipos', 'Herramienta eléctrica', 'Taladro', 'Eléctrica'),
            ('Mobiliario', 'Oficina', 'Archivador', 'No aplica'),
            ('Tecnología', 'Periféricos', 'Monitor', 'TI'),
        ]:
            obj, _ = Taxonomy.objects.update_or_create(
                asset_type=row[0], category=row[1], subcategory=row[2],
                defaults={'specialty': row[3], 'active': True},
            )
            taxonomies[row[2]] = obj

        responsibles = {}
        for ref, kind, name, area, location in [
            ('P-0142', 'PERSONA', 'Ana Torres', 'Sistemas', None),
            ('P-0277', 'PERSONA', 'Marco Quispe', 'Mantenimiento', None),
            ('P-0319', 'PERSONA', 'Rosa Medina', 'Facility Management', None),
            ('A-SIS', 'AREA', 'Área de Sistemas', 'Sistemas', None),
            ('A-MAN', 'AREA', 'Área de Mantenimiento', 'Mantenimiento', None),
            ('A-LOG', 'AREA', 'Área de Logística', 'Logística', None),
            ('E-COM-01', 'ESPACIO_COMUN', 'Sala de reuniones principal', '', locations['Sala de reuniones principal']),
            ('E-COM-03', 'ESPACIO_COMUN', 'Almacén de uso común', '', locations['Almacén central']),
        ]:
            obj, _ = AssignableResponsible.objects.update_or_create(
                external_reference=ref,
                defaults={'type': kind, 'display_name': name, 'area_name': area, 'location': location, 'active': True},
            )
            responsibles[ref] = obj

        samples = [
            ('INC-BIEN-2026-000188', 'purchase', 'Laptop Lenovo ThinkPad T14', 'Equipo portátil para infraestructura', 'Lenovo', 'T14', 'Nuevo', 'Laptop', 'Oficina 204', 'P-0142'),
            ('INC-BIEN-2026-000189', 'purchase', 'Taladro percutor industrial', 'Herramienta para mantenimiento de planta', 'Bosch', 'GSB 20-2', 'Bueno', 'Taladro', 'Taller mecánico', 'P-0277'),
            ('INC-BIEN-2026-000190', 'own_creation', 'Mueble archivador metálico', 'Archivador fabricado por mantenimiento', '', '', 'Bueno', 'Archivador', 'Oficina 204', 'A-SIS'),
            ('INC-BIEN-2026-000191', 'donation', 'Monitor industrial 27 pulgadas', 'Monitor para tablero de supervisión', 'LG', '27UL500', 'Regular', 'Monitor', 'Oficina 204', 'E-COM-01'),
        ]
        for code, entry_type, name, description, brand, model, condition, tax, loc, resp in samples:
            asset, _ = Asset.objects.update_or_create(
                code=code,
                defaults={
                    'entry_type': entry_type, 'name': name, 'description': description, 'brand': brand,
                    'model': model, 'condition': condition, 'criticality': 'Media',
                    'taxonomy': taxonomies[tax], 'location': locations[loc], 'registered_by': user,
                    'assignment_status': 'Asignado',
                    'entry_payload': {'source': 'seed_demo_data', 'assigneeId': resp},
                },
            )
            AssetAssignment.objects.update_or_create(
                asset=asset, status='ACTIVA',
                defaults={
                    'responsible': responsibles[resp], 'location': locations[loc],
                    'start_date': timezone.make_aware(datetime(2026, 7, 22, 9, 0)),
                    'change_reason': 'Asignación inicial de datos de prueba', 'registered_by': user,
                },
            )
        self.stdout.write(self.style.SUCCESS('Datos de prueba cargados: 4 bienes, catálogos, ubicaciones y responsables.'))
