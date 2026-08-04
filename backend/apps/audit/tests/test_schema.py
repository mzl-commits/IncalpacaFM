from django.test import TestCase
from drf_spectacular.generators import SchemaGenerator


class OpenApiSchemaTests(TestCase):
    def test_schema_generation_includes_fm_code_endpoints(self):
        schema = SchemaGenerator().get_schema(request=None, public=True)

        self.assertIsNotNone(schema)
        self.assertIn("/api/v1/fm-codes/", schema["paths"])
        self.assertIn("/api/v1/fm-codes/summary/", schema["paths"])
        self.assertIn("/api/v1/assets/{id}/classify/", schema["paths"])
