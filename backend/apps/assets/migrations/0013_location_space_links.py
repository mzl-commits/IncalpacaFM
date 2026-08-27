# Generated manually to link spaces with operative locations.

import hashlib

from django.db import migrations, models
import django.db.models.deletion


def _ancestor_chain(node):
    chain = []
    current = node
    while current is not None:
        chain.append(current)
        current = current.parent
    return list(reversed(chain))


def _first_name(chain, *types, fallback=""):
    for item in reversed(chain):
        if item.node_type in types:
            return item.name
    return fallback


def _location_code(path_code):
    digest = hashlib.sha1(path_code.encode("utf-8")).hexdigest()[:16].upper()
    return f"SP-{digest}"


def sync_existing_space_locations(apps, schema_editor):
    SpaceNode = apps.get_model("spaces", "SpaceNode")
    Location = apps.get_model("assets", "Location")
    BuildingArea = apps.get_model("assets", "BuildingArea")

    modules = (
        SpaceNode.objects.select_related("site", "parent", "parent__parent")
        .filter(node_type="MODULE")
        .order_by("path_code")
    )
    for node in modules:
        chain = _ancestor_chain(node)
        site_name = node.site.name
        macro_area = _first_name(chain, "MACRO_AREA", fallback="General")
        area = _first_name(chain, "AREA", "MACRO_AREA", fallback="General")
        location, _ = Location.objects.get_or_create(
            space_node=node,
            defaults={
                "location_code": _location_code(node.path_code),
                "site": site_name,
                "zone": macro_area,
                "building": macro_area,
                "level": "General",
                "area": area,
                "room": node.name,
                "square_meters": node.square_meters,
                "headcount": node.headcount,
                "common_space": node.common_space,
                "active": bool(node.active and node.site.active),
            },
        )
        changed = []
        for field, value in {
            "site": site_name,
            "zone": macro_area,
            "building": macro_area,
            "level": "General",
            "area": area,
            "room": node.name,
            "square_meters": node.square_meters,
            "headcount": node.headcount,
            "common_space": node.common_space,
            "active": bool(node.active and node.site.active),
        }.items():
            if getattr(location, field) != value:
                setattr(location, field, value)
                changed.append(field)
        if changed:
            location.save(update_fields=changed)

    macro_areas = (
        SpaceNode.objects.select_related("site")
        .filter(node_type="MACRO_AREA")
        .order_by("path_code")
    )
    for node in macro_areas:
        identity = {
            "site": node.site.name,
            "zone": node.name,
            "building": node.name,
        }
        if BuildingArea.objects.filter(space_node__isnull=True, **identity).exists():
            continue
        BuildingArea.objects.get_or_create(
            space_node=node,
            defaults={**identity, "square_meters": node.square_meters},
        )


class Migration(migrations.Migration):

    dependencies = [
        ("spaces", "0001_initial"),
        ("assets", "0012_alter_buildingarea_square_meters"),
    ]

    operations = [
        migrations.AddField(
            model_name="location",
            name="space_node",
            field=models.OneToOneField(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="asset_location",
                to="spaces.spacenode",
            ),
        ),
        migrations.AddField(
            model_name="buildingarea",
            name="space_node",
            field=models.OneToOneField(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="building_area",
                to="spaces.spacenode",
            ),
        ),
        migrations.RunPython(sync_existing_space_locations, migrations.RunPython.noop),
    ]
