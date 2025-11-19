import React, { useState, useRef } from 'react';
import type { Project, Character, Location, PlotPoint, GeneratedImage } from '../types';
import { generateCharacterImage, generateLocationImage, generatePlotPointImage, generateSceneImage, suggestScenesFromManuscript } from '../services/geminiService';
import { Spinner, SparklesIcon, UploadIcon, TrashIcon, DownloadIcon } from './Icons';

interface VisualStudioProps {
  project: Project;
  setProject: React.Dispatch<React.SetStateAction<Project>>;
}

interface SuggestedScene {
    title: string;
    prompt: string;
}

// --- Utility Functions for Image Size ---

const getBase64SizeInBytes = (base64String: string): number => {
    let padding = 0;
    if (base64String.endsWith('==')) padding = 2;
    else if (base64String.endsWith('=')) padding = 1;
    
    // Length of base64 string * 0.75 gives rough byte size
    return (base64String.length * 0.75) - padding;
};

const formatBytes = (bytes: number, decimals = 0) => {
    if (!+bytes) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

const SAFE_LIMIT_BYTES = 950 * 1024; // 950 KB Safe limit (Firestore doc limit is 1MB)

// -----------------------------------------

const GeneratorButton: React.FC<{onClick: () => void; isLoading: boolean; disabled?: boolean; text: string}> = ({onClick, isLoading, disabled, text}) => (
     <button
        onClick={onClick}
        disabled={isLoading || disabled}
        className="w-full bg-brand-accent text-white font-bold py-2 px-4 rounded-md hover:bg-sky-500 transition-colors duration-200 disabled:bg-slate-600 flex justify-center items-center"
    >
        {isLoading ? <Spinner className="h-5 w-5"/> : text}
    </button>
)

const DeleteConfirmModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
}> = ({ isOpen, onClose, onConfirm }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[60] backdrop-blur-sm">
            <div className="bg-slate-900 rounded-lg shadow-2xl p-6 w-full max-w-md border border-red-500/50">
                <h3 className="text-xl font-bold mb-2 text-red-400">Eliminar Imagen</h3>
                <p className="text-brand-text-secondary mb-6">¿Estás seguro de que quieres eliminar esta imagen de la galería? Esta acción es irreversible.</p>
                <div className="flex justify-end space-x-3">
                    <button onClick={onClose} className="px-4 py-2 bg-brand-secondary text-white rounded hover:bg-slate-600 transition-colors">
                        Cancelar
                    </button>
                    <button onClick={onConfirm} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors shadow-lg flex items-center space-x-2">
                        <TrashIcon className="h-4 w-4"/>
                        <span>Eliminar</span>
                    </button>
                </div>
            </div>
        </div>
    );
};


export const VisualStudio: React.FC<VisualStudioProps> = ({ project, setProject }) => {
  const [loadings, setLoadings] = useState({char: false, location: false, plot: false, scene: false, suggest: false});
  
  const [selectedCharId, setSelectedCharId] = useState<string>(project.memoryCore.characters[0]?.id || '');
  const [selectedLocationId, setSelectedLocationId] = useState<string>(project.memoryCore.locations[0]?.id || '');
  const [selectedPlotId, setSelectedPlotId] = useState<string>(project.memoryCore.plotPoints[0]?.id || '');
  
  const [sceneAction, setSceneAction] = useState('');
  const [sceneCharIds, setSceneCharIds] = useState<Set<string>>(new Set());
  const [sceneLocationId, setSceneLocationId] = useState<string>('none');
  
  const [suggestedScenes, setSuggestedScenes] = useState<SuggestedScene[]>([]);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [imageToDelete, setImageToDelete] = useState<string | null>(null);
  
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
            // Validate Size from AI
            const size = getBase64SizeInBytes(imageUrl);
            if (size > SAFE_LIMIT_BYTES) {
                alert(`La imagen generada por la IA es inusualmente grande (${formatBytes(size)}) y supera el límite de seguridad de 950KB. No se ha guardado para proteger la base de datos.`);
            } else {
                const newImage: GeneratedImage = { id: crypto.randomUUID(), src: imageUrl };
                setProject(prev => ({ ...prev, gallery: [newImage, ...(prev.gallery || [])] }));
            }
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

 const handleAssignImage = (image: GeneratedImage, newTargetId: string) => { // newTargetId is "type-id" or "none"
    setProject(prevProject => {
        const newProject = JSON.parse(JSON.stringify(prevProject));
        const oldTargetId = image.assignedToId;

        // --- Step 1: Update the old target entity (remove image URL/ID) ---
        if (oldTargetId && oldTargetId !== newTargetId) {
            const [oldType, oldId] = oldTargetId.split('-');
            const unassign = <T extends {id: string}>(items: T[]) => items.map(item => 
                item.id === oldId ? { ...item, imageUrl: '' } : item
            );
            if (oldType === 'character') newProject.memoryCore.characters = unassign(newProject.memoryCore.characters);
            if (oldType === 'location') newProject.memoryCore.locations = unassign(newProject.memoryCore.locations);
            if (oldType === 'plot') newProject.memoryCore.plotPoints = unassign(newProject.memoryCore.plotPoints);
        }

        // --- Step 2: Update the new target entity (ADD IMAGE ID, NOT BASE64) ---
        // Critical for Firestore limit: We only store the ID of the image, not the base64 string again.
        if (newTargetId !== 'none') {
            const [newType, newId] = newTargetId.split('-');
            const assign = <T extends {id: string}>(items: T[]) => items.map(item => 
                item.id === newId ? { ...item, imageUrl: image.id } : item 
            );
            if (newType === 'character') newProject.memoryCore.characters = assign(newProject.memoryCore.characters);
            if (newType === 'location') newProject.memoryCore.locations = assign(newProject.memoryCore.locations);
            if (newType === 'plot') newProject.memoryCore.plotPoints = assign(newProject.memoryCore.plotPoints);
        }

        // --- Step 3: Update the gallery ---
        newProject.gallery = newProject.gallery.map((galleryImage: GeneratedImage) => {
            // Unassign any other image that was on the new target
            if (galleryImage.id !== image.id && galleryImage.assignedToId === newTargetId && newTargetId !== 'none') {
                return { ...galleryImage, assignedToId: undefined };
            }
            // Update the current image being assigned/unassigned
            if (galleryImage.id === image.id) {
                return { ...galleryImage, assignedToId: newTargetId === 'none' ? undefined : newTargetId };
            }
            return galleryImage;
        });

        return newProject;
    });
};

  const promptDeleteImage = (id: string) => {
      setImageToDelete(id);
      setDeleteModalOpen(true);
  }

  const confirmDeleteImage = () => {
    if (imageToDelete) {
        setProject(prev => ({ ...prev, gallery: (prev.gallery || []).filter(img => img.id !== imageToDelete) }));
    }
    setDeleteModalOpen(false);
    setImageToDelete(null);
  };
  
  const handleDownloadImage = (image: GeneratedImage) => {
    const sanitizeFilename = (name: string) => name.replace(/[^a-z0-9_.-]/gi, '_').toLowerCase();
    const fileName = `${sanitizeFilename(project.title)}_${image.id.substring(0, 8)}.png`;
    const link = document.createElement('a');
    link.href = image.src;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        // 1. Check File Size (Binary)
        if (file.size > SAFE_LIMIT_BYTES) {
            alert(`La imagen seleccionada es demasiado pesada (${formatBytes(file.size)}). \n\nEl límite es 950KB para asegurar la sincronización en la nube. Por favor, comprime la imagen antes de subirla.`);
            if (event.target) event.target.value = ''; // Reset input
            return;
        }

        const reader = new FileReader();
        reader.onload = (loadEvent) => {
            const base64String = loadEvent.target?.result as string;
            if (base64String) {
                // 2. Check Base64 Size (Double check as encoding adds size)
                const b64Size = getBase64SizeInBytes(base64String);
                if (b64Size > SAFE_LIMIT_BYTES) {
                     alert(`Al procesar la imagen, su tamaño aumentó a ${formatBytes(b64Size)}, superando el límite de 950KB. Intenta con una imagen más pequeña o comprimida.`);
                     return;
                }

                const newImage: GeneratedImage = { id: crypto.randomUUID(), src: base64String };
                setProject(prev => ({ ...prev, gallery: [newImage, ...(prev.gallery || [])] }));
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
  
  const gallery = project.gallery || [];

  return (
    <div className="p-4 md:p-6 lg:p-8">
       <input type="file" ref={fileInputRef} onChange={handleImageUpload} style={{ display: 'none' }} accept="image/*" />
      <DeleteConfirmModal 
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDeleteImage}
      />
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
                <button onClick={() => fileInputRef.current?.click()} className="flex items-center space-x-2 px-3 py-1 text-xs bg-brand-secondary text-white rounded-lg hover:bg-slate-600 transition-colors border border-transparent hover:border-brand-accent">
                    <UploadIcon className="h-4 w-4"/>
                    <span>Cargar (Máx 950KB)</span>
                </button>
           </div>
           <div className="bg-slate-900 border border-brand-secondary rounded-lg p-4 h-[80vh] overflow-y-auto">
                {gallery.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-brand-text-secondary">Tus imágenes generadas aparecerán aquí.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {gallery.map((image) => {
                            const sizeBytes = getBase64SizeInBytes(image.src);
                            const isHeavy = sizeBytes > 800 * 1024; // Warn if > 800KB
                            return (
                                <div key={image.id} className="bg-brand-secondary p-2 rounded-lg space-y-2 group relative">
                                    <div className="relative">
                                        <img src={image.src} alt={`Generated art ${image.id}`} className="rounded-lg w-full h-auto object-cover" />
                                        <div className={`absolute bottom-2 right-2 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold backdrop-blur-md ${isHeavy ? 'bg-yellow-500/80 text-black' : 'bg-black/60 text-white'}`}>
                                            {formatBytes(sizeBytes)}
                                        </div>
                                    </div>
                                    <div className="absolute top-3 right-3 flex space-x-2 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                                        <button onClick={() => handleDownloadImage(image)} className="p-1.5 bg-black bg-opacity-75 rounded-full text-white hover:bg-sky-600 transition-colors" title="Descargar imagen">
                                            <DownloadIcon className="h-4 w-4" />
                                        </button>
                                        <button onClick={() => promptDeleteImage(image.id)} className="p-1.5 bg-black bg-opacity-75 rounded-full text-white hover:bg-red-600 transition-colors" title="Eliminar imagen">
                                            <TrashIcon className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <select 
                                        value={image.assignedToId || 'none'} 
                                        onChange={(e) => handleAssignImage(image, e.target.value)} 
                                        className="w-full bg-slate-700 rounded-md p-2 text-sm focus:ring-1 focus:ring-brand-accent focus:outline-none"
                                    >
                                        <option value="none">Sin asignar</option>
                                        <optgroup label="Personajes">{project.memoryCore.characters.map(c => <option key={c.id} value={`character-${c.id}`}>{c.name}</option>)}</optgroup>
                                        <optgroup label="Ubicaciones">{project.memoryCore.locations.map(l => <option key={l.id} value={`location-${l.id}`}>{l.name}</option>)}</optgroup>
                                        <optgroup label="Puntos de Trama">{project.memoryCore.plotPoints.map(p => <option key={p.id} value={`plot-${p.id}`}>{p.title}</option>)}</optgroup>
                                    </select>
                                </div>
                            );
                        })}
                    </div>
                )}
           </div>
        </div>
      </div>
    </div>
  );
};