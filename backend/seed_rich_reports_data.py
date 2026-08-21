import os
import sys
import django
from datetime import datetime, timezone, timedelta

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from apps.assets.models import (
    Asset,
    AssetAssignment,
    AssignableResponsible,
    Location,
    Taxonomy,
)
from django.contrib.auth import get_user_model

User = get_user_model()
admin_user = User.objects.filter(username="admin").first() or User.objects.first()

print("--- Actualizando y enriqueciendo datos de prueba para Reportes Incalpaca ---")

# 1. Asegurar Responsables Reales
resp_data = [
    {
        "code": "TRAB-4082",
        "name": "Rosa Medina Gutiérrez",
        "type": "PERSON",
        "area": "Facility Management",
        "cost_center": "CC-1040 (ADMINISTRACIÓN & MKT)",
        "email": "rmedina@incalpaca.com",
    },
    {
        "code": "TRAB-3019",
        "name": "Luis Fernández Paredes",
        "type": "PERSON",
        "area": "Mantenimiento e Infraestructura",
        "cost_center": "CC-2010 (OPERACIONES & FM)",
        "email": "lfernandez@incalpaca.com",
    },
    {
        "code": "TRAB-1055",
        "name": "Mariela Quispe Flores",
        "type": "PERSON",
        "area": "Sistemas e Informática",
        "cost_center": "CC-3050 (TECNOLOGÍA & TI)",
        "email": "mquispe@incalpaca.com",
    },
    {
        "code": "TRAB-5120",
        "name": "Carlos Mendoza Valdivia",
        "type": "PERSON",
        "area": "Logística y Almacenes",
        "cost_center": "CC-4010 (CADENA DE SUMINISTRO)",
        "email": "cmendoza@incalpaca.com",
    },
]

responsibles = {}
for r in resp_data:
    resp_obj, created = AssignableResponsible.objects.update_or_create(
        external_reference=r["code"],
        defaults={
            "display_name": r["name"],
            "type": r["type"],
            "area_name": r["area"],
            "active": True,
        }
    )
    responsibles[r["code"]] = resp_obj
    print(f"Responsable: {r['name']} [{r['code']}] {'creado' if created else 'actualizado'}")

# 2. Asegurar Ubicaciones Institucionales
locations_data = [
    {
        "code": "LOC-FM-01",
        "site": "INCALPACA (Sede Principal)",
        "zone": "Sector Administrativo",
        "building": "Edificio Casona",
        "area": "Facility Management",
        "room": "Oficina 204 (Módulo de Trabajo 04)",
        "specific_location": "Puesto 04 · Gerencia Técnica",
    },
    {
        "code": "LOC-TI-01",
        "site": "INCALPACA (Sede Principal)",
        "zone": "Sector Administrativo",
        "building": "Edificio Casona",
        "area": "Sistemas e Informática",
        "room": "Oficina 102 (Desarrollo & Infraestructura)",
        "specific_location": "Mesa Técnica 02",
    },
    {
        "code": "LOC-MAN-01",
        "site": "INCALPACA (Sede Principal)",
        "zone": "Zona Industrial",
        "building": "Planta Principal Sachaca",
        "area": "Mantenimiento e Infraestructura",
        "room": "Taller Central de FM",
        "specific_location": "Banco de Trabajo Mecánico 01",
    },
    {
        "code": "LOC-LOG-01",
        "site": "INCALPACA (Sede Principal)",
        "zone": "Zona Industrial",
        "building": "Centro de Distribución",
        "area": "Logística y Almacenes",
        "room": "Almacén Central de Repuestos",
        "specific_location": "Rack A-04 Nivel 2",
    },
]

locations = {}
for l in locations_data:
    loc_obj, created = Location.objects.update_or_create(
        location_code=l["code"],
        defaults={
            "site": l["site"],
            "zone": l["zone"],
            "building": l["building"],
            "area": l["area"],
            "room": l["room"],
            "specific_location": l["specific_location"],
            "active": True,
        }
    )
    locations[l["code"]] = loc_obj

# 3. Datos enriquecidos para Activos
assets_data = [
    {
        "code": "INC-BIEN-2026-000188",
        "name": "Silla Ergonómica Ejecutiva Tipo 1",
        "brand": "Forma",
        "model": "ErgoMax 2026 Pro",
        "serial_number": "SN-FM-2026-00188",
        "condition": "Excelente",
        "criticality": "Media",
        "administrative_status": "Operativo",
        "assignment_status": "Asignado",
        "description": "Silla ergonómica de alta gama con respaldo de malla transpirable, soporte lumbar regulable 3D y base de nylon reforzado con ruedas silenciosas.",
        "location": locations["LOC-FM-01"],
        "responsible": responsibles["TRAB-4082"],
        "tax_code": "INC1-AD-MKT-MT04-MOB-SE-BA-6A-SKU10",
        "payload": {
            "site": "INCALPACA (Calle Cóndor 100, Sachaca, Arequipa)",
            "site_code": "INC1",
            "macro_area": "Sectores Administrativos",
            "macro_area_code": "AD",
            "area": "Facility Management & Marketing",
            "area_code": "MKT",
            "locationArea": "Facility Management & Marketing",
            "building": "Edificio Casona",
            "building_code": "ADC",
            "room": "Oficina 204 (Módulo de Trabajo 04)",
            "room_code": "MT04",
            "specificLocation": "Puesto 04 · Gerencia Técnica",
            "family": "Mobiliario Corporativo",
            "family_code": "MOB",
            "category": "Mobiliario Corporativo",
            "subcategory": "Silla Ergonómica",
            "type": "Silla Ergonómica Ejecutiva",
            "type_code": "SE",
            "part": "Base Giratoria con Pistón Neumático",
            "part_code": "BA",
            "piece": "Garrucha (Rueda de Nylon de Alta Resistencia)",
            "piece_code": "6A",
            "sku": "SKU10",
            "n1_code": "INC1",
            "n2_code": "AD",
            "n3_code": "MKT",
            "n4_code": "MT04",
            "n5_code": "MOB",
            "n6_code": "SE",
            "n7_code": "BA",
            "n8_code": "6A",
            "n9_code": "SKU10",
            "entryType": "purchase",
            "effectiveEntryDate": "2026-01-15",
            "supplier": "Forma y Espacios S.A.",
            "purchaseOrder": "OC-2026-00418",
            "voucherNumber": "F001-0008492",
            "acquisitionDate": "2026-01-12",
            "cost": "850.00",
            "currency": "PEN",
            "costCenter": "CC-1040 (ADMINISTRACIÓN & MKT)",
            "registeredBy": "Rosa Medina (Control Patrimonial FM)",
            "assigneeId": "TRAB-4082",
            "assigneeName": "Rosa Medina Gutiérrez",
            "workerCode": "TRAB-4082",
            "responsibleName": "Rosa Medina Gutiérrez",
            "assignmentDate": "2026-01-20",
            "assignmentReason": "Asignación inicial de puesto de trabajo y custodia operativa.",
            "assignmentObservations": "El bien se entrega nuevo, verificado y calibrado ergonómicamente.",
            "observations": "Recepción conforme en almacén central con guía de remisión física sellada.",
            "evidence": [
                {"id": "DOC-01", "name": "Factura_F001-0008492.pdf", "category": "factura", "size": 184320},
                {"id": "DOC-02", "name": "Guia_Remision_GR-00241.pdf", "category": "guia", "size": 128000},
                {"id": "DOC-03", "name": "Ficha_Tecnica_ErgoMax.pdf", "category": "especificacion", "size": 312000},
            ]
        }
    },
    {
        "code": "INC-BIEN-2026-000189",
        "name": "Laptop Lenovo ThinkPad T14 Gen 4",
        "brand": "Lenovo",
        "model": "ThinkPad T14 Gen 4 Core i7 32GB 1TB",
        "serial_number": "PF-49X82Z-2026",
        "condition": "Excelente",
        "criticality": "Alta",
        "administrative_status": "Operativo",
        "assignment_status": "Asignado",
        "description": "Estación de trabajo portátil para administración de sistemas, modelado BIM y control de instalaciones.",
        "location": locations["LOC-TI-01"],
        "responsible": responsibles["TRAB-1055"],
        "tax_code": "INC1-AD-SIS-OF02-EQC-LAP-PL-MB-SKU05",
        "payload": {
            "site": "INCALPACA (Calle Cóndor 100, Sachaca, Arequipa)",
            "site_code": "INC1",
            "macro_area": "Sectores Administrativos",
            "macro_area_code": "AD",
            "area": "Sistemas e Informática",
            "area_code": "SIS",
            "locationArea": "Sistemas e Informática",
            "building": "Edificio Casona",
            "building_code": "ADC",
            "room": "Oficina 102 (Desarrollo & Infraestructura)",
            "room_code": "OF02",
            "specificLocation": "Mesa Técnica 02",
            "family": "Equipos de Cómputo",
            "family_code": "EQC",
            "category": "Equipos de Cómputo",
            "subcategory": "Laptop Corporativa",
            "type": "Laptop ThinkPad",
            "type_code": "LAP",
            "part": "Placa Base y Procesador",
            "part_code": "PL",
            "piece": "Módulo Motherboard Integrado",
            "piece_code": "MB",
            "sku": "SKU05",
            "n1_code": "INC1",
            "n2_code": "AD",
            "n3_code": "SIS",
            "n4_code": "OF02",
            "n5_code": "EQC",
            "n6_code": "LAP",
            "n7_code": "PL",
            "n8_code": "MB",
            "n9_code": "SKU05",
            "entryType": "purchase",
            "effectiveEntryDate": "2026-02-01",
            "supplier": "Lenovo Perú S.R.L.",
            "purchaseOrder": "OC-2026-00512",
            "voucherNumber": "E001-0049210",
            "acquisitionDate": "2026-01-28",
            "cost": "5400.00",
            "currency": "PEN",
            "costCenter": "CC-3050 (TECNOLOGÍA & TI)",
            "registeredBy": "Mariela Quispe (Supervisor TI)",
            "assigneeId": "TRAB-1055",
            "assigneeName": "Mariela Quispe Flores",
            "workerCode": "TRAB-1055",
            "responsibleName": "Mariela Quispe Flores",
            "assignmentDate": "2026-02-05",
            "assignmentReason": "Asignación de equipo de cómputo para desarrollo y monitoreo del SGTB.",
            "assignmentObservations": "Equipo entregado con cargador original 65W USB-C, funda protectora y mouse inalámbrico.",
            "observations": "Garantía oficial Lenovo Premier Support por 36 meses registrada en portal corporativo.",
            "evidence": [
                {"id": "DOC-11", "name": "Factura_Electronica_E001-0049210.pdf", "category": "factura", "size": 245000},
                {"id": "DOC-12", "name": "Acta_Entrega_TI_2026-02.pdf", "category": "acta", "size": 189000},
            ]
        }
    },
    {
        "code": "INC-BIEN-2026-000190",
        "name": "Estante Modular de Almacenamiento Pesado",
        "brand": "Incalpaca",
        "model": "ModuRack 5N Industrial",
        "serial_number": "MR-IND-2026-0190",
        "condition": "Bueno",
        "criticality": "Media",
        "administrative_status": "Operativo",
        "assignment_status": "Asignado",
        "description": "Estantería metálica de 5 niveles fabricada en maestranza para soporte de repuestos pesados y herramientas especiales.",
        "location": locations["LOC-MAN-01"],
        "responsible": responsibles["TRAB-3019"],
        "tax_code": "INC1-OP-MAN-TL01-EST-EST-CR-5N-SKU02",
        "payload": {
            "site": "INCALPACA (Calle Cóndor 100, Sachaca, Arequipa)",
            "site_code": "INC1",
            "macro_area": "Operaciones y Mantenimiento",
            "macro_area_code": "OP",
            "area": "Mantenimiento e Infraestructura",
            "area_code": "MAN",
            "locationArea": "Mantenimiento e Infraestructura",
            "building": "Planta Principal Sachaca",
            "building_code": "PLT",
            "room": "Taller Central de FM",
            "room_code": "TL01",
            "specificLocation": "Banco de Trabajo Mecánico 01",
            "family": "Estructuras y Almacenamiento",
            "family_code": "EST",
            "category": "Estructuras y Almacenamiento",
            "subcategory": "Estante Industrial",
            "type": "Estante Metálico Modular",
            "type_code": "EST",
            "part": "Cuerpo Principal Ranurado",
            "part_code": "CR",
            "piece": "Bandeja Galvanizada de Carga",
            "piece_code": "5N",
            "sku": "SKU02",
            "n1_code": "INC1",
            "n2_code": "OP",
            "n3_code": "MAN",
            "n4_code": "TL01",
            "n5_code": "EST",
            "n6_code": "EST",
            "n7_code": "CR",
            "n8_code": "5N",
            "n9_code": "SKU02",
            "entryType": "own_creation",
            "effectiveEntryDate": "2026-02-10",
            "supplier": "Taller de Maestranza Incalpaca",
            "purchaseOrder": "OT-INT-2026-089",
            "voucherNumber": "OT-FAB-0089",
            "acquisitionDate": "2026-02-08",
            "cost": "1250.00",
            "currency": "PEN",
            "costCenter": "CC-2010 (OPERACIONES & FM)",
            "registeredBy": "Luis Fernández (Técnico Mecánico)",
            "assigneeId": "TRAB-3019",
            "assigneeName": "Luis Fernández Paredes",
            "workerCode": "TRAB-3019",
            "responsibleName": "Luis Fernández Paredes",
            "assignmentDate": "2026-02-12",
            "assignmentReason": "Custodia y administración de herramientas del taller de mantenimiento.",
            "assignmentObservations": "Estructura anclada a piso y pared conforme a norma de seguridad industrial.",
            "observations": "Fabricación con perfiles estructurales de 2mm y pintura electrostática gris.",
            "evidence": [
                {"id": "DOC-21", "name": "Orden_Fabricacion_Interna.pdf", "category": "orden", "size": 156000},
                {"id": "DOC-22", "name": "Informe_Inspeccion_Seguridad.pdf", "category": "informe", "size": 210000},
            ]
        }
    },
    {
        "code": "INC-BIEN-2026-000215",
        "name": "Compresor de Aire Industrial Schulz 500L",
        "brand": "Schulz",
        "model": "Max MSV 40 Max/500",
        "serial_number": "SCH-500-2026-9812",
        "condition": "Nuevo",
        "criticality": "Alta",
        "administrative_status": "Operativo",
        "assignment_status": "Asignado",
        "description": "Compresor de aire a pistón de alta presión con tanque de 500 litros y motor trifásico de 10 HP para líneas de neumática.",
        "location": locations["LOC-LOG-01"],
        "responsible": responsibles["TRAB-5120"],
        "tax_code": "INC1-OP-LOG-AL01-MAQ-CMP-TK-50-SKU01",
        "payload": {
            "site": "INCALPACA (Calle Cóndor 100, Sachaca, Arequipa)",
            "site_code": "INC1",
            "macro_area": "Operaciones y Logística",
            "macro_area_code": "OP",
            "area": "Logística y Almacenes",
            "area_code": "LOG",
            "locationArea": "Logística y Almacenes",
            "building": "Centro de Distribución",
            "building_code": "CDI",
            "room": "Almacén Central de Repuestos",
            "room_code": "AL01",
            "specificLocation": "Área de Compresores Neumáticos",
            "family": "Maquinaria e Instalaciones",
            "family_code": "MAQ",
            "category": "Maquinaria e Instalaciones",
            "subcategory": "Compresores Industriales",
            "type": "Compresor a Pistón",
            "type_code": "CMP",
            "part": "Tanque de Almacenamiento a Presión",
            "part_code": "TK",
            "piece": "Válvula de Seguridad y Manómetro",
            "piece_code": "50",
            "sku": "SKU01",
            "n1_code": "INC1",
            "n2_code": "OP",
            "n3_code": "LOG",
            "n4_code": "AL01",
            "n5_code": "MAQ",
            "n6_code": "CMP",
            "n7_code": "TK",
            "n8_code": "50",
            "n9_code": "SKU01",
            "entryType": "purchase",
            "effectiveEntryDate": "2026-02-15",
            "supplier": "Distribuidora Industrial del Sur S.A.C.",
            "purchaseOrder": "OC-2026-00620",
            "voucherNumber": "F002-0019283",
            "acquisitionDate": "2026-02-11",
            "cost": "12800.00",
            "currency": "PEN",
            "costCenter": "CC-4010 (CADENA DE SUMINISTRO)",
            "registeredBy": "Carlos Mendoza (Supervisor Logística)",
            "assigneeId": "TRAB-5120",
            "assigneeName": "Carlos Mendoza Valdivia",
            "workerCode": "TRAB-5120",
            "responsibleName": "Carlos Mendoza Valdivia",
            "assignmentDate": "2026-02-18",
            "assignmentReason": "Asignación para suministro de aire comprimido a líneas de empaque.",
            "assignmentObservations": "Equipo probado a 175 PSI, nivel de aceite verificado y purga automática operativa.",
            "observations": "Incluye certificado de prueba hidrostática vigente por 5 años.",
            "evidence": [
                {"id": "DOC-31", "name": "Factura_F002-0019283.pdf", "category": "factura", "size": 298000},
                {"id": "DOC-32", "name": "Certificado_Prueba_Hidrostatica.pdf", "category": "certificado", "size": 412000},
            ]
        }
    },
]

for ad in assets_data:
    asset_obj = Asset.objects.filter(code=ad["code"]).first()
    if not asset_obj:
        asset_obj = Asset(code=ad["code"])
    
    # Despejar colisiones de serial_number si existen en otros activos
    if asset_obj.id:
        Asset.objects.exclude(id=asset_obj.id).filter(serial_number=ad["serial_number"]).update(
            serial_number=f"{ad['serial_number']}-OLD"
        )
    else:
        Asset.objects.filter(serial_number=ad["serial_number"]).update(
            serial_number=f"{ad['serial_number']}-OLD"
        )

    asset_obj.name = ad["name"]
    asset_obj.brand = ad["brand"]
    asset_obj.model = ad["model"]
    asset_obj.serial_number = ad["serial_number"]
    asset_obj.condition = ad["condition"]
    asset_obj.criticality = ad["criticality"]
    asset_obj.administrative_status = ad["administrative_status"]
    asset_obj.assignment_status = ad["assignment_status"]
    asset_obj.description = ad["description"]
    asset_obj.location = ad["location"]
    asset_obj.entry_payload = ad["payload"]
    asset_obj.registered_by = admin_user
    asset_obj.save()

    # Actualizar o crear asignación activa en AssetAssignment
    AssetAssignment.objects.filter(asset=asset_obj).update(status="FINALIZADA")
    AssetAssignment.objects.create(
        asset=asset_obj,
        responsible=ad["responsible"],
        location=ad["location"],
        start_date=datetime(2026, 1, 20, 8, 0, tzinfo=timezone.utc),
        end_date=None,
        status="ACTIVA",
        change_reason=ad["payload"]["assignmentReason"],
        registered_by=admin_user,
    )
    print(f"Bien enriquecido con datos completos: {ad['code']} - {ad['name']}")

# También enriquecer los demás bienes para que tengan todos sus datos completos
for a in Asset.objects.exclude(code__in=[ad["code"] for ad in assets_data]):
    p = a.entry_payload or {}
    updated = False
    
    if not p.get("site"):
        p["site"] = "INCALPACA (Calle Cóndor 100, Sachaca, Arequipa)"
        p["site_code"] = "INC1"
        updated = True
    if not p.get("macro_area"):
        p["macro_area"] = "Sectores Administrativos"
        p["macro_area_code"] = "AD"
        updated = True
    if not p.get("supplier"):
        p["supplier"] = "Forma y Espacios S.A."
        updated = True
    if not p.get("purchaseOrder"):
        p["purchaseOrder"] = "OC-2026-00418"
        updated = True
    if not p.get("voucherNumber"):
        p["voucherNumber"] = "F001-0008492"
        updated = True
    if not p.get("cost"):
        p["cost"] = "850.00"
        p["currency"] = "PEN"
        updated = True
    if not p.get("costCenter"):
        p["costCenter"] = "CC-1040 (ADMINISTRACIÓN & MKT)"
        updated = True
    if not p.get("registeredBy"):
        p["registeredBy"] = "Rosa Medina (Control Patrimonial FM)"
        updated = True
    if not p.get("assigneeName") or p.get("assigneeName") == "Sin asignar":
        p["assigneeName"] = "Rosa Medina Gutiérrez"
        p["workerCode"] = "TRAB-4082"
        p["assigneeId"] = "TRAB-4082"
        p["assignmentReason"] = "Asignación de funciones y custodia patrimonial."
        p["assignmentObservations"] = "Bien operativo entregado conforme."
        updated = True
    
    if updated or not a.entry_payload:
        a.entry_payload = p
        a.brand = a.brand or "Forma"
        a.model = a.model or "ErgoMax 2026"
        a.serial_number = a.serial_number or f"SN-{a.code[-4:]}"
        a.save()
        
        # Asignar si no tiene activa
        if not a.assignments.filter(status="ACTIVA").exists():
            AssetAssignment.objects.create(
                asset=a,
                responsible=responsibles["TRAB-4082"],
                location=locations["LOC-FM-01"],
                start_date=datetime(2026, 1, 20, 8, 0, tzinfo=timezone.utc),
                end_date=None,
                status="ACTIVA",
                change_reason=p["assignmentReason"],
                registered_by=admin_user,
            )
        print(f"Bien complementado con datos institucionales: {a.code}")

print("\n--- Todos los datos de prueba institucionales han sido cargados exitosamente ---")
