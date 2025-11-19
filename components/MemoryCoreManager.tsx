
import React, { useState, useEffect } from 'react';
import type { Project, Character, Location, PlotPoint } from '../types';
import { CharacterIcon, WorldIcon, PlotIcon, PlusIcon, EditIcon, TrashIcon, ChevronDownIcon, ChevronUpIcon, Spinner, SparklesIcon } from './Icons';
import { generateCharacterDetails, generateLocationDetails, generatePlotStructure, enrichCharacterProfile } from '../services/geminiService';

interface MemoryCoreManagerProps {
  project: Project;
  setProject: React.Dispatch<React.SetStateAction<Project>>;
}

export enum MemoryView {
  Characters,
  World,
  Plot,
}

const MemoryModal: React.FC<{
    isOpen: boolean;
    view: MemoryView | null;
    data: Character | Location | PlotPoint | null;
    project: Project; // Passed to provide context for AI enrichment
    onClose: () => void;
    onSave: (item: any) => void;
}> = ({ isOpen, view, data, project, onClose, onSave }) => {
    const [formData, setFormData] = useState<any>({});
    const [isEnriching, setIsEnriching] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        if (data) {
            setFormData(data);
        } else {
            // Reset form for new item
            let emptyState = {};
            if (view === MemoryView.Characters) emptyState = { name: '', age: '', role: '', psychology: '', backstory: '', relationships: '', appearance: '', skills: '', imageUrl: '' };
            if (view === MemoryView.World) emptyState = { name: '', description: '', imageUrl: '' };
            if (view === MemoryView.Plot) emptyState = { title: '', description: '', imageUrl: '' };
            setFormData(emptyState);
        }
    }, [data, view, isOpen]);
    
    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    const handleEnrichCharacter = async () => {
        if (!formData.name || !formData.role) {
            alert("Por favor, introduce al menos un Nombre y un Rol para que la IA pueda trabajar.");
            return;
        }
        
        // Generar un resumen de los otros personajes para que la IA cree relaciones coherentes
        const otherCharactersSummary = project.memoryCore.characters
            .filter(c => c.id !== formData.id) // Excluir al personaje que estamos editando
            .map(c => `- ${c.name} (${c.role})`)
            .join('\n');

        setIsEnriching(true);
        try {
            const enriched = await enrichCharacterProfile(formData, project.synopsis, otherCharactersSummary);
            // Merge response with existing ID/ImageUrl to preserve them
            setFormData((prev: any) => ({ ...prev, ...enriched }));
        } catch (e) {
            alert("Error al enriquecer el personaje. Revisa la consola.");
        } finally {
            setIsEnriching(false);
        }
    };

    const renderFormFields = () => {
        const commonFields = (
            // We don't allow manual editing of imageUrl here easily if it's an ID reference now, but keeping input for debug/manual override if user knows what they are doing
            <input name="imageUrl" value={formData.imageUrl || ''} onChange={handleChange} placeholder="ID de Imagen o URL" className="w-full bg-brand-secondary p-2 rounded opacity-50 text-sm" disabled title="Asigna imágenes desde el Estudio Visual" />
        );

        switch (view) {
            case MemoryView.Characters:
                return (
                    <>
                        <div className="flex justify-end mb-2">
                            <button 
                                type="button" 
                                onClick={handleEnrichCharacter} 
                                disabled={isEnriching}
                                className="text-xs flex items-center space-x-1 text-sky-400 hover:text-sky-300 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded transition-colors border border-sky-900 w-full sm:w-auto justify-center"
                                title="La IA rellenará los campos vacíos basándose en el nombre, rol, sinopsis y otros personajes."
                            >
                                {isEnriching ? <Spinner className="h-3 w-3"/> : <SparklesIcon className="h-3 w-3"/>}
                                <span>{isEnriching ? 'Analizando...' : 'Autocompletar Detalles con IA'}</span>
                            </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input name="name" value={formData.name || ''} onChange={handleChange} placeholder="Nombre" className="w-full bg-brand-secondary p-2 rounded" required />
                            <input name="age" value={formData.age || ''} onChange={handleChange} placeholder="Edad" className="w-full bg-brand-secondary p-2 rounded" />
                        </div>
                        <input name="role" value={formData.role || ''} onChange={handleChange} placeholder="Rol (Protagonista, etc.)" className="w-full bg-brand-secondary p-2 rounded" />
                        <textarea name="appearance" value={formData.appearance || ''} onChange={handleChange} placeholder="Apariencia (Físico, Vestimenta)" className="w-full bg-brand-secondary p-2 rounded h-24" />
                        <textarea name="skills" value={formData.skills || ''} onChange={handleChange} placeholder="Habilidades y Poderes" className="w-full bg-brand-secondary p-2 rounded h-24" />
                        <textarea name="psychology" value={formData.psychology || ''} onChange={handleChange} placeholder="Psicología y Personalidad" className="w-full bg-brand-secondary p-2 rounded h-24" />
                        <textarea name="backstory" value={formData.backstory || ''} onChange={handleChange} placeholder="Historia de Fondo" className="w-full bg-brand-secondary p-2 rounded h-24" />
                        <textarea name="relationships" value={formData.relationships || ''} onChange={handleChange} placeholder="Relaciones" className="w-full bg-brand-secondary p-2 rounded h-24" />
                        {/* {commonFields} - Hide manual image input to avoid confusion */}
                    </>
                );
            case MemoryView.World:
                return (
                    <>
                        <input name="name" value={formData.name || ''} onChange={handleChange} placeholder="Nombre de la Ubicación" className="w-full bg-brand-secondary p-2 rounded" required />
                        <textarea name="description" value={formData.description || ''} onChange={handleChange} placeholder="Descripción" className="w-full bg-brand-secondary p-2 rounded h-40" />
                        {/* {commonFields} */}
                    </>
                );
            case MemoryView.Plot:
                return (
                    <>
                        <input name="title" value={formData.title || ''} onChange={handleChange} placeholder="Título del Punto de Trama" className="w-full bg-brand-secondary p-2 rounded" required />
                        <textarea name="description" value={formData.description || ''} onChange={handleChange} placeholder="Descripción" className="w-full bg-brand-secondary p-2 rounded h-40" />
                        {/* {commonFields} */}
                    </>
                );
            default: return null;
        }
    };
    
    const title = data && data.id ? "Editar" : "Añadir Nuevo";
    const viewName = view === MemoryView.Characters ? "Personaje" : view === MemoryView.World ? "Ubicación" : "Punto de Trama";

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 rounded-lg shadow-xl p-6 w-full max-w-lg border border-brand-secondary overflow-y-auto max-h-[90vh] flex flex-col">
                <h3 className="text-xl font-bold mb-4 text-brand-accent">{`${title} ${viewName}`}</h3>
                <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off" data-form-type="other">
                    {renderFormFields()}
                    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-6">
                        <button 
                            type="button" 
                            onClick={onClose} 
                            className="w-full sm:w-auto px-4 py-3 sm:py-2 bg-brand-secondary rounded hover:bg-slate-600 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit"
                            data-lpignore="true"
                            data-form-type="other"
                            className="w-full sm:w-auto px-4 py-3 sm:py-2 bg-brand-accent text-white rounded hover:bg-sky-500 transition-colors font-semibold"
                        >
                            Guardar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const DeleteConfirmModal: React.FC<{
    isOpen: boolean;
    title: string;
    onClose: () => void;
    onConfirm: () => void;
}> = ({ isOpen, title, onClose, onConfirm }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[60] backdrop-blur-sm p-4">
            <div className="bg-slate-900 rounded-lg shadow-2xl p-6 w-full max-w-md border border-red-500/50">
                <h3 className="text-xl font-bold mb-2 text-red-400">Eliminar Elemento</h3>
                <p className="text-brand-text-secondary mb-6">¿Estás seguro de que quieres eliminar <span className="text-white font-bold">"{title}"</span>? Esta acción no se puede deshacer.</p>
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                    <button onClick={onClose} className="w-full sm:w-auto px-4 py-3 sm:py-2 bg-brand-secondary text-white rounded hover:bg-slate-600 transition-colors">
                        Cancelar
                    </button>
                    <button onClick={onConfirm} className="w-full sm:w-auto px-4 py-3 sm:py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors shadow-lg flex items-center justify-center space-x-2">
                        <TrashIcon className="h-4 w-4"/>
                        <span>Eliminar</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

const AIAssistant: React.FC<{
    view: MemoryView;
    onGenerate: (prompt: string) => Promise<void>;
}> = ({ view, onGenerate }) => {
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const placeholder = view === MemoryView.Characters 
        ? 'ej: Un cazarrecompensas cyborg melancólico'
        : 'ej: Una ciudad flotante sobre cristales de energía';

    const handleGenerate = async () => {
        if (!prompt) return;
        setIsLoading(true);
        await onGenerate(prompt);
        setIsLoading(false);
        setPrompt('');
    };

    return (
        <div className="bg-slate-900 p-4 rounded-lg border border-brand-secondary mb-6">
            <h4 className="text-lg font-semibold mb-2 text-brand-accent">Ayudante IA</h4>
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={placeholder}
                    className="w-full bg-brand-secondary rounded-md p-2 focus:ring-1 focus:ring-brand-accent focus:outline-none"
                />
                <button
                    onClick={handleGenerate}
                    disabled={isLoading}
                    className="bg-brand-accent text-white font-bold py-2 px-4 rounded-md hover:bg-sky-500 transition-colors duration-200 disabled:bg-slate-600 flex justify-center items-center w-full sm:w-32"
                >
                    {isLoading ? <Spinner className="h-5 w-5"/> : 'Generar'}
                </button>
            </div>
        </div>
    );
};


export const MemoryCoreManager: React.FC<MemoryCoreManagerProps> = ({ project, setProject }) => {
  const [activeView, setActiveView] = useState<MemoryView>(MemoryView.Characters);
  const [modalState, setModalState] = useState<{ isOpen: boolean; view: MemoryView | null; data: any }>({ isOpen: false, view: null, data: null });
  const [deleteState, setDeleteState] = useState<{ isOpen: boolean, view: MemoryView | null, id: string, name: string }>({ isOpen: false, view: null, id: '', name: '' });
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);
  const [isPlotLoading, setIsPlotLoading] = useState(false);

  // Helper to resolve image URL (Handles both direct Base64 for backward compat and ID Reference for new system)
  const resolveImageUrl = (imageUrl?: string): string | undefined => {
      if (!imageUrl) return undefined;
      // If it's a data URL, it's the old format (legacy)
      if (imageUrl.startsWith('data:')) return imageUrl;
      // Otherwise, treat it as an ID and look up in gallery
      const galleryImage = project.gallery?.find(g => g.id === imageUrl);
      return galleryImage ? galleryImage.src : undefined; 
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        return newSet;
    });
  };

  const openModal = (view: MemoryView, data: any = null) => {
      setModalState({ isOpen: true, view, data });
  };

  const closeModal = () => {
      setModalState({ isOpen: false, view: null, data: null });
  };
  
  const handleSave = (item: any) => {
    const isNew = !item.id;
    const newItem = isNew ? { ...item, id: crypto.randomUUID() } : item;

    const updateProject = (key: 'characters' | 'locations' | 'plotPoints') => {
        setProject(prev => {
            const items = prev.memoryCore[key];
            const updatedItems = isNew ? [...items, newItem] : items.map(i => i.id === newItem.id ? newItem : i);
            return { ...prev, memoryCore: { ...prev.memoryCore, [key]: updatedItems } };
        });
    };

    if (modalState.view === MemoryView.Characters) updateProject('characters');
    if (modalState.view === MemoryView.World) updateProject('locations');
    if (modalState.view === MemoryView.Plot) updateProject('plotPoints');

    closeModal();
  };
  
  const openDeleteConfirm = (view: MemoryView, id: string, name: string) => {
      setDeleteState({ isOpen: true, view, id, name });
  };

  const confirmDelete = () => {
      const { view, id } = deleteState;
      const updateProject = (key: 'characters' | 'locations' | 'plotPoints') => {
        setProject(prev => {
            const updatedItems = prev.memoryCore[key].filter(i => i.id !== id);
            return { ...prev, memoryCore: { ...prev.memoryCore, [key]: updatedItems } };
        });
    };

    if (view === MemoryView.Characters) updateProject('characters');
    if (view === MemoryView.World) updateProject('locations');
    if (view === MemoryView.Plot) updateProject('plotPoints');
    
    setDeleteState({ isOpen: false, view: null, id: '', name: '' });
  };

  const handleAIGenerate = async (prompt: string) => {
    try {
        if (activeView === MemoryView.Characters) {
            const details = await generateCharacterDetails(prompt);
            openModal(MemoryView.Characters, details);
        } else if (activeView === MemoryView.World) {
            const details = await generateLocationDetails(prompt);
            openModal(MemoryView.World, details);
        }
    } catch (error) {
        alert("Ocurrió un error al generar con IA. Por favor, revisa la consola.");
    }
  };

  const handleAIGeneratePlot = async () => {
    setIsPlotLoading(true);
    try {
        const plotPoints = await generatePlotStructure(project.synopsis);
        const newPointsWithIds: PlotPoint[] = plotPoints.map(p => ({
            id: crypto.randomUUID(),
            imageUrl: '',
            title: p.title || 'Nuevo Punto de Trama',
            description: p.description || ''
        }));
        setProject(prev => ({
            ...prev,
            memoryCore: {
                ...prev.memoryCore,
                plotPoints: [...prev.memoryCore.plotPoints, ...newPointsWithIds]
            }
        }));
    } catch (error) {
        alert("Ocurrió un error al generar la estructura de la trama. Por favor, revisa la consola.");
    } finally {
        setIsPlotLoading(false);
    }
  };


  const renderView = () => {
    const commonButtonClass = "flex items-center space-x-2 px-3 py-2 text-sm bg-brand-accent text-white rounded-lg hover:bg-sky-500 transition-colors";
    
    switch (activeView) {
      case MemoryView.Characters:
        return (
          <div>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-brand-accent">Perfiles de Personajes</h3>
                <button onClick={() => openModal(MemoryView.Characters)} className={commonButtonClass}><PlusIcon className="h-5 w-5"/><span>Añadir Personaje</span></button>
            </div>
             <AIAssistant view={MemoryView.Characters} onGenerate={handleAIGenerate} />
            <div className="space-y-4">
              {project.memoryCore.characters.map(char => {
                const resolvedImg = resolveImageUrl(char.imageUrl);
                return (
                    <div key={char.id} className="bg-brand-secondary rounded-lg shadow-lg overflow-hidden">
                        <div className="p-4 flex justify-between items-center cursor-pointer" onClick={() => toggleExpand(char.id)}>
                            <h4 className="text-lg font-bold text-brand-text-primary">{char.name} <span className="text-sm font-normal text-brand-text-secondary ml-2">{char.role}</span></h4>
                            <div className="flex items-center space-x-2">
                                <button onClick={(e) => { e.stopPropagation(); openModal(MemoryView.Characters, char); }} className="p-2 hover:bg-slate-600 rounded"><EditIcon className="h-5 w-5"/></button>
                                <button onClick={(e) => { e.stopPropagation(); openDeleteConfirm(MemoryView.Characters, char.id, char.name); }} className="p-2 hover:bg-slate-600 rounded text-red-400 hover:text-red-300"><TrashIcon className="h-5 w-5"/></button>
                                {expandedIds.has(char.id) ? <ChevronUpIcon className="h-5 w-5"/> : <ChevronDownIcon className="h-5 w-5"/>}
                            </div>
                        </div>
                        {expandedIds.has(char.id) && (
                            <div className="p-4 border-t border-slate-700 flex flex-col md:flex-row gap-6">
                                <div className="flex-shrink-0 w-full md:w-48">
                                    {resolvedImg ? (
                                        <img src={resolvedImg} alt={char.name} className="w-full h-auto object-cover rounded-md" />
                                    ) : (
                                        <div className="w-full h-48 bg-slate-700 flex items-center justify-center rounded-md">
                                            <CharacterIcon className="h-16 w-16 text-slate-500" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-grow space-y-4 text-sm">
                                    <div>
                                        <h5 className="font-bold text-brand-accent mb-1">Apariencia</h5>
                                        <p className="whitespace-pre-wrap">{char.appearance || 'No especificada.'}</p>
                                    </div>
                                    <div>
                                        <h5 className="font-bold text-brand-accent mb-1">Habilidades y Poderes</h5>
                                        <p className="whitespace-pre-wrap">{char.skills || 'No especificados.'}</p>
                                    </div>
                                    <div>
                                        <h5 className="font-bold text-brand-accent mb-1">Psicología y Personalidad</h5>
                                        <p className="whitespace-pre-wrap">{char.psychology}</p>
                                    </div>
                                    <div>
                                        <h5 className="font-bold text-brand-accent mb-1">Historia de Fondo</h5>
                                        <p className="whitespace-pre-wrap">{char.backstory}</p>
                                    </div>
                                    <div>
                                        <h5 className="font-bold text-brand-accent mb-1">Relaciones</h5>
                                        <p className="whitespace-pre-wrap">{char.relationships}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                );
              })}
            </div>
          </div>
        );
      case MemoryView.World:
         return (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-brand-accent">Atlas del Mundo</h3>
              <button onClick={() => openModal(MemoryView.World)} className={commonButtonClass}><PlusIcon className="h-5 w-5"/><span>Añadir Ubicación</span></button>
            </div>
            <AIAssistant view={MemoryView.World} onGenerate={handleAIGenerate} />
            <div className="space-y-4">
              {project.memoryCore.locations.map(loc => {
                const resolvedImg = resolveImageUrl(loc.imageUrl);
                return (
                    <div key={loc.id} className="bg-brand-secondary rounded-lg shadow-lg overflow-hidden">
                        <div className="p-4 flex justify-between items-center cursor-pointer" onClick={() => toggleExpand(loc.id)}>
                            <h4 className="text-lg font-bold text-brand-text-primary">{loc.name}</h4>
                            <div className="flex items-center space-x-2">
                                <button onClick={(e) => { e.stopPropagation(); openModal(MemoryView.World, loc); }} className="p-2 hover:bg-slate-600 rounded"><EditIcon className="h-5 w-5"/></button>
                                <button onClick={(e) => { e.stopPropagation(); openDeleteConfirm(MemoryView.World, loc.id, loc.name); }} className="p-2 hover:bg-slate-600 rounded text-red-400 hover:text-red-300"><TrashIcon className="h-5 w-5"/></button>
                                {expandedIds.has(loc.id) ? <ChevronUpIcon className="h-5 w-5"/> : <ChevronDownIcon className="h-5 w-5"/>}
                            </div>
                        </div>
                        {expandedIds.has(loc.id) && (
                             <div className="p-4 border-t border-slate-700 flex flex-col md:flex-row gap-4">
                                <div className="flex-shrink-0 w-full md:w-48">
                                    {resolvedImg ? (
                                        <img src={resolvedImg} alt={loc.name} className="w-full h-auto object-cover rounded-md" />
                                    ) : (
                                        <div className="w-full h-48 bg-slate-700 flex items-center justify-center rounded-md">
                                            <WorldIcon className="h-16 w-16 text-slate-500" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-grow">
                                    <h5 className="font-bold text-brand-accent">Descripción</h5>
                                    <p className="text-sm whitespace-pre-wrap">{loc.description}</p>
                                </div>
                            </div>
                        )}
                    </div>
                );
              })}
            </div>
          </div>
        );
      case MemoryView.Plot:
        return (
          <div>
             <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-brand-accent">Lienzo de la Trama</h3>
              <button onClick={() => openModal(MemoryView.Plot)} className={commonButtonClass}><PlusIcon className="h-5 w-5"/><span>Añadir Punto</span></button>
            </div>
            <div className="bg-slate-900 p-4 rounded-lg border border-brand-secondary mb-6">
                <h4 className="text-lg font-semibold mb-2 text-brand-accent">Ayudante IA</h4>
                <p className="text-sm text-brand-text-secondary mb-3">Genera una estructura de trama inicial basada en la sinopsis de tu proyecto.</p>
                <button
                    onClick={handleAIGeneratePlot}
                    disabled={isPlotLoading}
                    className="bg-brand-accent text-white font-bold py-2 px-4 rounded-md hover:bg-sky-500 transition-colors duration-200 disabled:bg-slate-600 flex justify-center items-center w-full"
                >
                    {isPlotLoading ? <Spinner className="h-5 w-5"/> : 'Generar Estructura con IA'}
                </button>
            </div>
            <div className="space-y-4">
              {project.memoryCore.plotPoints.map(point => {
                 const resolvedImg = resolveImageUrl(point.imageUrl);
                 return (
                    <div key={point.id} className="bg-brand-secondary rounded-lg shadow-lg overflow-hidden">
                        <div className="p-4 flex justify-between items-center cursor-pointer" onClick={() => toggleExpand(point.id)}>
                            <h4 className="text-lg font-bold text-brand-text-primary">{point.title}</h4>
                            <div className="flex items-center space-x-2">
                                <button onClick={(e) => { e.stopPropagation(); openModal(MemoryView.Plot, point); }} className="p-2 hover:bg-slate-600 rounded"><EditIcon className="h-5 w-5"/></button>
                                <button onClick={(e) => { e.stopPropagation(); openDeleteConfirm(MemoryView.Plot, point.id, point.title); }} className="p-2 hover:bg-slate-600 rounded text-red-400 hover:text-red-300"><TrashIcon className="h-5 w-5"/></button>
                                {expandedIds.has(point.id) ? <ChevronUpIcon className="h-5 w-5"/> : <ChevronDownIcon className="h-5 w-5"/>}
                            </div>
                        </div>
                        {expandedIds.has(point.id) && (
                             <div className="p-4 border-t border-slate-700 flex flex-col md:flex-row gap-4">
                                <div className="flex-shrink-0 w-full md:w-48">
                                    {resolvedImg ? (
                                        <img src={resolvedImg} alt={point.title} className="w-full h-auto object-cover rounded-md" />
                                    ) : (
                                        <div className="w-full h-48 bg-slate-700 flex items-center justify-center rounded-md">
                                            <PlotIcon className="h-16 w-16 text-slate-500" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-grow">
                                    <h5 className="font-bold text-brand-accent">Descripción</h5>
                                    <p className="text-sm whitespace-pre-wrap">{point.description}</p>
                                </div>
                            </div>
                        )}
                    </div>
                );
              })}
            </div>
          </div>
        );
      default:
        return null;
    }
  };
  
  const NavButton: React.FC<{
    label: string, 
    icon: React.ReactNode, 
    view: MemoryView
  }> = ({label, icon, view}) => (
    <button
        onClick={() => setActiveView(view)}
        className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors duration-200 w-full sm:w-auto justify-center sm:justify-start ${activeView === view ? 'bg-brand-accent text-white' : 'bg-brand-secondary hover:bg-slate-600'}`}
    >
        {icon}
        <span>{label}</span>
    </button>
  );

  const handleSynopsisChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setProject(p => ({...p, synopsis: e.target.value}));
  }
  const handleStyleSeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setProject(p => ({...p, styleSeed: e.target.value}));
  }
  const handleWritingStyleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setProject(p => ({...p, writingStyle: e.target.value}));
  }

  return (
    <>
      <MemoryModal 
        isOpen={modalState.isOpen}
        view={modalState.view}
        data={modalState.data}
        project={project}
        onClose={closeModal}
        onSave={handleSave}
      />
      <DeleteConfirmModal
        isOpen={deleteState.isOpen}
        title={deleteState.name}
        onClose={() => setDeleteState({...deleteState, isOpen: false})}
        onConfirm={confirmDelete}
      />
      <div className="p-4 md:p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b-2 border-brand-secondary pb-2 mb-6 gap-2">
            <h2 className="text-2xl md:text-3xl font-bold">Núcleo de Memoria</h2>
            <button onClick={() => setIsSettingsExpanded(!isSettingsExpanded)} className="flex items-center space-x-2 text-sm text-brand-text-secondary hover:text-brand-accent">
                <span>Ajustes del Proyecto</span>
                {isSettingsExpanded ? <ChevronUpIcon className="h-5 w-5" /> : <ChevronDownIcon className="h-5 w-5" />}
            </button>
        </div>
        {isSettingsExpanded && (
            <div className="bg-slate-900 p-4 rounded-lg border border-brand-secondary mb-6 space-y-4">
                <div>
                    <label htmlFor="project-synopsis" className="text-lg font-semibold mb-2 block text-brand-accent">Sinopsis y Temática Principal</label>
                    <textarea 
                        id="project-synopsis"
                        value={project.synopsis}
                        onChange={handleSynopsisChange}
                        rows={4}
                        className="w-full bg-brand-secondary rounded-md p-3 focus:ring-1 focus:ring-brand-accent focus:outline-none"
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="style-seed" className="text-lg font-semibold mb-2 block text-brand-accent">Semilla de Estilo Visual</label>
                        <input
                            id="style-seed"
                            type="text"
                            value={project.styleSeed}
                            onChange={handleStyleSeedChange}
                            placeholder="ej: Anime Shōnen de los 90, Acuarela Cyberpunk"
                            className="w-full bg-brand-secondary rounded-md p-3 focus:ring-1 focus:ring-brand-accent focus:outline-none"
                        />
                    </div>
                    <div>
                        <label htmlFor="writing-style" className="text-lg font-semibold mb-2 block text-brand-accent">Estilo de Narrativa (POV, Tono, Ritmo)</label>
                        <input
                            id="writing-style"
                            type="text"
                            value={project.writingStyle || ''}
                            onChange={handleWritingStyleChange}
                            placeholder="ej: Primera persona, introspectivo, diálogos rápidos. O: Tercera persona omnisciente, estilo victoriano."
                            className="w-full bg-brand-secondary rounded-md p-3 focus:ring-1 focus:ring-brand-accent focus:outline-none"
                        />
                    </div>
                </div>
            </div>
        )}
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4 mb-6">
          <NavButton label="Personajes" icon={<CharacterIcon className="h-5 w-5"/>} view={MemoryView.Characters} />
          <NavButton label="Atlas del Mundo" icon={<WorldIcon className="h-5 w-5"/>} view={MemoryView.World} />
          <NavButton label="Lienzo de la Trama" icon={<PlotIcon className="h-5 w-5"/>} view={MemoryView.Plot} />
        </div>
        <div>{renderView()}</div>
      </div>
    </>
  );
};
