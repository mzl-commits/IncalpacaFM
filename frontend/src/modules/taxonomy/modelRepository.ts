import localforage from "localforage";

export interface AssetModel {
  id: string;
  name: string;
  brand: string;
  createdAt: string;
  isActive: boolean;
}

const modelsStore = localforage.createInstance({
  name: "sgtb_incalpaca",
  storeName: "asset_models",
});

const DEFAULT_MODELS: AssetModel[] = [
  { id: "M001", name: "Latitude 5420", brand: "Dell", createdAt: new Date().toISOString(), isActive: true },
  { id: "M002", name: "ThinkPad T14", brand: "Lenovo", createdAt: new Date().toISOString(), isActive: true },
  { id: "M003", name: "MacBook Pro 16", brand: "Apple", createdAt: new Date().toISOString(), isActive: true },
  { id: "M004", name: "ProDesk 400 G7", brand: "HP", createdAt: new Date().toISOString(), isActive: true },
  { id: "M005", name: "Genérico", brand: "Genérico", createdAt: new Date().toISOString(), isActive: true },
];

export async function listModels(): Promise<AssetModel[]> {
  const keys = await modelsStore.keys();
  if (keys.length === 0) {
    for (const model of DEFAULT_MODELS) {
      await modelsStore.setItem(model.id, model);
    }
    return DEFAULT_MODELS;
  }
  
  const models: AssetModel[] = [];
  for (const key of keys) {
    const model = await modelsStore.getItem<AssetModel>(key);
    if (model) models.push(model);
  }
  return models.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getModel(id: string): Promise<AssetModel | null> {
  return modelsStore.getItem<AssetModel>(id);
}

export async function createModel(model: Omit<AssetModel, "id" | "createdAt">): Promise<AssetModel> {
  const id = `MOD-${Date.now().toString(36).toUpperCase()}`;
  const newModel: AssetModel = {
    ...model,
    id,
    createdAt: new Date().toISOString(),
  };
  await modelsStore.setItem(id, newModel);
  return newModel;
}

export async function updateModel(id: string, updates: Partial<AssetModel>): Promise<AssetModel> {
  const existing = await modelsStore.getItem<AssetModel>(id);
  if (!existing) throw new Error("Model not found");
  
  const updated = { ...existing, ...updates };
  await modelsStore.setItem(id, updated);
  return updated;
}

export async function deleteModel(id: string): Promise<void> {
  await modelsStore.removeItem(id);
}
