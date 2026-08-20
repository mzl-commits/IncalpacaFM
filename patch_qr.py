import re

with open(r'c:\Users\Asus TUF F15\incalpacafm\sgtb-incalpaca\frontend\src\modules\assets\pages\AssetQrInventoryPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

target = """.brand-logo span {
            font-size: ${format === PRINT_FORMATS.COMPACT ? 7 : format === PRINT_FORMATS.STANDARD ? 9 : 11}px;
            font-weight: 800;
            letter-spacing: 0.05em;
            color: #000;
            line-height: 1;
          }
          strong { 
            font-family: "Courier New", Courier, monospace;
            margin: 0 0 ${format === PRINT_FORMATS.COMPACT ? 1 : 1.5}mm 0; 
            font-size: ${format === PRINT_FORMATS.COMPACT ? 9 : format === PRINT_FORMATS.STANDARD ? 13 : 15}px; 
            line-height: 1.1; 
            font-weight: 800;
            letter-spacing: -0.02em;
          }
          .name { 
            font-size: ${format === PRINT_FORMATS.COMPACT ? 7 : format === PRINT_FORMATS.STANDARD ? 9 : 11}px; 
            font-weight: 600; 
            line-height: 1.2;
            color: #333;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            margin-bottom: 1mm;
          }"""

replacement = """.brand-logo span {
            font-size: ${format === PRINT_FORMATS.COMPACT ? 5.5 : format === PRINT_FORMATS.STANDARD ? 9 : 11}px;
            font-weight: 800;
            letter-spacing: 0.05em;
            color: #000;
            line-height: 1.1;
            word-break: keep-all;
            white-space: nowrap;
          }
          strong { 
            font-family: ${format === PRINT_FORMATS.COMPACT ? 'inherit' : '"Courier New", Courier, monospace'};
            margin: 0 0 ${format === PRINT_FORMATS.COMPACT ? 1 : 1.5}mm 0; 
            font-size: ${format === PRINT_FORMATS.COMPACT ? 7.5 : format === PRINT_FORMATS.STANDARD ? 13 : 15}px; 
            line-height: 1.1; 
            font-weight: 800;
            letter-spacing: -0.02em;
            word-break: break-all;
          }
          .name { 
            font-size: ${format === PRINT_FORMATS.COMPACT ? 6 : format === PRINT_FORMATS.STANDARD ? 9 : 11}px; 
            font-weight: 600; 
            line-height: 1.1;
            color: #333;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            margin-bottom: 1mm;
          }"""

content = content.replace(target, replacement)

# Check if technical or instruction CSS is there and adjust font sizes for COMPACT
tech_target = """.technical { 
            font-size: ${format === PRINT_FORMATS.COMPACT ? 5 : format === PRINT_FORMATS.STANDARD ? 7 : 8}px; 
            color: #666; 
          }
          .instruction {
            font-size: ${format === PRINT_FORMATS.COMPACT ? 5 : format === PRINT_FORMATS.STANDARD ? 7 : 8}px;
            color: #888;
            font-style: italic;
            margin-top: auto;
          }"""

tech_replace = """.technical { 
            font-size: ${format === PRINT_FORMATS.COMPACT ? 4.5 : format === PRINT_FORMATS.STANDARD ? 7 : 8}px; 
            color: #666; 
          }
          .instruction {
            font-size: ${format === PRINT_FORMATS.COMPACT ? 4.5 : format === PRINT_FORMATS.STANDARD ? 7 : 8}px;
            color: #888;
            font-style: italic;
            margin-top: auto;
          }"""

content = content.replace(tech_target, tech_replace)

with open(r'c:\Users\Asus TUF F15\incalpacafm\sgtb-incalpaca\frontend\src\modules\assets\pages\AssetQrInventoryPage.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
