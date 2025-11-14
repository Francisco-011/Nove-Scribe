export enum View {
  MemoryCore = 'memory-core',
  CreationEngine = 'creation-engine',
  VisualStudio = 'visual-studio',
}

export interface Character {
  id: string;
  name: string;
  age: string;
  role: string;
  psychology: string;
  backstory: string;
  relationships: string;
  appearance?: string;
  skills?: string;
  imageUrl?: string;
}

export interface Location {
  id:string;
  name: string;
  description: string;
  imageUrl?: string;
}

export interface PlotPoint {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
}

export interface MemoryCoreData {
  characters: Character[];
  locations: Location[];
  plotPoints: PlotPoint[];
}

export interface Manuscript {
  id: string;
  title: string;
  content: string;
}

export interface Project {
  id: string;
  title: string;
  synopsis: string;
  styleSeed: string;
  memoryCore: MemoryCoreData;
  manuscripts: Manuscript[];
  activeManuscriptId: string;
}