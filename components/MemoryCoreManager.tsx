import React, { useState, useEffect } from 'react';
import type { Project, Character, Location, PlotPoint } from '../types';
import { CharacterIcon, WorldIcon, PlotIcon, PlusIcon, EditIcon, TrashIcon, ChevronDownIcon, ChevronUpIcon, Spinner } from './Icons';
import { generateCharacterDetails, generateLocationDetails, generatePlotStructure } from '../services/geminiService';

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
    onClose: () => void;
    onSave: (item: any) => void;
}> = ({ isOpen, view, data, onClose, onSave }) => {
    const [formData, setFormData] = useState<any>({});

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

    const renderFormFields = () => {
        const commonFields = (
            <input name="imageUrl" value={formData.imageUrl || ''} onChange={handleChange} placeholder="URL de la Imagen" className="w-full bg-brand-secondary p-2 rounded" />
        );

        switch (view) {
            case MemoryView.Characters:
                return (
                    <>
                        <input name="name" value={formData.name || ''} onChange={handleChange} placeholder="Nombre" className="w-full bg-brand-secondary p-2 rounded" required />
                        <input name="age" value={formData.age || ''} onChange={handleChange} placeholder="Edad" className="w-full bg-brand-secondary p-2 rounded" />
                        <input name="role" value={formData.role || ''} onChange={handleChange} placeholder="Rol (Protagonista, etc.)" className="w-full bg-brand-secondary p-2 rounded" />
                        <textarea name="appearance" value={formData.appearance || ''} onChange={handleChange} placeholder="Apariencia" className="w-full bg-brand-secondary p-2 rounded h-24" />
                        <textarea name="skills" value={formData.skills || ''} onChange={handleChange} placeholder="Habilidades y Poderes" className="w-full bg-brand-secondary p-2 rounded h-24" />
                        <textarea name="psychology" value={formData.psychology || ''} onChange={handleChange} placeholder="Psicología y Personalidad" className="w-full bg-brand-secondary p-2 rounded h-24" />
                        <textarea name="backstory" value={formData.backstory || ''} onChange={handleChange} placeholder="Historia de Fondo" className="w-full bg-brand-secondary p-2 rounded h-24" />
                        <textarea name="relationships" value={formData.relationships || ''} onChange={handleChange} placeholder="Relaciones" className="w-full bg-brand-secondary p-2 rounded h-24" />
                        {commonFields}
                    </>
                );
            case MemoryView.World:
                return (
                    <>
                        <input name="name" value={formData.name || ''} onChange={handleChange} placeholder="Nombre de la Ubicación" className="w-full bg-brand-secondary p-2 rounded" required />
                        <textarea name="description" value={formData.description || ''} onChange={handleChange} placeholder="Descripción" className="w-full bg-brand-secondary p-2 rounded h-40" />
                        {commonFields}
                    </>
                );
            case MemoryView.Plot:
                return (
                    <>
                        <input name="title" value={formData.title || ''} onChange={handleChange} placeholder="Título del Punto de Trama" className="w-full bg-brand-secondary p-2 rounded" required />
                        <textarea name="description" value={formData.description || ''} onChange={handleChange} placeholder="Descripción" className="w-full bg-brand-secondary p-2 rounded h-40" />
                        {commonFields}
                    </>
                );
            default: return null;
        }
    };
    
    const title = data && data.id ? "Editar" : "Añadir Nuevo";
    const viewName = view === MemoryView.Characters ? "Personaje" : view === MemoryView.World ? "Ubicación" : "Punto de Trama";

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-slate-900 rounded-lg shadow-xl p-6 w-full max-w-lg border border-brand-secondary overflow-y-auto max-h-[90vh]">
                <h3 className="text-xl font-bold mb-4 text-brand-accent">{`${title} ${viewName}`}</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {renderFormFields()}
                    <div className="flex justify-end space-x-3 mt-6">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-brand-secondary rounded hover:bg-slate-600">Cancelar</button>
                        <button type="submit" className="px-4 py-2 bg-brand-accent text-white rounded hover:bg-sky-500">Guardar</button>
                    </div>
                </form>
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
            <div className="flex space-x-2">
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
                    className="bg-brand-accent text-white font-bold py-2 px-4 rounded-md hover:bg-sky-500 transition-colors duration-200 disabled:bg-slate-600 flex justify-center items-center w-32"
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
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);
  const [isPlotLoading, setIsPlotLoading] = useState(false);

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
  
  const handleDelete = (view: MemoryView, id: string) => {
    if (!window.confirm("¿Estás seguro de que quieres eliminar este elemento?")) return;

    const updateProject = (key: 'characters' | 'locations' | 'plotPoints') => {
        setProject(prev => {
            const updatedItems = prev.memoryCore[key].filter(i => i.id !== id);
            return { ...prev, memoryCore: { ...prev.memoryCore, [key]: updatedItems } };
        });
    };

    if (view === MemoryView.Characters) updateProject('characters');
    if (view === MemoryView.World) updateProject('locations');
    if (view === MemoryView.Plot) updateProject('plotPoints');
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
        const newPointsWithIds = plotPoints.map(p => ({...p, id: crypto.randomUUID(), imageUrl: ''}));
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
              {project.memoryCore.characters.map(char => (
                <div key={char.id} className="bg-brand-secondary rounded-lg shadow-lg overflow-hidden">
                    <div className="p-4 flex justify-between items-center cursor-pointer" onClick={() => toggleExpand(char.id)}>
                        <h4 className="text-lg font-bold text-brand-text-primary">{char.name} <span className="text-sm font-normal text-brand-text-secondary ml-2">{char.role}</span></h4>
                        <div className="flex items-center space-x-2">
                            <button onClick={(e) => { e.stopPropagation(); openModal(MemoryView.Characters, char); }} className="p-2 hover:bg-slate-600 rounded"><EditIcon className="h-5 w-5"/></button>
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(MemoryView.Characters, char.id); }} className="p-2 hover:bg-slate-600 rounded"><TrashIcon className="h-5 w-5"/></button>
                            {expandedIds.has(char.id) ? <ChevronUpIcon className="h-5 w-5"/> : <ChevronDownIcon className="h-5 w-5"/>}
                        </div>
                    </div>
                    {expandedIds.has(char.id) && (
                        <div className="p-4 border-t border-slate-700 flex flex-col md:flex-row gap-6">
                            <div className="flex-shrink-0 w-full md:w-48">
                                {char.imageUrl ? (
                                    <img src={char.imageUrl} alt={char.name} className="w-full h-auto object-cover rounded-md" />
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
              ))}
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
              {project.memoryCore.locations.map(loc => (
                <div key={loc.id} className="bg-brand-secondary rounded-lg shadow-lg overflow-hidden">
                    <div className="p-4 flex justify-between items-center cursor-pointer" onClick={() => toggleExpand(loc.id)}>
                        <h4 className="text-lg font-bold text-brand-text-primary">{loc.name}</h4>
                        <div className="flex items-center space-x-2">
                            <button onClick={(e) => { e.stopPropagation(); openModal(MemoryView.World, loc); }} className="p-2 hover:bg-slate-600 rounded"><EditIcon className="h-5 w-5"/></button>
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(MemoryView.World, loc.id); }} className="p-2 hover:bg-slate-600 rounded"><TrashIcon className="h-5 w-5"/></button>
                            {expandedIds.has(loc.id) ? <ChevronUpIcon className="h-5 w-5"/> : <ChevronDownIcon className="h-5 w-5"/>}
                        </div>
                    </div>
                    {expandedIds.has(loc.id) && (
                         <div className="p-4 border-t border-slate-700 flex flex-col md:flex-row gap-4">
                            <div className="flex-shrink-0 w-full md:w-48">
                                {loc.imageUrl ? (
                                    <img src={loc.imageUrl} alt={loc.name} className="w-full h-auto object-cover rounded-md" />
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
              ))}
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
              {project.memoryCore.plotPoints.map(point => (
                <div key={point.id} className="bg-brand-secondary rounded-lg shadow-lg overflow-hidden">
                    <div className="p-4 flex justify-between items-center cursor-pointer" onClick={() => toggleExpand(point.id)}>
                        <h4 className="text-lg font-bold text-brand-text-primary">{point.title}</h4>
                        <div className="flex items-center space-x-2">
                            <button onClick={(e) => { e.stopPropagation(); openModal(MemoryView.Plot, point); }} className="p-2 hover:bg-slate-600 rounded"><EditIcon className="h-5 w-5"/></button>
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(MemoryView.Plot, point.id); }} className="p-2 hover:bg-slate-600 rounded"><TrashIcon className="h-5 w-5"/></button>
                            {expandedIds.has(point.id) ? <ChevronUpIcon className="h-5 w-5"/> : <ChevronDownIcon className="h-5 w-5"/>}
                        </div>
                    </div>
                    {expandedIds.has(point.id) && (
                         <div className="p-4 border-t border-slate-700 flex flex-col md:flex-row gap-4">
                            <div className="flex-shrink-0 w-full md:w-48">
                                {point.imageUrl ? (
                                    <img src={point.imageUrl} alt={point.title} className="w-full h-auto object-cover rounded-md" />
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
              ))}
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
        className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors duration-200 ${activeView === view ? 'bg-brand-accent text-white' : 'bg-brand-secondary hover:bg-slate-600'}`}
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

  return (
    <>
      <MemoryModal 
        isOpen={modalState.isOpen}
        view={modalState.view}
        data={modalState.data}
        onClose={closeModal}
        onSave={handleSave}
      />
      <div className="p-4 md:p-6 lg:p-8">
        <div className="flex justify-between items-center border-b-2 border-brand-secondary pb-2 mb-6">
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
                 <div>
                    <label htmlFor="style-seed" className="text-lg font-semibold mb-2 block text-brand-accent">Semilla de Estilo</label>
                    <input
                        id="style-seed"
                        type="text"
                        value={project.styleSeed}
                        onChange={handleStyleSeedChange}
                        placeholder="ej: Anime Shōnen de los 90, Acuarela Cyberpunk"
                        className="w-full bg-brand-secondary rounded-md p-3 focus:ring-1 focus:ring-brand-accent focus:outline-none"
                    />
                </div>
            </div>
        )}
        <div className="flex space-x-2 md:space-x-4 mb-6">
          <NavButton label="Personajes" icon={<CharacterIcon className="h-5 w-5"/>} view={MemoryView.Characters} />
          <NavButton label="Atlas del Mundo" icon={<WorldIcon className="h-5 w-5"/>} view={MemoryView.World} />
          <NavButton label="Lienzo de la Trama" icon={<PlotIcon className="h-5 w-5"/>} view={MemoryView.Plot} />
        </div>
        <div>{renderView()}</div>
      </div>
    </>
  );
};