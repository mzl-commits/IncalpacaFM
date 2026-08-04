from django.contrib import admin

from apps.assets.models import Taxonomy, TaxonomySequence


@admin.register(Taxonomy)
class TaxonomyAdmin(admin.ModelAdmin):
    list_display = (
        "prefix",
        "name",
        "asset_type",
        "category",
        "active",
        "issuance_enabled",
        "review_status",
    )
    list_filter = ("active", "issuance_enabled", "review_status", "asset_type")
    search_fields = ("prefix", "name", "subcategory", "aliases")


@admin.register(TaxonomySequence)
class TaxonomySequenceAdmin(admin.ModelAdmin):
    list_display = ("taxonomy", "last_value", "updated_at")
    search_fields = ("taxonomy__prefix", "taxonomy__name")
    readonly_fields = ("taxonomy", "last_value", "updated_at")

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
