from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from apps.assets.models import Asset, AssetAssignment, AssignableResponsible


class AssetEntryApiTests(TestCase):
    def setUp(self):
        call_command('seed_demo_data', verbosity=0)
        self.client = APIClient()

    def test_seed_is_idempotent_and_list_uses_database(self):
        call_command('seed_demo_data', verbosity=0)
        response = self.client.get('/api/v1/assets/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 4)
        self.assertEqual(Asset.objects.count(), 4)

    def test_create_asset_generates_code_and_active_assignment(self):
        responsible = AssignableResponsible.objects.get(external_reference='P-0142')
        response = self.client.post('/api/v1/assets/', {
            'entry_type': 'purchase',
            'name': 'Equipo de prueba integrado',
            'description': 'Registro enviado por el frontend',
            'brand': 'Test',
            'model': 'API-1',
            'condition': 'Nuevo',
            'entry_payload': {
                'assigneeId': responsible.external_reference,
                'assignmentReason': 'Asignación inicial',
                'classificationPending': True,
                'locationPending': True,
            },
        }, format='json')
        self.assertEqual(response.status_code, 201, response.json())
        self.assertTrue(response.json()['code'].startswith('INC-BIEN-'))
        self.assertEqual(response.json()['assignment_status'], 'Asignado')
        self.assertEqual(AssetAssignment.objects.filter(asset_id=response.json()['id'], status='ACTIVA').count(), 1)

    def test_public_endpoint_excludes_sensitive_fields(self):
        asset = Asset.objects.first()
        response = self.client.get(f'/api/v1/public/assets/{asset.public_token}/')
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('serial_number', response.json())
        self.assertNotIn('entry_payload', response.json())
        self.assertNotIn('registered_by_name', response.json())

    def test_frontend_origin_header_is_allowed_by_cors(self):
        response = self.client.options(
            '/api/v1/assets/',
            HTTP_ORIGIN='http://127.0.0.1:5173',
            HTTP_ACCESS_CONTROL_REQUEST_METHOD='POST',
            HTTP_ACCESS_CONTROL_REQUEST_HEADERS='content-type,x-frontend-origin',
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn('x-frontend-origin', response['access-control-allow-headers'])
