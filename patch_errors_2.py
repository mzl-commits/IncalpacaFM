import re

path_pdf = r"c:\Users\Asus TUF F15\incalpacafm\sgtb-incalpaca\frontend\src\modules\reports\utils\workOrderReportPdf.ts"
with open(path_pdf, "r", encoding="utf-8") as f:
    content = f.read()

content = re.sub(r'\$\{m\.name \|\| m\.description \|\| "[^"]*"\}', '${m.materialNombre || "-"}', content)
content = re.sub(r'\$\{m\.notes \|\| "[^"]*"\}', '${m.clasificacionOperativaLabel || "-"}', content)
content = re.sub(r'\$\{order\.description \|\| "[^"]*"\}', '${order.administratorNotes || "-"}', content)

with open(path_pdf, "w", encoding="utf-8") as f:
    f.write(content)
