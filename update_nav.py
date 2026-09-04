with open('frontend/src/components/navigation/navData.ts', 'r', encoding='utf-8') as f:
    content = f.read()

import re
content = re.sub(r'\{\s*to:\s*"/incidencias/nueva",[^}]+\},', '', content)

with open('frontend/src/components/navigation/navData.ts', 'w', encoding='utf-8') as f:
    f.write(content)
