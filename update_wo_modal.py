import re

with open('frontend/src/modules/workorders/components/WorkOrderCreateModal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('operatorId: defaultOperator?.id ?? "",', 'operatorId: "",')
content = content.replace('scheduledDate: new Date().toISOString().split("T")[0],', 'scheduledDate: "",')

content = content.replace('status: "PROGRAMADA",', 'status: (!orderForm.operatorId || !scheduledDate) ? "PENDIENTE_REPROGRAMACION" : "PROGRAMADA",')

content = re.sub(r'<select\s+required\s+value=\{orderForm.operatorId\}', r'<select\n                      value={orderForm.operatorId}', content)
content = re.sub(r'<input\s+type="date"\s+required\s+value=\{orderForm.scheduledDate\}', r'<input\n                        type="date"\n                        value={orderForm.scheduledDate}', content)

with open('frontend/src/modules/workorders/components/WorkOrderCreateModal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
