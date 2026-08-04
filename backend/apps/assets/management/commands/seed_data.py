from django.core.management import call_command
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Alias compatible para cargar los datos oficiales de demostración del SGTB."

    def handle(self, *args, **options):
        self.stdout.write("Ejecutando el seed oficial del SGTB...")
        call_command("seed_demo_data")
