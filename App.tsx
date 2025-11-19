import React, { useState, useEffect, useRef } from 'react';
import type { Project } from './types';
import { View } from './types';
import { MemoryCoreManager } from './components/MemoryCoreManager';
import { CreationEngine } from './components/CreationEngine';
import { VisualStudio } from './components/VisualStudio';
import { ProjectDashboard } from './components/ProjectDashboard';
import { AuthScreen } from './components/AuthScreen'; // Importar pantalla de Auth
import { WriteIcon, ImageIcon, CharacterIcon, HomeIcon, Spinner } from './components/Icons';
import { saveProjectFull, loadProjectFull, subscribeToProjectList, deleteProjectFull, subscribeToAuth, logoutUser } from './services/firebase';
import type { User } from 'firebase/auth';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [projectList, setProjectList] = useState<Project[]>([]); 
  const [activeProject, setActiveProject] = useState<Project | null>(null); 
  const [activeView, setActiveView] = useState<View>(View.CreationEngine);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<number | undefined>(undefined);

  // 0. Suscripción a Auth
  useEffect(() => {
    const unsubscribe = subscribeToAuth((currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 1. Suscripción a la lista de proyectos (Solo si hay usuario)
  useEffect(() => {
    if (!user) {
        setProjectList([]);
        return;
    }

    const unsubscribe = subscribeToProjectList((projects) => {
      setProjectList(projects);
    });
    return () => unsubscribe();
  }, [user]);

  // 2. Auto-guardado del proyecto ACTIVO
  const triggerSave = async () => {
     if (!activeProject) return;
     setIsSaving(true);
     try {
        await saveProjectFull(activeProject);
     } catch (error) {
        console.error("Error en guardado manual/auto:", error);
     } finally {
        setIsSaving(false);
     }
  };

  useEffect(() => {
    if (!activeProject) return;

    setIsSaving(true); // Indicar visualmente que hay cambios pendientes
    clearTimeout(saveTimeoutRef.current);

    // Guardar 1.5 segundos después del último cambio
    saveTimeoutRef.current = window.setTimeout(() => {
        triggerSave();
    }, 1500);

    return () => clearTimeout(saveTimeoutRef.current);
  }, [activeProject]);

  // --- HANDLERS ---

  const handleCreateProject = async (projectData: Omit<Project, 'id'>) => {
    const newId = crypto.randomUUID();
    const newProject: Project = { ...projectData, id: newId };
    
    setIsLoading(true);
    try {
        await saveProjectFull(newProject);
        setActiveProject(newProject);
    } catch (error) {
        console.error("Error creando proyecto:", error);
        alert("No se pudo crear el proyecto en la nube.");
    } finally {
        setIsLoading(false);
    }
  };

  const handleSelectProject = async (id: string) => {
    setIsLoading(true);
    try {
        const fullProject = await loadProjectFull(id);
        if (fullProject) {
            setActiveProject(fullProject);
        } else {
            alert("Proyecto no encontrado o eliminado.");
        }
    } catch (error) {
        console.error("Error cargando proyecto:", error);
        alert("Error al cargar el proyecto.");
    } finally {
        setIsLoading(false);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
      try {
          await deleteProjectFull(projectId);
          if (activeProject?.id === projectId) {
              setActiveProject(null);
          }
      } catch (error) {
          console.error("Error eliminando proyecto:", error);
          alert("Error al eliminar el proyecto.");
      }
  };

  const setActiveProjectState = (updater: React.SetStateAction<Project>) => {
    setActiveProject(prev => {
        if (!prev) return null;
        return typeof updater === 'function' ? updater(prev) : updater;
    });
  };

  const handleLogout = async () => {
      await logoutUser();
      setActiveProject(null);
  };

  // --- RENDERING ---

  // Pantalla de Carga Inicial (Verificando sesión)
  if (authLoading) {
      return (
        <div className="min-h-screen bg-brand-primary flex flex-col items-center justify-center text-white">
            <Spinner className="h-12 w-12 text-brand-accent mb-4" />
            <p className="text-brand-text-secondary animate-pulse">Iniciando Nova Scribe...</p>
        </div>
      );
  }

  // Si no hay usuario -> Pantalla de Login
  if (!user) {
      return <AuthScreen />;
  }

  // Pantalla de Carga de Datos
  if (isLoading && !activeProject && projectList.length > 0) {
      return (
          <div className="flex flex-col items-center justify-center h-screen bg-brand-primary text-brand-text-primary">
              <Spinner className="h-12 w-12 text-brand-accent mb-4" />
              <p className="text-xl animate-pulse">Sincronizando con el Núcleo...</p>
          </div>
      );
  }

  // Dashboard de Proyectos (Si hay usuario pero no proyecto activo)
  if (!activeProject) {
    return (
        <div className="relative">
            <div className="absolute top-4 right-4 z-50">
                <div className="flex items-center space-x-3">
                     <span className="text-sm text-brand-text-secondary hidden md:inline">{user.email}</span>
                     <button onClick={handleLogout} className="px-3 py-1 bg-slate-800 text-red-400 text-sm rounded hover:bg-red-900/50 border border-slate-700">
                         Salir
                     </button>
                </div>
            </div>
            <ProjectDashboard 
                projects={projectList} 
                onSelectProject={handleSelectProject}
                onCreateProject={handleCreateProject}
                onDeleteProject={handleDeleteProject}
            />
        </div>
    );
  }
  
  const renderActiveView = () => {
    switch (activeView) {
      case View.MemoryCore:
        return <MemoryCoreManager project={activeProject} setProject={setActiveProjectState} />;
      case View.CreationEngine:
        return <CreationEngine project={activeProject} setProject={setActiveProjectState} />;
      case View.VisualStudio:
        return <VisualStudio project={activeProject} setProject={setActiveProjectState} />;
      default:
        return <CreationEngine project={activeProject} setProject={setActiveProjectState} />;
    }
  };
  
  const NavItem: React.FC<{
    label: string;
    view: View;
    icon: React.ReactNode;
  }> = ({ label, view, icon }) => (
    <button
      onClick={() => setActiveView(view)}
      className={`flex flex-col md:flex-row items-center justify-center md:justify-start w-full md:w-auto text-sm space-x-0 md:space-x-2 p-2 md:px-4 md:py-2 rounded-lg transition-colors duration-200 ${
        activeView === view
          ? 'bg-brand-accent text-white'
          : 'text-brand-text-secondary hover:bg-brand-secondary hover:text-brand-text-primary'
      }`}
    >
      {icon}
      <span className="mt-1 md:mt-0">{label}</span>
    </button>
  );

  return (
    <div className="flex flex-col h-screen font-sans">
      <header className="flex-shrink-0 bg-brand-primary border-b border-brand-secondary shadow-md px-4 py-2">
        <div className="flex items-center justify-between mx-auto">
            <div className="flex items-center space-x-4">
                 <button onClick={() => setActiveProject(null)} className="p-2 rounded-full hover:bg-brand-secondary" title="Volver al Panel de Proyectos">
                    <HomeIcon className="h-5 w-5 text-brand-text-secondary hover:text-brand-accent" />
                 </button>
                 <div className="flex items-center space-x-3">
                    <div className="text-xl font-bold hidden md:block">
                        Nova<span className="text-brand-accent">Scribe</span>
                        <span className="text-lg font-normal text-brand-text-secondary ml-3">/ {activeProject.title}</span>
                    </div>
                    <div className="flex items-center">
                      {isSaving ? (
                          <button disabled className="flex items-center space-x-2 px-3 py-1 bg-slate-800 rounded text-xs text-sky-400 animate-pulse border border-slate-700">
                              <Spinner className="h-3 w-3"/> <span>Guardando...</span>
                          </button>
                      ) : (
                          <button onClick={triggerSave} className="flex items-center space-x-1 px-3 py-1 bg-transparent hover:bg-slate-800 rounded text-xs text-green-500 transition-colors border border-transparent hover:border-green-900/50" title="Forzar guardado ahora">
                              <span>✓ En la nube</span>
                          </button>
                      )}
                    </div>
                 </div>
            </div>
            
            <div className="flex items-center space-x-4">
                <nav className="flex items-center space-x-2">
                    <NavItem label="Núcleo" view={View.MemoryCore} icon={<CharacterIcon className="h-5 w-5" />} />
                    <NavItem label="Editor" view={View.CreationEngine} icon={<WriteIcon className="h-5 w-5" />} />
                    <NavItem label="Visual" view={View.VisualStudio} icon={<ImageIcon className="h-5 w-5" />} />
                </nav>
                 <button onClick={handleLogout} className="hidden md:block px-3 py-1 bg-slate-800 text-red-400 text-xs rounded border border-slate-700 hover:bg-red-900/30">
                    Salir
                </button>
            </div>
        </div>
      </header>
      <main className="flex-grow overflow-y-auto bg-[#0f172a]">
        {renderActiveView()}
      </main>
    </div>
  );
};

export default App;