from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import AccountProfile
from apps.assets.models import BuildingArea, Location
from apps.audit.models import AuditEvent
from apps.spaces.models import SpaceNode


class SpatialApiTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.admin = user_model.objects.create_user(username="space-admin", password="test-pass")
        AccountProfile.objects.create(
            user=self.admin,
            worker_code="SPACE-ADMIN",
            role=AccountProfile.Role.ADMIN,
            must_change_password=False,
        )
        self.technician = user_model.objects.create_user(username="space-technician", password="test-pass")
        AccountProfile.objects.create(
            user=self.technician,
            worker_code="SPACE-TECH",
            role=AccountProfile.Role.TECHNICIAN,
            must_change_password=False,
        )
        self.supervisor = user_model.objects.create_user(username="space-supervisor", password="test-pass")
        AccountProfile.objects.create(
            user=self.supervisor,
            worker_code="SPACE-SUPERVISOR",
            role=AccountProfile.Role.SUPERVISOR,
            must_change_password=False,
        )
        self.requester = user_model.objects.create_user(username="space-requester", password="test-pass")
        AccountProfile.objects.create(
            user=self.requester,
            worker_code="SPACE-REQUESTER",
            role=AccountProfile.Role.REQUESTER,
            must_change_password=False,
        )
        self.client = APIClient()

    def authenticate_admin(self):
        self.client.force_authenticate(self.admin)

    def create_site(self, **overrides):
        payload = {
            "code": "inc1",
            "name": "Sede principal",
            "address_line": "Calle Cóndor 100",
            "district": "Sachaca",
            "province": "Arequipa",
            "department": "Arequipa",
        }
        payload.update(overrides)
        response = self.client.post("/api/v1/spaces/sites/", payload, format="json")
        self.assertEqual(response.status_code, 201, response.json())
        return response.json()

    def create_node(self, site_id, *, node_type, code, name, parent_id=None, **overrides):
        payload = {
            "site_id": str(site_id),
            "node_type": node_type,
            "code_segment": code,
            "name": name,
        }
        if parent_id is not None:
            payload["parent_id"] = str(parent_id)
        payload.update(overrides)
        return self.client.post("/api/v1/spaces/nodes/", payload, format="json")

    def create_handwritten_hierarchy(self):
        site = self.create_site()
        macro = self.create_node(
            site["id"],
            node_type=SpaceNode.Type.MACRO_AREA,
            code="ad",
            name="Administración",
        )
        self.assertEqual(macro.status_code, 201, macro.json())
        sector = self.create_node(
            site["id"],
            parent_id=macro.json()["id"],
            node_type=SpaceNode.Type.SECTOR,
            code="mkt",
            name="Co working marketing",
        )
        self.assertEqual(sector.status_code, 201, sector.json())
        module = self.create_node(
            site["id"],
            parent_id=sector.json()["id"],
            node_type=SpaceNode.Type.MODULE,
            code="mt04",
            name="Módulo de trabajo 4",
        )
        self.assertEqual(module.status_code, 201, module.json())
        environment = self.create_node(
            site["id"],
            parent_id=module.json()["id"],
            node_type=SpaceNode.Type.ENVIRONMENT,
            code="of1",
            name="Oficina FM",
            square_meters="32.50",
            headcount=4,
            common_space=True,
        )
        self.assertEqual(environment.status_code, 201, environment.json())
        return site, macro.json(), sector.json(), module.json(), environment.json()

    def test_only_administrator_can_manage_spatial_crud(self):
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get("/api/v1/spaces/sites/").status_code, 401)
        for user in (self.technician, self.supervisor, self.requester):
            self.client.force_authenticate(user)
            self.assertEqual(self.client.get("/api/v1/spaces/sites/").status_code, 403)
            self.assertEqual(
                self.client.post("/api/v1/spaces/sites/", {"code": "INC1", "name": "Sede"}, format="json").status_code,
                403,
            )
            self.assertEqual(self.client.get("/api/v1/spaces/tree/").status_code, 403)
            self.assertEqual(self.client.get("/api/v1/spaces/options/").status_code, 403)

    def test_non_administrators_cannot_change_or_archive_an_existing_node(self):
        self.authenticate_admin()
        _, _, _, _, environment = self.create_handwritten_hierarchy()
        for user in (self.technician, self.supervisor, self.requester):
            self.client.force_authenticate(user)
            self.assertEqual(
                self.client.patch(
                    f"/api/v1/spaces/nodes/{environment['id']}/",
                    {"name": "Cambio no autorizado"},
                    format="json",
                ).status_code,
                403,
            )
            self.assertEqual(
                self.client.post(
                    f"/api/v1/spaces/nodes/{environment['id']}/archive/",
                    format="json",
                ).status_code,
                403,
            )
            self.assertEqual(
                self.client.get(f"/api/v1/spaces/nodes/{environment['id']}/impact/").status_code,
                403,
            )

    def test_handwritten_hierarchy_derives_path_and_syncs_legacy_location(self):
        self.authenticate_admin()
        site, _, _, _, environment = self.create_handwritten_hierarchy()

        self.assertEqual(site["code"], "INC1")
        self.assertEqual(site["kind"], "SITE")
        self.assertEqual(environment["kind"], SpaceNode.Type.ENVIRONMENT)
        self.assertEqual(environment["code"], "OF1")
        self.assertEqual(environment["path_code"], "INC1-AD-MKT-MT04-OF1")
        self.assertIsNotNone(environment["legacy_location"])

        location = Location.objects.get(space_node_id=environment["id"])
        self.assertTrue(location.active)
        self.assertTrue(location.location_code.startswith("SP-"))
        self.assertLessEqual(len(location.location_code), 20)
        self.assertEqual(location.site, "Sede principal")
        self.assertEqual(location.zone, "Administración")
        self.assertEqual(location.area, "Módulo de trabajo 4")
        self.assertEqual(location.room, "Oficina FM")
        self.assertEqual(str(location.square_meters), "32.50")
        self.assertEqual(location.headcount, 4)

        locations_response = self.client.get("/api/v1/locations/")
        self.assertEqual(locations_response.status_code, 200, locations_response.json())
        self.assertIn(str(location.id), {item["id"] for item in locations_response.json()})
        self.assertTrue(AuditEvent.objects.filter(action="SPACE_NODE_CREATED", entity_id=environment["id"]).exists())

    def test_building_level_area_path_is_also_valid_and_building_area_stays_synced(self):
        self.authenticate_admin()
        site = self.create_site()
        building = self.create_node(
            site["id"],
            node_type=SpaceNode.Type.BUILDING,
            code="ed01",
            name="Edificio Administrativo",
            square_meters="750.00",
        )
        self.assertEqual(building.status_code, 201, building.json())
        level = self.create_node(
            site["id"],
            parent_id=building.json()["id"],
            node_type=SpaceNode.Type.LEVEL,
            code="n1",
            name="Nivel 1",
        )
        area = self.create_node(
            site["id"],
            parent_id=level.json()["id"],
            node_type=SpaceNode.Type.AREA,
            code="fm",
            name="Facility Management",
        )
        environment = self.create_node(
            site["id"],
            parent_id=area.json()["id"],
            node_type=SpaceNode.Type.ENVIRONMENT,
            code="of01",
            name="Oficina FM",
        )
        self.assertEqual(level.status_code, 201, level.json())
        self.assertEqual(area.status_code, 201, area.json())
        self.assertEqual(environment.status_code, 201, environment.json())
        location = Location.objects.get(space_node_id=environment.json()["id"])
        self.assertEqual(location.building, "Edificio Administrativo")
        self.assertEqual(location.level, "Nivel 1")
        self.assertEqual(location.area, "Facility Management")
        building_area = BuildingArea.objects.get(space_node_id=building.json()["id"])
        self.assertEqual(str(building_area.square_meters), "750.00")

    def test_new_space_preserves_historical_location_identity_for_later_conciliation(self):
        self.authenticate_admin()
        historical = Location.objects.create(
            site="Sede principal",
            zone="Administración",
            building="Marketing",
            level="",
            area="Marketing",
            room="Oficina FM",
        )
        site = self.create_site()
        macro = self.create_node(site["id"], node_type=SpaceNode.Type.MACRO_AREA, code="AD", name="Administración")
        sector = self.create_node(site["id"], parent_id=macro.json()["id"], node_type=SpaceNode.Type.SECTOR, code="MKT", name="Marketing")
        environment = self.create_node(
            site["id"],
            parent_id=sector.json()["id"],
            node_type=SpaceNode.Type.ENVIRONMENT,
            code="OF1",
            name="Oficina FM",
        )
        self.assertEqual(environment.status_code, 201, environment.json())
        generated = Location.objects.get(space_node_id=environment.json()["id"])
        self.assertTrue(generated.requires_review)
        self.assertIsNone(historical.space_node_id)
        self.assertNotEqual(generated.id, historical.id)

    def test_models_reject_values_that_do_not_fit_the_legacy_projection(self):
        self.authenticate_admin()
        too_long_name = "X" * 101
        response = self.client.post(
            "/api/v1/spaces/sites/",
            {"code": "INC1", "name": too_long_name},
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.json())
        self.assertIn("name", response.json())

        site = self.create_site()
        response = self.create_node(
            site["id"],
            node_type=SpaceNode.Type.BUILDING,
            code="ED1",
            name="Edificio",
            square_meters="100000000.00",
        )
        self.assertEqual(response.status_code, 400, response.json())
        self.assertIn("square_meters", response.json())

    def test_hierarchy_validates_parent_type_and_site(self):
        self.authenticate_admin()
        first_site = self.create_site()
        invalid_root = self.create_node(
            first_site["id"],
            node_type=SpaceNode.Type.ENVIRONMENT,
            code="AMB1",
            name="Ambiente inválido",
        )
        self.assertEqual(invalid_root.status_code, 400)
        self.assertIn("parent_id", invalid_root.json())

        macro = self.create_node(
            first_site["id"],
            node_type=SpaceNode.Type.MACRO_AREA,
            code="AD",
            name="Administración",
        )
        second_site = self.create_site(code="INC2", name="Sede secundaria")
        wrong_site = self.create_node(
            second_site["id"],
            parent_id=macro.json()["id"],
            node_type=SpaceNode.Type.SECTOR,
            code="MKT",
            name="Marketing",
        )
        self.assertEqual(wrong_site.status_code, 400)
        self.assertIn("parent_id", wrong_site.json())

    def test_archive_restore_preserves_rows_and_legacy_location(self):
        self.authenticate_admin()
        _, _, _, module, environment = self.create_handwritten_hierarchy()
        blocked = self.client.post(f"/api/v1/spaces/nodes/{module['id']}/archive/", format="json")
        self.assertEqual(blocked.status_code, 400, blocked.json())

        archived = self.client.post(f"/api/v1/spaces/nodes/{environment['id']}/archive/", format="json")
        self.assertEqual(archived.status_code, 200, archived.json())
        self.assertFalse(archived.json()["active"])
        environment_model = SpaceNode.objects.get(pk=environment["id"])
        location = Location.objects.get(space_node=environment_model)
        self.assertFalse(location.active)
        self.assertTrue(SpaceNode.objects.filter(pk=environment["id"]).exists())

        archived_list = self.client.get("/api/v1/spaces/nodes/?active=false")
        self.assertEqual(archived_list.status_code, 200)
        self.assertEqual([item["id"] for item in archived_list.json()], [environment["id"]])
        all_nodes = self.client.get("/api/v1/spaces/nodes/?active=all")
        self.assertEqual(all_nodes.status_code, 200, all_nodes.json())
        self.assertEqual(len(all_nodes.json()), 4)

        archived_tree = self.client.get("/api/v1/spaces/tree/?active=false")
        self.assertEqual(archived_tree.status_code, 200, archived_tree.json())
        archived_root = archived_tree.json()["results"][0]
        self.assertEqual(
            archived_root["children"][0]["children"][0]["children"][0]["children"][0]["id"],
            environment["id"],
        )

        restored = self.client.post(f"/api/v1/spaces/nodes/{environment['id']}/restore/", format="json")
        self.assertEqual(restored.status_code, 200, restored.json())
        location.refresh_from_db()
        self.assertTrue(location.active)
        self.assertEqual(self.client.delete(f"/api/v1/spaces/nodes/{environment['id']}/").status_code, 405)

    def test_archived_site_rejects_new_nodes_and_options(self):
        self.authenticate_admin()
        site = self.create_site()
        archived = self.client.post(f"/api/v1/spaces/sites/{site['id']}/archive/", format="json")
        self.assertEqual(archived.status_code, 200, archived.json())

        node = self.create_node(
            site["id"],
            node_type=SpaceNode.Type.MACRO_AREA,
            code="AD",
            name="Administracion",
        )
        self.assertEqual(node.status_code, 400, node.json())
        self.assertIn("site_id", node.json())

        options = self.client.get(f"/api/v1/spaces/options/?site_id={site['id']}")
        self.assertEqual(options.status_code, 400, options.json())
        self.assertIn("site_id", options.json())

    def test_tree_options_impact_and_bidirectional_capacity_sync(self):
        self.authenticate_admin()
        site, macro, _, _, environment = self.create_handwritten_hierarchy()
        tree = self.client.get(f"/api/v1/spaces/tree/?site_id={site['id']}")
        self.assertEqual(tree.status_code, 200, tree.json())
        root = tree.json()["results"][0]
        self.assertEqual(root["kind"], "SITE")
        self.assertEqual(root["code"], "INC1")
        self.assertEqual(root["children"][0]["kind"], SpaceNode.Type.MACRO_AREA)

        options = self.client.get(f"/api/v1/spaces/options/?site_id={site['id']}&parent_id={macro['id']}")
        self.assertEqual(options.status_code, 200, options.json())
        self.assertIn("SECTOR", {item["value"] for item in options.json()["allowed_node_types"]})

        impact = self.client.get(f"/api/v1/spaces/nodes/{environment['id']}/impact/")
        self.assertEqual(impact.status_code, 200, impact.json())
        self.assertEqual(impact.json()["legacy_location_count"], 1)
        self.assertTrue(impact.json()["can_archive"])

        updated = self.client.patch(
            f"/api/v1/spaces/nodes/{environment['id']}/",
            {"square_meters": "41.25", "headcount": 6},
            format="json",
        )
        self.assertEqual(updated.status_code, 200, updated.json())
        location = Location.objects.get(space_node_id=environment["id"])
        self.assertEqual(str(location.square_meters), "41.25")
        self.assertEqual(location.headcount, 6)

        legacy_update = self.client.patch(
            f"/api/v1/locations/{location.id}/area/",
            {"square_meters": "45.00"},
            format="json",
        )
        self.assertEqual(legacy_update.status_code, 200, legacy_update.json())
        node = SpaceNode.objects.get(pk=environment["id"])
        self.assertEqual(str(node.square_meters), "45.00")

    def test_move_rebuilds_descendant_paths_and_rejects_cycles(self):
        self.authenticate_admin()
        site, macro, sector, module, environment = self.create_handwritten_hierarchy()
        other_sector = self.create_node(
            site["id"],
            parent_id=macro["id"],
            node_type=SpaceNode.Type.SECTOR,
            code="PR",
            name="Planta de producción",
        )
        self.assertEqual(other_sector.status_code, 201, other_sector.json())
        moved = self.client.patch(
            f"/api/v1/spaces/nodes/{module['id']}/",
            {"site_id": site["id"], "parent_id": other_sector.json()["id"]},
            format="json",
        )
        self.assertEqual(moved.status_code, 200, moved.json())
        self.assertEqual(moved.json()["path_code"], "INC1-AD-PR-MT04")
        environment_model = SpaceNode.objects.get(pk=environment["id"])
        self.assertEqual(environment_model.path_code, "INC1-AD-PR-MT04-OF1")
        legacy_location = Location.objects.get(space_node=environment_model)
        self.assertEqual(legacy_location.location_code[:3], "SP-")

        cycle = self.client.patch(
            f"/api/v1/spaces/nodes/{macro['id']}/",
            {"site_id": site["id"], "parent_id": environment["id"]},
            format="json",
        )
        self.assertEqual(cycle.status_code, 400)
        self.assertIn("parent_id", cycle.json())

    def test_site_and_node_uniqueness_and_sub_environment_support(self):
        self.authenticate_admin()
        site1 = self.create_site(code="INC1", name="Sede Principal")

        # Intentar crear sede con código o nombre duplicado debe fallar
        dup_code = self.client.post(
            "/api/v1/spaces/sites/",
            {"code": "inc1", "name": "Sede Alterna"},
            format="json",
        )
        self.assertEqual(dup_code.status_code, 400)
        self.assertIn("code", dup_code.json())

        dup_name = self.client.post(
            "/api/v1/spaces/sites/",
            {"code": "INC2", "name": "Sede principal"},
            format="json",
        )
        self.assertEqual(dup_name.status_code, 400)
        self.assertIn("name", dup_name.json())

        # Crear macroárea (N2)
        macro = self.create_node(site1["id"], node_type=SpaceNode.Type.MACRO_AREA, code="AD", name="Administración")
        self.assertEqual(macro.status_code, 201)

        # Nombre duplicado en el mismo nivel debe fallar
        dup_macro = self.create_node(site1["id"], node_type=SpaceNode.Type.MACRO_AREA, code="AD2", name="administración")
        self.assertEqual(dup_macro.status_code, 400)
        self.assertIn("name", dup_macro.json())

        # Crear jerarquía hasta Sub-ambiente (N8) y Punto (N9)
        env = self.create_node(site1["id"], parent_id=macro.json()["id"], node_type=SpaceNode.Type.ENVIRONMENT, code="OF1", name="Oficina Principal")
        self.assertEqual(env.status_code, 201)

        sub_env = self.create_node(site1["id"], parent_id=env.json()["id"], node_type=SpaceNode.Type.SUB_ENVIRONMENT, code="ZON1", name="Zona de Impresión")
        self.assertEqual(sub_env.status_code, 201, sub_env.json())
        self.assertEqual(sub_env.json()["node_type"], "SUB_ENVIRONMENT")

        point = self.create_node(site1["id"], parent_id=sub_env.json()["id"], node_type=SpaceNode.Type.POINT, code="EST1", name="Estante A")
        self.assertEqual(point.status_code, 201, point.json())
        self.assertEqual(point.json()["node_type"], "POINT")

