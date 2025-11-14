import React, { useState, useEffect, useRef } from 'react';
import type { Project } from '../types';
import { generateProjectIdea } from '../services/geminiService';
import { exportProject, importProject } from '../utils/projectImportExport';
import { PlusIcon, Spinner, TrashIcon, LightbulbIcon, UploadIcon, ExportIcon } from './Icons';

interface ProjectDashboardProps {
    projects: Project[];
    onSelectProject: (id: string) => void;
    onCreateProject: (projectData: Omit<Project, 'id'>) => void;
    onDeleteProject: (id: string) => void;
}

const NewProjectModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onCreate: (projectData: Omit<Project, 'id'>) => void;
    initialData?: Partial<Omit<Project, 'id'>>;
}> = ({ isOpen, onClose, onCreate, initialData }) => {
    const [title, setTitle] = useState('');
    const [synopsis, setSynopsis] = useState('');
    const [styleSeed, setStyleSeed] = useState('');

    React.useEffect(() => {
        if(isOpen){
            setTitle(initialData?.title || '');
            setSynopsis(initialData?.synopsis || '');
            setStyleSeed(initialData?.styleSeed || '');
        }
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const initialManuscriptId = crypto.randomUUID();
        onCreate({
            title,
            synopsis,
            styleSeed,
            memoryCore: { characters: [], locations: [], plotPoints: [] },
            manuscripts: [{ id: initialManuscriptId, title: 'Capítulo 1 - Borrador', content: '' }],
            activeManuscriptId: initialManuscriptId,
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-slate-900 rounded-lg shadow-xl p-6 w-full max-w-lg border border-brand-secondary">
                <h3 className="text-xl font-bold mb-4 text-brand-accent">Crear Nuevo Proyecto</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título del Proyecto" className="w-full bg-brand-secondary p-2 rounded" required />
                    <textarea value={synopsis} onChange={e => setSynopsis(e.target.value)} placeholder="Sinopsis" className="w-full bg-brand-secondary p-2 rounded h-32" required />
                    <input value={styleSeed} onChange={e => setStyleSeed(e.target.value)} placeholder="Semilla de Estilo Visual (ej: Fantasía oscura gótica)" className="w-full bg-brand-secondary p-2 rounded" />
                    <div className="flex justify-end space-x-3 mt-6">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-brand-secondary rounded hover:bg-slate-600">Cancelar</button>
                        <button type="submit" className="px-4 py-2 bg-brand-accent text-white rounded hover:bg-sky-500">Crear Proyecto</button>
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
}> = ({ isOpen, onClose, onConfirm, projectName }) => {
    const [confirmationText, setConfirmationText] = useState('');

    useEffect(() => {
        if (isOpen) {
            setConfirmationText('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const isConfirmed = confirmationText === 'eliminar';

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-slate-900 rounded-lg shadow-xl p-6 w-full max-w-md border border-red-500">
                <h3 className="text-xl font-bold mb-2 text-red-400">Confirmar Eliminación</h3>
                <p className="text-brand-text-secondary mb-4">
                    Esta acción es irreversible. Se eliminará el proyecto <strong className="text-brand-text-primary">{projectName}</strong> y todo su contenido.
                </p>
                <p className="text-brand-text-secondary mb-4">
                    Para confirmar, por favor escribe "<strong className="text-red-400">eliminar</strong>" en el campo de abajo.
                </p>
                <input
                    type="text"
                    value={confirmationText}
                    onChange={(e) => setConfirmationText(e.target.value)}
                    className="w-full bg-brand-secondary p-2 rounded border border-brand-secondary focus:ring-1 focus:ring-red-500 focus:outline-none"
                />
                <div className="flex justify-end space-x-3 mt-6">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-brand-secondary rounded hover:bg-slate-600">Cancelar</button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={!isConfirmed}
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed"
                    >
                        Eliminar Permanentemente
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
    const [initialData, setInitialData] = useState<Partial<Omit<Project, 'id'>> | undefined>();
    const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
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
            await exportProject(project);
        } catch(e) {
            // Error is alerted inside the export function
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
            onCreateProject(projectData);
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
                onConfirm={() => {
                    if (projectToDelete) {
                        onDeleteProject(projectToDelete.id);
                    }
                    setProjectToDelete(null);
                }}
                projectName={projectToDelete?.title || ''}
            />
            <div className="bg-brand-primary min-h-screen text-brand-text-primary p-8">
                <header className="text-center mb-12">
                    <h1 className="text-5xl font-bold">Nova<span className="text-brand-accent">Scribe</span></h1>
                    <p className="text-brand-text-secondary mt-2">Tu Coautor IA para Mundos que Viven y Respiran.</p>
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
                            <div key={project.id} className="bg-brand-secondary rounded-lg shadow-lg p-5 flex flex-col justify-between group">
                                <div>
                                    <h3 className="text-xl font-bold text-brand-text-primary mb-2 truncate">{project.title}</h3>
                                    <p className="text-sm text-brand-text-secondary h-20 overflow-hidden text-ellipsis">{project.synopsis}</p>
                                </div>
                                <div className="flex items-center justify-between mt-4">
                                    <button onClick={() => onSelectProject(project.id)} className="w-full text-center py-2 px-4 bg-slate-600 rounded-md hover:bg-brand-accent transition-colors">Abrir</button>
                                    <div className="flex items-center ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleExport(project)} className="p-2 text-slate-400 hover:text-sky-400 hover:bg-slate-700 rounded-full" title="Exportar Proyecto">
                                            {exportingId === project.id ? <Spinner className="h-5 w-5" /> : <ExportIcon className="h-5 w-5"/>}
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); setProjectToDelete(project); }} className="p-2 text-slate-400 hover:text-red-500 hover:bg-slate-700 rounded-full" title="Eliminar Proyecto">
                                            <TrashIcon className="h-5 w-5"/>
                                        </button>
                                     </div>
                                </div>
                            </div>
                        ))}
                    </div>
                     {projects.length === 0 && (
                        <div className="text-center py-10 border-2 border-dashed border-brand-secondary rounded-lg">
                            <p className="text-brand-text-secondary">No tienes proyectos todavía.</p>
                            <p className="text-brand-text-secondary">¡Crea uno nuevo o usa el Asistente de Ideas para empezar!</p>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};