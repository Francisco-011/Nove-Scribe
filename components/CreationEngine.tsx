
import React, { useState, useEffect } from 'react';
import type { Project, PlotPoint, Character, Location, Inconsistency, ManuscriptVersion } from '../types';
import { generateNarrative, analyzeManuscriptForPlotPoints, analyzeManuscriptForEntities, evolveCharactersFromManuscript, evolveLocationsFromManuscript, checkConsistency } from '../services/geminiService';
import { saveManuscriptVersion, getManuscriptHistory } from '../services/firebase';
import { Spinner, PlusIcon, LightbulbIcon, XIcon, ExportIcon, EditIcon, TrashIcon, ListIcon, CheckIcon, SparklesIcon, CheckCircleIcon, RefreshIcon, ClipboardCheckIcon, AlertIcon, DocumentSearchIcon, ShieldCheckIcon, ClockIcon } from './Icons';

interface CreationEngineProps {
  project: Project;
  setProject: React.Dispatch<React.SetStateAction<Project>>;
}

interface EntitySuggestion {
    name: string;
    justification: string;
}

// --- Subcomponent: Modal for Manuscript Titles ---
const ManuscriptModal: React.FC<{
    isOpen: boolean;
    mode: 'create' | 'rename';
    initialValue: string;
    onClose: () => void;
    onSave: (value: string) => void;
}> = ({ isOpen, mode, initialValue, onClose, onSave }) => {
    const [value, setValue] = useState(initialValue);

    useEffect(() => {
        setValue(initialValue);
    }, [initialValue, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (value.trim()) {
            onSave(value.trim());
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 backdrop-blur-sm p-4">
            <div className="bg-slate-900 rounded-lg shadow-2xl p-6 w-full max-w-md border border-brand-secondary">
                <h3 className="text-xl font-bold mb-4 text-brand-accent">
                    {mode === 'create' ? 'Nuevo Manuscrito/Capítulo' : 'Renombrar Manuscrito'}
                </h3>
                <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off" translate="no">
                    <input 
                        autoFocus
                        value={value} 
                        onChange={e => setValue(e.target.value)} 
                        placeholder="Título del capítulo..." 
                        className="w-full bg-brand-secondary text-white p-3 rounded border border-slate-700 focus:border-brand-accent focus:outline-none" 
                    />
                    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-6">
                        <button type="button" onClick={onClose} className="w-full sm:w-auto px-4 py-3 sm:py-2 bg-transparent text-brand-text-secondary hover:text-white rounded hover:bg-slate-800 transition-colors border border-slate-700 sm:border-none">Cancelar</button>
                        <button 
                            type="submit" 
                            translate="no"
                            className="w-full sm:w-auto flex items-center justify-center space-x-2 px-4 py-3 sm:py-2 bg-brand-accent text-white rounded hover:bg-sky-500 transition-colors shadow-lg"
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

// --- Subcomponent: Delete Confirmation Modal ---
const DeleteConfirmModal: React.FC<{
    isOpen: boolean;
    title: string;
    message: string;
    onClose: () => void;
    onConfirm: () => void;
}> = ({ isOpen, title, message, onClose, onConfirm }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[60] backdrop-blur-sm p-4">
            <div className="bg-slate-900 rounded-lg shadow-2xl p-6 w-full max-w-md border border-red-500/50">
                <h3 className="text-xl font-bold mb-2 text-red-400">{title}</h3>
                <p className="text-brand-text-secondary mb-6">{message}</p>
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

// --- Subcomponent: Draft Scanner Modal ---
const DraftScannerModal: React.FC<{
    isOpen: boolean;
    project: Project;
    onClose: () => void;
    onMerge: (text: string) => void;
}> = ({ isOpen, project, onClose, onMerge }) => {
    const [text, setText] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState<Inconsistency[] | null>(null);

    if (!isOpen) return null;

    const handleAnalyze = async () => {
        if (!text.trim()) return;
        setIsAnalyzing(true);
        try {
            const inconsistencies = await checkConsistency(project, text);
            setResult(inconsistencies);
        } catch (e) {
            alert("Error al analizar el borrador.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleReset = () => {
        setResult(null);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[70] backdrop-blur-sm p-4">
             <div className="bg-slate-900 rounded-lg shadow-2xl w-full max-w-4xl border border-brand-secondary h-[85vh] flex flex-col">
                <div className="p-4 border-b border-brand-secondary flex justify-between items-center bg-slate-800/50">
                    <h3 className="text-xl font-bold text-brand-accent flex items-center">
                        <DocumentSearchIcon className="h-6 w-6 mr-2" />
                        Escáner de Borradores Externos
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><XIcon className="h-6 w-6"/></button>
                </div>
                
                <div className="flex-grow flex flex-col md:flex-row overflow-hidden">
                    {/* Left Pane: Input */}
                    <div className="flex-1 flex flex-col p-4 border-r border-brand-secondary min-h-0">
                        <label className="text-sm text-brand-text-secondary mb-2 font-medium">Pega tu texto externo aquí:</label>
                        <textarea 
                            value={text}
                            onChange={(e) => { setText(e.target.value); if(result) handleReset(); }}
                            placeholder="Pega aquí el capítulo que escribiste en otro lado..."
                            className="flex-grow w-full bg-brand-primary/50 p-4 rounded-lg border border-slate-700 focus:border-brand-accent focus:outline-none resize-none font-mono text-sm text-slate-300"
                        />
                        <div className="mt-4">
                            <button 
                                onClick={handleAnalyze}
                                disabled={isAnalyzing || !text.trim()}
                                className="w-full py-3 bg-brand-accent hover:bg-sky-500 text-white font-bold rounded-lg transition-colors disabled:bg-slate-700 disabled:cursor-not-allowed flex justify-center items-center"
                            >
                                {isAnalyzing ? <Spinner className="h-5 w-5 mr-2"/> : <DocumentSearchIcon className="h-5 w-5 mr-2"/>}
                                {isAnalyzing ? 'Analizando Coherencia...' : 'Escanear en busca de Errores'}
                            </button>
                        </div>
                    </div>

                    {/* Right Pane: Results */}
                    <div className="flex-1 flex flex-col p-4 bg-slate-800/30 overflow-y-auto">
                        <h4 className="text-sm font-bold text-brand-text-secondary mb-4 uppercase tracking-wider">Reporte de Continuidad</h4>
                        
                        {!result && !isAnalyzing && (
                            <div className="flex flex-col items-center justify-center h-64 text-slate-500 opacity-50">
                                <DocumentSearchIcon className="h-16 w-16 mb-4"/>
                                <p className="text-center max-w-xs">Analiza el texto para detectar conflictos con la trama, personajes o reglas del mundo.</p>
                            </div>
                        )}

                        {isAnalyzing && (
                            <div className="flex flex-col items-center justify-center h-64 text-brand-accent animate-pulse">
                                <Spinner className="h-12 w-12 mb-4"/>
                                <p>Consultando el Núcleo de Memoria...</p>
                            </div>
                        )}

                        {result && result.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full animate-fade-in">
                                <div className="bg-green-500/20 p-6 rounded-full mb-4 border-2 border-green-500/50 shadow-lg shadow-green-900/20">
                                    <ShieldCheckIcon className="h-16 w-16 text-green-400" />
                                </div>
                                <h3 className="text-2xl font-bold text-green-400 mb-2">¡Texto Coherente!</h3>
                                <p className="text-slate-400 text-center mb-8">No se detectaron contradicciones con la memoria del proyecto.</p>
                                <button 
                                    onClick={() => { onMerge(text); onClose(); }}
                                    className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg shadow-lg transition-transform hover:scale-105 flex items-center"
                                >
                                    <CheckCircleIcon className="h-5 w-5 mr-2"/>
                                    Fusionar al Manuscrito
                                </button>
                            </div>
                        )}

                        {result && result.length > 0 && (
                            <div className="animate-fade-in pb-20">
                                <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg flex items-center">
                                    <AlertIcon className="h-6 w-6 text-red-400 mr-3 flex-shrink-0"/>
                                    <div>
                                        <p className="font-bold text-red-400">Se detectaron {result.length} posibles conflictos.</p>
                                        <p className="text-xs text-red-300/70">Revisa antes de fusionar.</p>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    {result.map((inc, i) => (
                                        <div key={i} className={`p-3 rounded-lg border ${inc.severity === 'high' ? 'bg-red-900/20 border-red-500/40' : 'bg-amber-900/20 border-amber-500/40'}`}>
                                            <div className="flex justify-between items-start mb-1">
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${inc.severity === 'high' ? 'bg-red-900 text-red-200' : 'bg-amber-900 text-amber-200'}`}>
                                                    {inc.severity}
                                                </span>
                                                <span className="text-[10px] text-slate-500 uppercase">{inc.type}</span>
                                            </div>
                                            <p className="text-sm text-brand-text-primary font-medium mb-2">{inc.description}</p>
                                            <div className="bg-black/30 p-2 rounded text-xs italic text-slate-400 border-l-2 border-slate-600">
                                                "{inc.quote}"
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-6 pt-4 border-t border-slate-700">
                                     <p className="text-xs text-slate-500 mb-3 text-center">¿Quieres añadirlo de todos modos?</p>
                                     <button 
                                        onClick={() => { onMerge(text); onClose(); }}
                                        className="w-full py-2 bg-brand-secondary hover:bg-slate-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center"
                                    >
                                        Ignorar Alertas y Fusionar
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Subcomponent: History Modal ---
const HistoryModal: React.FC<{
    isOpen: boolean;
    projectId: string;
    manuscriptId: string;
    currentContent: string;
    onClose: () => void;
    onRestore: (content: string) => void;
}> = ({ isOpen, projectId, manuscriptId, currentContent, onClose, onRestore }) => {
    const [history, setHistory] = useState<ManuscriptVersion[]>([]);
    const [selectedVersion, setSelectedVersion] = useState<ManuscriptVersion | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Cargar historial al abrir
    useEffect(() => {
        if (!isOpen) return;
        const loadHistory = async () => {
            setIsLoading(true);
            const versions = await getManuscriptHistory(projectId, manuscriptId);
            setHistory(versions);
            if (versions.length > 0) {
                setSelectedVersion(versions[0]);
            }
            setIsLoading(false);
        };
        loadHistory();
    }, [isOpen, projectId, manuscriptId]);

    // Intentar Auto-Snapshot al montar si ha habido cambios recientes y no hay snapshot en X tiempo
    // (Simplificado: Solo comprobamos si la ultima version es diferente al currentContent al abrir el editor, pero aqui lo haremos manual para evitar spam)

    const handleCreateSnapshot = async () => {
        if (!currentContent) return;
        setIsSaving(true);
        await saveManuscriptVersion(projectId, manuscriptId, currentContent, "Snapshot Manual");
        const versions = await getManuscriptHistory(projectId, manuscriptId);
        setHistory(versions);
        if (versions.length > 0) setSelectedVersion(versions[0]);
        setIsSaving(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[70] backdrop-blur-sm p-4">
            <div className="bg-slate-900 rounded-lg shadow-2xl w-full max-w-5xl border border-brand-secondary h-[85vh] flex flex-col">
                <div className="p-4 border-b border-brand-secondary flex justify-between items-center bg-slate-800/50">
                    <h3 className="text-xl font-bold text-brand-accent flex items-center">
                        <ClockIcon className="h-6 w-6 mr-2" />
                        Historial de Versiones
                    </h3>
                    <div className="flex items-center space-x-2">
                         <button 
                            onClick={handleCreateSnapshot}
                            disabled={isSaving}
                            className="text-xs flex items-center space-x-1 px-3 py-1.5 bg-brand-secondary hover:bg-slate-700 rounded text-brand-text-primary transition-colors border border-slate-600"
                        >
                            {isSaving ? <Spinner className="h-3 w-3"/> : <PlusIcon className="h-3 w-3"/>}
                            <span>Crear Snapshot Ahora</span>
                        </button>
                        <button onClick={onClose} className="text-slate-400 hover:text-white p-2"><XIcon className="h-6 w-6"/></button>
                    </div>
                </div>

                <div className="flex-grow flex overflow-hidden">
                    {/* Sidebar Lista de Versiones */}
                    <div className="w-64 bg-slate-800/30 border-r border-brand-secondary flex flex-col">
                         {isLoading ? (
                             <div className="flex justify-center items-center p-10"><Spinner className="h-6 w-6"/></div>
                         ) : (
                             <div className="flex-grow overflow-y-auto p-2 space-y-1">
                                 {history.length === 0 && <p className="text-slate-500 text-xs text-center mt-4">No hay historial guardado aún.</p>}
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
                                <div className="mb-2 flex justify-between items-center">
                                    <h4 className="text-sm font-bold text-brand-text-secondary">Vista Previa de Versión</h4>
                                    <span className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-400">
                                        {selectedVersion.content.length} caracteres
                                    </span>
                                </div>
                                <div className="flex-grow bg-slate-900 border border-slate-700 rounded p-4 overflow-y-auto whitespace-pre-wrap text-sm text-slate-300 font-mono">
                                    {selectedVersion.content}
                                </div>
                                <div className="mt-4 flex justify-end">
                                    <button 
                                        onClick={() => {
                                            if(confirm("¿Estás seguro? Esto reemplazará tu texto actual con esta versión antigua.")) {
                                                onRestore(selectedVersion.content);
                                                onClose();
                                            }
                                        }}
                                        className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded flex items-center space-x-2"
                                    >
                                        <RefreshIcon className="h-4 w-4"/>
                                        <span>Restaurar esta Versión</span>
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-500">
                                <ClockIcon className="h-16 w-16 mb-4 opacity-20"/>
                                <p>Selecciona una versión para verla.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};


export const CreationEngine: React.FC<CreationEngineProps> = ({ project, setProject }) => {
  const [prompt, setPrompt] = useState('');
  const [generatedText, setGeneratedText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isEvolving, setIsEvolving] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  
  const [suggestedPlotPoints, setSuggestedPlotPoints] = useState<Partial<PlotPoint>[]>([]);
  const [suggestedCharacters, setSuggestedCharacters] = useState<EntitySuggestion[]>([]);
  const [suggestedLocations, setSuggestedLocations] = useState<EntitySuggestion[]>([]);
  const [inconsistencies, setInconsistencies] = useState<Inconsistency[]>([]);
  
  // UI State
  const [showSidebar, setShowSidebar] = useState(true); // Desktop sidebar
  const [manuscriptModal, setManuscriptModal] = useState<{isOpen: boolean, mode: 'create' | 'rename', initialValue: string}>({
      isOpen: false, mode: 'create', initialValue: ''
  });
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDraftScannerOpen, setIsDraftScannerOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  const activeManuscript = project.manuscripts.find(m => m.id === project.activeManuscriptId);

  // Auto-Snapshot on Initial Load of Manuscript if changed
  useEffect(() => {
      if(activeManuscript?.id && activeManuscript.content.length > 50) {
          // Check if we should auto-snapshot (simple logic: just try to save, service will add timestamps)
          // To avoid spam, we rely on user manually or big events, OR we could do it once per session per chapter.
          // For now, let's keep it manual + explicit save points to be safe.
      }
  }, [activeManuscript?.id]);

  const handleManuscriptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setProject(prev => ({
      ...prev,
      manuscripts: prev.manuscripts.map(m =>
        m.id === prev.activeManuscriptId ? { ...m, content: newContent } : m
      ),
    }));
  };
  
  const handleSwitchManuscript = (id: string) => {
    setProject(prev => ({ ...prev, activeManuscriptId: id }));
    // On mobile, close sidebar after selection if we were using it as a drawer (optional but nice)
    if (window.innerWidth < 768) setShowSidebar(false);
  };

  // --- Modal Handlers ---
  const openCreateModal = () => {
      setManuscriptModal({ isOpen: true, mode: 'create', initialValue: '' });
  };

  const openRenameModal = () => {
      if (!activeManuscript) return;
      setManuscriptModal({ isOpen: true, mode: 'rename', initialValue: activeManuscript.title });
  };

  const handleModalSave = (title: string) => {
      if (manuscriptModal.mode === 'create') {
          const newManuscript = {
            id: crypto.randomUUID(),
            title: title,
            content: ''
        };
        setProject(prev => ({
            ...prev,
            manuscripts: [...prev.manuscripts, newManuscript],
            activeManuscriptId: newManuscript.id
        }));
      } else {
          setProject(prev => ({
            ...prev,
            manuscripts: prev.manuscripts.map(m =>
                m.id === prev.activeManuscriptId ? { ...m, title: title } : m
            ),
        }));
      }
  };

  const openDeleteConfirmation = () => {
    if (!activeManuscript || project.manuscripts.length <= 1) {
        alert("No puedes eliminar el único manuscrito.");
        return;
    }
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteManuscript = () => {
    setProject(prev => {
        const remainingManuscripts = prev.manuscripts.filter(m => m.id !== prev.activeManuscriptId);
        return {
            ...prev,
            manuscripts: remainingManuscripts,
            activeManuscriptId: remainingManuscripts[0]?.id || '', 
        };
    });
    setIsDeleteModalOpen(false);
  };
  
  const handleExportManuscript = () => {
    if (!activeManuscript) return;

    let exportContent = activeManuscript.content;
    
    // Build image references appendix
    const imageReferences: string[] = [];
    project.memoryCore.characters.forEach(c => {
        if (c.imageUrl) imageReferences.push(`- [IMAGEN: Personaje] ${c.name}`);
    });
    project.memoryCore.locations.forEach(l => {
        if (l.imageUrl) imageReferences.push(`- [IMAGEN: Ubicación] ${l.name}`);
    });
    project.memoryCore.plotPoints.forEach(p => {
        if (p.imageUrl) imageReferences.push(`- [IMAGEN: Punto de Trama] ${p.title}`);
    });

    if (imageReferences.length > 0) {
        exportContent += `\n\n\n---\n\n## REFERENCIAS DE IMÁGENES\n\n`;
        exportContent += `Esta sección es una guía para la maquetación. Indica qué elementos del Núcleo de Memoria tienen una imagen asignada.\n\n`;
        exportContent += imageReferences.join('\n');
    }

    const sanitizeFilename = (name: string) => name.replace(/[^a-z0-9_.-]/gi, '_').toLowerCase();
    
    const fileName = `${sanitizeFilename(project.title)}_${sanitizeFilename(activeManuscript.title)}.md`;
    const blob = new Blob([exportContent], { type: 'text/markdown;charset=utf-8' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };


  const handleGenerate = async () => {
    if (!prompt) return;
    setIsLoading(true);
    setGeneratedText('');
    const result = await generateNarrative(prompt, project);
    setGeneratedText(result);
    setIsLoading(false);
  };

  const insertText = async () => {
    if (!generatedText) return;
    const currentContent = activeManuscript?.content || '';
    
    // Auto-snapshot before merge if content is substantial
    if (activeManuscript && currentContent.length > 100) {
        await saveManuscriptVersion(project.id, activeManuscript.id, currentContent, "Antes de inserción IA");
    }

    const newContent = currentContent + '\n\n' + generatedText;

    setProject(prev => ({
      ...prev,
      manuscripts: prev.manuscripts.map(m =>
        m.id === prev.activeManuscriptId ? { ...m, content: newContent } : m
      ),
    }));
    setGeneratedText('');
  };

  const handleMergeDraft = async (textToMerge: string) => {
    const currentContent = activeManuscript?.content || '';
    
    // Auto-snapshot before external merge
    if (activeManuscript && currentContent.length > 0) {
        await saveManuscriptVersion(project.id, activeManuscript.id, currentContent, "Antes de fusión externa");
    }

    // Add a separator if not empty
    const separator = currentContent ? '\n\n' : '';
    const newContent = currentContent + separator + textToMerge;

    setProject(prev => ({
      ...prev,
      manuscripts: prev.manuscripts.map(m =>
        m.id === prev.activeManuscriptId ? { ...m, content: newContent } : m
      ),
    }));
  };

  const handleRestoreVersion = (oldContent: string) => {
      // Auto-snapshot current state before restoring old one
      if (activeManuscript && activeManuscript.content) {
          saveManuscriptVersion(project.id, activeManuscript.id, activeManuscript.content, "Backup antes de restaurar versión");
      }

      setProject(prev => ({
          ...prev,
          manuscripts: prev.manuscripts.map(m =>
              m.id === prev.activeManuscriptId ? { ...m, content: oldContent } : m
          )
      }));
  };

  const handleAnalyzeManuscript = async () => {
    if (!activeManuscript || !activeManuscript.content) return;
    setIsAnalyzing(true);
    clearSuggestions();
    try {
        const [plotSuggestions, entitySuggestions] = await Promise.all([
             analyzeManuscriptForPlotPoints(project),
             analyzeManuscriptForEntities(project)
        ]);
        setSuggestedPlotPoints(plotSuggestions);
        setSuggestedCharacters(entitySuggestions.characters);
        setSuggestedLocations(entitySuggestions.locations);
    } catch (error) {
        alert("Error al analizar el manuscrito. Revisa la consola.");
    } finally {
        setIsAnalyzing(false);
    }
  };

  const handleCheckConsistency = async () => {
    if (!activeManuscript || !activeManuscript.content) return;
    setIsChecking(true);
    clearSuggestions();
    try {
        const results = await checkConsistency(project);
        setInconsistencies(results);
        if (results.length === 0) {
            alert("¡No se encontraron inconsistencias! El texto parece coherente con la memoria.");
        }
    } catch (error) {
        alert("Error al verificar la continuidad. Revisa la consola.");
    } finally {
        setIsChecking(false);
    }
  };

  const handleEvolveWorld = async () => {
      if (!activeManuscript || !activeManuscript.content) return;
      setIsEvolving(true);
      try {
          // Ejecutar ambas evoluciones en paralelo
          const [charUpdates, locUpdates] = await Promise.all([
              evolveCharactersFromManuscript(project),
              evolveLocationsFromManuscript(project)
          ]);

          if (charUpdates.length === 0 && locUpdates.length === 0) {
              alert("La IA no detectó cambios significativos en el mundo o los personajes en este texto.");
          } else {
              setProject(prev => ({
                  ...prev,
                  memoryCore: {
                      ...prev.memoryCore,
                      characters: prev.memoryCore.characters.map(char => {
                          const update = charUpdates.find(u => u.id === char.id);
                          if (update) {
                              return { 
                                  ...char, 
                                  psychology: update.psychology,
                                  relationships: update.relationships
                              };
                          }
                          return char;
                      }),
                      locations: prev.memoryCore.locations.map(loc => {
                          const update = locUpdates.find(u => u.id === loc.id);
                          if (update) {
                              return {
                                  ...loc,
                                  description: update.description
                              }
                          }
                          return loc;
                      })
                  }
              }));
              
              let msg = "¡Memoria Viva Actualizada!\n";
              if (charUpdates.length > 0) msg += `\nPersonajes evolucionados: ${charUpdates.map(u => u.name).join(', ')}`;
              if (locUpdates.length > 0) msg += `\nUbicaciones alteradas: ${locUpdates.map(u => u.name).join(', ')}`;
              alert(msg);
          }
      } catch (error) {
          alert("Error al evolucionar el mundo. Revisa la consola.");
      } finally {
          setIsEvolving(false);
      }
  };
  
  const addSuggestedPlotPoint = (suggestion: Partial<PlotPoint>) => {
    const newPlotPoint: PlotPoint = {
        id: crypto.randomUUID(),
        title: suggestion.title || 'Sin Título',
        description: suggestion.description || 'Sin Descripción',
        imageUrl: ''
    };

    setProject(prev => ({
        ...prev,
        memoryCore: { ...prev.memoryCore, plotPoints: [...prev.memoryCore.plotPoints, newPlotPoint] }
    }));
    setSuggestedPlotPoints(prev => prev.filter(p => p.title !== suggestion.title));
  };
  
  const addSuggestedCharacter = (suggestion: EntitySuggestion) => {
    const newCharacter: Character = {
        id: crypto.randomUUID(),
        name: suggestion.name || 'Sin Nombre',
        age: '', role: '', psychology: '', backstory: '', relationships: ''
    };
    setProject(prev => ({
        ...prev,
        memoryCore: { ...prev.memoryCore, characters: [...prev.memoryCore.characters, newCharacter] }
    }));
    setSuggestedCharacters(prev => prev.filter(c => c.name !== suggestion.name));
  };
  
  const addSuggestedLocation = (suggestion: EntitySuggestion) => {
    const newLocation: Location = {
        id: crypto.randomUUID(),
        name: suggestion.name || 'Sin Nombre',
        description: ''
    };
    setProject(prev => ({
        ...prev,
        memoryCore: { ...prev.memoryCore, locations: [...prev.memoryCore.locations, newLocation] }
    }));
    setSuggestedLocations(prev => prev.filter(l => l.name !== suggestion.name));
  };

  const clearSuggestions = () => {
    setSuggestedPlotPoints([]);
    setSuggestedCharacters([]);
    setSuggestedLocations([]);
    setInconsistencies([]);
  };

  const hasSuggestions = suggestedPlotPoints.length > 0 || suggestedCharacters.length > 0 || suggestedLocations.length > 0 || inconsistencies.length > 0;

  return (
    <>
    <ManuscriptModal 
        isOpen={manuscriptModal.isOpen} 
        mode={manuscriptModal.mode} 
        initialValue={manuscriptModal.initialValue} 
        onClose={() => setManuscriptModal({...manuscriptModal, isOpen: false})}
        onSave={handleModalSave}
    />
    <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        title="Eliminar Capítulo"
        message={`¿Estás seguro de que quieres eliminar "${activeManuscript?.title}"? Esta acción no se puede deshacer y se perderá todo el contenido.`}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDeleteManuscript}
    />
    <DraftScannerModal
        isOpen={isDraftScannerOpen}
        project={project}
        onClose={() => setIsDraftScannerOpen(false)}
        onMerge={handleMergeDraft}
    />
    {activeManuscript && (
        <HistoryModal
            isOpen={isHistoryModalOpen}
            projectId={project.id}
            manuscriptId={activeManuscript.id}
            currentContent={activeManuscript.content}
            onClose={() => setIsHistoryModalOpen(false)}
            onRestore={handleRestoreVersion}
        />
    )}

    <div className="flex h-full overflow-hidden bg-brand-primary relative">
      
      {/* Sidebar de Navegación (Desktop Only, or Toggle on Mobile) */}
      {showSidebar && (
        <div className={`
            fixed inset-0 z-40 flex md:static md:z-0
            md:w-64 md:flex-shrink-0 md:flex md:flex-col 
            ${showSidebar ? 'flex' : 'hidden'}
        `}>
            {/* Overlay Mobile */}
            <div className="absolute inset-0 bg-black/80 md:hidden" onClick={() => setShowSidebar(false)}></div>
            
            <div className="relative w-64 bg-slate-900 border-r border-brand-secondary flex flex-col h-full transition-all duration-300 shadow-xl md:shadow-none">
                <div className="p-4 border-b border-brand-secondary flex justify-between items-center">
                    <h3 className="font-bold text-brand-text-primary">Índice</h3>
                    <button onClick={() => setShowSidebar(false)} className="text-brand-text-secondary hover:text-white md:hidden">
                        <XIcon className="h-5 w-5" />
                    </button>
                </div>
                <div className="flex-grow overflow-y-auto p-2 space-y-1">
                    {project.manuscripts.map(m => (
                        <button 
                            key={m.id}
                            onClick={() => handleSwitchManuscript(m.id)}
                            className={`w-full text-left px-3 py-2 rounded-md text-sm truncate transition-colors ${
                                m.id === project.activeManuscriptId 
                                ? 'bg-brand-accent text-white font-medium' 
                                : 'text-brand-text-secondary hover:bg-brand-secondary hover:text-brand-text-primary'
                            }`}
                        >
                            {m.title}
                        </button>
                    ))}
                </div>
                <div className="p-4 border-t border-brand-secondary">
                    <button onClick={openCreateModal} className="w-full flex items-center justify-center space-x-2 bg-brand-secondary hover:bg-slate-700 text-brand-text-primary py-2 px-3 rounded transition-colors">
                        <PlusIcon className="h-4 w-4" />
                        <span className="text-sm">Nuevo Capítulo</span>
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Área Principal: Divide verticalmente en móvil, horizontalmente en desktop */}
      <div className="flex-grow flex flex-col md:flex-row h-full w-full relative overflow-hidden">
        
        {/* Columna del Editor (60% height on mobile, full on desktop) */}
        <div className="flex-grow flex flex-col min-w-0 bg-brand-primary h-[60%] md:h-full border-b md:border-b-0 md:border-r border-brand-secondary">
            {/* Cabecera del Editor */}
            <div className="h-14 md:h-16 border-b border-brand-secondary flex items-center justify-between px-4 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10 shrink-0">
                <div className="flex items-center space-x-2 overflow-hidden">
                    <button onClick={() => setShowSidebar(true)} className="text-brand-text-secondary hover:text-brand-accent p-1 rounded hover:bg-slate-800 md:hidden">
                        <ListIcon className="h-6 w-6" />
                    </button>
                    <div className="flex flex-col min-w-0">
                        <div className="flex items-center space-x-2 group cursor-pointer" onClick={openRenameModal}>
                            <h2 className="text-base md:text-lg font-bold text-white truncate max-w-[150px] md:max-w-md">
                                {activeManuscript?.title}
                            </h2>
                            <EditIcon className="h-4 w-4 text-brand-text-secondary opacity-0 group-hover:opacity-100 transition-opacity hidden md:block" />
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center space-x-1 md:space-x-2 flex-shrink-0">
                     <button onClick={() => setIsHistoryModalOpen(true)} className="p-2 text-brand-text-secondary hover:text-brand-accent hover:bg-slate-800 rounded transition-colors" title="Historial de Versiones">
                         <ClockIcon className="h-4 w-4 md:h-5 md:w-5" />
                     </button>
                     <div className="h-4 w-px bg-slate-700 mx-1"></div>
                     <button onClick={() => setIsDraftScannerOpen(true)} className="p-2 text-brand-text-secondary hover:text-brand-accent hover:bg-slate-800 rounded transition-colors" title="Escanear Borrador Externo">
                         <DocumentSearchIcon className="h-4 w-4 md:h-5 md:w-5" />
                     </button>
                     <div className="h-4 w-px bg-slate-700 mx-1 hidden md:block"></div>
                     <button onClick={handleEvolveWorld} disabled={isEvolving || !activeManuscript?.content} className="p-2 text-brand-text-secondary hover:text-brand-accent hover:bg-slate-800 rounded transition-colors" title="Evolucionar Relaciones de Personajes y Estado del Mundo según el texto">
                        {isEvolving ? <Spinner className="h-4 w-4 md:h-5 md:w-5"/> : <RefreshIcon className="h-4 w-4 md:h-5 md:w-5"/>}
                     </button>
                     <button onClick={handleCheckConsistency} disabled={isChecking || !activeManuscript?.content} className="p-2 text-brand-text-secondary hover:text-brand-accent hover:bg-slate-800 rounded transition-colors" title="Verificar Continuidad (Inconsistencias)">
                        {isChecking ? <Spinner className="h-4 w-4 md:h-5 md:w-5"/> : <ClipboardCheckIcon className="h-4 w-4 md:h-5 md:w-5"/>}
                     </button>
                     <button onClick={handleAnalyzeManuscript} disabled={isAnalyzing || !activeManuscript?.content} className="p-2 text-brand-text-secondary hover:text-brand-accent hover:bg-slate-800 rounded transition-colors" title="Analizar en busca de nuevos elementos">
                        {isAnalyzing ? <Spinner className="h-4 w-4 md:h-5 md:w-5"/> : <LightbulbIcon className="h-4 w-4 md:h-5 md:w-5"/>}
                     </button>
                    <button onClick={handleExportManuscript} className="p-2 text-brand-text-secondary hover:text-white hover:bg-slate-800 rounded transition-colors" title="Exportar">
                        <ExportIcon className="h-4 w-4 md:h-5 md:w-5" />
                    </button>
                    <button onClick={openDeleteConfirmation} disabled={project.manuscripts.length <= 1} className="p-2 text-brand-text-secondary hover:text-red-400 hover:bg-slate-800 rounded transition-colors" title="Eliminar">
                        <TrashIcon className="h-4 w-4 md:h-5 md:w-5" />
                    </button>
                </div>
            </div>

            {/* Textarea del Editor */}
            <div className="flex-grow relative overflow-hidden">
                <textarea
                    value={activeManuscript?.content || ''}
                    onChange={handleManuscriptChange}
                    placeholder="Escribe tu historia aquí..."
                    className="w-full h-full bg-transparent text-brand-text-primary p-4 md:p-8 text-base md:text-lg leading-relaxed resize-none focus:outline-none"
                    spellCheck={false}
                />
            </div>
        </div>

        {/* Columna de IA (Panel derecho en Desktop, Panel inferior en Mobile - 40% height) */}
        <div className="w-full md:w-80 lg:w-96 bg-slate-900 flex flex-col h-[40%] md:h-full z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.3)] md:shadow-none relative">
            
            {/* Header del Panel IA */}
            <div className="p-3 border-b border-brand-secondary bg-slate-800/50 shrink-0 flex justify-between items-center">
                 <h3 className="font-bold text-brand-accent flex items-center text-sm md:text-base">
                    <SparklesIcon className="h-4 w-4 md:h-5 md:w-5 mr-2"/>
                    Coautor IA
                 </h3>
                 {project.writingStyle && (
                     <span className="text-[10px] px-2 py-0.5 rounded bg-sky-900/50 text-sky-300 border border-sky-800 truncate max-w-[120px]" title={`Estilo: ${project.writingStyle}`}>
                        {project.writingStyle}
                     </span>
                 )}
            </div>
            
            {/* Input de Prompt (Fijo arriba) */}
            <div className="p-3 shrink-0">
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder='Describe la escena...'
                    className="w-full bg-brand-secondary rounded-lg p-2 focus:ring-1 focus:ring-brand-accent focus:outline-none text-sm min-h-[60px] md:min-h-[80px] resize-none"
                />
                <button
                    onClick={handleGenerate}
                    disabled={isLoading}
                    className="mt-2 w-full bg-brand-accent text-white font-bold py-1.5 md:py-2 px-4 rounded-md hover:bg-sky-500 transition-colors disabled:bg-slate-600 disabled:cursor-not-allowed flex items-center justify-center text-sm"
                >
                    {isLoading ? <Spinner className="h-4 w-4" /> : 'Generar Texto'}
                </button>
            </div>

            {/* Zona de Contenido Scrollable (Sugerencias y Texto Generado) */}
            <div className="flex-grow overflow-y-auto p-3 space-y-3 min-h-0">
                
                {/* Panel de Sugerencias / Inconsistencias */}
                {hasSuggestions && (
                    <div className="bg-brand-primary/50 p-2 rounded-lg border border-brand-secondary">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="text-[10px] font-bold text-brand-text-secondary uppercase tracking-wider">
                                {inconsistencies.length > 0 ? 'Inconsistencias Detectadas' : 'Sugerencias'}
                            </h4>
                            <button onClick={clearSuggestions} className="text-brand-text-secondary hover:text-white"><XIcon className="h-3 w-3"/></button>
                        </div>
                        
                        {/* Inconsistencies */}
                        {inconsistencies.map((inc, i) => (
                            <div key={`inc-${i}`} className={`mb-3 p-2 rounded text-xs border ${inc.severity === 'high' ? 'bg-red-900/30 border-red-500/50' : 'bg-amber-900/30 border-amber-500/50'}`}>
                                <div className="flex items-start space-x-2">
                                    <AlertIcon className={`h-4 w-4 flex-shrink-0 ${inc.severity === 'high' ? 'text-red-400' : 'text-amber-400'}`}/>
                                    <div>
                                        <p className="font-semibold text-brand-text-primary mb-1 uppercase tracking-wide text-[10px]">{inc.type} - {inc.severity}</p>
                                        <p className="text-slate-300 mb-1">{inc.description}</p>
                                        <p className="text-slate-400 italic border-l-2 border-slate-600 pl-2 my-1">"{inc.quote}"</p>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Plot Suggestions */}
                        {suggestedPlotPoints.map((p, i) => (
                            <div key={`p-${i}`} className="mb-2 bg-slate-800 p-2 rounded text-xs">
                                <p className="font-semibold text-brand-accent">{p.title}</p>
                                <p className="opacity-80 mb-1">{p.description}</p>
                                <button onClick={() => addSuggestedPlotPoint(p)} className="text-xs text-sky-400 hover:underline">Añadir a Trama</button>
                            </div>
                        ))}

                        {/* Character Suggestions */}
                        {suggestedCharacters.map((c, i) => (
                            <div key={`c-${i}`} className="mb-2 bg-slate-800 p-2 rounded text-xs">
                                <p className="font-semibold text-green-400">{c.name}</p>
                                <p className="opacity-80 mb-1 italic">"{c.justification}"</p>
                                <button onClick={() => addSuggestedCharacter(c)} className="text-xs text-sky-400 hover:underline">Crear Personaje</button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Texto Generado */}
                {generatedText ? (
                    <div className="bg-brand-secondary/30 p-3 rounded-lg border border-brand-accent/30 animate-fade-in">
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-brand-text-primary">{generatedText}</p>
                    </div>
                ) : (
                    !hasSuggestions && (
                        <div className="flex flex-col items-center justify-center text-brand-text-secondary opacity-50 text-xs text-center py-4">
                            <SparklesIcon className="h-8 w-8 mb-2"/>
                            <p>Pídeme que escriba una escena<br/>basada en tus personajes.</p>
                        </div>
                    )
                )}
            </div>

            {/* Footer Fijo: Botón de Acción (Siempre visible) */}
            {generatedText && (
                <div className="p-3 border-t border-brand-secondary bg-slate-900 shrink-0 shadow-[0_-4px_10px_rgba(0,0,0,0.5)] z-10">
                    <button
                        onClick={insertText}
                        className="w-full py-2 px-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded-md transition-colors flex items-center justify-center space-x-2 shadow-lg"
                    >
                        <CheckIcon className="h-5 w-5"/>
                        <span>Insertar en Manuscrito</span>
                    </button>
                </div>
            )}
        </div>

      </div>
    </div>
    </>
  );
};