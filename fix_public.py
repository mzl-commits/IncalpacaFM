import sys

def apply_refactor(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    imports = "import { type ImpactAnswer, type AffectedPeople, type SuggestedPriority, type PublicLocationOption, type PublicAssetContext, type PublicRequestFormState, initialForm, getLoggedRequester, calculateSuggestedPriority, getPriorityReasons, getSubmitErrorMessage, yesNoOptions } from '../components/publicWorkRequestUtils';\n"
    
    new_lines = lines[0:6] + [imports] + lines[152:]
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)

apply_refactor('frontend/src/modules/incidents/pages/PublicWorkRequestPage.tsx')
