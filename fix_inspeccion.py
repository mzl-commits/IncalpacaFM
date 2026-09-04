import sys

def apply_refactor(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    table_lines = ["import { Plus, Trash } from '@phosphor-icons/react';\n", "import type { ObservacionInspeccion, PiezaBase } from '@/modules/almacen/types';\n\n", "export function InspeccionObservacionesTable({\n", "  esPlantillaEPP,\n", "  tipo,\n", "  piezasLote,\n", "  piezas,\n", "  itemsObservacion,\n", "  addItemObservacion,\n", "  updateItemObservacion,\n", "  removeItemObservacion,\n", "}: {\n", "  esPlantillaEPP: boolean;\n", "  tipo: 'individual' | 'grupal';\n", "  piezasLote: Set<number>;\n", "  piezas: PiezaBase[];\n", "  itemsObservacion: ObservacionInspeccion[];\n", "  addItemObservacion: () => void;\n", "  updateItemObservacion: (index: number, field: keyof ObservacionInspeccion, value: string) => void;\n", "  removeItemObservacion: (index: number) => void;\n", "}) {\n", "  return (\n"] + lines[970:1107] + ["  );\n", "}\n"]
    
    with open('frontend/src/modules/almacen/components/InspeccionObservacionesTable.tsx', 'w', encoding='utf-8') as f:
        f.writelines(table_lines)
        
    crit_lines = ["import type { Criterio, ValorRespuesta } from '@/modules/almacen/types';\n", "import { valorRespuestaLabels } from '@/modules/almacen/types';\n\n", "export function InspeccionCriteriosList({\n", "  criterios,\n", "  respuestas,\n", "  setRespuesta,\n", "}: {\n", "  criterios: Criterio[];\n", "  respuestas: Record<number, { valor: ValorRespuesta | ''; observacion: string }>;\n", "  setRespuesta: (criterioId: number, field: 'valor' | 'observacion', value: string) => void;\n", "}) {\n", "  return (\n"] + lines[876:916] + ["  );\n", "}\n"]
    
    with open('frontend/src/modules/almacen/components/InspeccionCriteriosList.tsx', 'w', encoding='utf-8') as f:
        f.writelines(crit_lines)
        
    imports = "import { InspeccionCriteriosList } from '../components/InspeccionCriteriosList';\nimport { InspeccionObservacionesTable } from '../components/InspeccionObservacionesTable';\n"
    
    component1 = "            <InspeccionCriteriosList\n              criterios={criterios}\n              respuestas={respuestas}\n              setRespuesta={setRespuesta}\n            />\n"
    
    component2 = "            <InspeccionObservacionesTable\n              esPlantillaEPP={esPlantillaEPP}\n              tipo={tipo}\n              piezasLote={piezasLote}\n              piezas={piezas}\n              itemsObservacion={itemsObservacion}\n              addItemObservacion={addItemObservacion}\n              updateItemObservacion={updateItemObservacion}\n              removeItemObservacion={removeItemObservacion}\n            />\n"
    
    new_lines = lines[0:41] + [imports] + lines[41:874] + [component1] + lines[917:970] + [component2] + lines[1108:]
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)

apply_refactor('frontend/src/modules/almacen/pages/InspeccionFormPage.tsx')
