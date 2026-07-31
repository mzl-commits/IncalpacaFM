import hashlib
import os
import shutil
import tempfile
from pathlib import Path, PurePosixPath

import apps.assets.storage
from django.conf import settings
from django.db import migrations, models


def _storage_roots():
    public_root = Path(settings.MEDIA_ROOT).resolve()
    private_root = Path(settings.PRIVATE_MEDIA_ROOT).resolve()
    if public_root == private_root:
        raise RuntimeError("MEDIA_ROOT y PRIVATE_MEDIA_ROOT deben ser directorios distintos.")
    return public_root, private_root


def _safe_storage_path(root, stored_name):
    normalized = str(stored_name).replace("\\", "/")
    relative = PurePosixPath(normalized)
    if (
        not normalized
        or relative.is_absolute()
        or any(part in {"", ".", ".."} or ":" in part for part in relative.parts)
    ):
        raise RuntimeError(f"Nombre de imagen de plano inseguro: {stored_name!r}")
    candidate = root.joinpath(*relative.parts).resolve()
    try:
        candidate.relative_to(root)
    except ValueError as exc:
        raise RuntimeError(f"La imagen sale de su directorio permitido: {stored_name!r}") from exc
    return candidate


def _sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _copy_verify_and_remove(source, destination, stored_name):
    if not source.exists():
        if destination.is_file():
            return
        raise RuntimeError(f"No existe la imagen del plano {stored_name!r} en ningún storage.")
    if not source.is_file():
        raise RuntimeError(f"La imagen del plano no es un archivo regular: {source}")

    source_digest = _sha256(source)
    if destination.exists():
        if not destination.is_file() or _sha256(destination) != source_digest:
            raise RuntimeError(
                f"La copia de destino de {stored_name!r} existe con contenido diferente."
            )
    else:
        destination.parent.mkdir(parents=True, exist_ok=True)
        descriptor, temporary_name = tempfile.mkstemp(
            prefix=".facility-plan-",
            suffix=".tmp",
            dir=destination.parent,
        )
        os.close(descriptor)
        temporary_path = Path(temporary_name)
        try:
            shutil.copyfile(source, temporary_path)
            if _sha256(temporary_path) != source_digest:
                raise RuntimeError(f"Falló la verificación de copia de {stored_name!r}.")
            os.replace(temporary_path, destination)
        finally:
            temporary_path.unlink(missing_ok=True)

    if _sha256(destination) != source_digest:
        raise RuntimeError(f"Falló la verificación final de {stored_name!r}.")
    source.unlink()


def move_to_private_storage(apps, schema_editor):
    FacilityPlan = apps.get_model("assets", "FacilityPlan")
    public_root, private_root = _storage_roots()
    for stored_name in FacilityPlan.objects.exclude(image="").values_list("image", flat=True):
        source = _safe_storage_path(public_root, stored_name)
        destination = _safe_storage_path(private_root, stored_name)
        _copy_verify_and_remove(source, destination, stored_name)


def move_to_public_storage(apps, schema_editor):
    FacilityPlan = apps.get_model("assets", "FacilityPlan")
    public_root, private_root = _storage_roots()
    for stored_name in FacilityPlan.objects.exclude(image="").values_list("image", flat=True):
        source = _safe_storage_path(private_root, stored_name)
        destination = _safe_storage_path(public_root, stored_name)
        _copy_verify_and_remove(source, destination, stored_name)


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ("assets", "0005_facility_plans"),
    ]

    operations = [
        migrations.RunPython(move_to_private_storage, move_to_public_storage),
        migrations.AlterField(
            model_name="facilityplan",
            name="image",
            field=models.FileField(
                storage=apps.assets.storage.PrivateFacilityPlanStorage(),
                upload_to="facility_plans/",
            ),
        ),
    ]
