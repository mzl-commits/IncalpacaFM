from django.contrib import admin
from .models import Location

@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    list_display = ('site', 'zone', 'building', 'level', 'area', 'room', 'headcount', 'square_meters', 'active')
    list_filter = ('site', 'zone', 'building', 'level', 'active')
    search_fields = ('location_code', 'room', 'area', 'specific_location')
