from datetime import timedelta

from django.contrib.auth import authenticate, get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken
from apps.catalogo.models import Almacen

from .models import AccountProfile

def normalize_employee_dni(value):
    digits = "".join(char for char in str(value or "") if char.isdigit())
    if len(digits) != 8:
        raise serializers.ValidationError("El DNI debe tener 8 dígitos.")
    return digits

def notify_duplicate(subject, body, discriminator):
    from apps.notifications.services import queue_for_administrators
    queue_for_administrators(event="DUPLICATE_WORKER_IDENTITY", subject=subject, body=body, discriminator=discriminator)


class CurrentUserSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source="account_profile.id", read_only=True)
    user_id = serializers.IntegerField(source="pk", read_only=True)
    worker_code = serializers.CharField(source="account_profile.worker_code", read_only=True)
    full_name = serializers.SerializerMethodField()
    role = serializers.CharField(source="account_profile.role", read_only=True)
    specialty = serializers.CharField(source="account_profile.specialty", read_only=True)
    dni = serializers.CharField(source="account_profile.dni", read_only=True)
    position = serializers.CharField(source="account_profile.position", read_only=True)
    hourly_rate = serializers.DecimalField(source="account_profile.hourly_rate", max_digits=10, decimal_places=2, read_only=True)
    must_change_password = serializers.BooleanField(
        source="account_profile.must_change_password", read_only=True
    )
    almacen_id = serializers.IntegerField(source="account_profile.almacen_id", read_only=True, default=None)
    almacen_nombre = serializers.CharField(source="account_profile.almacen.nombre", read_only=True, default=None)

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
            "dni",
            "position",
            "hourly_rate",
            "must_change_password",
            "almacen_id",
            "almacen_nombre",
        )

    def get_full_name(self, obj) -> str:
        return obj.get_full_name() or obj.username


class LoginSerializer(serializers.Serializer):
    worker_code = serializers.CharField(max_length=40)
    password = serializers.CharField(trim_whitespace=False, write_only=True)

    @transaction.atomic
    def validate(self, attrs):
        from django.db.models import Q
        now = timezone.now()
        login_input = attrs["worker_code"].strip()
        
        matching_profiles = AccountProfile.objects.select_for_update().select_related("user").filter(
            Q(worker_code__iexact=login_input) | Q(user__username__iexact=login_input) | Q(user__email__iexact=login_input),
            active=True,
            user__is_active=True,
        )
        if matching_profiles.count() > 1:
            notify_duplicate("Perfiles duplicados detectados", f"Se detectaron varios perfiles activos para {login_input}.", f"login-dup:{login_input}")
            raise serializers.ValidationError("No se puede validar este identificador. Contacta al administrador.")
        
        profile = matching_profiles.first()
        if not profile:
            raise serializers.ValidationError("Credenciales inválidas.")

        if profile.dni and AccountProfile.objects.filter(dni=profile.dni).exclude(pk=profile.pk).exists():
            notify_duplicate("DNI duplicado detectado en acceso", f"El DNI {profile.dni} está asociado a más de un perfil.", f"login-dni:{profile.dni}")

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

    def get_full_name(self, obj) -> str:
        return obj.get_full_name() or obj.username

    def get_role_display(self, obj) -> str:
        try:
            return obj.account_profile.get_role_display()
        except AccountProfile.DoesNotExist:
            return ""

from apps.catalogo.models import Almacen  # ← nuevo import, junto a los de arriba

class TechnicianSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='account_profile.id', read_only=True)
    full_name = serializers.CharField(max_length=160, write_only=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    worker_code = serializers.CharField(source='account_profile.worker_code', max_length=40)
    dni = serializers.CharField(source='account_profile.dni', max_length=8, required=False, allow_blank=True)
    specialty = serializers.CharField(source='account_profile.specialty', max_length=100, allow_blank=True)
    position = serializers.CharField(source='account_profile.position', max_length=100, allow_blank=True, required=False)
    hourly_rate = serializers.DecimalField(source='account_profile.hourly_rate', max_digits=10, decimal_places=2, min_value=0, required=False)
    active = serializers.BooleanField(source='account_profile.active', required=False)
    temporary_password = serializers.CharField(write_only=True, min_length=6, required=False, allow_blank=True)
    role = serializers.ChoiceField(
        choices=AccountProfile.Role.choices,
        source='account_profile.role',
        default=AccountProfile.Role.TECHNICIAN,
        required=False,
    )
    almacen = serializers.PrimaryKeyRelatedField(
        source='account_profile.almacen',
        queryset=Almacen.objects.all(),
        required=False,
        allow_null=True,
    )
    almacen_nombre = serializers.CharField(
        source='account_profile.almacen.nombre', read_only=True, default=None,
    )
    current_password_display = serializers.SerializerMethodField()

    def get_current_password_display(self, obj) -> str:
        profile = getattr(obj, 'account_profile', None)
        if profile and profile.initial_password:
            return profile.initial_password
        if profile and profile.worker_code:
            return f"{profile.worker_code}2026"
        return f"{obj.username}2026"

    class Meta:
        model = get_user_model()
        fields = (
            'id', 'full_name', 'email', 'worker_code', 'dni', 'specialty', 'position',
            'hourly_rate', 'active', 'temporary_password', 'current_password_display', 'role', 'almacen', 'almacen_nombre',
        )

    def validate_worker_code(self, value):
        value = value.strip().upper()
        queryset = AccountProfile.objects.filter(worker_code__iexact=value)
        if self.instance:
            queryset = queryset.exclude(user=self.instance)
        if queryset.exists():
            raise serializers.ValidationError('Este código de trabajador ya está registrado.')
        return value

    def validate_dni(self, value):
        if not str(value or '').strip():
            return ''
        value = normalize_employee_dni(value)
        queryset = AccountProfile.objects.filter(dni=value)
        if self.instance:
            queryset = queryset.exclude(user=self.instance)
        if queryset.exists():
            notify_duplicate("Intento de código de trabajador duplicado", f"El código {value} ya está registrado.", f"register-worker:{value}")
        if queryset.exists():
            notify_duplicate("Intento de DNI duplicado", f"El DNI {value} ya está registrado en otro perfil.", f"register-dni:{value}")
            raise serializers.ValidationError("Este DNI ya está registrado en otro perfil.")
        return value

    def validate(self, attrs):
        profile_data = attrs.get('account_profile', {})
        current_role = self.instance.account_profile.role if self.instance else None
        role = profile_data.get('role', current_role or AccountProfile.Role.TECHNICIAN)

        current_almacen = self.instance.account_profile.almacen_id if self.instance else None
        almacen = profile_data.get('almacen', current_almacen)

        if role in (AccountProfile.Role.ALMACENERO, AccountProfile.Role.INSPECTOR) and not almacen:
            raise serializers.ValidationError({'almacen': 'Selecciona un almacén para este rol.'})
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['full_name'] = instance.get_full_name() or instance.username
        return data

    @transaction.atomic
    def create(self, validated_data):
        profile_data = validated_data.pop('account_profile')
        password = validated_data.pop('temporary_password', None)
        if not password:
            raise serializers.ValidationError({'temporary_password': 'Define una contraseña temporal.'})
        full_name = validated_data.pop('full_name').strip()
        first_name, _, last_name = full_name.partition(' ')
        worker_code = profile_data['worker_code']
        user = get_user_model().objects.create_user(
            username=worker_code.lower(),
            password=password,
            first_name=first_name,
            last_name=last_name,
            email=validated_data.get('email', ''),
            is_active=profile_data.get('active', True),
        )
        AccountProfile.objects.create(
            user=user,
            worker_code=worker_code,
            dni=profile_data.get('dni', ''),
            specialty=profile_data.get('specialty', ''),
            position=profile_data.get('position', ''),
            hourly_rate=profile_data.get('hourly_rate', 0),
            active=profile_data.get('active', True),
            role=profile_data.get('role', AccountProfile.Role.TECHNICIAN),
            almacen=profile_data.get('almacen'),
            must_change_password=True,
            initial_password=password,
        )
        return user

    @transaction.atomic
    def update(self, instance, validated_data):
        profile_data = validated_data.pop('account_profile', {})
        password = validated_data.pop('temporary_password', '')
        full_name = validated_data.pop('full_name', '').strip()
        if full_name:
            instance.first_name, _, instance.last_name = full_name.partition(' ')
        if 'email' in validated_data:
            instance.email = validated_data['email']
        if 'active' in profile_data:
            instance.is_active = profile_data['active']
        if password:
            instance.set_password(password)
            instance.account_profile.must_change_password = True
            instance.account_profile.initial_password = password
        instance.save()
        profile = instance.account_profile
        for field in ('worker_code', 'specialty', 'position', 'hourly_rate', 'active', 'role', 'almacen'):
            if field in profile_data:
                setattr(profile, field, profile_data[field])
        # Si el rol deja de ser Almacenero/Inspector, se libera el almacén asignado
        if profile.role not in (AccountProfile.Role.ALMACENERO, AccountProfile.Role.INSPECTOR):
            profile.almacen = None
        profile.save()
        return instance
