export type AccessoryType =
  | 'none'
  | 'glasses'         // Researcher, SAP Analyst
  | 'beret'           // Designer, ComfyUI Creator
  | 'headphones'      // M365 Assistant, Communication
  | 'book'            // RAG Specialist
  | '3d_glasses';     // Blender 3D

const KEYWORD_TO_ACCESSORY: Array<[string[], AccessoryType]> = [
  [['researcher', 'research', 'investigador'], 'glasses'],
  [['sap', 'analyst', 'analista'], 'glasses'],
  [['designer', 'diseñador', 'diseño', 'comfyui', 'comfy'], 'beret'],
  [['blender', '3d'], '3d_glasses'],
  [['rag', 'knowledge', 'document'], 'book'],
  [['m365', 'microsoft', 'office365', 'communication', 'comunicación', 'teams'], 'headphones'],
];

export function getAgentAccessory(brainNames: string[]): AccessoryType {
  const joined = brainNames.join(' ').toLowerCase();
  for (const [keywords, accessory] of KEYWORD_TO_ACCESSORY) {
    if (keywords.some(kw => joined.includes(kw))) return accessory;
  }
  return 'none';
}
