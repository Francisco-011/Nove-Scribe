import React, { useState, useRef } from 'react';
import type { Project, Character, Location, PlotPoint } from '../types';
import { generateCharacterImage, generateLocationImage, generatePlotPointImage, generateSceneImage, suggestScenesFromManuscript } from '../services/geminiService';
import { Spinner, SparklesIcon, UploadIcon, TrashIcon } from './Icons';

interface VisualStudioProps {
  project: Project;
  setProject: React.Dispatch<React.SetStateAction<Project>>;
}

interface GeneratedImage {
    id: string;
    src: string;
}

interface SuggestedScene {
    title: string;
    prompt: string;
}

const GeneratorButton: React.FC<{onClick: () => void; isLoading: boolean; disabled?: boolean; text: string}> = ({onClick, isLoading, disabled, text}) => (
     <button
        onClick={onClick}
        disabled={isLoading || disabled}
        className="w-full bg-brand-accent text-white font-bold py-2 px-4 rounded-md hover:bg-sky-500 transition-colors duration-200 disabled:bg-slate-600 flex justify-center items-center"
    >
        {isLoading ? <Spinner className="h-5 w-5"/> : text}
    </button>
)


export const VisualStudio: React.FC<VisualStudioProps> = ({ project, setProject }) => {
  const [loadings, setLoadings] = useState({char: false, location: false, plot: false, scene: false, suggest: false});
  
  const [selectedCharId, setSelectedCharId] = useState<string>(project.memoryCore.characters[0]?.id || '');
  const [selectedLocationId, setSelectedLocationId] = useState<string>(project.memoryCore.locations[0]?.id || '');
  const [selectedPlotId, setSelectedPlotId] = useState<string>(project.memoryCore.plotPoints[0]?.id || '');
  
  const [sceneAction, setSceneAction] = useState('');
  const [sceneCharIds, setSceneCharIds] = useState<Set<string>>(new Set());
  const [sceneLocationId, setSceneLocationId] = useState<string>('none');
  
  const [suggestedScenes, setSuggestedScenes] = useState<SuggestedScene[]>([]);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setLoading = (key: keyof typeof loadings, value: boolean) => {
    setLoadings(prev => ({ ...prev, [key]: value }));
  };
  
  const handleGenerate = async (type: 'char' | 'location' | 'plot' | 'scene', payload?: any) => {
    setLoading(type, true);
    try {
        let imageUrl: string | null = null;
        if (type === 'char') {
            const character = project.memoryCore.characters.find(c => c.id === selectedCharId);
            if(character) imageUrl = await generateCharacterImage(character, project);
        } else if (type === 'location') {
            const location = project.memoryCore.locations.find(l => l.id === selectedLocationId);
            if(location) imageUrl = await generateLocationImage(location, project);
        } else if (type === 'plot') {
             const plotPoint = project.memoryCore.plotPoints.find(p => p.id === selectedPlotId);
             if(plotPoint) imageUrl = await generatePlotPointImage(plotPoint, project);
        } else if (type === 'scene' && payload) {
            imageUrl = await generateSceneImage(payload);
        }
        
        if (imageUrl) {
            setGeneratedImages(prev => [{ id: crypto.randomUUID(), src: imageUrl }, ...prev]);
        }
    } catch (error) {
      console.error(`Failed to generate ${type} image`, error);
      alert(`Error al generar la imagen. Revisa la consola.`);
    } finally {
      setLoading(type, false);
    }
  };

  const handleGenerateScene = () => {
    if (!sceneAction) {
        alert("Por favor, describe la acción de la escena.");
        return;
    }
    const characters = project.memoryCore.characters.filter(c => sceneCharIds.has(c.id));
    const location = project.memoryCore.locations.find(l => l.id === sceneLocationId);
    handleGenerate('scene', { actionDescription: sceneAction, characters, location, project });
  };
  
  const handleSuggestScenes = async () => {
    const manuscript = project.manuscripts.find(m => m.id === project.activeManuscriptId);
    if (!manuscript?.content) return;
    setLoading('suggest', true);
    try {
        const suggestions = await suggestScenesFromManuscript(project);
        setSuggestedScenes(suggestions);
    } catch (error) {
         console.error(`Failed to suggest scenes`, error);
         alert(`Error al sugerir escenas. Revisa la consola.`);
    } finally {
        setLoading('suggest', false);
    }
  }

  const handleAssignImage = (imageSrc: string, target: string) => {
    if (!target || target === "none") return;
    const [type, id] = target.split('-');
    
    setProject(prev => {
        const newMemoryCore = { ...prev.memoryCore };
        if (type === 'character') newMemoryCore.characters = newMemoryCore.characters.map(c => c.id === id ? { ...c, imageUrl: imageSrc } : c);
        else if (type === 'location') newMemoryCore.locations = newMemoryCore.locations.map(l => l.id === id ? { ...l, imageUrl: imageSrc } : l);
        else if (type === 'plot') newMemoryCore.plotPoints = newMemoryCore.plotPoints.map(p => p.id === id ? { ...p, imageUrl: imageSrc } : p);

        alert('¡Imagen asignada con éxito!');
        return { ...prev, memoryCore: newMemoryCore };
    });
  };

  const handleDeleteImage = (id: string) => {
    setGeneratedImages(prev => prev.filter(image => image.id !== id));
  };
  
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (loadEvent) => {
            const base64String = loadEvent.target?.result as string;
            if (base64String) {
                setGeneratedImages(prev => [{ id: crypto.randomUUID(), src: base64String }, ...prev]);
            }
        };
        reader.readAsDataURL(file);
    }
    if (event.target) {
        event.target.value = '';
    }
  };
  
  const toggleSceneChar = (id: string) => {
    setSceneCharIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        return newSet;
    });
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
       <input type="file" ref={fileInputRef} onChange={handleImageUpload} style={{ display: 'none' }} accept="image/*" />
      <h2 className="text-2xl md:text-3xl font-bold mb-6 border-b-2 border-brand-secondary pb-2">Estudio Visual</h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          
          <div className="bg-slate-900 p-4 rounded-lg border border-brand-secondary space-y-3">
            <h3 className="text-xl font-bold">Cazatalentos Visual IA</h3>
            <p className="text-xs text-brand-text-secondary">Analiza tu manuscrito activo para encontrar los momentos más dignos de ser ilustrados.</p>
            <GeneratorButton onClick={handleSuggestScenes} isLoading={loadings.suggest} text="Analizar Manuscrito"/>
             {suggestedScenes.length > 0 && (
                <div className="space-y-2 pt-2 max-h-40 overflow-y-auto">
                    {suggestedScenes.map((scene, i) => (
                        <div key={i} onClick={() => setSceneAction(scene.prompt)} className="bg-brand-secondary p-2 rounded-md hover:bg-slate-600 cursor-pointer">
                            <p className="font-bold text-sm text-brand-accent">{scene.title}</p>
                            <p className="text-xs text-brand-text-secondary truncate">{scene.prompt}</p>
                        </div>
                    ))}
                </div>
            )}
          </div>
          
          <div className="bg-slate-900 p-4 rounded-lg border border-brand-secondary space-y-3">
            <h3 className="text-xl font-bold">Generadores Individuales</h3>
            <p className="text-xs text-brand-text-secondary mb-3">El estilo visual se define en los Ajustes del Proyecto en el Núcleo de Memoria.</p>
            {/* Character */}
            <div>
                 <select value={selectedCharId} onChange={(e) => setSelectedCharId(e.target.value)} className="w-full bg-brand-secondary rounded-md p-3 focus:ring-1 focus:ring-brand-accent focus:outline-none mb-2" disabled={project.memoryCore.characters.length === 0}>
                    {project.memoryCore.characters.length > 0 ? project.memoryCore.characters.map(char => (<option key={char.id} value={char.id}>{char.name}</option>)) : <option>No hay personajes</option>}
                </select>
                <GeneratorButton onClick={() => handleGenerate('char')} isLoading={loadings.char} disabled={project.memoryCore.characters.length === 0} text="Generar Retrato"/>
            </div>
             {/* Location */}
            <div>
                 <select value={selectedLocationId} onChange={(e) => setSelectedLocationId(e.target.value)} className="w-full bg-brand-secondary rounded-md p-3 focus:ring-1 focus:ring-brand-accent focus:outline-none mb-2" disabled={project.memoryCore.locations.length === 0}>
                    {project.memoryCore.locations.length > 0 ? project.memoryCore.locations.map(loc => (<option key={loc.id} value={loc.id}>{loc.name}</option>)) : <option>No hay ubicaciones</option>}
                </select>
                <GeneratorButton onClick={() => handleGenerate('location')} isLoading={loadings.location} disabled={project.memoryCore.locations.length === 0} text="Generar Ubicación"/>
            </div>
             {/* Plot Point */}
            <div>
                 <select value={selectedPlotId} onChange={(e) => setSelectedPlotId(e.target.value)} className="w-full bg-brand-secondary rounded-md p-3 focus:ring-1 focus:ring-brand-accent focus:outline-none mb-2" disabled={project.memoryCore.plotPoints.length === 0}>
                    {project.memoryCore.plotPoints.length > 0 ? project.memoryCore.plotPoints.map(p => (<option key={p.id} value={p.id}>{p.title}</option>)) : <option>No hay Puntos de Trama</option>}
                </select>
                <GeneratorButton onClick={() => handleGenerate('plot')} isLoading={loadings.plot} disabled={project.memoryCore.plotPoints.length === 0} text="Generar Punto de Trama"/>
            </div>
          </div>
          
           <div className="bg-slate-900 p-4 rounded-lg border border-brand-secondary space-y-3">
                <h3 className="text-xl font-bold">Director de Escena IA</h3>
                 <textarea value={sceneAction} onChange={(e) => setSceneAction(e.target.value)} placeholder="Describe la acción de la escena..." rows={3} className="w-full bg-brand-secondary rounded-md p-3 focus:ring-1 focus:ring-brand-accent focus:outline-none"/>
                <div>
                    <label className="text-sm font-semibold text-brand-text-secondary mb-2 block">Personajes en la Escena</label>
                    <div className="max-h-24 overflow-y-auto space-y-1 bg-brand-secondary p-2 rounded-md">
                        {project.memoryCore.characters.map(char => (
                            <label key={char.id} className="flex items-center space-x-2 cursor-pointer p-1 rounded hover:bg-slate-600">
                                <input type="checkbox" checked={sceneCharIds.has(char.id)} onChange={() => toggleSceneChar(char.id)} className="form-checkbox bg-slate-700 border-slate-500 text-brand-accent focus:ring-brand-accent"/>
                                <span>{char.name}</span>
                            </label>
                        ))}
                    </div>
                </div>
                 <div>
                    <label className="text-sm font-semibold text-brand-text-secondary mb-1 block">Ubicación</label>
                    <select value={sceneLocationId} onChange={e => setSceneLocationId(e.target.value)} className="w-full bg-brand-secondary rounded-md p-2 focus:ring-1 focus:ring-brand-accent focus:outline-none">
                        <option value="none">Ninguna</option>
                        {project.memoryCore.locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                    </select>
                </div>
                <GeneratorButton onClick={handleGenerateScene} isLoading={loadings.scene} text="Generar Escena Compleja"/>
           </div>
        </div>

        <div className="lg:col-span-2">
           <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-semibold text-brand-accent">Galería de Imágenes</h3>
                <button onClick={() => fileInputRef.current?.click()} className="flex items-center space-x-2 px-3 py-1 text-xs bg-brand-secondary text-white rounded-lg hover:bg-slate-600 transition-colors">
                    <UploadIcon className="h-4 w-4"/>
                    <span>Cargar Imagen</span>
                </button>
           </div>
           <div className="bg-slate-900 border border-brand-secondary rounded-lg p-4 h-[80vh] overflow-y-auto">
                {generatedImages.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-brand-text-secondary">Tus imágenes generadas aparecerán aquí.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {generatedImages.map((image) => (
                            <div key={image.id} className="bg-brand-secondary p-2 rounded-lg space-y-2 group relative">
                                <img src={image.src} alt={`Generated art ${image.id}`} className="rounded-lg w-full h-auto object-cover" />
                                <button onClick={() => handleDeleteImage(image.id)} className="absolute top-3 right-3 p-1.5 bg-black bg-opacity-50 rounded-full text-white opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all" title="Eliminar imagen">
                                    <TrashIcon className="h-4 w-4" />
                                </button>
                                <select defaultValue="none" onChange={(e) => handleAssignImage(image.src, e.target.value)} className="w-full bg-slate-700 rounded-md p-2 text-sm focus:ring-1 focus:ring-brand-accent focus:outline-none">
                                    <option value="none" disabled>Asignar a...</option>
                                    <optgroup label="Personajes">{project.memoryCore.characters.map(c => <option key={c.id} value={`character-${c.id}`}>{c.name}</option>)}</optgroup>
                                    <optgroup label="Ubicaciones">{project.memoryCore.locations.map(l => <option key={l.id} value={`location-${l.id}`}>{l.name}</option>)}</optgroup>
                                    <optgroup label="Puntos de Trama">{project.memoryCore.plotPoints.map(p => <option key={p.id} value={`plot-${p.id}`}>{p.title}</option>)}</optgroup>
                                </select>
                            </div>
                        ))}
                    </div>
                )}
           </div>
        </div>
      </div>
    </div>
  );
};