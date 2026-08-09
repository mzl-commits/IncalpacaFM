import os
import sys
import django
from datetime import timedelta
from django.utils import timezone

# Configurar el entorno de Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.contrib.auth import get_user_model
from apps.assets.models import Asset
from apps.catalogo.models import Material, Categoria, Subcategoria
from apps.inventario.models import Almacen, Stock
from apps.assignments.models import Assignment, AssignmentItem
from apps.incidents.models import Incident
from apps.workorders.models import WorkOrder
from apps.lifecycle.models import TechnicalDiagnosis, AssetRetirement

User = get_user_model()

def run_qa_lifecycle():
    print("Iniciando prueba QA de ciclo de vida completo (Backend E2E)...")
    
    # 1. Preparar datos maestros
    print("1. Preparando datos maestros...")
    admin, _ = User.objects.get_or_create(username="qa_admin", defaults={"email": "qa@test.com", "first_name": "QA"})
    admin.set_password("password123")
    admin.save()
    
    almacen, _ = Almacen.objects.get_or_create(codigo="ALM-QA", defaults={"nombre": "Almacén QA", "direccion": "QA St"})
    
    cat, _ = Categoria.objects.get_or_create(nombre="Equipos QA", defaults={"prefijo": "QA"})
    subcat, _ = Subcategoria.objects.get_or_create(categoria=cat, nombre="Sub Equipos QA")
    
    material, _ = Material.objects.get_or_create(
        codigo="MAT-QA-01",
        defaults={
            "nombre": "Material QA",
            "subcategoria": subcat,
            "marca": "QA Brand",
            "modelo": "QA Model",
            "medida": "UN",
            "tipo_control": "no_retornable"
        }
    )
    
    # 2. Recepción en Almacén (Creación de Bien)
    print("2. Creación de Bien...")
    asset = Asset.objects.create(
        code="AST-QA-001",
        name="Bien QA de Prueba",
        type="EQUIPMENT",
        status="AVAILABLE"
    )
    
    stock, _ = Stock.objects.get_or_create(
        warehouse=almacen,
        material=material,
        defaults={"quantity": 1}
    )
    
    # 3. Asignación del Bien
    print("3. Asignación del Bien...")
    assignment = Assignment.objects.create(
        code="ASG-QA-001",
        assignee_name="Usuario QA",
        assignee_document="12345678",
        status="ACTIVE",
        assigned_by=admin
    )
    AssignmentItem.objects.create(
        assignment=assignment,
        asset=asset,
        condition="NEW"
    )
    asset.status = "IN_USE"
    asset.save()
    
    # 4. Reporte de Incidencia (QR)
    print("4. Reporte de Incidencia...")
    incident = Incident.objects.create(
        code="INC-QA-001",
        asset=asset,
        reporter_name="Usuario QA",
        description="Falla detectada durante QA",
        status="PENDING",
        impact="LOW"
    )
    
    # 5. Creación de Orden de Trabajo
    print("5. Creación de OT...")
    ot = WorkOrder.objects.create(
        code="OT-QA-001",
        asset=asset,
        incident=incident,
        title="Revisión de Falla QA",
        type="CORRECTIVE",
        priority="HIGH",
        status="PENDING"
    )
    incident.status = "IN_PROGRESS"
    incident.save()
    
    ot.status = "IN_PROGRESS"
    ot.save()
    
    # 6. Diagnóstico Técnico
    print("6. Diagnóstico Técnico...")
    diagnosis = TechnicalDiagnosis.objects.create(
        work_order=ot,
        asset=asset,
        technician=admin,
        result="IRREPARABLE",
        description="El bien QA no tiene reparación, se sugiere baja."
    )
    
    # 7. Baja del Bien
    print("7. Baja del Bien...")
    retirement = AssetRetirement.objects.create(
        code="RET-QA-001",
        asset=asset,
        diagnosis=diagnosis,
        requested_by=admin,
        decision_reason="Falla catastrófica QA",
        status="APPROVED",
        approved_by=admin,
        approved_at=timezone.now()
    )
    asset.status = "RETIRED"
    asset.save()
    
    print("✅ Prueba QA de ciclo de vida completada con éxito.")
    print(f"   Asset: {asset.code} - {asset.status}")
    print(f"   OT: {ot.code}")
    print(f"   Incidencia: {incident.code}")
    print(f"   Baja: {retirement.code}")

if __name__ == "__main__":
    try:
        run_qa_lifecycle()
    except Exception as e:
        print(f"❌ Error durante QA: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
