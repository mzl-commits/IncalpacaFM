import os

def fix_encoding(filepath):
    with open(filepath, 'rb') as f:
        raw = f.read()
    
    if raw.startswith(b'\xef\xbb\xbf'):
        raw = raw[3:]
        
    text = raw.decode('utf-8')
    try:
        original_bytes = text.encode('windows-1252')
        fixed_text = original_bytes.decode('utf-8')
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(fixed_text)
        print(f"Fixed {filepath}")
    except Exception as e:
        print(f"Skipping {filepath}: {e}")

files = [
    r"frontend\src\modules\incidents\pages\PublicWorkRequestPage.tsx",
    r"frontend\src\modules\incidents\components\publicWorkRequestUtils.ts",
    r"frontend\src\modules\workorders\pages\WorkOrderDetailPage.tsx",
    r"frontend\src\modules\workorders\pages\workOrderDetailUtils.ts",
    r"frontend\src\modules\almacen\pages\InspeccionFormPage.tsx",
    r"frontend\src\modules\almacen\components\InspeccionObservacionesTable.tsx",
    r"frontend\src\modules\almacen\components\InspeccionCriteriosList.tsx"
]

for f in files:
    if os.path.exists(f):
        fix_encoding(f)
