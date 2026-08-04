import json
import tempfile
from io import BytesIO

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connections
from django.test import TestCase, override_settings
from PIL import Image
from rest_framework.test import APIClient

from apps.accounts.models import AccountProfile
from apps.assets.models import Asset


def uploaded_photo():
    stream = BytesIO()
    Image.new('RGB', (640, 480), '#dce7f5').save(stream, format='JPEG')
    return SimpleUploadedFile('bien.jpg', stream.getvalue(), content_type='image/jpeg')


class AssetPhotoApiTests(TestCase):
    def setUp(self):
        # Algunos tests de migración cierran conexiones PostgreSQL explícitamente.
        # Reabre la conexión de esta prueba para conservar aislamiento de la suite.
        connections["default"].close()
        self.media_directory = tempfile.TemporaryDirectory()
        self.settings_override = override_settings(
            PRIVATE_MEDIA_ROOT=self.media_directory.name
        )
        self.settings_override.enable()
        self.addCleanup(self.settings_override.disable)
        self.addCleanup(self.media_directory.cleanup)
        self.user = get_user_model().objects.create_user(username='photo-admin')
        AccountProfile.objects.create(
            user=self.user,
            worker_code='PHOTO-ADMIN',
            role=AccountProfile.Role.ADMIN,
            must_change_password=False,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_photo_is_uploaded_and_available_through_public_token(self):
        response = self.client.post('/api/v1/assets/', {
            'entry_type': 'purchase',
            'name': 'Bien con fotografía',
            'description': 'Registro con fotografía oficial verificable.',
            'condition': 'Nuevo',
            'photo': uploaded_photo(),
            'entry_payload': json.dumps({
                'classificationPending': True,
                'locationPending': True,
            }),
        }, format='multipart')

        self.assertEqual(response.status_code, 201, response.json())
        self.assertTrue(response.json()['photo_url'].endswith('/photo/'))
        asset = Asset.objects.get(pk=response.json()['id'])
        self.assertTrue(asset.photo.name.startswith('asset_photos/'))

        public_client = APIClient()
        summary = public_client.get(f'/api/v1/public/assets/{asset.public_token}/')
        photo = public_client.get(f'/api/v1/public/assets/{asset.public_token}/photo/')
        self.assertEqual(summary.status_code, 200)
        self.assertIsNotNone(summary.json()['photo_url'])
        self.assertEqual(photo.status_code, 200)
        self.assertEqual(photo['Content-Type'], 'image/jpeg')
        photo.close()

    def test_rejects_too_small_photo(self):
        stream = BytesIO()
        Image.new('RGB', (120, 120), 'white').save(stream, format='PNG')
        response = self.client.post('/api/v1/assets/', {
            'entry_type': 'purchase',
            'name': 'Bien con fotografía inválida',
            'description': 'La imagen no alcanza la resolución mínima.',
            'condition': 'Nuevo',
            'photo': SimpleUploadedFile('small.png', stream.getvalue(), content_type='image/png'),
            'entry_payload': json.dumps({
                'classificationPending': True,
                'locationPending': True,
            }),
        }, format='multipart')
        self.assertEqual(response.status_code, 400)
        self.assertIn('photo', response.json())
