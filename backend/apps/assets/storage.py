import os

from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.utils.deconstruct import deconstructible


@deconstructible
class PrivateFacilityPlanStorage(FileSystemStorage):
    """Filesystem storage without a public URL for facility plan images."""

    @property
    def base_location(self):
        return settings.PRIVATE_MEDIA_ROOT

    @property
    def location(self):
        return os.path.abspath(self.base_location)

    @property
    def base_url(self):
        return None


private_facility_plan_storage = PrivateFacilityPlanStorage()


@deconstructible
class PrivateLocationMapStorage(PrivateFacilityPlanStorage):
    """Private storage for administrator-provided location reference images."""


private_location_map_storage = PrivateLocationMapStorage()
