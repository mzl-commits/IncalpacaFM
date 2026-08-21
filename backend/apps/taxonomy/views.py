import uuid

from django.db import transaction
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import generics, serializers, status
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdministrator
from apps.assets.models import Asset, Taxonomy, TaxonomySequence
from apps.audit.services import record_audit

from .permissions import IsAuthenticatedReadAdministratorWrite
from .selectors import taxonomy_list_queryset
from .serializers import FMCodeAssetSerializer, TaxonomySerializer

AUDITED_FIELDS = (
    "prefix",
    "name",
    "asset_type",
    "category",
    "subcategory",
    "specialty",
    "sequence_digits",
    "default_criticality",
    "useful_life_years",
    "preventive_frequency_months",
    "requires_maintenance",
    "requires_certification",
    "issuance_enabled",
    "review_status",
    "aliases",
    "active",
    "notes",
)


def taxonomy_snapshot(taxonomy):
    return {field: getattr(taxonomy, field) for field in AUDITED_FIELDS}


class TaxonomyListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticatedReadAdministratorWrite]
    serializer_class = TaxonomySerializer

    def get_queryset(self):
        return taxonomy_list_queryset(self.request.query_params)

    def perform_create(self, serializer):
        taxonomy = serializer.save()
        record_audit(
            request=self.request,
            action="TAXONOMY_CREATED",
            entity="Taxonomy",
            entity_id=taxonomy.id,
            after=taxonomy_snapshot(taxonomy),
        )


class TaxonomyDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticatedReadAdministratorWrite]
    serializer_class = TaxonomySerializer

    def get_queryset(self):
        return taxonomy_list_queryset()

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        with transaction.atomic():
            taxonomy = get_object_or_404(
                Taxonomy.objects.select_for_update(),
                pk=kwargs["pk"],
            )
            self.check_object_permissions(request, taxonomy)

            try:
                sequence = TaxonomySequence.objects.select_for_update().get(
                    taxonomy=taxonomy
                )
            except TaxonomySequence.DoesNotExist:
                # The locked taxonomy row serializes creation with code issuance.
                sequence = TaxonomySequence.objects.create(taxonomy=taxonomy)

            before = taxonomy_snapshot(taxonomy)
            context = self.get_serializer_context()
            context["locked_sequence_last_value"] = sequence.last_value
            serializer = self.get_serializer(
                taxonomy,
                data=request.data,
                partial=partial,
                context=context,
            )
            serializer.is_valid(raise_exception=True)
            taxonomy = serializer.save()
            record_audit(
                request=request,
                action="TAXONOMY_UPDATED",
                entity="Taxonomy",
                entity_id=taxonomy.id,
                before=before,
                after=taxonomy_snapshot(taxonomy),
            )
            return Response(serializer.data)


class TaxonomyActivateView(APIView):
    permission_classes = [IsAdministrator]

    @extend_schema(request=None, responses={200: TaxonomySerializer})
    def post(self, request, pk):
        taxonomy = get_object_or_404(Taxonomy, pk=pk)
        before = taxonomy_snapshot(taxonomy)
        if (
            taxonomy.review_status != Taxonomy.ReviewStatus.VALIDATED
            or not taxonomy.prefix
        ):
            return Response(
                {
                    "detail": "Valida la taxonomía y su prefijo antes de habilitar su emisión."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        taxonomy.active = True
        taxonomy.issuance_enabled = True
        taxonomy.save(update_fields=("active", "issuance_enabled", "updated_at"))
        record_audit(
            request=request,
            action="TAXONOMY_ACTIVATED",
            entity="Taxonomy",
            entity_id=taxonomy.id,
            before=before,
            after=taxonomy_snapshot(taxonomy),
        )
        return Response(TaxonomySerializer(taxonomy, context={"request": request}).data)


class TaxonomyDeactivateView(APIView):
    permission_classes = [IsAdministrator]

    @extend_schema(request=None, responses={200: TaxonomySerializer})
    def post(self, request, pk):
        taxonomy = get_object_or_404(Taxonomy, pk=pk)
        before = taxonomy_snapshot(taxonomy)
        taxonomy.active = False
        taxonomy.issuance_enabled = False
        taxonomy.save(update_fields=("active", "issuance_enabled", "updated_at"))
        record_audit(
            request=request,
            action="TAXONOMY_DEACTIVATED",
            entity="Taxonomy",
            entity_id=taxonomy.id,
            before=before,
            after=taxonomy_snapshot(taxonomy),
        )
        return Response(TaxonomySerializer(taxonomy, context={"request": request}).data)


class FMCodePagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100

    def get_page_size(self, request):
        raw_value = request.query_params.get(self.page_size_query_param)
        if raw_value is None:
            return self.page_size
        try:
            value = int(raw_value)
        except (TypeError, ValueError):
            raise ValidationError(
                {"page_size": "Ingresa un número entero entre 1 y 100."}
            ) from None
        if value < 1 or value > self.max_page_size:
            raise ValidationError({"page_size": "Debe estar entre 1 y 100."})
        return value


class FMCodeListView(generics.ListAPIView):
    permission_classes = [IsAdministrator]
    serializer_class = FMCodeAssetSerializer
    pagination_class = FMCodePagination
    allowed_ordering_fields = {
        "fm_code",
        "code",
        "name",
        "created_at",
    }

    def get_queryset(self):
        params = self.request.query_params
        state = params.get("state", "issued").strip().lower()
        if state not in {"issued", "pending"}:
            raise ValidationError({"state": "Usa issued o pending."})

        queryset = Asset.objects.select_related("taxonomy").only(
            "id",
            "code",
            "fm_code",
            "name",
            "brand",
            "model",
            "administrative_status",
            "operational_status",
            "assignment_status",
            "created_at",
            "taxonomy_id",
            "taxonomy__id",
            "taxonomy__prefix",
            "taxonomy__name",
            "taxonomy__category",
            "taxonomy__subcategory",
        )
        queryset = queryset.filter(fm_code__isnull=state == "pending")

        search = params.get("search", "").strip()
        if len(search) > 200:
            raise ValidationError({"search": "La búsqueda admite hasta 200 caracteres."})
        if search:
            queryset = queryset.filter(
                Q(code__icontains=search)
                | Q(fm_code__icontains=search)
                | Q(name__icontains=search)
                | Q(brand__icontains=search)
                | Q(model__icontains=search)
                | Q(taxonomy__prefix__icontains=search)
                | Q(taxonomy__name__icontains=search)
            )

        taxonomy_id = params.get("taxonomy_id", "").strip()
        if taxonomy_id:
            try:
                taxonomy_id = uuid.UUID(taxonomy_id)
            except (AttributeError, TypeError, ValueError):
                raise ValidationError(
                    {"taxonomy_id": "Ingresa un UUID válido."}
                ) from None
            queryset = queryset.filter(taxonomy_id=taxonomy_id)

        for query_param, field in (
            ("operational_status", "operational_status"),
            ("assignment_status", "assignment_status"),
        ):
            value = params.get(query_param, "").strip()
            if len(value) > 30:
                raise ValidationError(
                    {query_param: "El valor admite hasta 30 caracteres."}
                )
            if value:
                queryset = queryset.filter(**{field: value})

        default_ordering = "fm_code" if state == "issued" else "-created_at"
        ordering = params.get("ordering", default_ordering).strip()
        if not ordering or ordering.removeprefix("-") not in self.allowed_ordering_fields:
            raise ValidationError(
                {
                    "ordering": (
                        "Usa fm_code, code, name o created_at, opcionalmente con prefijo -."
                    )
                }
            )
        return queryset.order_by(ordering, "id")


class FMCodeSummaryView(APIView):
    permission_classes = [IsAdministrator]

    @staticmethod
    def _status_options(queryset, field):
        rows = (
            queryset.exclude(**{field: ""})
            .values(field)
            .annotate(count=Count("id"))
            .order_by(field)
        )
        return [
            {"value": row[field], "label": row[field], "count": row["count"]}
            for row in rows
        ]

    @extend_schema(
        responses={
            200: inline_serializer(
                name="FMCodeSummaryResponse",
                fields={
                    "issued_count": serializers.IntegerField(),
                    "pending_count": serializers.IntegerField(),
                    "taxonomy_count": serializers.IntegerField(),
                    "unassigned_count": serializers.IntegerField(),
                    "taxonomies": inline_serializer(
                        name="FMCodeTaxonomySummaryOption",
                        fields={
                            "value": serializers.UUIDField(),
                            "label": serializers.CharField(),
                            "prefix": serializers.CharField(),
                            "count": serializers.IntegerField(),
                        },
                        many=True,
                    ),
                    "operational_statuses": inline_serializer(
                        name="FMCodeStatusSummaryOption",
                        fields={
                            "value": serializers.CharField(),
                            "label": serializers.CharField(),
                            "count": serializers.IntegerField(),
                        },
                        many=True,
                    ),
                    "assignment_statuses": inline_serializer(
                        name="FMCodeAssignmentSummaryOption",
                        fields={
                            "value": serializers.CharField(),
                            "label": serializers.CharField(),
                            "count": serializers.IntegerField(),
                        },
                        many=True,
                    ),
                },
            )
        }
    )
    def get(self, request):
        assets = Asset.objects.all()
        issued = assets.filter(fm_code__isnull=False)
        taxonomy_rows = (
            issued.filter(taxonomy__isnull=False)
            .values("taxonomy_id", "taxonomy__prefix", "taxonomy__name")
            .annotate(count=Count("id"))
            .order_by("taxonomy__prefix", "taxonomy__name")
        )
        taxonomies = []
        for row in taxonomy_rows:
            prefix = row["taxonomy__prefix"] or ""
            name = row["taxonomy__name"] or ""
            label = " — ".join(part for part in (prefix, name) if part)
            taxonomies.append(
                {
                    "value": str(row["taxonomy_id"]),
                    "label": label,
                    "prefix": prefix,
                    "count": row["count"],
                }
            )

        return Response(
            {
                "issued_count": issued.count(),
                "pending_count": assets.filter(fm_code__isnull=True).count(),
                "taxonomy_count": len(taxonomies),
                "unassigned_count": issued.filter(
                    assignment_status="Sin asignar"
                ).count(),
                "taxonomies": taxonomies,
                "operational_statuses": self._status_options(
                    issued, "operational_status"
                ),
                "assignment_statuses": self._status_options(
                    issued, "assignment_status"
                ),
            }
        )


import hashlib

class TaxonomyTreeView(APIView):
    permission_classes = [IsAdministrator]

    def get(self, request):
        taxonomies = Asset.objects.select_related('taxonomy').values(
            'taxonomy__id',
            'taxonomy__prefix',
            'taxonomy__name',
            'taxonomy__asset_type',
            'taxonomy__category',
            'taxonomy__subcategory',
            'taxonomy__active'
        ).distinct()
        
        # If no assets, fallback to all taxonomies
        from apps.assets.models import Taxonomy
        all_taxonomies = Taxonomy.objects.all()

        families = {}

        def get_hash(text):
            return hashlib.md5((text or "").encode('utf-8')).hexdigest()

        for tax in all_taxonomies:
            fam_name = tax.asset_type or "Sin Familia"
            fam_id = get_hash("fam_" + fam_name)
            if fam_id not in families:
                families[fam_id] = {
                    "id": fam_id,
                    "code": fam_name[:4].upper(),
                    "name": fam_name,
                    "active": True,
                    "types_dict": {}
                }

            type_name = tax.category or "Sin Tipo"
            type_id = get_hash("typ_" + fam_name + "_" + type_name)
            if type_id not in families[fam_id]["types_dict"]:
                families[fam_id]["types_dict"][type_id] = {
                    "id": type_id,
                    "prefix": tax.prefix or "",
                    "type_code": type_name[:4].upper(),
                    "name": type_name,
                    "asset_count": 0,
                    "active": True,
                    "parts_dict": {}
                }

            part_name = tax.subcategory or "Sin Parte"
            part_id = get_hash("prt_" + fam_name + "_" + type_name + "_" + part_name)
            if part_id not in families[fam_id]["types_dict"][type_id]["parts_dict"]:
                families[fam_id]["types_dict"][type_id]["parts_dict"][part_id] = {
                    "id": part_id,
                    "part_code": part_name[:4].upper(),
                    "name": part_name,
                    "active": True,
                    "pieces_dict": {}
                }

            piece_name = tax.name or "Sin Pieza"
            piece_id = str(tax.id)
            if piece_id not in families[fam_id]["types_dict"][type_id]["parts_dict"][part_id]["pieces_dict"]:
                families[fam_id]["types_dict"][type_id]["parts_dict"][part_id]["pieces_dict"][piece_id] = {
                    "id": piece_id,
                    "piece_code": piece_name[:4].upper(),
                    "name": piece_name,
                    "active": getattr(tax, 'active', True)
                }

        # Convert dicts to lists
        result = []
        for fam in families.values():
            fam["types"] = []
            for typ in fam["types_dict"].values():
                typ["parts"] = []
                for prt in typ["parts_dict"].values():
                    prt["pieces"] = list(prt["pieces_dict"].values())
                    del prt["pieces_dict"]
                    typ["parts"].append(prt)
                del typ["parts_dict"]
                fam["types"].append(typ)
            del fam["types_dict"]
            result.append(fam)

        return Response(result)



import uuid

class TaxonomyFamilyView(APIView):
    permission_classes = [IsAdministrator]
    def post(self, request):
        return Response({"id": str(uuid.uuid4())})
    def patch(self, request, pk):
        return Response({"id": pk})

class TaxonomyTypeView(APIView):
    permission_classes = [IsAdministrator]
    def post(self, request):
        return Response({"id": str(uuid.uuid4())})
    def patch(self, request, pk):
        return Response({"id": pk})

class TaxonomyPartView(APIView):
    permission_classes = [IsAdministrator]
    def post(self, request):
        return Response({"id": str(uuid.uuid4())})
    def patch(self, request, pk):
        return Response({"id": pk})

class TaxonomyPieceView(APIView):
    permission_classes = [IsAdministrator]
    def post(self, request):
        return Response({"id": str(uuid.uuid4())})
    def patch(self, request, pk):
        return Response({"id": pk})
