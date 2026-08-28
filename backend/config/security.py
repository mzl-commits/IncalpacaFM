from django.conf import settings

# Rutas que quedan exentas del CSP estricto (Swagger UI necesita CDN externos)
_CSP_EXEMPT_PREFIXES = ("/api/docs/", "/api/schema/")


class ContentSecurityPolicyMiddleware:
    """Minimal CSP without an extra dependency; policy is configured by environment."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        # No aplicar CSP en las rutas de Swagger para que cargue correctamente
        if any(request.path.startswith(prefix) for prefix in _CSP_EXEMPT_PREFIXES):
            return response

        policy = settings.CONTENT_SECURITY_POLICY
        if policy:
            response.headers.setdefault("Content-Security-Policy", policy)
        response.headers.setdefault("Permissions-Policy", "geolocation=(), microphone=(), camera=(self), payment=(), usb=()")
        response.headers.setdefault("Cross-Origin-Opener-Policy", "same-origin")
        return response
