
import React, { useState, useEffect } from 'react';
import type { Project, Character, Location, PlotPoint, GeneratedImage, ManuscriptVersion } from '../types';
import { CharacterIcon, WorldIcon, PlotIcon, PlusIcon, EditIcon, TrashIcon, ChevronDownIcon, ChevronUpIcon, Spinner, SparklesIcon, CheckIcon, ImageIcon, ClockIcon, XIcon, RefreshIcon } from './Icons';
import { generateCharacterDetails, generateLocationDetails, generatePlotStructure, enrichCharacterProfile } from '../services/geminiService';
import { saveEntityVersion, getEntityHistory, saveProjectMetadataVersion, getProjectMetadataHistory } from '../services/firebase';

interface MemoryCoreManagerProps {
  project: Project;
  setProject: React.Dispatch<React.SetStateAction<Project>>;
}

export enum MemoryView {
  Characters,
  World,
  Plot,
}

// Helper function to resolve image URL from ID or direct Data URL
const resolveImage = (imageUrl: string | undefined, gallery: GeneratedImage[] | undefined): string | undefined => {
    if (!imageUrl) return undefined;
    // Legacy support for direct base64
    if (imageUrl.startsWith('data:')) return imageUrl;
    // Lookup in gallery
    const galleryImage = gallery?.find(g => g.id === imageUrl);
    return galleryImage ? galleryImage.src : undefined;
};

// --- History Modal (Generic) ---
const HistoryViewerModal: React.FC<{
    isOpen: boolean;
    title: string;
    isLoading: boolean;
    history: ManuscriptVersion[];
    onClose: () => void;
    onRestore: (data: any) => void;
    onSnapshot: () => void;
    isSaving: boolean;
}> = ({ isOpen, title, isLoading, history, onClose, onRestore, onSnapshot, isSaving }) => {
    const [selectedVersion, setSelectedVersion] = useState<ManuscriptVersion | null>(null);

    useEffect(() => {
        if (history.length > 0) setSelectedVersion(history[0]);
    }, [history]);

    if (!isOpen) return null;

    // Helper to render JSON content nicely
    const renderContent = (jsonString: string) => {
        try {
            const data = JSON.parse(jsonString);
            return Object.entries(data).map(([key, value]) => {
                // Skip large fields or ids for preview clarity if needed
                if (key === 'id' || key === 'imageUrl') return null;
                if (!value) return null;
                return (
                    <div key={key} className="mb-2">
                        <strong className="text-brand-accent capitalize">{key}: </strong>
                        <span className="text-slate-300">{String(value)}</span>
                    </div>
                );
            });
        } catch (e) {
            return <div className="text-red-400">Error leyendo datos de versión.</div>;
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[80] backdrop-blur-sm p-4">
            <div className="bg-slate-900 rounded-lg shadow-2xl w-full max-w-4xl border border-brand-secondary h-[80vh] flex flex-col">
                <div className="p-4 border-b border-brand-secondary flex justify-between items-center bg-slate-800/50">
                    <h3 className="text-xl font-bold text-brand-accent flex items-center">
                        <ClockIcon className="h-6 w-6 mr-2" />
                        Historial: {title}
                    </h3>
                    <div className="flex items-center space-x-2">
                         <button 
                            onClick={onSnapshot}
                            disabled={isSaving}
                            className="text-xs flex items-center space-x-1 px-3 py-1.5 bg-brand-secondary hover:bg-slate-700 rounded text-brand-text-primary transition-colors border border-slate-600"
                        >
                            {isSaving ? <Spinner className="h-3 w-3"/> : <PlusIcon className="h-3 w-3"/>}
                            <span>Crear Snapshot</span>
                        </button>
                        <button onClick={onClose} className="text-slate-400 hover:text-white p-2"><XIcon className="h-6 w-6"/></button>
                    </div>
                </div>

                <div className="flex-grow flex overflow-hidden">
                    {/* Sidebar Lista */}
                    <div className="w-64 bg-slate-800/30 border-r border-brand-secondary flex flex-col">
                         {isLoading ? (
                             <div className="flex justify-center items-center p-10"><Spinner className="h-6 w-6"/></div>
                         ) : (
                             <div className="flex-grow overflow-y-auto p-2 space-y-1">
                                 {history.length === 0 && <p className="text-slate-500 text-xs text-center mt-4">No hay historial.</p>}
                                 {history.map(ver => (
                                     <button
                                        key={ver.id}
                                        onClick={() => setSelectedVersion(ver)}
                                        className={`w-full text-left p-3 rounded border transition-colors ${
                                            selectedVersion?.id === ver.id 
                                            ? 'bg-brand-accent/20 border-brand-accent text-white' 
                                            : 'bg-transparent border-transparent hover:bg-slate-700 text-brand-text-secondary'
                                        }`}
                                     >
                                         <p className="font-bold text-sm">{new Date(ver.timestamp).toLocaleString()}</p>
                                         <p className="text-[10px] opacity-70 truncate">{ver.note || 'Sin nota'}</p>
                                     </button>
                                 ))}
                             </div>
                         )}
                    </div>

                    {/* Preview Area */}
                    <div className="flex-grow flex flex-col p-4 bg-brand-primary min-w-0">
                        {selectedVersion ? (
                            <>
                                <div className="mb-2 flex justify-between items-center border-b border-slate-700 pb-2">
                                    <h4 className="text-sm font-bold text-brand-text-secondary">Datos de la Versión</h4>
                                    <button 
                                        onClick={() => {
                                            if(confirm("¿Restaurar esta versión? Se sobrescribirán los datos actuales.")) {
                                                try {
                                                    const data = JSON.parse(selectedVersion.content);
                                                    onRestore(data);
                                                    onClose();
                                                } catch(e) { alert("Error al parsear datos de restauración."); }
                                            }
                                        }}
                                        className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white font-bold text-xs rounded flex items-center space-x-1"
                                    >
                                        <RefreshIcon className="h-3 w-3"/>
                                        <span>Restaurar</span>
                                    </button>
                                </div>
                                <div className="flex-grow overflow-y-auto text-sm">
                                    {renderContent(selectedVersion.content)}
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-500">
                                <ClockIcon className="h-16 w-16 mb-4 opacity-20"/>
                                <p>Selecciona una versión.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Image Picker Modal ---
const ImagePickerModal: React.FC<{
    isOpen: boolean;
    gallery: GeneratedImage[];
    onSelect: (imageId: string) => void;
    onClose: () => void;
}> = ({ isOpen, gallery, onSelect, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[70] p-4 backdrop-blur-sm">
            <div className="bg-slate-900 rounded-lg shadow-2xl p-6 w-full max-w-3xl border border-brand-secondary flex flex-col max-h-[80vh]">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-brand-accent">Seleccionar Imagen de Galería</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><div className="w-6 h-6">✕</div></button>
                </div>
                
                <div className="flex-grow overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-2">
                    {gallery.length === 0 ? (
                        <div className="col-span-full text-center text-slate-500 py-10">
                            No hay imágenes en la galería. Ve al Estudio Visual para generar algunas.
                        </div>
                    ) : (
                        gallery.map(img => (
                            <button 
                                key={img.id} 
                                onClick={() => onSelect(img.id)}
                                className="relative group aspect-square rounded-lg overflow-hidden border border-slate-700 hover:border-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-accent"
                            >
                                <img src={img.src} alt="Gallery thumbnail" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                            </button>
                        ))
                    )}
                </div>
                <div className="mt-4 flex justify-end">
                     <button onClick={onClose} className="px-4 py-2 bg-brand-secondary rounded hover:bg-slate-600 transition-colors">Cancelar</button>
                </div>
            </div>
        </div>
    );
};

const MemoryModal: React.FC<{
    isOpen: boolean;
    view: MemoryView | null;
    data: Character | Location | PlotPoint | null;
    project: Project; 
    onClose: () => void;
    onSave: (item: any) => void;
}> = ({ isOpen, view, data, project, onClose, onSave }) => {
    const [formData, setFormData] = useState<any>({});
    const [isEnriching, setIsEnriching] = useState(false);
    const [showImagePicker, setShowImagePicker] = useState(false);
    
    // History State
    const [showHistory, setShowHistory] = useState(false);
    const [historyList, setHistoryList] = useState<ManuscriptVersion[]>([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    const [isSnapshotSaving, setIsSnapshotSaving] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        if (data) {
            setFormData(data);
        } else {
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

    const handleImageSelect = (imageId: string) => {
        setFormData({ ...formData, imageUrl: imageId });
        setShowImagePicker(false);
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
        
        const otherCharactersSummary = project.memoryCore.characters
            .filter(c => c.id !== formData.id) 
            .map(c => `- ${c.name} (${c.role})`)
            .join('\n');

        setIsEnriching(true);
        try {
            const enriched = await enrichCharacterProfile(formData, project.synopsis, otherCharactersSummary);
            setFormData((prev: any) => ({ ...prev, ...enriched }));
        } catch (e) {
            alert("Error al enriquecer el personaje. Revisa la consola.");
        } finally {
            setIsEnriching(false);
        }
    };
    
    // --- History Logic for Modal ---
    const getCollectionName = () => {
        if (view === MemoryView.Characters) return 'characters';
        if (view === MemoryView.World) return 'locations';
        if (view === MemoryView.Plot) return 'plotPoints';
        return '';
    };

    const handleOpenHistory = async () => {
        if (!formData.id) {
            alert("Guarda el elemento primero para activar el historial.");
            return;
        }
        setShowHistory(true);
        setIsHistoryLoading(true);
        const col = getCollectionName();
        if (col) {
            // Auto snapshot on open history if fields are filled
            if(formData.name) {
                 await saveEntityVersion(project.id, col, formData.id, formData, "Antes de ver historial");
            }
            const hist = await getEntityHistory(project.id, col, formData.id);
            setHistoryList(hist);
        }
        setIsHistoryLoading(false);
    };
    
    const handleManualSnapshot = async () => {
         if (!formData.id) return;
         setIsSnapshotSaving(true);
         const col = getCollectionName();
         if(col) {
            await saveEntityVersion(project.id, col, formData.id, formData, "Snapshot Manual");
            const hist = await getEntityHistory(project.id, col, formData.id);
            setHistoryList(hist);
         }
         setIsSnapshotSaving(false);
    };

    const handleRestoreHistory = (restoredData: any) => {
        setFormData(restoredData);
    };

    // Resolve image for preview in Modal
    const resolvedImg = resolveImage(formData.imageUrl, project.gallery);
    const title = data && data.id ? "Editar" : "Añadir Nuevo";
    const viewName = view === MemoryView.Characters ? "Personaje" : view === MemoryView.World ? "Ubicación" : "Punto de Trama";

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
             <ImagePickerModal 
                isOpen={showImagePicker} 
                gallery={project.gallery || []} 
                onSelect={handleImageSelect} 
                onClose={() => setShowImagePicker(false)} 
            />
            <HistoryViewerModal
                isOpen={showHistory}
                title={formData.name || formData.title || 'Elemento'}
                isLoading={isHistoryLoading}
                history={historyList}
                onClose={() => setShowHistory(false)}
                onRestore={handleRestoreHistory}
                onSnapshot={handleManualSnapshot}
                isSaving={isSnapshotSaving}
            />

            <div className="bg-slate-900 rounded-lg shadow-xl p-6 w-full max-w-lg border border-brand-secondary overflow-y-auto max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-bold text-brand-accent">{`${title} ${viewName}`}</h3>
                    {formData.id && (
                        <button 
                            onClick={handleOpenHistory} 
                            className="text-brand-text-secondary hover:text-white p-2 rounded hover:bg-slate-700"
                            title="Ver Historial de Cambios"
                        >
                            <ClockIcon className="h-5 w-5"/>
                        </button>
                    )}
                </div>
                
                {/* Image Preview & Picker in Modal */}
                <div className="mb-6">
                    <div className="relative w-full h-48 bg-slate-800 rounded-lg border border-slate-700 overflow-hidden group">
                        {resolvedImg ? (
                            <img src={resolvedImg} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
                                <ImageIcon className="w-12 h-12 mb-2 opacity-50" />
                                <span className="text-sm">Sin imagen asignada</span>
                            </div>
                        )}
                        {/* Overlay Button */}
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                                type="button"
                                onClick={() => setShowImagePicker(true)}
                                className="px-4 py-2 bg-brand-accent text-white rounded-full font-bold shadow-lg hover:bg-sky-400 flex items-center space-x-2 transform hover:scale-105 transition-all"
                            >
                                <ImageIcon className="w-4 h-4" />
                                <span>{resolvedImg ? 'Cambiar Imagen' : 'Seleccionar de Galería'}</span>
                            </button>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off" data-form-type="other" translate="no">
                    {/* Character Specific Fields */}
                    {view === MemoryView.Characters && (
                         <>
                            <div className="flex justify-end mb-2">
                                <button 
                                    type="button" 
                                    onClick={handleEnrichCharacter} 
                                    disabled={isEnriching}
                                    className="text-xs flex items-center space-x-1 text-sky-400 hover:text-sky-300 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded transition-colors border border-sky-900 w-full sm:w-auto justify-center"
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
                        </>
                    )}
                    
                    {/* World Specific Fields */}
                    {view === MemoryView.World && (
                         <>
                            <input name="name" value={formData.name || ''} onChange={handleChange} placeholder="Nombre de la Ubicación" className="w-full bg-brand-secondary p-2 rounded" required />
                            <textarea name="description" value={formData.description || ''} onChange={handleChange} placeholder="Descripción" className="w-full bg-brand-secondary p-2 rounded h-40" />
                        </>
                    )}

                    {/* Plot Specific Fields */}
                    {view === MemoryView.Plot && (
                         <>
                            <input name="title" value={formData.title || ''} onChange={handleChange} placeholder="Título del Punto de Trama" className="w-full bg-brand-secondary p-2 rounded" required />
                            <textarea name="description" value={formData.description || ''} onChange={handleChange} placeholder="Descripción" className="w-full bg-brand-secondary p-2 rounded h-40" />
                        </>
                    )}

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
                            className="w-full sm:w-auto flex items-center justify-center space-x-2 px-4 py-3 sm:py-2 bg-brand-accent text-white rounded hover:bg-sky-500 transition-colors font-semibold"
                        >
                            <CheckIcon className="h-4 w-4"/>
                            <span>Guardar</span>
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

  // Metadata History State
  const [showMetaHistory, setShowMetaHistory] = useState(false);
  const [metaHistoryList, setMetaHistoryList] = useState<ManuscriptVersion[]>([]);
  const [isMetaHistoryLoading, setIsMetaHistoryLoading] = useState(false);
  const [isMetaSnapshotSaving, setIsMetaSnapshotSaving] = useState(false);

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
            
            // Sync Gallery
            let updatedGallery = prev.gallery;
            if (newItem.imageUrl) {
                updatedGallery = (prev.gallery || []).map(img => {
                    if (img.id === newItem.imageUrl) {
                        let typePrefix = '';
                        if (activeView === MemoryView.Characters) typePrefix = 'character';
                        if (activeView === MemoryView.World) typePrefix = 'location';
                        if (activeView === MemoryView.Plot) typePrefix = 'plot';
                        return { ...img, assignedToId: `${typePrefix}-${newItem.id}` };
                    }
                    return img;
                });
            }

            return { 
                ...prev, 
                gallery: updatedGallery,
                memoryCore: { ...prev.memoryCore, [key]: updatedItems } 
            };
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
  
  // --- Metadata History Handlers ---
  const handleOpenMetaHistory = async () => {
      setShowMetaHistory(true);
      setIsMetaHistoryLoading(true);
      // Auto snapshot current state
      const currentMeta = {
          synopsis: project.synopsis,
          styleSeed: project.styleSeed,
          writingStyle: project.writingStyle
      };
      await saveProjectMetadataVersion(project.id, currentMeta, "Antes de ver historial");
      const hist = await getProjectMetadataHistory(project.id);
      setMetaHistoryList(hist);
      setIsMetaHistoryLoading(false);
  }

  const handleManualMetaSnapshot = async () => {
      setIsMetaSnapshotSaving(true);
      const currentMeta = {
          synopsis: project.synopsis,
          styleSeed: project.styleSeed,
          writingStyle: project.writingStyle
      };
      await saveProjectMetadataVersion(project.id, currentMeta, "Snapshot Manual");
      const hist = await getProjectMetadataHistory(project.id);
      setMetaHistoryList(hist);
      setIsMetaSnapshotSaving(false);
  }

  const handleRestoreMeta = (data: any) => {
      setProject(prev => ({
          ...prev,
          synopsis: data.synopsis || prev.synopsis,
          styleSeed: data.styleSeed || prev.styleSeed,
          writingStyle: data.writingStyle || prev.writingStyle
      }));
  }


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
                const resolvedImg = resolveImage(char.imageUrl, project.gallery);
                return (
                    <div key={char.id} className="bg-brand-secondary rounded-lg shadow-lg overflow-hidden border border-slate-700/50 hover:border-slate-600 transition-colors">
                        <div className="p-4 flex justify-between items-center cursor-pointer" onClick={() => toggleExpand(char.id)}>
                             <div className="flex items-center space-x-4 overflow-hidden">
                                {/* Thumbnail in List Header */}
                                <div className="flex-shrink-0 relative group">
                                    {resolvedImg ? (
                                        <img src={resolvedImg} alt={char.name} className="w-12 h-12 rounded-full object-cover border-2 border-slate-600 group-hover:border-brand-accent transition-colors" />
                                    ) : (
                                        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center border-2 border-slate-700 group-hover:border-slate-600">
                                            <CharacterIcon className="h-6 w-6 text-slate-500" />
                                        </div>
                                    )}
                                </div>
                                <h4 className="text-lg font-bold text-brand-text-primary truncate">
                                    {char.name} 
                                    <span className="block text-sm font-normal text-brand-text-secondary">{char.role}</span>
                                </h4>
                            </div>
                            <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
                                <button onClick={(e) => { e.stopPropagation(); openModal(MemoryView.Characters, char); }} className="p-2 hover:bg-slate-700 rounded text-brand-text-secondary hover:text-white"><EditIcon className="h-5 w-5"/></button>
                                <button onClick={(e) => { e.stopPropagation(); openDeleteConfirm(MemoryView.Characters, char.id, char.name); }} className="p-2 hover:bg-slate-700 rounded text-red-400 hover:text-red-300"><TrashIcon className="h-5 w-5"/></button>
                                {expandedIds.has(char.id) ? <ChevronUpIcon className="h-5 w-5"/> : <ChevronDownIcon className="h-5 w-5"/>}
                            </div>
                        </div>
                        {expandedIds.has(char.id) && (
                            <div className="p-4 border-t border-slate-700 flex flex-col md:flex-row gap-6 bg-slate-800/30 animate-fade-in">
                                <div className="flex-shrink-0 w-full md:w-48">
                                    {resolvedImg ? (
                                        <img src={resolvedImg} alt={char.name} className="w-full h-auto object-cover rounded-lg border border-slate-700 shadow-lg" />
                                    ) : (
                                        <div className="w-full h-48 bg-slate-800 flex items-center justify-center rounded-lg border border-slate-700 border-dashed">
                                            <div className="text-center text-slate-500">
                                                <CharacterIcon className="h-12 w-12 mx-auto mb-2" />
                                                <span className="text-xs">Sin imagen</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="flex-grow space-y-4 text-sm">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <h5 className="font-bold text-brand-accent mb-1">Apariencia</h5>
                                            <p className="whitespace-pre-wrap text-slate-300">{char.appearance || 'No especificada.'}</p>
                                        </div>
                                        <div>
                                            <h5 className="font-bold text-brand-accent mb-1">Habilidades</h5>
                                            <p className="whitespace-pre-wrap text-slate-300">{char.skills || 'No especificados.'}</p>
                                        </div>
                                    </div>
                                    <div>
                                        <h5 className="font-bold text-brand-accent mb-1">Psicología</h5>
                                        <p className="whitespace-pre-wrap text-slate-300">{char.psychology}</p>
                                    </div>
                                    <div>
                                        <h5 className="font-bold text-brand-accent mb-1">Historia</h5>
                                        <p className="whitespace-pre-wrap text-slate-300">{char.backstory}</p>
                                    </div>
                                    <div>
                                        <h5 className="font-bold text-brand-accent mb-1">Relaciones</h5>
                                        <p className="whitespace-pre-wrap text-slate-300">{char.relationships}</p>
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
                const resolvedImg = resolveImage(loc.imageUrl, project.gallery);
                return (
                    <div key={loc.id} className="bg-brand-secondary rounded-lg shadow-lg overflow-hidden border border-slate-700/50 hover:border-slate-600 transition-colors">
                        <div className="p-4 flex justify-between items-center cursor-pointer" onClick={() => toggleExpand(loc.id)}>
                             <div className="flex items-center space-x-4 overflow-hidden">
                                {/* Thumbnail */}
                                <div className="flex-shrink-0">
                                    {resolvedImg ? (
                                        <img src={resolvedImg} alt={loc.name} className="w-12 h-12 rounded-md object-cover border-2 border-slate-600" />
                                    ) : (
                                        <div className="w-12 h-12 rounded-md bg-slate-800 flex items-center justify-center border-2 border-slate-700">
                                            <WorldIcon className="h-6 w-6 text-slate-500" />
                                        </div>
                                    )}
                                </div>
                                <h4 className="text-lg font-bold text-brand-text-primary truncate">{loc.name}</h4>
                            </div>
                            <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
                                <button onClick={(e) => { e.stopPropagation(); openModal(MemoryView.World, loc); }} className="p-2 hover:bg-slate-700 rounded text-brand-text-secondary hover:text-white"><EditIcon className="h-5 w-5"/></button>
                                <button onClick={(e) => { e.stopPropagation(); openDeleteConfirm(MemoryView.World, loc.id, loc.name); }} className="p-2 hover:bg-slate-700 rounded text-red-400 hover:text-red-300"><TrashIcon className="h-5 w-5"/></button>
                                {expandedIds.has(loc.id) ? <ChevronUpIcon className="h-5 w-5"/> : <ChevronDownIcon className="h-5 w-5"/>}
                            </div>
                        </div>
                        {expandedIds.has(loc.id) && (
                             <div className="p-4 border-t border-slate-700 flex flex-col md:flex-row gap-4 bg-slate-800/30 animate-fade-in">
                                <div className="flex-shrink-0 w-full md:w-48">
                                    {resolvedImg ? (
                                        <img src={resolvedImg} alt={loc.name} className="w-full h-auto object-cover rounded-lg border border-slate-700 shadow-lg" />
                                    ) : (
                                        <div className="w-full h-48 bg-slate-800 flex items-center justify-center rounded-lg border border-slate-700 border-dashed">
                                            <WorldIcon className="h-12 w-12 text-slate-500" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-grow">
                                    <h5 className="font-bold text-brand-accent mb-2">Descripción</h5>
                                    <p className="text-sm whitespace-pre-wrap text-slate-300">{loc.description}</p>
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
                 const resolvedImg = resolveImage(point.imageUrl, project.gallery);
                 return (
                    <div key={point.id} className="bg-brand-secondary rounded-lg shadow-lg overflow-hidden border border-slate-700/50 hover:border-slate-600 transition-colors">
                        <div className="p-4 flex justify-between items-center cursor-pointer" onClick={() => toggleExpand(point.id)}>
                            <div className="flex items-center space-x-4 overflow-hidden">
                                {/* Thumbnail */}
                                <div className="flex-shrink-0">
                                    {resolvedImg ? (
                                        <img src={resolvedImg} alt={point.title} className="w-12 h-12 rounded-md object-cover border-2 border-slate-600" />
                                    ) : (
                                        <div className="w-12 h-12 rounded-md bg-slate-800 flex items-center justify-center border-2 border-slate-700">
                                            <PlotIcon className="h-6 w-6 text-slate-500" />
                                        </div>
                                    )}
                                </div>
                                <h4 className="text-lg font-bold text-brand-text-primary truncate">{point.title}</h4>
                            </div>
                            <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
                                <button onClick={(e) => { e.stopPropagation(); openModal(MemoryView.Plot, point); }} className="p-2 hover:bg-slate-700 rounded text-brand-text-secondary hover:text-white"><EditIcon className="h-5 w-5"/></button>
                                <button onClick={(e) => { e.stopPropagation(); openDeleteConfirm(MemoryView.Plot, point.id, point.title); }} className="p-2 hover:bg-slate-700 rounded text-red-400 hover:text-red-300"><TrashIcon className="h-5 w-5"/></button>
                                {expandedIds.has(point.id) ? <ChevronUpIcon className="h-5 w-5"/> : <ChevronDownIcon className="h-5 w-5"/>}
                            </div>
                        </div>
                        {expandedIds.has(point.id) && (
                             <div className="p-4 border-t border-slate-700 flex flex-col md:flex-row gap-4 bg-slate-800/30 animate-fade-in">
                                <div className="flex-shrink-0 w-full md:w-48">
                                    {resolvedImg ? (
                                        <img src={resolvedImg} alt={point.title} className="w-full h-auto object-cover rounded-lg border border-slate-700 shadow-lg" />
                                    ) : (
                                        <div className="w-full h-48 bg-slate-800 flex items-center justify-center rounded-lg border border-slate-700 border-dashed">
                                            <PlotIcon className="h-12 w-12 text-slate-500" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-grow">
                                    <h5 className="font-bold text-brand-accent mb-2">Descripción</h5>
                                    <p className="text-sm whitespace-pre-wrap text-slate-300">{point.description}</p>
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
      <HistoryViewerModal 
        isOpen={showMetaHistory}
        title="Ajustes del Proyecto (Sinopsis/Estilo)"
        isLoading={isMetaHistoryLoading}
        history={metaHistoryList}
        onClose={() => setShowMetaHistory(false)}
        onRestore={handleRestoreMeta}
        onSnapshot={handleManualMetaSnapshot}
        isSaving={isMetaSnapshotSaving}
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
            <div className="bg-slate-900 p-4 rounded-lg border border-brand-secondary mb-6 space-y-4 relative">
                <div className="flex justify-between items-center border-b border-brand-secondary pb-2 mb-4">
                     <h3 className="text-lg font-bold text-brand-accent">Configuración Global</h3>
                     <button 
                        onClick={handleOpenMetaHistory}
                        className="flex items-center space-x-1 text-xs text-brand-text-secondary hover:text-white px-2 py-1 rounded hover:bg-slate-700 transition-colors"
                     >
                         <ClockIcon className="h-4 w-4"/>
                         <span>Historial de Cambios</span>
                     </button>
                </div>

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
