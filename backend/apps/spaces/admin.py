from django.contrib import admin
from django.core.exceptions import ValidationError

from apps.audit.services import record_audit

from .models import FacilitySite, SpaceNode
from .services import (
    archive_site,
    archive_space_node,
    create_space_node,
    node_snapshot,
    site_snapshot,
    update_facility_site,
    update_space_node,
)


@admin.register(FacilitySite)
class FacilitySiteAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "district", "province", "active", "updated_at")
    list_filter = ("active", "department", "province")
    search_fields = ("code", "name", "address_line", "district")
    readonly_fields = ("normalized_name", "active", "created_at", "updated_at")

    def save_model(self, request, obj, form, change):
        if not change:
            obj.save()
            record_audit(
                request=request,
                action="FACILITY_SITE_CREATED",
                entity="FacilitySite",
                entity_id=obj.id,
                after=site_snapshot(obj),
            )
            return
        before = site_snapshot(FacilitySite.objects.get(pk=obj.pk))
        data = {
            field: getattr(obj, field)
            for field in ("code", "name", "address_line", "district", "province", "department", "country")
        }
        try:
            saved = update_facility_site(instance=obj, data=data)
        except ValidationError as exc:
            raise ValidationError(exc.message_dict if hasattr(exc, "message_dict") else exc.messages) from exc
        obj.pk = saved.pk
        obj.code = saved.code
        record_audit(
            request=request,
            action="FACILITY_SITE_UPDATED",
            entity="FacilitySite",
            entity_id=saved.id,
            before=before,
            after=site_snapshot(saved),
        )

    def delete_model(self, request, obj):
        before = site_snapshot(obj)
        archived = archive_site(obj)
        record_audit(
            request=request,
            action="FACILITY_SITE_ARCHIVED",
            entity="FacilitySite",
            entity_id=archived.id,
            before=before,
            after=site_snapshot(archived),
        )

    def delete_queryset(self, request, queryset):
        for site in queryset:
            self.delete_model(request, site)


@admin.register(SpaceNode)
class SpaceNodeAdmin(admin.ModelAdmin):
    list_display = ("path_code", "name", "node_type", "site", "parent", "active")
    list_filter = ("site", "node_type", "active")
    search_fields = ("path_code", "code_segment", "name")
    readonly_fields = ("path_code", "normalized_name", "active", "created_at", "updated_at")
    ordering = ("path_code",)

    def save_model(self, request, obj, form, change):
        data = {
            "site": obj.site,
            "parent": obj.parent,
            "node_type": obj.node_type,
            "code_segment": obj.code_segment,
            "name": obj.name,
            "square_meters": obj.square_meters,
            "headcount": obj.headcount,
            "common_space": obj.common_space,
        }
        before = node_snapshot(SpaceNode.objects.get(pk=obj.pk)) if change else None
        try:
            saved = update_space_node(instance=obj, data=data) if change else create_space_node(data=data)
        except ValidationError as exc:
            raise ValidationError(exc.message_dict if hasattr(exc, "message_dict") else exc.messages) from exc
        obj.pk = saved.pk
        obj.path_code = saved.path_code
        record_audit(
            request=request,
            action="SPACE_NODE_UPDATED" if change else "SPACE_NODE_CREATED",
            entity="SpaceNode",
            entity_id=saved.id,
            before=before,
            after=node_snapshot(saved),
        )

    def delete_model(self, request, obj):
        # El dominio espacial no permite borrado físico; el API ofrece archive.
        before = node_snapshot(obj)
        archived = archive_space_node(obj)
        record_audit(
            request=request,
            action="SPACE_NODE_ARCHIVED",
            entity="SpaceNode",
            entity_id=archived.id,
            before=before,
            after=node_snapshot(archived),
        )

    def delete_queryset(self, request, queryset):
        for node in queryset:
            self.delete_model(request, node)
