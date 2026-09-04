with open('frontend/src/modules/incidents/pages/IncidentListPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

import re
# Remove the Link entirely
content = re.sub(r'<Link\s+className="button button-primary"\s+to="/incidencias/nueva".*?>.*?Nueva solicitud\s*</Link>', '', content, flags=re.DOTALL)

with open('frontend/src/modules/incidents/pages/IncidentListPage.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
