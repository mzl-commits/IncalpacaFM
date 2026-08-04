from django.db.models import Count, Q, TextField
from django.db.models.functions import Cast

from apps.assets.models import Taxonomy


def taxonomy_list_queryset(params=None):
    params = params or {}
    queryset = Taxonomy.objects.select_related("sequence").annotate(
        asset_count=Count("asset", distinct=True),
        aliases_text=Cast("aliases", output_field=TextField()),
    )
    search = params.get("search", "").strip()
    if search:
        queryset = queryset.filter(
            Q(prefix__icontains=search)
            | Q(name__icontains=search)
            | Q(asset_type__icontains=search)
            | Q(category__icontains=search)
            | Q(subcategory__icontains=search)
            | Q(specialty__icontains=search)
            | Q(aliases_text__icontains=search)
        )
    for field in ("asset_type", "category", "specialty", "review_status"):
        value = params.get(field)
        if value:
            queryset = queryset.filter(**{field: value})
    boolean_filters = {}
    for field in ("active", "issuance_enabled"):
        value = params.get(field)
        if value is not None and str(value).lower() in {"true", "false", "1", "0"}:
            parsed = str(value).lower() in {"true", "1"}
            boolean_filters[field] = parsed
            queryset = queryset.filter(**{field: parsed})
    if boolean_filters == {"active": True, "issuance_enabled": True}:
        queryset = queryset.filter(review_status=Taxonomy.ReviewStatus.VALIDATED)
    if str(params.get("issuable", "")).lower() in {"true", "1"}:
        queryset = queryset.filter(
            active=True,
            issuance_enabled=True,
            review_status=Taxonomy.ReviewStatus.VALIDATED,
            prefix__isnull=False,
        )
    return queryset.order_by("prefix", "name")
