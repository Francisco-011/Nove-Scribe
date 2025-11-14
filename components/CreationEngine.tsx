import React, { useState } from 'react';
import type { Project, PlotPoint, Character, Location } from '../types';
import { generateNarrative, analyzeManuscriptForPlotPoints, analyzeManuscriptForEntities } from '../services/geminiService';
import { Spinner, PlusIcon, LightbulbIcon, XIcon, ExportIcon } from './Icons';

interface CreationEngineProps {
  project: Project;
  setProject: React.Dispatch<React.SetStateAction<Project>>;
}

export const CreationEngine: React.FC<CreationEngineProps> = ({ project, setProject }) => {
  const [prompt, setPrompt] = useState('');
  const [generatedText, setGeneratedText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [suggestedPlotPoints, setSuggestedPlotPoints] = useState<Partial<PlotPoint>[]>([]);
  const [suggestedCharacters, setSuggestedCharacters] = useState<Partial<Character>[]>([]);
  const [suggestedLocations, setSuggestedLocations] = useState<Partial<Location>[]>([]);

  const activeManuscript = project.manuscripts.find(m => m.id === project.activeManuscriptId);

  const handleManuscriptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setProject(prev => ({
      ...prev,
      manuscripts: prev.manuscripts.map(m =>
        m.id === prev.activeManuscriptId ? { ...m, content: newContent } : m
      ),
    }));
  };
  
  const handleSwitchManuscript = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setProject(prev => ({ ...prev, activeManuscriptId: e.target.value }));
  };

  const handleNewManuscript = () => {
    const title = window.prompt("Introduce el título para el nuevo manuscrito:", "Nuevo Borrador");
    if (title) {
        const newManuscript = {
            id: crypto.randomUUID(),
            title,
            content: ''
        };
        setProject(prev => ({
            ...prev,
            manuscripts: [...prev.manuscripts, newManuscript],
            activeManuscriptId: newManuscript.id
        }));
    }
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
    
    // Clean up
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

  const insertText = () => {
    if (!generatedText) return;
    const currentContent = activeManuscript?.content || '';
    const newContent = currentContent + '\n\n' + generatedText;

    setProject(prev => ({
      ...prev,
      manuscripts: prev.manuscripts.map(m =>
        m.id === prev.activeManuscriptId ? { ...m, content: newContent } : m
      ),
    }));
    setGeneratedText('');
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
  
  const addSuggestedCharacter = (suggestion: Partial<Character>) => {
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
  
  const addSuggestedLocation = (suggestion: Partial<Location>) => {
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
  };

  const hasSuggestions = suggestedPlotPoints.length > 0 || suggestedCharacters.length > 0 || suggestedLocations.length > 0;


  return (
    <div className="p-4 md:p-6 lg:p-8 h-full flex flex-col">
      <h2 className="text-2xl md:text-3xl font-bold mb-6 border-b-2 border-brand-secondary pb-2">Motor de Creación</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-grow">
        {/* Manuscript Editor */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <div className='flex items-center space-x-2'>
              <label htmlFor="manuscript" className="text-lg font-semibold text-brand-accent">Manuscrito</label>
              <button onClick={handleAnalyzeManuscript} disabled={isAnalyzing || !activeManuscript?.content} className="p-1 bg-brand-secondary rounded-md hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed" title="Analizar Manuscrito">
                {isAnalyzing ? <Spinner className="h-5 w-5"/> : <LightbulbIcon className="h-5 w-5"/>}
              </button>
            </div>
            <div className="flex items-center space-x-2">
                <select 
                    value={project.activeManuscriptId}
                    onChange={handleSwitchManuscript}
                    className="bg-brand-secondary rounded-md p-2 text-sm focus:ring-1 focus:ring-brand-accent focus:outline-none"
                >
                    {project.manuscripts.map(m => (
                        <option key={m.id} value={m.id}>{m.title}</option>
                    ))}
                </select>
                <button onClick={handleNewManuscript} className="p-2 bg-brand-secondary rounded-md hover:bg-slate-600" title="Nuevo Manuscrito"><PlusIcon className="h-5 w-5"/></button>
                <button onClick={handleExportManuscript} className="p-2 bg-brand-secondary rounded-md hover:bg-slate-600" title="Exportar Manuscrito"><ExportIcon className="h-5 w-5"/></button>
            </div>
          </div>
          <textarea
            id="manuscript"
            value={activeManuscript?.content || ''}
            onChange={handleManuscriptChange}
            placeholder="Comienza a escribir tu historia aquí..."
            className="w-full flex-grow bg-slate-900 border border-brand-secondary rounded-lg p-4 focus:ring-2 focus:ring-brand-accent focus:outline-none resize-none"
          />
        </div>

        {/* AI Assistant */}
        <div className="flex flex-col">
          <label htmlFor="ai-prompt" className="text-lg font-semibold mb-2 text-brand-accent">Coautor IA</label>
          <div className="bg-slate-900 border border-brand-secondary rounded-lg p-4 flex-grow flex flex-col">
            <textarea
              id="ai-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder='ej: "Escribe un encuentro tenso entre Kael y Elara en el hangar."'
              className="w-full bg-brand-secondary rounded-md p-3 focus:ring-1 focus:ring-brand-accent focus:outline-none"
              rows={3}
            />
            <button
              onClick={handleGenerate}
              disabled={isLoading}
              className="mt-3 w-full bg-brand-accent text-white font-bold py-2 px-4 rounded-md hover:bg-sky-500 transition-colors duration-200 disabled:bg-slate-600 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isLoading ? <Spinner className="h-5 w-5" /> : 'Generar Escena'}
            </button>
            
            {hasSuggestions && (
                 <div className="relative mt-4 border-t border-brand-secondary pt-4 space-y-4 max-h-48 overflow-y-auto bg-brand-primary p-3 rounded-md">
                    <button onClick={clearSuggestions} className="absolute top-2 right-2 p-1 text-brand-text-secondary hover:text-white" title="Ocultar sugerencias">
                        <XIcon className="h-4 w-4" />
                    </button>
                    { suggestedPlotPoints.length > 0 && (
                        <div>
                            <h4 className='text-sm font-bold text-brand-accent mb-2'>Puntos de Trama Sugeridos:</h4>
                            <div className='space-y-2'>
                                {suggestedPlotPoints.map((p, index) => (
                                    <div key={`p-${index}`} className='bg-slate-900 p-2 rounded-md text-sm flex justify-between items-center'>
                                        <div>
                                            <p className='font-semibold'>{p.title}</p>
                                            <p className='text-xs text-brand-text-secondary'>{p.description}</p>
                                        </div>
                                        <button onClick={() => addSuggestedPlotPoint(p)} className='flex-shrink-0 ml-2 p-1 bg-slate-600 text-white rounded-md hover:bg-slate-500 text-xs'>Añadir</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    { suggestedCharacters.length > 0 && (
                        <div>
                            <h4 className='text-sm font-bold text-brand-accent mb-2'>Nuevos Personajes Sugeridos:</h4>
                            <div className='space-y-2'>
                                {suggestedCharacters.map((c, index) => (
                                    <div key={`c-${index}`} className='bg-slate-900 p-2 rounded-md text-sm flex justify-between items-center'>
                                        <p className='font-semibold'>{c.name}</p>
                                        <button onClick={() => addSuggestedCharacter(c)} className='flex-shrink-0 ml-2 p-1 bg-slate-600 text-white rounded-md hover:bg-slate-500 text-xs'>Añadir</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    { suggestedLocations.length > 0 && (
                        <div>
                            <h4 className='text-sm font-bold text-brand-accent mb-2'>Nuevas Ubicaciones Sugeridas:</h4>
                            <div className='space-y-2'>
                                {suggestedLocations.map((l, index) => (
                                    <div key={`l-${index}`} className='bg-slate-900 p-2 rounded-md text-sm flex justify-between items-center'>
                                        <p className='font-semibold'>{l.name}</p>
                                        <button onClick={() => addSuggestedLocation(l)} className='flex-shrink-0 ml-2 p-1 bg-slate-600 text-white rounded-md hover:bg-slate-500 text-xs'>Añadir</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}


            <div className="mt-4 border-t border-brand-secondary pt-4 flex-grow overflow-y-auto">
              {isLoading && <p className="text-brand-text-secondary text-center">Generando...</p>}
              {generatedText && (
                <div className="bg-brand-primary p-3 rounded-md">
                  <p className="whitespace-pre-wrap text-sm">{generatedText}</p>
                  <button
                    onClick={insertText}
                    className="mt-3 w-full bg-slate-600 text-white font-bold py-2 px-4 rounded-md hover:bg-slate-500 transition-colors duration-200"
                  >
                    Insertar en el Manuscrito
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};