from rest_framework import serializers

from .models import ReporterProfile


class ReporterProfileSerializer(serializers.ModelSerializer):
    workerCodes = serializers.SerializerMethodField()
    reportsCount = serializers.IntegerField(source="incidents.count", read_only=True)
    firstReportedAt = serializers.DateTimeField(source="first_reported_at", read_only=True)
    lastReportedAt = serializers.DateTimeField(source="last_reported_at", read_only=True)

    class Meta:
        model = ReporterProfile
        fields = (
            "id", "dni", "full_name", "email", "active", "workerCodes", "reportsCount",
            "firstReportedAt", "lastReportedAt",
        )

    def get_workerCodes(self, obj):
        return [code.worker_code for code in obj.worker_codes.all()]
