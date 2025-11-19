
import React, { useState, useEffect, useRef } from 'react';
import type { Project, Character, PlotPoint } from '../types';
import { generateProjectIdea } from '../services/geminiService';
import { exportProject, importProject } from '../utils/projectImportExport';
import { PlusIcon, Spinner, TrashIcon, LightbulbIcon, UploadIcon, ExportIcon, SparklesIcon, WriteIcon } from './Icons';

interface ProjectDashboardProps {
    projects: Project[];
    onSelectProject: (id: string) => void;
    onCreateProject: (projectData: Omit<Project, 'id'>) => void;
    onDeleteProject: (id: string) => Promise<void>; // Ahora es promesa
}

interface NewProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (projectData: Omit<Project, 'id'>) => void;
    initialData?: {
        title?: string;
        synopsis?: string;
        styleSeed?: string;
        writingStyle?: string;
        characters?: Partial<Character>[];
        plotPoints?: Partial<PlotPoint>[];
    };
}


const NewProjectModal: React.FC<NewProjectModalProps> = ({ isOpen, onClose, onCreate, initialData }) => {
    const [title, setTitle] = useState('');
    const [synopsis, setSynopsis] = useState('');
    const [styleSeed, setStyleSeed] = useState('');
    const [writingStyle, setWritingStyle] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    React.useEffect(() => {
        if(isOpen){
            setTitle(initialData?.title || '');
            setSynopsis(initialData?.synopsis || '');
            setStyleSeed(initialData?.styleSeed || '');
            setWritingStyle(initialData?.writingStyle || '');
            setIsCreating(false);
        }
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsCreating(true);
        const initialManuscriptId = crypto.randomUUID();
        
        const finalCharacters: Character[] = initialData?.characters?.map((c): Character => ({
            id: crypto.randomUUID(),
            name: c.name || 'Sin Nombre',
            age: c.age || '',
            role: c.role || '',
            psychology: c.psychology || '',
            backstory: c.backstory || '',
            relationships: c.relationships || '',
            appearance: c.appearance || '',
            skills: c.skills || '',
        })) || [];

        const finalPlotPoints: PlotPoint[] = initialData?.plotPoints?.map((p): PlotPoint => ({
            id: crypto.randomUUID(),
            title: p.title || 'Sin Título',
            description: p.description || '',
        })) || [];

        await onCreate({
            title,
            synopsis,
            styleSeed,
            writingStyle,
            memoryCore: { 
                characters: finalCharacters,
                locations: [],
                plotPoints: finalPlotPoints,
            },
            manuscripts: [{ id: initialManuscriptId, title: 'Capítulo 1 - Borrador', content: '' }],
            activeManuscriptId: initialManuscriptId,
            gallery: [],
        });
        setIsCreating(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 rounded-lg shadow-xl p-6 w-full max-w-lg border border-brand-secondary overflow-y-auto max-h-[90vh]">
                <h3 className="text-xl font-bold mb-4 text-brand-accent">Crear Nuevo Proyecto</h3>
                <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
                    <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título del Proyecto" className="w-full bg-brand-secondary p-2 rounded" required />
                    <textarea value={synopsis} onChange={e => setSynopsis(e.target.value)} placeholder="Sinopsis" className="w-full bg-brand-secondary p-2 rounded h-32" required />
                    <input value={styleSeed} onChange={e => setStyleSeed(e.target.value)} placeholder="Semilla de Estilo Visual (ej: Fantasía oscura gótica)" className="w-full bg-brand-secondary p-2 rounded" />
                    <input value={writingStyle} onChange={e => setWritingStyle(e.target.value)} placeholder="Estilo de Escritura (ej: Primera persona, tono sarcástico)" className="w-full bg-brand-secondary p-2 rounded" />
                    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-6">
                        <button type="button" onClick={onClose} className="w-full sm:w-auto px-4 py-3 sm:py-2 bg-brand-secondary rounded hover:bg-slate-600 transition-colors">Cancelar</button>
                        <button type="submit" disabled={isCreating} className="w-full sm:w-auto px-4 py-3 sm:py-2 bg-brand-accent text-white rounded hover:bg-sky-500 flex items-center justify-center transition-colors">
                            {isCreating && <Spinner className="h-4 w-4 mr-2"/>}
                            {isCreating ? 'Creando...' : 'Crear Proyecto'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const DeleteProjectModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    projectName: string;
    isDeleting: boolean;
}> = ({ isOpen, onClose, onConfirm, projectName, isDeleting }) => {
    const [confirmationText, setConfirmationText] = useState('');

    useEffect(() => {
        if (isOpen) {
            setConfirmationText('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const isConfirmed = confirmationText === 'eliminar';

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 rounded-lg shadow-xl p-6 w-full max-w-md border border-red-500">
                <h3 className="text-xl font-bold mb-2 text-red-400">Confirmar Eliminación</h3>
                <p className="text-brand-text-secondary mb-4">
                    Esta acción es irreversible. Se eliminará el proyecto <strong className="text-brand-text-primary">{projectName}</strong> y todo su contenido de Firestore.
                </p>
                <p className="text-brand-text-secondary mb-4">
                    Para confirmar, por favor escribe "<strong className="text-red-400">eliminar</strong>" en el campo de abajo.
                </p>
                <input
                    type="text"
                    value={confirmationText}
                    onChange={(e) => setConfirmationText(e.target.value)}
                    className="w-full bg-brand-secondary p-2 rounded border border-brand-secondary focus:ring-1 focus:ring-red-500 focus:outline-none"
                    autoComplete="off"
                />
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-6">
                    <button type="button" onClick={onClose} disabled={isDeleting} className="w-full sm:w-auto px-4 py-3 sm:py-2 bg-brand-secondary rounded hover:bg-slate-600 transition-colors">Cancelar</button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={!isConfirmed || isDeleting}
                        className="w-full sm:w-auto px-4 py-3 sm:py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                    >
                         {isDeleting && <Spinner className="h-4 w-4 mr-2"/>}
                         {isDeleting ? 'Eliminando...' : 'Eliminar Permanentemente'}
                    </button>
                </div>
            </div>
        </div>
    );
};


export const ProjectDashboard: React.FC<ProjectDashboardProps> = ({ projects, onSelectProject, onCreateProject, onDeleteProject }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAILoading, setIsAILoading] = useState(false);
    const [ideaPrompt, setIdeaPrompt] = useState('');
    const [initialData, setInitialData] = useState<NewProjectModalProps['initialData']>();
    const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const importInputRef = useRef<HTMLInputElement>(null);
    const [exportingId, setExportingId] = useState<string | null>(null);

    const handleGenerateIdea = async () => {
        if (!ideaPrompt) return;
        setIsAILoading(true);
        try {
            const idea = await generateProjectIdea(ideaPrompt);
            setInitialData(idea);
            setIsModalOpen(true);
        } catch (error) {
            alert("Error al generar la idea. Revisa la consola.");
        } finally {
            setIsAILoading(false);
        }
    };
    
    const openNewProjectModal = () => {
        setInitialData(undefined);
        setIsModalOpen(true);
    };

    const handleExport = async (project: Project) => {
        setExportingId(project.id);
        try {
            alert("Nota: La exportación desde el dashboard solo incluye metadatos por ahora. Abre el proyecto para exportar contenido completo.");
            await exportProject(project);
        } catch(e) {
            // Error alertado dentro
        } finally {
            setExportingId(null);
        }
    }

    const handleImportClick = () => {
        importInputRef.current?.click();
    };

    const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        try {
            const projectData = await importProject(file);
            await onCreateProject(projectData);
            alert(`Proyecto "${projectData.title}" importado con éxito.`);
        } catch (error: any) {
            console.error("Error importing project:", error);
            alert(`Hubo un error al importar el proyecto: ${error.message}`);
        } finally {
            setIsImporting(false);
            if(importInputRef.current) {
                importInputRef.current.value = '';
            }
        }
    };

    const confirmDelete = async () => {
        if (projectToDelete) {
            setIsDeleting(true);
            await onDeleteProject(projectToDelete.id);
            setIsDeleting(false);
        }
        setProjectToDelete(null);
    };


    return (
        <>
            <input 
                type="file" 
                ref={importInputRef} 
                onChange={handleFileImport} 
                accept=".zip" 
                style={{ display: 'none' }}
            />
            <NewProjectModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onCreate={onCreateProject}
                initialData={initialData}
            />
            <DeleteProjectModal
                isOpen={!!projectToDelete}
                onClose={() => setProjectToDelete(null)}
                onConfirm={confirmDelete}
                projectName={projectToDelete?.title || ''}
                isDeleting={isDeleting}
            />
            <div className="bg-brand-primary min-h-screen text-brand-text-primary p-8">
                <header className="text-center mb-12">
                    <h1 className="text-5xl font-bold">Nova<span className="text-brand-accent">Scribe</span></h1>
                    <p className="text-brand-text-secondary mt-2">Tu Coautor IA para Mundos que Viven y Respiran (Ahora en la Nube).</p>
                </header>
                
                <div className="max-w-4xl mx-auto">
                     <div className="bg-slate-900 p-6 rounded-lg border border-brand-secondary mb-10">
                        <h3 className="text-2xl font-bold mb-3 text-brand-accent flex items-center"><LightbulbIcon className="h-6 w-6 mr-2"/>Asistente de Ideas</h3>
                        <p className="text-sm text-brand-text-secondary mb-4">¿Atascado? Describe una idea simple y deja que la IA la convierta en la base para tu próxima gran historia.</p>
                        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                             <input
                                type="text"
                                value={ideaPrompt}
                                onChange={(e) => setIdeaPrompt(e.target.value)}
                                placeholder="ej: Un detective que resuelve crímenes en un mundo de fantasía cyberpunk."
                                className="w-full bg-brand-secondary rounded-md p-3 focus:ring-1 focus:ring-brand-accent focus:outline-none"
                            />
                            <button
                                onClick={handleGenerateIdea}
                                disabled={isAILoading}
                                className="bg-brand-accent text-white font-bold py-3 px-6 rounded-md hover:bg-sky-500 transition-colors duration-200 disabled:bg-slate-600 flex justify-center items-center sm:w-auto w-full"
                            >
                                {isAILoading ? <Spinner className="h-5 w-5"/> : 'Generar Idea'}
                            </button>
                        </div>
                    </div>

                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-3xl font-bold">Mis Proyectos</h2>
                        <div className="flex items-center space-x-2">
                            <button onClick={handleImportClick} disabled={isImporting} className="flex items-center space-x-2 px-4 py-2 text-sm bg-brand-secondary text-white rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-50">
                                {isImporting ? <Spinner className="h-5 w-5"/> : <UploadIcon className="h-5 w-5"/>}
                                <span>{isImporting ? 'Importando...' : 'Importar'}</span>
                            </button>
                            <button onClick={openNewProjectModal} className="flex items-center space-x-2 px-4 py-2 text-sm bg-brand-accent text-white rounded-lg hover:bg-sky-500 transition-colors">
                                <PlusIcon className="h-5 w-5"/>
                                <span>Nuevo Proyecto</span>
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {projects.map(project => (
                            <div key={project.id} className="bg-brand-secondary rounded-lg shadow-lg p-5 flex flex-col justify-between group h-full border border-transparent hover:border-brand-accent/50 transition-all duration-300">
                                <div>
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="text-xl font-bold text-brand-text-primary truncate flex-grow mr-2" title={project.title}>{project.title}</h3>
                                        {project.lastModified && (
                                            <span className="text-[10px] text-brand-text-secondary whitespace-nowrap mt-1">
                                                {new Date(project.lastModified).toLocaleDateString()}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-brand-text-secondary h-14 overflow-hidden line-clamp-2 mb-3">{project.synopsis}</p>
                                    
                                    {/* Etiquetas de Estilo - Verificación Visual de Datos */}
                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {project.styleSeed && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-purple-900 text-purple-200" title="Semilla Visual">
                                                <SparklesIcon className="h-3 w-3 mr-1" />
                                                <span className="truncate max-w-[80px]">{project.styleSeed}</span>
                                            </span>
                                        )}
                                        {project.writingStyle && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-900 text-blue-200" title="Estilo Narrativo">
                                                <WriteIcon className="h-3 w-3 mr-1" />
                                                <span className="truncate max-w-[80px]">{project.writingStyle}</span>
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-700">
                                    <button onClick={() => onSelectProject(project.id)} className="flex-grow text-center py-2 px-4 bg-slate-700 rounded-md hover:bg-brand-accent text-sm font-semibold transition-colors">Abrir Proyecto</button>
                                    <div className="flex items-center ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleExport(project)} className="p-2 text-slate-400 hover:text-sky-400 hover:bg-slate-800 rounded-full transition-colors" title="Exportar Metadatos">
                                            {exportingId === project.id ? <Spinner className="h-4 w-4" /> : <ExportIcon className="h-4 w-4"/>}
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); setProjectToDelete(project); }} className="p-2 text-slate-400 hover:text-red-500 hover:bg-slate-800 rounded-full transition-colors" title="Eliminar Proyecto">
                                            <TrashIcon className="h-4 w-4"/>
                                        </button>
                                     </div>
                                </div>
                            </div>
                        ))}
                    </div>
                     {projects.length === 0 && (
                        <div className="text-center py-12 border-2 border-dashed border-brand-secondary rounded-lg bg-slate-800/30">
                            <p className="text-brand-text-secondary text-lg mb-2">No tienes proyectos todavía.</p>
                            <p className="text-brand-text-secondary text-sm">¡Crea uno nuevo o impórtalo para empezar a escribir!</p>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};
