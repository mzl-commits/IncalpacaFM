with open('frontend/src/modules/workorders/components/WorkOrderCreateModal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('Técnico asignado *', 'Técnico asignado (Opcional)')
content = content.replace('Fecha programada *', 'Fecha programada (Opcional)')
content = content.replace('disabled={!orderForm.operatorId}', 'disabled={false}')

with open('frontend/src/modules/workorders/components/WorkOrderCreateModal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
