import io
import tempfile
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from PIL import Image
from rest_framework.test import APIClient

from apps.accounts.models import AccountProfile
from apps.assets.models import Asset, Location, LocationMap


def uploaded_image(name="ambiente.png", color=(37, 99, 163)):
    output = io.BytesIO()
    Image.new("RGB", (640, 480), color).save(output, format="PNG")
    return SimpleUploadedFile(name, output.getvalue(), content_type="image/png")


class LocationMapApiTests(TestCase):
    def setUp(self):
        self.private_directory = tempfile.TemporaryDirectory()
        self.override = override_settings(
            PRIVATE_MEDIA_ROOT=Path(self.private_directory.name),
        )
        self.override.enable()
        user_model = get_user_model()
        self.admin = user_model.objects.create_user(username="map-admin")
        AccountProfile.objects.create(
            user=self.admin,
            worker_code="MAP-ADMIN",
            role=AccountProfile.Role.ADMIN,
            must_change_password=False,
        )
        self.technician = user_model.objects.create_user(username="map-tech")
        AccountProfile.objects.create(
            user=self.technician,
            worker_code="MAP-TECH",
            role=AccountProfile.Role.TECHNICIAN,
            must_change_password=False,
        )
        self.requester = user_model.objects.create_user(username="map-requester")
        AccountProfile.objects.create(
            user=self.requester,
            worker_code="MAP-REQUESTER",
            role=AccountProfile.Role.REQUESTER,
            must_change_password=False,
        )
        self.location = Location.objects.create(
            zone="Zona Industrial",
            building="Planta Principal",
            area="Mantenimiento",
            room="Taller mecánico",
        )
        self.client = APIClient()

    def tearDown(self):
        self.override.disable()
        self.private_directory.cleanup()

    def upload_map(self, *, description="Vista referencial"):
        self.client.force_authenticate(self.admin)
        return self.client.post(
            "/api/v1/location-maps/",
            {
                "location_id": str(self.location.id),
                "description": description,
                "image": uploaded_image(),
            },
            format="multipart",
        )

    def test_location_catalog_is_available_to_operational_users_but_map_admin_is_restricted(self):
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get("/api/v1/locations/").status_code, 401)
        self.client.force_authenticate(self.technician)
        self.assertEqual(self.client.get("/api/v1/locations/").status_code, 200)
        self.assertEqual(self.client.get("/api/v1/location-maps/").status_code, 403)

    def test_administrator_can_update_location_square_meters(self):
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            f"/api/v1/locations/{self.location.id}/area/",
            {"square_meters": "45.50"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.json())
        self.location.refresh_from_db()
        self.assertEqual(str(self.location.square_meters), "45.50")

        self.client.force_authenticate(self.technician)
        forbidden = self.client.patch(
            f"/api/v1/locations/{self.location.id}/area/",
            {"square_meters": "50.00"},
            format="json",
        )
        self.assertEqual(forbidden.status_code, 403)
        self.client.force_authenticate(self.requester)
        self.assertEqual(self.client.get("/api/v1/locations/").status_code, 200)
        self.assertEqual(self.client.get("/api/v1/location-maps/").status_code, 403)

    def test_upload_versions_map_and_exposes_it_in_location_catalog(self):
        first_response = self.upload_map()
        self.assertEqual(first_response.status_code, 201, first_response.json())
        first = LocationMap.objects.get(pk=first_response.json()["id"])
        self.assertEqual(first.version, 1)
        self.assertTrue(first.active)
        self.assertEqual(first.width, 640)
        self.assertEqual(first.height, 480)
        self.assertTrue(Path(first.image.path).is_file())

        second_response = self.upload_map(description="Vista actualizada")
        self.assertEqual(second_response.status_code, 201, second_response.json())
        first.refresh_from_db()
        second = LocationMap.objects.get(pk=second_response.json()["id"])
        self.assertFalse(first.active)
        self.assertTrue(second.active)
        self.assertEqual(second.version, 2)

        catalog = self.client.get("/api/v1/locations/")
        self.assertEqual(catalog.status_code, 200, catalog.json())
        catalog_location = next(item for item in catalog.json() if item["id"] == str(self.location.id))
        self.assertEqual(catalog_location["active_map"]["id"], str(second.id))
        self.assertEqual(catalog_location["active_map"]["version"], 2)

    def test_image_stream_requires_an_operational_user(self):
        response = self.upload_map()
        image_url = f"/api/v1/location-maps/{response.json()['id']}/image/"

        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(image_url).status_code, 401)
        self.client.force_authenticate(self.technician)
        image_response = self.client.get(image_url)
        self.assertEqual(image_response.status_code, 200)
        self.assertEqual(image_response["Content-Type"], "image/png")
        self.assertEqual(image_response["Cache-Control"], "private, no-store, max-age=0")
        self.assertEqual(image_response["X-Content-Type-Options"], "nosniff")
        self.assertTrue(b"".join(image_response.streaming_content).startswith(b"\x89PNG"))
        self.client.force_authenticate(self.requester)
        requester_image = self.client.get(image_url)
        self.assertEqual(requester_image.status_code, 200)
        self.assertTrue(b"".join(requester_image.streaming_content).startswith(b"\x89PNG"))

    def test_asset_requires_marker_when_selected_location_has_active_map(self):
        map_response = self.upload_map()
        location_map = LocationMap.objects.get(pk=map_response.json()["id"])
        payload = {
            "entry_type": "purchase",
            "name": "Bien con posición",
            "description": "Registro espacial de prueba",
            "condition": "Nuevo",
            "location_id": str(self.location.id),
            "entry_payload": {
                "classificationPending": True,
                "locationPending": False,
                "zone": self.location.zone,
                "building": self.location.building,
                "locationArea": self.location.area,
                "room": self.location.room,
            },
        }

        missing = self.client.post("/api/v1/assets/", payload, format="json")
        self.assertEqual(missing.status_code, 400, missing.json())
        self.assertIn("location_map_id", missing.json())

        payload.update(
            {
                "location_map_id": str(location_map.id),
                "location_marker_x": "0.37500000",
                "location_marker_y": "0.62500000",
            }
        )
        created = self.client.post("/api/v1/assets/", payload, format="json")
        self.assertEqual(created.status_code, 201, created.json())
        asset = Asset.objects.get(pk=created.json()["id"])
        self.assertEqual(asset.location_id, self.location.id)
        self.assertEqual(asset.location_map_id, location_map.id)
        self.assertEqual(str(asset.location_marker_x), "0.37500000")
        self.assertEqual(created.json()["location_detail"]["marker"]["map_version"], 1)

        self.upload_map(description="Nueva fotografía del ambiente")
        asset.refresh_from_db()
        self.assertEqual(asset.location_map_id, location_map.id)
        self.assertFalse(asset.location_map.active)

    def test_rejects_invalid_image(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            "/api/v1/location-maps/",
            {
                "location_id": str(self.location.id),
                "image": SimpleUploadedFile(
                    "ambiente.png",
                    b"not-an-image",
                    content_type="image/png",
                ),
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("image", response.json())

    def test_administrator_can_retire_active_image_without_deleting_history(self):
        uploaded = self.upload_map()
        location_map = LocationMap.objects.get(pk=uploaded.json()["id"])
        detail_url = f"/api/v1/location-maps/{location_map.id}/"
        image_url = f"/api/v1/location-maps/{location_map.id}/image/"

        self.client.force_authenticate(self.technician)
        self.assertEqual(self.client.delete(detail_url).status_code, 403)

        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.delete(detail_url).status_code, 204)
        location_map.refresh_from_db()
        self.assertFalse(location_map.active)

        catalog = self.client.get("/api/v1/locations/")
        catalog_location = next(item for item in catalog.json() if item["id"] == str(self.location.id))
        self.assertIsNone(catalog_location["active_map"])
        historical_image = self.client.get(image_url)
        self.assertEqual(historical_image.status_code, 200)
        self.assertTrue(b"".join(historical_image.streaming_content).startswith(b"\x89PNG"))
