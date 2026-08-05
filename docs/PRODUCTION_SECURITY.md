# Configuración segura de producción

El archivo `.env.example` sigue listo para desarrollo local. Para producción no reutilices sus valores. Define como mínimo:

```env
DJANGO_ENV=production
DJANGO_DEBUG=0
DJANGO_SECRET_KEY=<cadena aleatoria de 50+ caracteres>
DJANGO_ALLOWED_HOSTS=sgtb.incalpaca.pe
CSRF_TRUSTED_ORIGINS=https://sgtb.incalpaca.pe
CORS_ALLOWED_ORIGINS=https://sgtb.incalpaca.pe
SECURE_SSL_REDIRECT=1
SECURE_HSTS_SECONDS=31536000
PUBLIC_FRONTEND_URL=https://sgtb.incalpaca.pe
```

El arranque se rechaza en producción si quedan `DEBUG=1`, el secreto local, hosts locales o no se declara el origen CSRF. Django activa cookies seguras, SameSite, HSTS, `X-Frame-Options: DENY`, `nosniff` y referrer policy. El middleware añade CSP y Permissions-Policy.

El proxy inverso debe terminar TLS, redirigir HTTP a HTTPS y enviar `X-Forwarded-Proto: https`. Ajusta `CONTENT_SECURITY_POLICY` sólo si se incorpora un origen externo justificado; no uses comodines.
