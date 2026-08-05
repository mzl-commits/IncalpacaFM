from datetime import timedelta

from django.contrib.auth import authenticate, get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import AccountProfile


class CurrentUserSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source="account_profile.id", read_only=True)
    user_id = serializers.IntegerField(source="pk", read_only=True)
    worker_code = serializers.CharField(source="account_profile.worker_code", read_only=True)
    full_name = serializers.SerializerMethodField()
    role = serializers.CharField(source="account_profile.role", read_only=True)
    specialty = serializers.CharField(source="account_profile.specialty", read_only=True)
    must_change_password = serializers.BooleanField(
        source="account_profile.must_change_password", read_only=True
    )

    class Meta:
        model = get_user_model()
        fields = (
            "id",
            "user_id",
            "worker_code",
            "full_name",
            "email",
            "role",
            "specialty",
            "must_change_password",
        )

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username


class LoginSerializer(serializers.Serializer):
    worker_code = serializers.CharField(max_length=40)
    password = serializers.CharField(trim_whitespace=False, write_only=True)

    @transaction.atomic
    def validate(self, attrs):
        now = timezone.now()
        try:
            profile = AccountProfile.objects.select_for_update().select_related("user").get(
                worker_code=attrs["worker_code"], active=True, user__is_active=True
            )
        except AccountProfile.DoesNotExist as exc:
            raise serializers.ValidationError("Credenciales inválidas.") from exc

        if profile.blocked_until and profile.blocked_until > now:
            raise serializers.ValidationError(
                "Cuenta bloqueada temporalmente. Intenta nuevamente más tarde."
            )

        user = authenticate(
            request=self.context.get("request"),
            username=profile.user.username,
            password=attrs["password"],
        )
        if not user:
            profile.failed_attempts += 1
            if profile.failed_attempts >= 5:
                profile.blocked_until = now + timedelta(minutes=15)
                profile.failed_attempts = 0
            profile.save(update_fields=("failed_attempts", "blocked_until"))
            raise serializers.ValidationError("Credenciales inválidas.")

        profile.failed_attempts = 0
        profile.blocked_until = None
        profile.last_access = now
        profile.save(update_fields=("failed_attempts", "blocked_until", "last_access"))
        refresh = RefreshToken.for_user(user)
        return {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": CurrentUserSerializer(user).data,
        }


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=10)

    def validate_current_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("La contraseña actual no es correcta.")
        return value

    def save(self):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=("password",))
        profile = user.account_profile
        profile.must_change_password = False
        profile.save(update_fields=("must_change_password",))
        return user


class UserListSerializer(serializers.ModelSerializer):
    """Serializador ligero para poblar selects de responsable/inspector en otros módulos."""
    id = serializers.IntegerField(source="pk", read_only=True)
    worker_code = serializers.CharField(source="account_profile.worker_code", read_only=True, default="")
    full_name = serializers.SerializerMethodField()
    role = serializers.CharField(source="account_profile.role", read_only=True, default="")
    role_display = serializers.SerializerMethodField()

    class Meta:
        model = get_user_model()
        fields = ("id", "worker_code", "full_name", "role", "role_display")

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username

    def get_role_display(self, obj):
        try:
            return obj.account_profile.get_role_display()
        except AccountProfile.DoesNotExist:
            return ""
