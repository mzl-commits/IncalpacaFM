from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from apps.assets.models import Asset, AssetAssignment, AssignableResponsible, Location
from apps.assignments.models import DeliveryAct, DeliveryEvidence, DeliverySignature


class DeliveryFlowTests(TestCase):
    def setUp(self):
        call_command('seed_demo_data', verbosity=0)
        self.client = APIClient()
        self.asset = Asset.objects.get(code='INC-BIEN-2026-000188')
        self.responsible = AssignableResponsible.objects.get(external_reference='A-SIS')
        self.location = Location.objects.get(room='Oficina 204')
        self.payload = {
            'asset_id': str(self.asset.id),
            'responsible_id': str(self.responsible.id),
            'location_id': str(self.location.id),
            'assignment_reason': 'Entrega formal al área',
            'condition': 'Bueno',
            'accessories': 'Cargador',
            'observations': 'Sin observaciones',
            'checklist': {
                'inspected': True,
                'qr_legible': True,
                'accessories_complete': True,
                'no_unreported_damage': True,
            },
            'privacy_accepted': True,
            'evidence': [
                {'category': 'general', 'name': 'general.jpg', 'mime_type': 'image/jpeg',
                 'size': 120, 'description': 'Vista general', 'content_data_url': 'data:image/jpeg;base64,YQ=='},
                {'category': 'qr', 'name': 'qr.jpg', 'mime_type': 'image/jpeg',
                 'size': 80, 'description': 'QR', 'content_data_url': 'data:image/jpeg;base64,Yg=='},
            ],
            'signatures': [
                {'role': 'ENTREGA', 'method': 'DIBUJADA', 'signer_name': 'Rosa Medina',
                 'signer_role': 'Facility Management', 'consent': True,
                 'signature_data_url': 'data:image/png;base64,Yw=='},
                {'role': 'RECIBE', 'method': 'DIBUJADA', 'signer_name': 'Ana Torres',
                 'signer_role': 'Receptor', 'consent': True,
                 'signature_data_url': 'data:image/png;base64,ZA=='},
            ],
        }

    def test_delivery_closes_previous_assignment_and_issues_immutable_act(self):
        old_assignment = AssetAssignment.objects.get(asset=self.asset, status='ACTIVA')
        response = self.client.post('/api/v1/assignments/deliver/', self.payload, format='json')
        self.assertEqual(response.status_code, 201, response.json())
        old_assignment.refresh_from_db()
        self.asset.refresh_from_db()
        self.assertEqual(old_assignment.status, 'FINALIZADA')
        self.assertEqual(self.asset.assignment_status, 'Entregado')
        self.assertEqual(AssetAssignment.objects.filter(asset=self.asset, status='ACTIVA').count(), 1)
        act = DeliveryAct.objects.get(assignment_id=response.json()['id'])
        self.assertEqual(act.status, 'EMITIDA')
        self.assertEqual(len(act.hash_sha256), 64)
        self.assertEqual(DeliverySignature.objects.filter(act=act).count(), 2)
        self.assertEqual(DeliveryEvidence.objects.filter(act=act).count(), 2)

    def test_delivery_requires_two_signatures(self):
        self.payload['signatures'] = self.payload['signatures'][:1]
        response = self.client.post('/api/v1/assignments/deliver/', self.payload, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('signatures', response.json())

    def test_catalog_contains_database_records(self):
        response = self.client.get('/api/v1/assignments/catalog/')
        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(len(response.json()['assets']), 4)
        self.assertGreaterEqual(len(response.json()['responsibles']), 3)
        self.assertGreaterEqual(len(response.json()['locations']), 2)

    def test_delivery_idempotency_header_is_allowed_by_cors(self):
        response = self.client.options(
            '/api/v1/assignments/deliver/',
            HTTP_ORIGIN='http://127.0.0.1:5173',
            HTTP_ACCESS_CONTROL_REQUEST_METHOD='POST',
            HTTP_ACCESS_CONTROL_REQUEST_HEADERS='content-type,idempotency-key',
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn('idempotency-key', response['access-control-allow-headers'])

    def test_transfer_updates_current_state_and_keeps_assignment_active(self):
        assignment = AssetAssignment.objects.get(asset=self.asset, status='ACTIVA')
        destination = Location.objects.get(room='Taller mecánico')
        response = self.client.post(
            f'/api/v1/assignments/{assignment.id}/operation/',
            {'type': 'TRASLADAR', 'reason': 'Cambio operativo', 'location_id': str(destination.id)},
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.json())
        assignment.refresh_from_db()
        self.asset.refresh_from_db()
        self.assertEqual(assignment.status, 'ACTIVA')
        self.assertEqual(assignment.location_id, destination.id)
        self.assertEqual(self.asset.assignment_status, 'En traslado')
