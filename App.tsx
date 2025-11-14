import React, { useState, useEffect } from 'react';
import type { Project } from './types';
import { View } from './types';
import { MemoryCoreManager } from './components/MemoryCoreManager';
import { CreationEngine } from './components/CreationEngine';
import { VisualStudio } from './components/VisualStudio';
import { ProjectDashboard } from './components/ProjectDashboard';
import { WriteIcon, ImageIcon, CharacterIcon, HomeIcon } from './components/Icons';

const initialManuscriptId = crypto.randomUUID();

const initialProject: Omit<Project, 'id'> = {
  title: 'Dinastía Estelar',
  synopsis: 'En una galaxia gobernada por un imperio en decadencia, un joven piloto descubre un antiguo artefacto que podría salvar a la civilización o destruirla por completo.',
  styleSeed: 'Estilo de anime épico de ciencia ficción, mechas detallados, iluminación cinematográfica, nebulosas vibrantes, al estilo de Studio Trigger y Hiroyuki Imaishi.',
  memoryCore: {
    characters: [
      { id: '1', name: 'Kaelen "Kael" Vance', age: '19', role: 'Protagonista', psychology: 'Imprudente, cínico, pero con un corazón de oro oculto. El ingenio sarcástico es su mecanismo de defensa.', backstory: 'Huérfano durante una escaramuza fronteriza, se unió a la academia para sobrevivir, no por la gloria.', relationships: 'Rival de Elara, su mentor es el Comandante Thorne.', appearance: 'Cabello oscuro y desordenado, ojos color avellana con una chispa desafiante. Complexión delgada pero atlética. Siempre lleva una chaqueta de piloto desgastada sobre su uniforme.', skills: 'Piloto de caza excepcional con reflejos inhumanos. Talentoso para la improvisación táctica. Pésimo en seguir las reglas.', imageUrl: '' },
      { id: '2', name: 'Elara Vex', age: '20', role: 'Rival/Antagonista', psychology: 'Disciplinada, ambiciosa y una firme creyente en el orden del Imperio. Ve a Kael como un comodín peligroso.', backstory: 'Proviene de una familia noble de alto rango, tiene una inmensa presión por tener éxito.', relationships: 'Rival de Kael, protegida del Gran Almirante.', appearance: 'Cabello plateado y liso recogido en una coleta estricta. Ojos azules penetrantes. Postura militar impecable. Su uniforme siempre está perfectamente planchado.', skills: 'Estratega brillante y piloto de manual. Experta en el combate de flotas a gran escala. Puede predecir los movimientos del enemigo basándose en la doctrina militar estándar.', imageUrl: '' },
    ],
    locations: [
      { id: '1', name: 'Nave Insignia "El Aegis"', description: 'Un destructor estelar masivo y antiguo, el último bastión de la 7ª flota. Sus hangares son cavernosos y están llenos de olor a ozono y metal viejo.', imageUrl: '' },
      { id: '2', name: 'Nebulosa Xylos', description: 'Una nebulosa traicionera pero hermosa, conocida por sus anomalías gravitacionales y por ser un refugio para contrabandistas.', imageUrl: '' },
    ],
    plotPoints: [
      { id: '1', title: 'El Descubrimiento', description: 'Kael encuentra el artefacto durante una patrulla de rutina en la Nebulosa Xylos.', imageUrl: '' },
      { id: '2', title: 'Primera Confrontación', description: 'Elara intenta confiscarle el artefacto a Kael, lo que lleva a su primer gran combate aéreo.', imageUrl: '' },
    ],
  },
  manuscripts: [
    {
      id: initialManuscriptId,
      title: 'Capítulo 1 - Borrador',
      content: 'El siseo estático del comunicador era el único sonido que se atrevía a desafiar el bajo zumbido del motor de la nave exploradora. Afuera, la Nebulosa Xylos pintaba la cabina en tonos de púrpura violento y azul eléctrico. Kaelen Vance, alias "Kael", lo odiaba. Demasiado bonito. Las cosas bonitas en el vacío solían ser el preludio de una muerte violenta y fea.\n\n"Ruta de patrulla siete despejada," dijo con voz monótona, cargada del aburrimiento practicado de un adolescente que preferiría estar en cualquier otro lugar. "Solicitando permiso para regresar al Aegis."\n\nSilencio. Más largo de lo habitual.'
    }
  ],
  activeManuscriptId: initialManuscriptId,
};

const App: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<View>(View.CreationEngine);

  useEffect(() => {
    try {
      const savedProjects = localStorage.getItem('nova-scribe-projects');
      if (savedProjects) {
        setProjects(JSON.parse(savedProjects));
      } else {
        const firstProject = { ...initialProject, id: crypto.randomUUID() };
        setProjects([firstProject]);
      }
    } catch (error) {
        console.error("Error al cargar proyectos:", error);
        const firstProject = { ...initialProject, id: crypto.randomUUID() };
        setProjects([firstProject]);
    }
  }, []);

  useEffect(() => {
    if (projects.length > 0) {
      localStorage.setItem('nova-scribe-projects', JSON.stringify(projects));
    }
  }, [projects]);

  const activeProject = projects.find(p => p.id === activeProjectId);
  
  const setActiveProjectState = (updater: React.SetStateAction<Project>) => {
    setProjects(prevProjects =>
      prevProjects.map(p => {
        if (p.id === activeProjectId) {
          return typeof updater === 'function' ? updater(p) : updater;
        }
        return p;
      })
    );
  };
  
  const handleCreateProject = (projectData: Omit<Project, 'id'>) => {
    const newProject: Project = { ...projectData, id: crypto.randomUUID() };
    setProjects(prev => [...prev, newProject]);
    setActiveProjectId(newProject.id);
  };

  const handleDeleteProject = (projectId: string) => {
    if (window.confirm("¿Estás seguro de que quieres eliminar este proyecto? Esta acción no se puede deshacer.")) {
        setProjects(prev => prev.filter(p => p.id !== projectId));
    }
  };

  if (!activeProject) {
    return <ProjectDashboard 
        projects={projects} 
        onSelectProject={setActiveProjectId}
        onCreateProject={handleCreateProject}
        onDeleteProject={handleDeleteProject}
    />;
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
                 <button onClick={() => setActiveProjectId(null)} className="p-2 rounded-full hover:bg-brand-secondary" title="Volver al Panel de Proyectos">
                    <HomeIcon className="h-5 w-5 text-brand-text-secondary hover:text-brand-accent" />
                 </button>
                 <div className="text-xl font-bold">
                    Nova<span className="text-brand-accent">Scribe</span>
                    <span className="text-lg font-normal text-brand-text-secondary ml-3 hidden md:inline">/ {activeProject.title}</span>
                 </div>
            </div>
            <nav className="flex items-center space-x-2">
                <NavItem label="Núcleo de Memoria" view={View.MemoryCore} icon={<CharacterIcon className="h-5 w-5" />} />
                <NavItem label="Motor de Creación" view={View.CreationEngine} icon={<WriteIcon className="h-5 w-5" />} />
                <NavItem label="Estudio Visual" view={View.VisualStudio} icon={<ImageIcon className="h-5 w-5" />} />
            </nav>
        </div>
      </header>
      <main className="flex-grow overflow-y-auto bg-[#0f172a]">
        {renderActiveView()}
      </main>
    </div>
  );
};

export default App;