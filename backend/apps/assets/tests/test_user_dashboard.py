from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import AccountProfile
from apps.assets.models import Asset, AssetAssignment, AssignableResponsible


class UserDashboardApiTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(
            username='requester-dashboard',
            password='secure-password',
            first_name='Usuario',
            last_name='Solicitante',
        )
        self.profile = AccountProfile.objects.create(
            user=self.user,
            worker_code='REQ-100',
            role=AccountProfile.Role.REQUESTER,
            must_change_password=False,
        )
        self.asset = Asset.objects.create(
            code='REQ-TEST-001',
            entry_type=Asset.EntryType.PURCHASE,
            name='Laptop asignada de prueba',
            description='Bien visible para el usuario solicitante.',
            condition='Bueno',
            registered_by=self.user,
        )

    def test_assigned_assets_are_visible_when_legacy_assignment_uses_profile_uuid(self):
        responsible = AssignableResponsible.objects.create(
            type=AssignableResponsible.Type.PERSON,
            external_reference=str(self.profile.id),
            display_name='Usuario Solicitante',
            area_name='Operaciones',
        )
        AssetAssignment.objects.create(
            asset=self.asset,
            responsible=responsible,
            start_date=timezone.now(),
            status='ACTIVA',
            change_reason='Asignación de prueba para portal de usuario.',
            registered_by=self.user,
        )

        self.client.force_authenticate(self.user)
        response = self.client.get('/api/v1/user-dashboard/')

        self.assertEqual(response.status_code, 200, response.json())
        self.assertEqual(response.data['profile']['worker_code'], 'REQ-100')
        self.assertEqual(response.data['assigned_assets'][0]['code'], 'REQ-TEST-001')

