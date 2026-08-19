from django.contrib import admin
from .models import BuildingArea, Location

@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    list_display = ('site', 'zone', 'building', 'level', 'area', 'room', 'headcount', 'square_meters', 'active')
    list_filter = ('site', 'zone', 'building', 'level', 'active')
    search_fields = ('location_code', 'room', 'area', 'specific_location')


@admin.register(BuildingArea)
class BuildingAreaAdmin(admin.ModelAdmin):
    list_display = ("zone", "building", "site", "square_meters")
    search_fields = ("site", "zone", "building")
