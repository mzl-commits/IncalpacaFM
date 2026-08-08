from django.conf import settings


class ContentSecurityPolicyMiddleware:
    """Minimal CSP without an extra dependency; policy is configured by environment."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        policy = settings.CONTENT_SECURITY_POLICY
        if policy:
            response.headers.setdefault("Content-Security-Policy", policy)
        response.headers.setdefault("Permissions-Policy", "geolocation=(), microphone=(), camera=(self), payment=(), usb=()")
        response.headers.setdefault("Cross-Origin-Opener-Policy", "same-origin")
        return response
