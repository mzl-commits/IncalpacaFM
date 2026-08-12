from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.models import AccountProfile
from apps.accounts.permissions import IsAlmaceneroOrAdministratorWrite
from apps.inventario.models import Movimiento, SolicitudMovimiento
from apps.catalogo.models import Pieza
from apps.inventario.serializers import (
    MovimientoSerializer,
    SalidaMaterialSerializer,
    SalidaPiezaSerializer,
    EntradaMaterialSerializer,
    EntradaPiezaSerializer,
    BajaMaterialSerializer,
    BajaPiezaSerializer,
    PiezaPrestadaSerializer,
    SolicitudMovimientoSerializer,
    SolicitudMovimientoCreateSerializer,
    RechazarSolicitudSerializer,  # AprobarSolicitudSerializer no se usa: la aprobación no necesita payload
)
from apps.inventario.services import (
    registrar_salida_material,
    registrar_salida_pieza,
    registrar_baja_material,
    registrar_baja_pieza,
)


def _es_almacenero(request):
    """Devuelve True si el usuario autenticado tiene rol ALMACENERO."""
    profile = getattr(request.user, "account_profile", None)
    return profile is not None and profile.role == AccountProfile.Role.ALMACENERO


class MovimientoViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Movimiento.objects.select_related("material", "pieza", "responsable").all()
    serializer_class = MovimientoSerializer
    permission_classes = [IsAlmaceneroOrAdministratorWrite]

    def get_queryset(self):
        qs = super().get_queryset()
        material_id = self.request.query_params.get("material")
        pieza_id = self.request.query_params.get("pieza")
        tipo = self.request.query_params.get("tipo")
        lote_id = self.request.query_params.get("lote_id")
        responsable_id = self.request.query_params.get("responsable")

        if material_id:
            qs = qs.filter(material_id=material_id)
        if pieza_id:
            qs = qs.filter(pieza_id=pieza_id)
        if tipo:
            qs = qs.filter(tipo=tipo)
        if lote_id:
            qs = qs.filter(lote_id=lote_id)
        if responsable_id:
            qs = qs.filter(responsable_id=responsable_id)
        return qs

    # ── Acciones con flujo de aprobación para ALMACENERO ──────────────────────

    @action(detail=False, methods=["post"], url_path="salida-material")
    def salida_material(self, request):
        if _es_almacenero(request):
            return _crear_solicitud(request, SolicitudMovimiento.Tipo.SALIDA_MATERIAL)
        serializer = SalidaMaterialSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        mov = serializer.save()
        return Response(MovimientoSerializer(mov).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="salida-pieza")
    def salida_pieza(self, request):
        if _es_almacenero(request):
            return _crear_solicitud(request, SolicitudMovimiento.Tipo.SALIDA_PIEZA)
        serializer = SalidaPiezaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        movimientos, hijas_excluidas = serializer.save()
        respuesta = {"movimientos": MovimientoSerializer(movimientos, many=True).data}
        if hijas_excluidas:
            respuesta["aviso"] = f"{len(hijas_excluidas)} pieza(s) no salieron por no estar disponibles."
            respuesta["hijas_excluidas"] = hijas_excluidas
        return Response(respuesta, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="baja-material")
    def baja_material(self, request):
        if _es_almacenero(request):
            return _crear_solicitud(request, SolicitudMovimiento.Tipo.BAJA_MATERIAL)
        serializer = BajaMaterialSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        mov = serializer.save()
        return Response(MovimientoSerializer(mov).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="baja-pieza")
    def baja_pieza(self, request):
        if _es_almacenero(request):
            return _crear_solicitud(request, SolicitudMovimiento.Tipo.BAJA_PIEZA)
        serializer = BajaPiezaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        mov = serializer.save()
        return Response(MovimientoSerializer(mov).data, status=status.HTTP_201_CREATED)

    # ── Entradas: sin flujo de aprobación ─────────────────────────────────────

    @action(detail=False, methods=["post"], url_path="entrada-material")
    def entrada_material(self, request):
        serializer = EntradaMaterialSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        mov = serializer.save()
        return Response(MovimientoSerializer(mov).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="entrada-pieza")
    def entrada_pieza(self, request):
        serializer = EntradaPiezaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        mov = serializer.save()
        return Response(MovimientoSerializer(mov).data, status=status.HTTP_201_CREATED)

    # ── Checklist de préstamos ─────────────────────────────────────────────────

    @action(detail=False, methods=["get"], url_path="checklist-prestados")
    def checklist_prestados(self, request):
        """Retorna todas las piezas que están actualmente prestadas para el checklist de devolución."""
        qs = Pieza.objects.filter(estado="Prestado").select_related(
            "material", "padre"
        ).prefetch_related("movimientos")

        salio_hoy = request.query_params.get("salio_hoy")
        if salio_hoy is not None and salio_hoy.lower() == "true":
            hoy = timezone.now().date()
            qs = qs.filter(movimientos__tipo="salida", movimientos__fecha__date=hoy).distinct()

        fecha_str = request.query_params.get("fecha")
        if fecha_str:
            qs = qs.filter(movimientos__tipo="salida", movimientos__fecha__date=fecha_str).distinct()

        return Response(PiezaPrestadaSerializer(qs, many=True).data)

    # ── Exportar Excel ────────────────────────────────────────────────────────
    @action(detail=False, methods=["get"], url_path="exportar-excel")
    def exportar_excel(self, request):
        from apps.inventario.exporters import generar_excel_movimientos
        from django.http import HttpResponse
        material_id = request.query_params.get("material")
        buffer, filename = generar_excel_movimientos(material_id=material_id)
        response = HttpResponse(
            buffer.read(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response


def _crear_solicitud(request, tipo: str):
    """Crea una SolicitudMovimiento en estado PENDIENTE y notifica a los administradores."""
    data = dict(request.data)
    data["tipo"] = tipo

    # Normaliza campos: SalidaMaterialSerializer usa material_id, nosotros usamos material
    if "material_id" in data and "material" not in data:
        data["material"] = data.pop("material_id")
    if "pieza_id" in data and "pieza" not in data:
        data["pieza"] = data.pop("pieza_id")
    if "responsable_id" in data:
        data.pop("responsable_id")  # La solicitud guarda solicitado_por automáticamente

    # ── Resolución de cantidad por empaque (opción A genérica) ─────────────────
    # El frontend manda cantidad_cajas SIN cantidad cuando unidad_manejo != "unidad"
    # (confiando en que el backend calcule cantidad = cantidad_cajas × unidades_por_caja).
    # SolicitudMovimientoCreateSerializer no pasa por _resolver_cantidad_por_caja,
    # así que lo hacemos aquí, antes de que llegue al serializer.
    # Nota: services.py NO llama _resolver_cantidad_por_caja, por lo que no hay
    # doble resolución al ejecutar el movimiento en la aprobación.
    cantidad_cajas_raw = data.get("cantidad_cajas")
    if cantidad_cajas_raw and not data.get("cantidad"):
        material_id = data.get("material")
        if material_id:
            from apps.catalogo.models import Material as _Material
            from rest_framework.exceptions import ValidationError as _ValidationError
            try:
                mat = _Material.objects.get(pk=material_id)
            except _Material.DoesNotExist:
                from rest_framework.exceptions import ValidationError as _VE
                raise _VE({"material": "Material no encontrado."})
            if mat.unidad_manejo == "unidad":
                raise _ValidationError({
                    "cantidad_cajas": (
                        f"'{mat.nombre}' se maneja por unidad suelta; "
                        f"indica la cantidad directamente, no por empaque."
                    )
                })
            if not mat.unidades_por_caja:
                raise _ValidationError({
                    "cantidad_cajas": (
                        f"'{mat.nombre}' no tiene configuradas las unidades "
                        f"por empaque ({mat.get_unidad_manejo_display()}). "
                        f"Edita el material antes de usar este campo."
                    )
                })
            data["cantidad"] = int(cantidad_cajas_raw) * mat.unidades_por_caja
    # ──────────────────────────────────────────────────────────────────────────

    serializer = SolicitudMovimientoCreateSerializer(data=data)
    serializer.is_valid(raise_exception=True)
    solicitud = serializer.save(solicitado_por=request.user)


    # Notificar a administradores
    try:
        from apps.notifications.services import queue_for_administrators
        objetivo = (
            solicitud.pieza.codigo if solicitud.pieza
            else (solicitud.material.nombre if solicitud.material else "—")
        )
        tipo_label = solicitud.get_tipo_display()
        queue_for_administrators(
            event="SOLICITUD_MOVIMIENTO_PENDIENTE",
            subject=f"Solicitud pendiente: {tipo_label} — {objetivo}",
            body=(
                f"{request.user.get_full_name() or request.user.username} solicita "
                f"una {tipo_label.lower()} de «{objetivo}» (cantidad: {solicitud.cantidad}). "
                f"Revisa y aprueba o rechaza la solicitud en el panel de Movimientos."
            ),
            entity=solicitud,
            context={"solicitudId": solicitud.id, "tipo": tipo, "objetivo": objetivo},
            discriminator=f"solicitud-{solicitud.id}",
        )
    except Exception:
        pass  # No bloquear la respuesta por fallo de notificación

    return Response(
        {
            "solicitud_id": solicitud.id,
            "estado": solicitud.estado,
            "tipo": solicitud.tipo,
            "mensaje": (
                "Tu solicitud fue registrada y está pendiente de aprobación por un administrador."
            ),
        },
        status=status.HTTP_202_ACCEPTED,
    )


class SolicitudMovimientoViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet para gestionar solicitudes de movimiento.
    - ALMACENERO: ve solo sus propias solicitudes.
    - ADMINISTRADOR: ve todas las solicitudes + puede aprobar/rechazar.
    """
    serializer_class = SolicitudMovimientoSerializer
    permission_classes = [IsAlmaceneroOrAdministratorWrite]

    def get_queryset(self):
        qs = SolicitudMovimiento.objects.select_related(
            "material", "pieza", "solicitado_por", "resuelto_por", "movimiento"
        ).all()

        # Filtros
        estado = self.request.query_params.get("estado")
        if estado:
            qs = qs.filter(estado=estado)

        tipo = self.request.query_params.get("tipo")
        if tipo:
            qs = qs.filter(tipo=tipo)

        # Almacenero solo ve las suyas
        profile = getattr(self.request.user, "account_profile", None)
        if profile and profile.role == AccountProfile.Role.ALMACENERO:
            qs = qs.filter(solicitado_por=self.request.user)

        return qs

    def create(self, request, *args, **kwargs):
        """Crear nueva solicitud (solo ALMACENERO)."""
        profile = getattr(request.user, "account_profile", None)
        if not profile or profile.role not in (
            AccountProfile.Role.ALMACENERO, AccountProfile.Role.ADMIN
        ):
            return Response(
                {"detail": "No tienes permisos para crear solicitudes."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return _crear_solicitud(request, request.data.get("tipo", ""))

    @action(detail=True, methods=["post"], url_path="aprobar")
    def aprobar(self, request, pk=None):
        """Aprueba la solicitud y crea el Movimiento real. Solo ADMINISTRADOR."""
        profile = getattr(request.user, "account_profile", None)
        if not profile or profile.role != AccountProfile.Role.ADMIN:
            return Response({"detail": "Solo administradores pueden aprobar solicitudes."},
                            status=status.HTTP_403_FORBIDDEN)

        solicitud = self.get_object()
        if solicitud.estado != SolicitudMovimiento.Estado.PENDIENTE:
            return Response(
                {"detail": f"La solicitud ya fue {solicitud.get_estado_display().lower()}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            movimiento = _ejecutar_solicitud(solicitud, request.user)
        except Exception as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        # Notificar al almacenero que solicitó
        _notificar_resolucion(solicitud, aprobada=True, request_user=request.user)

        return Response(
            {
                "solicitud_id": solicitud.id,
                "estado": solicitud.estado,
                "movimiento_id": movimiento.id if movimiento else None,
                "mensaje": "Solicitud aprobada. El movimiento fue registrado.",
            }
        )

    @action(detail=True, methods=["post"], url_path="rechazar")
    def rechazar(self, request, pk=None):
        """Rechaza la solicitud. Solo ADMINISTRADOR."""
        profile = getattr(request.user, "account_profile", None)
        if not profile or profile.role != AccountProfile.Role.ADMIN:
            return Response({"detail": "Solo administradores pueden rechazar solicitudes."},
                            status=status.HTTP_403_FORBIDDEN)

        solicitud = self.get_object()
        if solicitud.estado != SolicitudMovimiento.Estado.PENDIENTE:
            return Response(
                {"detail": f"La solicitud ya fue {solicitud.get_estado_display().lower()}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ser = RechazarSolicitudSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        solicitud.estado = SolicitudMovimiento.Estado.RECHAZADA
        solicitud.motivo_rechazo = ser.validated_data.get("motivo_rechazo", "")
        solicitud.resuelto_por = request.user
        solicitud.resuelto_en = timezone.now()
        solicitud.save(update_fields=["estado", "motivo_rechazo", "resuelto_por", "resuelto_en"])

        _notificar_resolucion(solicitud, aprobada=False, request_user=request.user)

        return Response(
            {
                "solicitud_id": solicitud.id,
                "estado": solicitud.estado,
                "mensaje": "Solicitud rechazada.",
            }
        )


def _ejecutar_solicitud(solicitud: SolicitudMovimiento, resuelto_por):
    """Ejecuta el movimiento real al aprobar una solicitud."""
    # El responsable del movimiento real es el admin que aprueba
    responsable = resuelto_por
    tipo = solicitud.tipo
    mov = None

    if tipo == SolicitudMovimiento.Tipo.SALIDA_MATERIAL:
        mov = registrar_salida_material(
            material=solicitud.material,
            cantidad=solicitud.cantidad,
            responsable=responsable,
            referencia_externa=solicitud.referencia_externa,
            observaciones=solicitud.observaciones,
            cantidad_cajas=solicitud.cantidad_cajas,
        )

    elif tipo == SolicitudMovimiento.Tipo.SALIDA_PIEZA:
        movs, _ = registrar_salida_pieza(
            pieza=solicitud.pieza,
            responsable=responsable,
            referencia_externa=solicitud.referencia_externa,
            observaciones=solicitud.observaciones,
            piezas_hijas_ids=solicitud.piezas_hijas_ids or None,
        )
        mov = movs[0] if movs else None

    elif tipo == SolicitudMovimiento.Tipo.BAJA_MATERIAL:
        mov = registrar_baja_material(
            material=solicitud.material,
            cantidad=solicitud.cantidad,
            responsable=responsable,
            observaciones=solicitud.observaciones,
            cantidad_cajas=solicitud.cantidad_cajas,
        )

    elif tipo == SolicitudMovimiento.Tipo.BAJA_PIEZA:
        mov = registrar_baja_pieza(
            pieza=solicitud.pieza,
            responsable=responsable,
            observaciones=solicitud.observaciones,
        )

    # Actualizar solicitud
    solicitud.estado = SolicitudMovimiento.Estado.APROBADA
    solicitud.resuelto_por = resuelto_por
    solicitud.resuelto_en = timezone.now()
    solicitud.movimiento = mov
    solicitud.save(update_fields=["estado", "resuelto_por", "resuelto_en", "movimiento"])
    return mov


def _notificar_resolucion(solicitud: SolicitudMovimiento, *, aprobada: bool, request_user):
    """Notifica al almacenero que hizo la solicitud sobre el resultado."""
    try:
        from apps.notifications.services import queue_for_roles
        objetivo = (
            solicitud.pieza.codigo if solicitud.pieza
            else (solicitud.material.nombre if solicitud.material else "—")
        )
        tipo_label = solicitud.get_tipo_display()
        if aprobada:
            subject = f"Solicitud aprobada: {tipo_label} — {objetivo}"
            body = (
                f"Tu solicitud de {tipo_label.lower()} para «{objetivo}» fue aprobada por "
                f"{request_user.get_full_name() or request_user.username}. "
                f"El movimiento fue registrado en el historial."
            )
            event = "SOLICITUD_MOVIMIENTO_APROBADA"
        else:
            subject = f"Solicitud rechazada: {tipo_label} — {objetivo}"
            motivo = solicitud.motivo_rechazo or "Sin motivo indicado."
            body = (
                f"Tu solicitud de {tipo_label.lower()} para «{objetivo}» fue rechazada. "
                f"Motivo: {motivo}"
            )
            event = "SOLICITUD_MOVIMIENTO_RECHAZADA"

        queue_for_roles(
            event=event,
            roles=[AccountProfile.Role.ALMACENERO],
            subject=subject,
            body=body,
            entity=solicitud,
            context={"solicitudId": solicitud.id, "aprobada": aprobada},
            discriminator=f"solicitud-resuelta-{solicitud.id}",
        )
    except Exception:
        pass