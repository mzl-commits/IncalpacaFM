from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q, F
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.models import AccountProfile
from apps.accounts.permissions import (
    IsAdministrator,
    IsAlmaceneroOrAdministratorWrite,
    user_role,
)
from apps.accounts.serializers import UserListSerializer
from apps.catalogo.models import Material, Pieza
from apps.catalogo.views import AlmacenScopedMixin

from apps.inventario.models import GrupoSolicitud, Movimiento, SolicitudMovimiento
from apps.workorders.models import WorkOrder

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
    RechazarSolicitudSerializer,
    GrupoSolicitudCreateSerializer,
    GrupoSolicitudDetailSerializer,
    ResolverParcialGrupoSerializer,
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


class MovimientoViewSet(AlmacenScopedMixin, viewsets.ReadOnlyModelViewSet):
    queryset = Movimiento.objects.select_related("material", "pieza", "responsable").all()
    serializer_class = MovimientoSerializer
    permission_classes = [IsAlmaceneroOrAdministratorWrite]
    almacen_lookup = "almacen"

    def get_queryset(self):
        qs = super().get_queryset()
        material_id = self.request.query_params.get("material")
        pieza_id = self.request.query_params.get("pieza")
        tipo = self.request.query_params.get("tipo")
        lote_id = self.request.query_params.get("lote_id")
        responsable_id = self.request.query_params.get("responsable")
        almacen_id = self.request.query_params.get("almacen")

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
        busqueda = self.request.query_params.get("q")
        if busqueda:
            q_filtro = (
                Q(material__nombre__icontains=busqueda)
                | Q(material__codigo__icontains=busqueda)
                | Q(material__ubicacion_fisica__icontains=busqueda)
                | Q(pieza__codigo__icontains=busqueda)
                | Q(pieza__detalle__icontains=busqueda)
                | Q(responsable__username__icontains=busqueda)
                | Q(responsable__first_name__icontains=busqueda)
                | Q(responsable__last_name__icontains=busqueda)
                | Q(referencia_externa__icontains=busqueda)
                | Q(observaciones__icontains=busqueda)
            )
            if busqueda.strip().isdigit():
                num = int(busqueda.strip())
                q_filtro |= (
                    Q(cantidad=num)
                    | Q(cantidad_cajas=num)
                    | Q(material__stock_minimo=num)
                    | Q(material__cantidad_total=num)
                )
            busq_norm = busqueda.strip().lower()
            if busq_norm in ("critico", "crítico", "stock critico", "stock crítico", "bajo", "stock bajo"):
                q_filtro |= (Q(material__stock_minimo__gt=0) & Q(material__cantidad_total__lte=F("material__stock_minimo")))

            qs = qs.filter(q_filtro)

        return qs

    # ── Acciones con flujo de aprobación para ALMACENERO ──────────────────────
    # Si el material/pieza es de otro almacén, la request ni siquiera llega
    # a crear el Movimiento: falla en is_valid(raise_exception=True).

    @action(detail=False, methods=["post"], url_path="salida-material")
    @transaction.atomic
    def salida_material(self, request):
        if _es_almacenero(request):
            return _crear_solicitud(request, SolicitudMovimiento.Tipo.SALIDA_MATERIAL)
        serializer = SalidaMaterialSerializer(
            data=request.data, context={"almacen_forzado": self._almacen_forzado()}
        )
        serializer.is_valid(raise_exception=True)
        mov = serializer.save()
        return Response(MovimientoSerializer(mov).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="salida-pieza")
    @transaction.atomic
    def salida_pieza(self, request):
        if _es_almacenero(request):
            return _crear_solicitud(request, SolicitudMovimiento.Tipo.SALIDA_PIEZA)
        serializer = SalidaPiezaSerializer(
            data=request.data, context={"almacen_forzado": self._almacen_forzado()}
        )
        serializer.is_valid(raise_exception=True)
        movimientos, hijas_excluidas = serializer.save()
        respuesta = {
            "movimientos": MovimientoSerializer(movimientos, many=True).data,
        }
        if hijas_excluidas:
            respuesta["aviso"] = f"{len(hijas_excluidas)} pieza(s) no salieron por no estar disponibles."
            respuesta["hijas_excluidas"] = hijas_excluidas
        return Response(respuesta, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="baja-material")
    @transaction.atomic
    def baja_material(self, request):
        if _es_almacenero(request):
            return _crear_solicitud(request, SolicitudMovimiento.Tipo.BAJA_MATERIAL)
        serializer = BajaMaterialSerializer(
            data=request.data, context={"almacen_forzado": self._almacen_forzado()}
        )
        serializer.is_valid(raise_exception=True)
        mov = serializer.save()
        return Response(MovimientoSerializer(mov).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="baja-pieza")
    @transaction.atomic
    def baja_pieza(self, request):
        if _es_almacenero(request):
            return _crear_solicitud(request, SolicitudMovimiento.Tipo.BAJA_PIEZA)
        serializer = BajaPiezaSerializer(
            data=request.data, context={"almacen_forzado": self._almacen_forzado()}
        )
        serializer.is_valid(raise_exception=True)
        mov = serializer.save()
        return Response(MovimientoSerializer(mov).data, status=status.HTTP_201_CREATED)

    # ── Entradas: sin flujo de aprobación ─────────────────────────────────────

    @action(detail=False, methods=["post"], url_path="entrada-material")
    @transaction.atomic
    def entrada_material(self, request):
        serializer = EntradaMaterialSerializer(
            data=request.data, context={"almacen_forzado": self._almacen_forzado()}
        )
        serializer.is_valid(raise_exception=True)
        mov = serializer.save()
        return Response(MovimientoSerializer(mov).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="entrada-pieza")
    @transaction.atomic
    def entrada_pieza(self, request):
        serializer = EntradaPiezaSerializer(
            data=request.data, context={"almacen_forzado": self._almacen_forzado()}
        )
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

        almacen_forzado = self._almacen_forzado()
        if almacen_forzado is not None:
            almacen_id = almacen_forzado
        else:
            almacen_id = request.data.get("almacen")
            if not almacen_id:
                return Response({"detail": "Debes indicar el almacén..."}, status=400)

        salio_hoy = request.query_params.get("salio_hoy")
        if salio_hoy is not None and salio_hoy.lower() == "true":
            hoy = timezone.now().date()
            qs = qs.filter(movimientos__tipo="salida", movimientos__fecha__date=hoy).distinct()

        fecha_str = request.query_params.get("fecha")
        if fecha_str:
            qs = qs.filter(movimientos__tipo="salida", movimientos__fecha__date=fecha_str).distinct()
        qs = qs.filter(almacen_id=almacen_id)
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


def _format_exc_msg(exc):
    detail = getattr(exc, "detail", None)
    if detail is not None:
        if isinstance(detail, list):
            return " ".join(str(d) for d in detail)
        if isinstance(detail, dict):
            return " ".join(f"{k}: {v}" for k, v in detail.items())
        return str(detail)
    return str(exc)

def _ejecutar_solicitud(solicitud: SolicitudMovimiento, resuelto_por):
    """Ejecuta el movimiento real al aprobar una solicitud."""
    # El responsable del movimiento real es el admin que aprueba
    responsable = resuelto_por
    tipo = solicitud.tipo
    mov = None

    ref_ext = solicitud.referencia_externa
    if not ref_ext:
        if solicitud.work_order:
            ref_ext = solicitud.work_order.code
        elif solicitud.grupo and solicitud.grupo.work_order:
            ref_ext = solicitud.grupo.work_order.code

    if tipo == SolicitudMovimiento.Tipo.SALIDA_MATERIAL:
        mov = registrar_salida_material(
            material=solicitud.material,
            cantidad=solicitud.cantidad,
            responsable=responsable,
            referencia_externa=ref_ext,
            observaciones=solicitud.observaciones,
            cantidad_cajas=solicitud.cantidad_cajas,
        )

    elif tipo == SolicitudMovimiento.Tipo.SALIDA_PIEZA:
        movs, _ = registrar_salida_pieza(
            pieza=solicitud.pieza,
            responsable=responsable,
            referencia_externa=ref_ext,
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

# ─── Endpoints de GrupoSolicitud y OTs activas (Objetivo 1) ─────────────────

from rest_framework.views import APIView  # noqa: E402
from rest_framework.permissions import IsAuthenticated  # noqa: E402

class WorkOrderActivasView(APIView):
    """
    Endpoint liviano de OTs activas (excluyendo CERRADA y CANCELADA).
    Permite al ALMACENERO poblar el desplegable de OTs en el formulario de salidas.
    Devuelve id, code, status y el nombre del técnico principal.

    Visibilidad (Objetivo 3 / Opción C):
    - ADMINISTRADOR ve todas las OTs activas.
    - ALMACENERO solo ve las OTs en las que el admin lo haya marcado
      explícitamente como autorizado (campo WorkOrder.almaceneros_autorizados),
      ya que en un esquema multi-almacén cada almacenero solo debe operar
      sobre las OTs de su(s) almacén(es).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        hoy = timezone.localdate()
        # Mismos estados que el sweep periódico (apps.notifications.monitoring)
        # usa para decidir si una OT "venció" por fecha sin completarse.
        # Una OT en supervisión/validación/conformidad puede tener fecha
        # pasada legítimamente (el trabajo ya se hizo) y no debe excluirse.
        estados_vence_por_fecha = [
            WorkOrder.Status.SCHEDULED,
            WorkOrder.Status.IN_PROGRESS,
            WorkOrder.Status.RETURNED,
        ]
        qs = (
            WorkOrder.objects.exclude(
                status__in=[
                    WorkOrder.Status.CLOSED,
                    WorkOrder.Status.CANCELLED,
                    # Ya marcada como vencida por el sweep periódico.
                    WorkOrder.Status.PENDING_RESCHEDULE,
                ]
            )
            .exclude(status__in=estados_vence_por_fecha, scheduled_date__lt=hoy)
        )

        # El ADMINISTRADOR ve todas las OTs activas; el ALMACENERO solo las
        # que se le hayan autorizado explícitamente para este almacén.
        if user_role(request.user) != AccountProfile.Role.ADMIN:
            qs = qs.filter(almaceneros_autorizados=request.user)

        qs = (
            qs.select_related("technician")
            .only("id", "code", "status", "technician", "scheduled_date")
            .order_by("-created_at")[:100]
        )

        data = [
            {
                "id": str(ot.id),
                "code": ot.code,
                "status": ot.status,
                "status_display": ot.get_status_display(),
                "technician_name": (
                    ot.technician.get_full_name() or ot.technician.username
                    if ot.technician else "N/A"
                ),
            }
            for ot in qs
        ]
        return Response(data)


class WorkOrderAlmacenerosAutorizadosView(APIView):
    """
    Gestión (solo ADMINISTRADOR) de qué almaceneros pueden ver/usar una OT
    específica en el módulo de movimientos de inventario.

    GET  -> lista de ids de almaceneros ya autorizados + catálogo de
            almaceneros disponibles (para poblar un selector múltiple).
    PUT  -> reemplaza el conjunto de almaceneros autorizados de la OT.
            body: {"almacenero_ids": [1, 2, 3]}
    """
    permission_classes = [IsAuthenticated, IsAdministrator]

    def _get_work_order(self, pk):
        return get_object_or_404(WorkOrder, pk=pk)

    def get(self, request, pk=None):
        work_order = self._get_work_order(pk)
        User = get_user_model()
        almaceneros_disponibles = User.objects.filter(
            account_profile__role=AccountProfile.Role.ALMACENERO
        ).select_related("account_profile")

        return Response({
            "work_order_id": str(work_order.id),
            "work_order_code": work_order.code,
            "autorizados": UserListSerializer(
                work_order.almaceneros_autorizados.all(), many=True
            ).data,
            "disponibles": UserListSerializer(
                almaceneros_disponibles, many=True
            ).data,
        })

    def put(self, request, pk=None):
        work_order = self._get_work_order(pk)
        ids = request.data.get("almacenero_ids", [])
        if not isinstance(ids, list):
            return Response(
                {"detail": "almacenero_ids debe ser una lista de ids."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        User = get_user_model()
        almaceneros = User.objects.filter(
            pk__in=ids, account_profile__role=AccountProfile.Role.ALMACENERO
        )
        work_order.almaceneros_autorizados.set(almaceneros)

        return Response({
            "work_order_id": str(work_order.id),
            "work_order_code": work_order.code,
            "autorizados": UserListSerializer(
                work_order.almaceneros_autorizados.all(), many=True
            ).data,
        })

class GrupoSolicitudViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet para gestionar Grupos de Solicitud (envíos multi-material).
    - ALMACENERO: ve sus propios grupos y crea nuevos con POST /grupos-solicitud/.
    - ADMINISTRADOR: ve todos los grupos.
    """
    permission_classes = [IsAlmaceneroOrAdministratorWrite]
    serializer_class = GrupoSolicitudDetailSerializer

    def get_queryset(self):
        qs = (
            GrupoSolicitud.objects.select_related("solicitado_por", "work_order")
            .prefetch_related(
                "items",
                "items__material",
                "items__pieza",
                "items__solicitado_por",
                "items__resuelto_por",
                "items__movimiento",
            )
            .all()
        )
        estado = self.request.query_params.get("estado")
        if estado == "pendiente":
            qs = qs.filter(items__estado="pendiente").distinct()
        elif estado in ("aprobada", "rechazada", "resuelta"):
            qs = qs.exclude(items__estado="pendiente").distinct()

        profile = getattr(self.request.user, "account_profile", None)
        if profile and profile.role == AccountProfile.Role.ALMACENERO:
            qs = qs.filter(solicitado_por=self.request.user)
        return qs

    def retrieve(self, request, pk=None, *args, **kwargs):
        """
        Retorna el detalle del grupo.
        Si la PK no pertenece a un GrupoSolicitud, intenta buscar si es el ID de una
        SolicitudMovimiento unitaria y la devuelve envuelta como grupo virtual.
        """
        from django.http import Http404
        grupo = GrupoSolicitud.objects.filter(pk=pk).first()
        if grupo:
            serializer = GrupoSolicitudDetailSerializer(grupo)
            return Response(serializer.data)

        # Fallback a SolicitudMovimiento unitaria
        sol = SolicitudMovimiento.objects.filter(pk=pk).first()
        if sol:
            sol_data = SolicitudMovimientoSerializer(sol).data
            wo_detail = None
            if sol.work_order:
                wo = sol.work_order
                wo_detail = {
                    "id": str(wo.id),
                    "code": wo.code,
                    "status": wo.status,
                    "status_display": wo.get_status_display(),
                    "technician_name": wo.technician.get_full_name() if wo.technician else "No asignado",
                    "supporting_technicians": [t.get_full_name() for t in wo.supporting_technicians.all()],
                }
            virtual_grupo = {
                "id": sol.id,
                "solicitado_por": sol.solicitado_por_id,
                "solicitado_por_nombre": sol.solicitado_por.get_full_name() if sol.solicitado_por else "",
                "work_order": str(sol.work_order_id) if sol.work_order_id else None,
                "work_order_code": sol.work_order.code if sol.work_order else None,
                "work_order_detail": wo_detail,
                "observaciones": sol.observaciones or "",
                "creado_en": sol.creado_en.isoformat(),
                "estado": "pendiente" if sol.estado == "pendiente" else "resuelta",
                "items": [sol_data],
            }
            return Response(virtual_grupo)

        raise Http404("No se encontró el grupo ni la solicitud especificada.")


    def create(self, request, *args, **kwargs):
        """
        Crea un GrupoSolicitud con N SolicitudMovimiento vinculadas.
        Notifica a los administradores 1 sola vez por el grupo completo.
        """
        profile = getattr(request.user, "account_profile", None)
        if not profile or profile.role not in (
            AccountProfile.Role.ALMACENERO, AccountProfile.Role.ADMIN
        ):
            return Response(
                {"detail": "No tienes permisos para crear solicitudes de grupo."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = GrupoSolicitudCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        v_data = serializer.validated_data

        work_order = v_data.get("work_order")
        observaciones_grupo = v_data.get("observaciones", "")
        items_data = v_data["items"]

        from django.db import transaction
        with transaction.atomic():
            grupo = GrupoSolicitud.objects.create(
                solicitado_por=request.user,
                work_order=work_order,
                observaciones=observaciones_grupo,
            )

            solicitudes_creadas = []
            for item in items_data:
                mat_obj = Material.objects.get(pk=item["material"])
                cant_cajas = item.get("cantidad_cajas")
                cant = item.get("cantidad") or 1

                # Resolución de empaque
                if cant_cajas and not item.get("cantidad"):
                    if mat_obj.unidad_manejo == "unidad":
                        raise status.ValidationError({
                            "cantidad_cajas": f"'{mat_obj.nombre}' se maneja por unidad suelta."
                        })
                    if not mat_obj.unidades_por_caja:
                        raise status.ValidationError({
                            "cantidad_cajas": f"'{mat_obj.nombre}' no tiene unidades por empaque configuradas."
                        })
                    cant = cant_cajas * mat_obj.unidades_por_caja

                sol = SolicitudMovimiento.objects.create(
                    grupo=grupo,
                    work_order=work_order,
                    tipo=item["tipo"],
                    material=mat_obj,
                    cantidad=cant,
                    cantidad_cajas=cant_cajas,
                    referencia_externa=work_order.code if work_order else "",
                    observaciones=item.get("observaciones", ""),
                    solicitado_por=request.user,
                )
                solicitudes_creadas.append(sol)

        # ── Notificación UNIFICADA a administradores (1 sola notificación por grupo) ──
        try:
            from apps.notifications.services import queue_for_administrators
            n_items = len(solicitudes_creadas)
            ot_info = f" en OT {work_order.code}" if work_order else ""
            resumen_items = ", ".join(
                f"{s.material.nombre} (x{s.cantidad})" for s in solicitudes_creadas[:3]
            )
            if n_items > 3:
                resumen_items += f" y {n_items - 3} más"

            almacenero_nombre = request.user.get_full_name() or request.user.username

            queue_for_administrators(
                event="SOLICITUD_GRUPO_PENDIENTE",
                subject=f"Solicitud de {n_items} material(es){ot_info} — {almacenero_nombre}",
                body=(
                    f"{almacenero_nombre} solicita salida de {n_items} material(es){ot_info}: "
                    f"{resumen_items}. Revisa y aprueba el grupo."
                ),
                entity=grupo,
                context={
                    "grupoId": grupo.id,
                    "totalItems": n_items,
                    "workOrderCode": work_order.code if work_order else None,
                    "solicitadoPor": almacenero_nombre,
                },
                discriminator=f"grupo-solicitud-{grupo.id}",
            )
        except Exception:
            pass

        detail_ser = GrupoSolicitudDetailSerializer(grupo)
        return Response(detail_ser.data, status=status.HTTP_201_CREATED)

    def _resolve_grupo_items(self, pk):
        """
        Intenta resolver la pk como GrupoSolicitud.
        Si no existe, busca si es la pk de una SolicitudMovimiento unitaria y
        usa sus items directamente (devuelve (None, [solicitud]) para acciones de aprobación).
        Lanza Http404 si no existe ninguna de las dos.
        """
        from django.http import Http404

        grupo = GrupoSolicitud.objects.filter(pk=pk).first()
        if grupo:
            items_pendientes = list(grupo.items.filter(estado=SolicitudMovimiento.Estado.PENDIENTE))
            return grupo, items_pendientes

        # Fallback: SolicitudMovimiento individual
        sol = SolicitudMovimiento.objects.filter(pk=pk).first()
        if sol:
            items_pendientes = [sol] if sol.estado == SolicitudMovimiento.Estado.PENDIENTE else []
            return None, items_pendientes

        raise Http404("No se encontró el grupo ni la solicitud especificada.")

    @action(detail=True, methods=["post"], url_path="aprobar-todos")
    def aprobar_todos(self, request, pk=None):
        """Aprueba todos los items pendientes. Acepta pk de GrupoSolicitud o de SolicitudMovimiento unitaria."""
        profile = getattr(request.user, "account_profile", None)
        if not profile or profile.role != AccountProfile.Role.ADMIN:
            return Response(
                {"detail": "Solo administradores pueden aprobar grupos de solicitudes."},
                status=status.HTTP_403_FORBIDDEN,
            )

        grupo, items_pendientes = self._resolve_grupo_items(pk)

        if not items_pendientes:
            return Response(
                {"detail": "El grupo no tiene items pendientes por aprobar."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        aprobados = []
        errores = []

        from django.db import transaction
        for item in items_pendientes:
            try:
                with transaction.atomic():
                    _ejecutar_solicitud(item, request.user)
                    aprobados.append(item)
            except Exception as exc:
                item_label = item.material.nombre if item.material else (item.pieza.codigo if item.pieza else "Item")
                errores.append(f"{item_label}: {_format_exc_msg(exc)}")

        # Notificar al almacenero (con protección si grupo es None)
        if aprobados:
            try:
                from apps.notifications.services import queue_for_roles
                entity_id = grupo.id if grupo else aprobados[0].id
                subject = f"Solicitud #{entity_id} aprobada"
                body = (
                    f"{len(aprobados)} material(es)/pieza(s) aprobado(s) por "
                    f"{request.user.get_full_name() or request.user.username}."
                )
                entity = grupo if grupo else aprobados[0]
                queue_for_roles(
                    event="SOLICITUD_GRUPO_RESUELTA",
                    roles=[AccountProfile.Role.ALMACENERO],
                    subject=subject,
                    body=body,
                    entity=entity,
                    context={"grupoId": entity_id, "aprobadosCount": len(aprobados)},
                    discriminator=f"grupo-aprobado-todos-{entity_id}",
                )
            except Exception:
                pass

        if errores and not aprobados:
            return Response(
                {"detail": "No se pudo aprobar ningún item.", "errores": errores},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Serializar respuesta según si es grupo real o solicitud individual
        if grupo:
            detail = GrupoSolicitudDetailSerializer(grupo).data
        else:
            items_resueltos = SolicitudMovimiento.objects.filter(
                pk__in=[a.pk for a in aprobados]
            )
            sol_data = SolicitudMovimientoSerializer(items_resueltos, many=True).data
            detail = {
                "id": int(pk),
                "solicitado_por_nombre": aprobados[0].solicitado_por.get_full_name() if aprobados else "",
                "estado": "resuelta",
                "items": sol_data,
            }
        return Response(
            {
                "mensaje": f"Se aprobaron {len(aprobados)} item(s).",
                "errores": errores,
                "grupo": detail,
            }
        )

    @action(detail=True, methods=["post"], url_path="resolver-parcial")
    def resolver_parcial(self, request, pk=None):
        """
        Resuelve individualmente cada item (aprobar o rechazar con motivo_no_entrega).
        Solo ADMINISTRADOR. Acepta pk de GrupoSolicitud o de SolicitudMovimiento unitaria.
        """
        profile = getattr(request.user, "account_profile", None)
        if not profile or profile.role != AccountProfile.Role.ADMIN:
            return Response(
                {"detail": "Solo administradores pueden resolver solicitudes de grupo."},
                status=status.HTTP_403_FORBIDDEN,
            )

        grupo, _ = self._resolve_grupo_items(pk)
        serializer = ResolverParcialGrupoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        decisiones_map = {
            item["solicitud_id"]: item
            for item in serializer.validated_data["items"]
        }

        # Obtener items: desde grupo real o desde solicitudes individuales
        if grupo:
            items_grupo = {item.id: item for item in grupo.items.all()}
        else:
            items_grupo = {
                sol.id: sol
                for sol in SolicitudMovimiento.objects.filter(pk__in=decisiones_map.keys())
            }

        aprobados_count = 0
        rechazados_count = 0
        errores = []

        from django.db import transaction
        for sol_id, dec in decisiones_map.items():
            sol = items_grupo.get(sol_id)
            if not sol:
                continue

            if sol.estado != SolicitudMovimiento.Estado.PENDIENTE:
                continue

            if dec["aprobado"]:
                try:
                    with transaction.atomic():
                        _ejecutar_solicitud(sol, request.user)
                        aprobados_count += 1
                except Exception as exc:
                    item_label = sol.material.nombre if sol.material else (sol.pieza.codigo if sol.pieza else "Item")
                    errores.append(f"{item_label}: {_format_exc_msg(exc)}")
            else:
                sol.estado = SolicitudMovimiento.Estado.RECHAZADA
                sol.motivo_no_entrega = dec.get("motivo_no_entrega", "")
                sol.motivo_rechazo = dec.get("motivo_no_entrega", "")
                sol.resuelto_por = request.user
                sol.resuelto_en = timezone.now()
                sol.save(update_fields=["estado", "motivo_no_entrega", "motivo_rechazo", "resuelto_por", "resuelto_en"])
                rechazados_count += 1

        # Notificación (con protección si grupo es None)
        try:
            from apps.notifications.services import queue_for_roles
            entity_id = grupo.id if grupo else pk
            entity = grupo if grupo else list(items_grupo.values())[0] if items_grupo else None
            subject = f"Solicitud #{entity_id} resuelta"
            body = (
                f"Tu solicitud fue procesada por {request.user.get_full_name() or request.user.username}: "
                f"{aprobados_count} aprobado(s), {rechazados_count} rechazado(s)."
            )
            if entity:
                queue_for_roles(
                    event="SOLICITUD_GRUPO_RESUELTA",
                    roles=[AccountProfile.Role.ALMACENERO],
                    subject=subject,
                    body=body,
                    entity=entity,
                    context={"grupoId": entity_id, "aprobados": aprobados_count, "rechazados": rechazados_count},
                    discriminator=f"grupo-resuelto-parcial-{entity_id}",
                )
        except Exception:
            pass

        # Serializar respuesta
        if grupo:
            detail = GrupoSolicitudDetailSerializer(grupo).data
        else:
            all_items = list(items_grupo.values())
            sol_data = SolicitudMovimientoSerializer(all_items, many=True).data
            detail = {
                "id": int(pk),
                "estado": "resuelta",
                "items": sol_data,
            }
        return Response(
            {
                "mensaje": f"Se procesó la solicitud: {aprobados_count} aprobado(s), {rechazados_count} rechazado(s).",
                "errores": errores,
                "grupo": detail,
            }
        )