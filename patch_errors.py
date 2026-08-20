import re

path_pdf = r"c:\Users\Asus TUF F15\incalpacafm\sgtb-incalpaca\frontend\src\modules\reports\utils\workOrderReportPdf.ts"
with open(path_pdf, "r", encoding="utf-8") as f:
    content = f.read()

# Fix material
content = content.replace('${m.name || m.description || "?"}', '${m.materialNombre || "?"}')
content = content.replace('${m.quantity ?? 1}', '${m.cantidad ?? 1}')
content = content.replace('${m.unit || "Unid."}', 'Unid.')
content = content.replace('${m.notes || "?"}', '${m.clasificacionOperativaLabel || "?"}')

# Fix WorkOrder
content = content.replace('${order.orderTypeLabel || "MANTENIMIENTO"}', '${order.orderType || "MANTENIMIENTO"}')
content = content.replace('${order.incidentCode || "Directa"}', '${order.requestCode || "Directa"}')
content = content.replace('${order.specificLocation || order.zone || "Planta Incalpaca"}', '${order.assetDisplayCode || order.assetCode || "Planta Incalpaca"}')
content = content.replace('${order.description || "Mantenimiento preventivo / correctivo."}', '${order.administratorNotes || "Mantenimiento preventivo / correctivo."}')

with open(path_pdf, "w", encoding="utf-8") as f:
    f.write(content)

path_tax = r"c:\Users\Asus TUF F15\incalpacafm\sgtb-incalpaca\frontend\src\modules\taxonomy\components\TaxonomyInspector.tsx"
with open(path_tax, "r", encoding="utf-8") as f:
    content_tax = f.read()

content_tax = content_tax.replace('(node as TaxonomyTreePart).parentId', '(node as any).parentId')
content_tax = content_tax.replace('(node as TaxonomyTreePiece).parentId', '(node as any).parentId')

with open(path_tax, "w", encoding="utf-8") as f:
    f.write(content_tax)
