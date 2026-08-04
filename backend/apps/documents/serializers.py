from rest_framework import serializers


class DocumentRecordSerializer(serializers.Serializer):
    id = serializers.CharField()
    source = serializers.CharField()
    sourceLabel = serializers.CharField()
    entityId = serializers.CharField()
    entityCode = serializers.CharField()
    assetCode = serializers.CharField()
    name = serializers.CharField()
    category = serializers.CharField()
    mimeType = serializers.CharField()
    size = serializers.IntegerField()
    createdAt = serializers.DateTimeField()
    hasContent = serializers.BooleanField()
    integrityHash = serializers.CharField(allow_blank=True)
    downloadPath = serializers.CharField(allow_null=True)


class DocumentRegistrySerializer(serializers.Serializer):
    count = serializers.IntegerField()
    results = DocumentRecordSerializer(many=True)
    sources = serializers.DictField(child=serializers.CharField())
