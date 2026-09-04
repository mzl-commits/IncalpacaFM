import sys

def apply_refactor(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    utils_lines = ["import type { WorkOrder } from '@/modules/workorders/types';\n", "import { type WorkOrderStatus } from '@/modules/workorders/workOrderModel';\n\n"] + lines[37:229]
    with open('frontend/src/modules/workorders/pages/workOrderDetailUtils.ts', 'w', encoding='utf-8') as f:
        f.writelines(utils_lines)
        
    imports = "import { statusClass, formatDate, todayKey, formatDateTime, formatWorkDuration, formatMinutesDuration, getTextValue, getRatingLabel, getCorrectionSchedule, getValidationLabel, getServiceOrderDetails, getStringList, getServiceStatusCopy, type PlanningForm } from './workOrderDetailUtils';\n"
    
    new_lines = lines[0:37] + [imports] + lines[229:]
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)

apply_refactor('frontend/src/modules/workorders/pages/WorkOrderDetailPage.tsx')
