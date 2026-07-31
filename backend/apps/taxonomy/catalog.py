import json
from pathlib import Path

CATALOG_PATH = Path(__file__).resolve().parent / "data" / "catalog_v1.json"


def load_catalog():
    return json.loads(CATALOG_PATH.read_text(encoding="utf-8"))


def load_catalog_rows():
    return load_catalog()["taxonomies"]
