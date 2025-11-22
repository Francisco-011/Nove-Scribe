
import { GoogleGenAI, Modality, Type } from "@google/genai";
import type { Project, Character, Location, PlotPoint, Inconsistency } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

function buildContextPrompt(userPrompt: string, project: Project): string {
  // Definir el estilo por defecto si no existe
  const narrativeStyle = project.writingStyle && project.writingStyle.trim() !== '' 
    ? project.writingStyle 
    : "Narrativa estándar en tercera persona, equilibrada entre diálogos y descripciones, tono coherente con la sinopsis.";

  let context = `Eres un asistente de escritura de novelas. Tu tarea es generar contenido narrativo atractivo basado en el contexto del proyecto y la solicitud del usuario.

INSTRUCCIÓN DE ESTILO Y TONO (CRÍTICO):
Debes escribir utilizando el siguiente estilo: "${narrativeStyle}".
Asegúrate de que la voz narrativa, el punto de vista (1ra/3ra persona) y la proporción diálogo/narración se ajusten a esta directriz.

CONTEXTO DEL PROYECTO:
---
**TÍTULO:** ${project.title}
**SINOPSIS GENERAL:** ${project.synopsis}
---
`;

  if (project.memoryCore.characters.length > 0) {
    context += `**PERSONAJES:**\n`;
    project.memoryCore.characters.forEach(char => {
      context += `- **${char.name}**: Edad ${char.age}, Rol: ${char.role}. Psicología: ${char.psychology}. Apariencia: ${char.appearance || 'No especificada'}. Habilidades/Poderes: ${char.skills || 'No especificados'}. Trasfondo: ${char.backstory}. Relaciones: ${char.relationships}\n`;
    });
    context += '---\n';
  }

  if (project.memoryCore.locations.length > 0) {
    context += `**UBICACIONES:**\n`;
    project.memoryCore.locations.forEach(loc => {
      context += `- **${loc.name}**: ${loc.description}\n`;
    });
    context += '---\n';
  }
  
  if (project.memoryCore.plotPoints.length > 0) {
    context += `**PUNTOS DE LA TRAMA YA ESTABLECIDOS:**\n`;
    project.memoryCore.plotPoints.forEach(plot => {
      context += `- **${plot.title}**: ${plot.description}\n`;
    });
    context += '---\n';
  }

  const activeManuscript = project.manuscripts.find(m => m.id === project.activeManuscriptId);
  if (activeManuscript && activeManuscript.content) {
    // Proporcionar las últimas ~500 palabras como memoria a corto plazo
    const lastWords = activeManuscript.content.trim().split(/\s+/).slice(-500).join(' ');
    context += `**CONTEXTO INMEDIATO DEL MANUSCRITO (últimas líneas escritas):**\n${lastWords}\n---\n`;
  }

  context += `\n**SOLICITUD DEL USUARIO:**\n${userPrompt}\n\n**ESCENA GENERADA (continúa desde el contexto inmediato y escribe en español):**\n`;
  return context;
}

const buildAnalysisContext = (project: Project, textToAnalyze?: string): string => {
    let context = `CONTEXTO DEL PROYECTO:
---
**TÍTULO:** ${project.title}
**SINOPSIS GENERAL:** ${project.synopsis}
---
`;

  if (project.memoryCore.characters.length > 0) {
    context += `**PERSONAJES EXISTENTES (para referencia de coherencia):**\n`;
    project.memoryCore.characters.forEach(char => {
      context += `- **${char.name}**: Rol: ${char.role}. Psicología: ${char.psychology}. Apariencia: ${char.appearance || 'N/A'}. Relaciones: ${char.relationships}\n`;
    });
    context += '---\n';
  }

  if (project.memoryCore.locations.length > 0) {
    context += `**UBICACIONES EXISTENTES (para referencia de coherencia):**\n`;
    project.memoryCore.locations.forEach(loc => {
      context += `- **${loc.name}**: ${loc.description}\n`;
    });
    context += '---\n';
  }
  
  if (project.memoryCore.plotPoints.length > 0) {
    context += `**PUNTOS DE LA TRAMA YA ESTABLECIDOS (para evitar repeticiones):**\n`;
    project.memoryCore.plotPoints.forEach(plot => {
      context += `- **${plot.title}**\n`;
    });
    context += '---\n';
  }
  
  const activeManuscript = project.manuscripts.find(m => m.id === project.activeManuscriptId);
  // Si textToAnalyze está presente, usar ese texto. De lo contrario, usar el manuscrito activo.
  const contentToAnalyze = textToAnalyze !== undefined ? textToAnalyze : (activeManuscript?.content || '');
  
  context += `**CONTENIDO A ANALIZAR:**\n"${contentToAnalyze}"\n---`;
  
  return context;
}


export const generateNarrative = async (userPrompt: string, project: Project): Promise<string> => {
  try {
    const fullPrompt = buildContextPrompt(userPrompt, project);
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: fullPrompt,
    });
    return response.text;
  } catch (error) {
    console.error("Error al generar la narrativa:", error);
    return "Ocurrió un error al generar la narrativa. Por favor, revisa la consola para más detalles.";
  }
};

export const checkConsistency = async (project: Project, textToAnalyze?: string): Promise<Inconsistency[]> => {
    const context = buildAnalysisContext(project, textToAnalyze);
    const prompt = `Actúa como un EDITOR DE CONTINUIDAD (Continuity Editor) profesional para una novela.
    
    Tu trabajo es leer el "CONTENIDO A ANALIZAR" proporcionado en el contexto y buscar INCONSISTENCIAS LÓGICAS comparándolo con los "PERSONAJES EXISTENTES", "UBICACIONES" y reglas del mundo.
    
    Busca errores como:
    1. **Personajes (character):** Alguien actúa de forma totalmente opuesta a su psicología establecida sin motivo, descripciones físicas erróneas (ojos azules cuando son verdes), o personajes que deberían estar en otro lugar/muertos.
    2. **Trama (plot):** Eventos que contradicen lo establecido anteriormente o saltos temporales ilógicos.
    3. **Mundo (world):** Reglas de magia/tecnología que se rompen, o descripciones de lugares que contradicen el mapa.
    
    Si no encuentras errores graves, devuelve un array vacío.
    Si encuentras errores, clasifícalos por gravedad (high/medium/low).
    
    Responde ÚNICAMENTE con un array JSON.`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `${context}\n\n${prompt}`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            type: { type: Type.STRING, enum: ['character', 'plot', 'world'] },
                            description: { type: Type.STRING, description: "Explicación clara de por qué es una inconsistencia." },
                            quote: { type: Type.STRING, description: "La frase o fragmento del texto donde ocurre el error." },
                            severity: { type: Type.STRING, enum: ['high', 'medium', 'low'] }
                        },
                        required: ["type", "description", "quote", "severity"]
                    },
                },
            },
        });

        let jsonStr = response.text.trim();
        return JSON.parse(jsonStr);

    } catch (error) {
        console.error("Error verificando consistencia:", error);
        throw error;
    }
};

export const generateCharacterDetails = async (prompt: string): Promise<Partial<Character>> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Genera un perfil de personaje detallado en español para una novela de ficción basado en este concepto: "${prompt}". Los valores del JSON deben estar en español. Responde únicamente con el objeto JSON.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        age: { type: Type.STRING },
                        role: { type: Type.STRING },
                        psychology: { type: Type.STRING },
                        backstory: { type: Type.STRING },
                        relationships: { type: Type.STRING },
                        appearance: { type: Type.STRING },
                        skills: { type: Type.STRING },
                    },
                },
            },
        });
        
        let jsonStr = response.text.trim();
        return JSON.parse(jsonStr);

    } catch (error) {
        console.error("Error generando detalles del personaje:", error);
        throw error;
    }
};

// Nueva función para enriquecer un personaje existente con contexto de otros personajes
export const enrichCharacterProfile = async (
    partialChar: Partial<Character>, 
    synopsis: string,
    otherCharactersSummary: string = ''
): Promise<Partial<Character>> => {
    try {
        const prompt = `Actúa como un consultor literario experto. Tengo un personaje parcialmente definido para una novela.
        
        SINOPSIS DE LA NOVELA: "${synopsis}"
        
        OTROS PERSONAJES EN LA HISTORIA (Úsalos para crear relaciones coherentes):
        ${otherCharactersSummary || 'No hay otros personajes definidos aún.'}
        
        DATOS ACTUALES DEL PERSONAJE A MEJORAR:
        Nombre: ${partialChar.name}
        Rol: ${partialChar.role}
        Edad: ${partialChar.age}
        Psicología actual: ${partialChar.psychology}
        
        TU TAREA:
        Rellena los campos vacíos y enriquece los existentes para crear un personaje tridimensional, complejo y coherente con la sinopsis y los otros personajes.
        NO cambies el nombre ni el rol fundamental, solo expándelos.
        
        Genera:
        1. 'psychology': Profundiza en sus miedos y deseos.
        2. 'backstory': Un pasado que explique su personalidad actual.
        3. 'appearance': Descripción física detallada y distintiva.
        4. 'skills': Habilidades, talentos o poderes.
        5. 'relationships': Cómo se relaciona con otros personajes existentes o nuevos (amigos, enemigos, familia).
        
        Responde únicamente con un objeto JSON en español.`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        age: { type: Type.STRING },
                        role: { type: Type.STRING },
                        psychology: { type: Type.STRING },
                        backstory: { type: Type.STRING },
                        relationships: { type: Type.STRING },
                        appearance: { type: Type.STRING },
                        skills: { type: Type.STRING },
                    },
                    required: ["name", "age", "role", "psychology", "backstory", "relationships", "appearance", "skills"]
                },
            },
        });
        
        let jsonStr = response.text.trim();
        return JSON.parse(jsonStr);

    } catch (error) {
        console.error("Error enriqueciendo personaje:", error);
        throw error;
    }
};

export const evolveCharactersFromManuscript = async (project: Project): Promise<{id: string, name: string, psychology: string, relationships: string}[]> => {
    const activeManuscript = project.manuscripts.find(m => m.id === project.activeManuscriptId);
    if (!activeManuscript || !activeManuscript.content) return [];

    const charactersJson = JSON.stringify(project.memoryCore.characters.map(c => ({
        id: c.id,
        name: c.name,
        psychology: c.psychology,
        relationships: c.relationships
    })));

    const prompt = `Eres un biógrafo de personajes y analista narrativo. He escrito un nuevo capítulo y necesito actualizar la "Memoria Viva" de mis personajes.
    
    MANUSCRITO RECIENTE:
    "${activeManuscript.content}"

    PERSONAJES ACTUALES (Historial previo):
    ${charactersJson}

    TU TAREA (CRÍTICA - PRESERVACIÓN DE HISTORIA):
    1. Lee el manuscrito e identifica si algún personaje ha experimentado cambios significativos en su **psicología** o en sus **relaciones**.
    2. IMPORTANTE: **NO BORRES** ni resumas excesivamente la información anterior. Queremos una biografía acumulativa.
    3. Si la relación cambió (de amigos a enemigos), NO elimines que fueron amigos. Añade el nuevo desarrollo.
       - Estructura sugerida: "[Contexto Original]. Sin embargo, tras los eventos recientes donde [acción], su relación se ha tornado [nuevo estado]."
    4. Solo devuelve los personajes que han tenido una evolución clara en este texto.
    
    Responde únicamente con un array JSON de objetos con: 'id', 'name', 'psychology' (texto actualizado), 'relationships' (texto actualizado).`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.STRING },
                            name: { type: Type.STRING },
                            psychology: { type: Type.STRING, description: "Descripción psicológica acumulativa." },
                            relationships: { type: Type.STRING, description: "Historial de relaciones acumulativo." },
                        },
                        required: ["id", "name", "psychology", "relationships"]
                    },
                },
            },
        });

        let jsonStr = response.text.trim();
        return JSON.parse(jsonStr);

    } catch (error) {
        console.error("Error evolucionando personajes:", error);
        throw error;
    }
};

export const evolveLocationsFromManuscript = async (project: Project): Promise<{id: string, name: string, description: string}[]> => {
    const activeManuscript = project.manuscripts.find(m => m.id === project.activeManuscriptId);
    if (!activeManuscript || !activeManuscript.content) return [];
    if (project.memoryCore.locations.length === 0) return [];

    const locationsJson = JSON.stringify(project.memoryCore.locations.map(l => ({
        id: l.id,
        name: l.name,
        description: l.description
    })));

    const prompt = `Eres un arquitecto de mundos y cartógrafo narrativo. He escrito un nuevo capítulo y necesito actualizar el estado físico y atmosférico de mis ubicaciones (World Atlas).
    
    MANUSCRITO RECIENTE:
    "${activeManuscript.content}"

    UBICACIONES ACTUALES:
    ${locationsJson}

    TU TAREA:
    1. Analiza si alguna ubicación mencionada ha sufrido cambios físicos (destrucción, renovación, cambio de estación, batalla) o atmosféricos.
    2. MANTÉN LA HISTORIA DEL LUGAR. No borres la descripción base. Añade una sección de "Estado Actual" o integra los cambios narrativamente.
       - Ejemplo: "Antiguamente un bosque verde (ver descripción original...), ahora yace calcinado tras el incendio..."
    3. Solo devuelve las ubicaciones que han cambiado.

    Responde únicamente con un array JSON de objetos con: 'id', 'name', 'description' (actualizada).`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.STRING },
                            name: { type: Type.STRING },
                            description: { type: Type.STRING, description: "Descripción actualizada reflejando los cambios del entorno." },
                        },
                        required: ["id", "name", "description"]
                    },
                },
            },
        });

        let jsonStr = response.text.trim();
        return JSON.parse(jsonStr);

    } catch (error) {
        console.error("Error evolucionando ubicaciones:", error);
        throw error; // O retornar [] si prefieres que no rompa el flujo
    }
};


export const generateLocationDetails = async (prompt: string): Promise<Partial<Location>> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Genera un perfil de ubicación detallado en español para una novela de ficción basado en este concepto: "${prompt}". Los valores del JSON deben estar en español. Responde únicamente con el objeto JSON.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        description: { type: Type.STRING },
                    },
                },
            },
        });
        
        let jsonStr = response.text.trim();
        return JSON.parse(jsonStr);

    } catch (error) {
        console.error("Error generando detalles de la ubicación:", error);
        throw error;
    }
};

export const generatePlotStructure = async (synopsis: string): Promise<Partial<PlotPoint>[]> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Basado en la siguiente sinopsis de una novela, genera una lista de 5 a 7 puntos clave de la trama que formen una estructura narrativa coherente (ej: introducción, nudo, desenlace) en español. Responde únicamente con un array de objetos JSON. Sinopsis: "${synopsis}"`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            description: { type: Type.STRING },
                        },
                    },
                },
            },
        });
        
        let jsonStr = response.text.trim();
        return JSON.parse(jsonStr);

    } catch (error) {
        console.error("Error generando la estructura de la trama:", error);
        throw error;
    }
};

export const analyzeManuscriptForPlotPoints = async (project: Project): Promise<Partial<PlotPoint>[]> => {
    const context = buildAnalysisContext(project);
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `${context}\n\nAnaliza el manuscrito en el contexto proporcionado. Identifica de 3 a 5 nuevos eventos clave, giros argumentales o revelaciones que sean COHERENTES con la sinopsis y los perfiles de personajes. No sugieras puntos de trama que ya existan en la lista. Para cada uno, crea un título conciso y una breve descripción, ambos en español. Responde únicamente con un array de objetos JSON.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING, description: "Un título corto y descriptivo para el evento." },
                            description: { type: Type.STRING, description: "Un resumen de 1-2 frases del evento." },
                        },
                         required: ["title", "description"],
                    },
                },
            },
        });
        
        let jsonStr = response.text.trim();
        return JSON.parse(jsonStr);

    } catch (error) {
        console.error("Error analizando el manuscrito:", error);
        throw error;
    }
}

export const analyzeManuscriptForEntities = async (
  project: Project
): Promise<{ characters: { name: string; justification: string }[], locations: { name: string; justification: string }[] }> => {
    const context = buildAnalysisContext(project);
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `${context}\n\nAnaliza el manuscrito en el contexto proporcionado. Identifica nombres de posibles NUEVOS personajes y NUEVAS ubicaciones que NO estén en las listas de existentes. Prioriza aquellos que parecen tener un rol o importancia en la narrativa (ej: tienen diálogo, realizan acciones clave). Para cada uno, extrae su nombre y proporciona una breve 'justification' (justificación) en español de por qué es relevante (ej: 'Tuvo un diálogo clave con el protagonista', 'Es el lugar de la batalla principal').\n\nResponde únicamente con un objeto JSON que tenga dos arrays: "characters" y "locations".`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        characters: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: { 
                                    name: { type: Type.STRING },
                                    justification: { type: Type.STRING, description: "Breve explicación de por qué el personaje es relevante."}
                                },
                                required: ["name", "justification"]
                            },
                        },
                        locations: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: { 
                                    name: { type: Type.STRING },
                                    justification: { type: Type.STRING, description: "Breve explicación de por qué la ubicación es relevante."}
                                },
                                required: ["name", "justification"]
                            },
                        },
                    },
                },
            },
        });

        let jsonStr = response.text.trim();
        const result = JSON.parse(jsonStr);
        // Ensure the structure is correct even if AI returns nulls
        return {
            characters: result.characters || [],
            locations: result.locations || [],
        };

    } catch (error) {
        console.error("Error analizando entidades del manuscrito:", error);
        throw error;
    }
}


export const generateCharacterImage = async (character: Character, project: Project): Promise<string> => {
  const prompt = `Genera un retrato de cuerpo completo de un personaje de novela de ficción. Sé muy detallado y fiel a la descripción.

**Nombre del Personaje:** ${character.name}
**Rol en la historia:** ${character.role}
**Edad:** ${character.age}
**Apariencia Física Detallada:** ${character.appearance || 'No especificada. Sé creativo basado en el resto de los detalles.'}
**Habilidades y Poderes Clave (esto debe influir en su vestimenta, equipo o postura):** ${character.skills || 'No especificados.'}
**Psicología y Trasfondo (para capturar su esencia en la expresión y el lenguaje corporal):** ${character.psychology} & ${character.backstory}
**Estilo Visual Maestro del Proyecto:** ${project.styleSeed}

Genera la imagen basándote en TODA esta información para asegurar la máxima coherencia.`;
  
  try {
     const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: prompt }] },
        config: {
            responseModalities: [Modality.IMAGE],
        },
     });
     
     for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
            return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
     }
     throw new Error("No se encontraron datos de imagen en la respuesta");
  } catch (error) {
    console.error("Error al generar la imagen del personaje:", error);
    throw error;
  }
};


export const generateLocationImage = async (location: Location, project: Project): Promise<string> => {
  const prompt = `Genera una ilustración de un escenario de novela de ficción. Sé muy detallado y fiel a la descripción para capturar la atmósfera.

**Nombre de la Ubicación:** ${location.name}
**Descripción Detallada (ambiente, arquitectura, elementos clave):** ${location.description}
**Estilo Visual Maestro del Proyecto:** ${project.styleSeed}

Genera la imagen basándote en TODA esta información para asegurar la máxima coherencia.`;
  
  try {
     const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: prompt }] },
        config: {
            responseModalities: [Modality.IMAGE],
        },
     });
     
     for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
            return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
     }
     throw new Error("No se encontraron datos de imagen en la respuesta");
  } catch (error) {
    console.error("Error al generar la imagen de la ubicación:", error);
    throw error;
  }
};


export const generatePlotPointImage = async (plotPoint: PlotPoint, project: Project): Promise<string> => {
  const prompt = `Genera una ilustración de un momento clave en una novela de ficción. La imagen debe ser dramática y capturar la esencia del evento.

**Título del Evento:** ${plotPoint.title}
**Descripción Detallada del Evento:** ${plotPoint.description}
**Estilo Visual Maestro del Proyecto:** ${project.styleSeed}

Genera la imagen basándote en TODA esta información para asegurar la máxima coherencia.`;
  
  try {
     const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: prompt }] },
        config: {
            responseModalities: [Modality.IMAGE],
        },
     });
     
     for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
            return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
     }
     throw new Error("No se encontraron datos de imagen en la respuesta");
  } catch (error) {
    console.error("Error al generar la imagen del punto de trama:", error);
    throw error;
  }
};


interface SceneGenerationPayload {
  actionDescription: string;
  characters: Character[];
  location?: Location;
  project: Project;
}

export const generateSceneImage = async (payload: SceneGenerationPayload): Promise<string> => {
  const { actionDescription, characters, location, project } = payload;
  let prompt = `Genera una ilustración de una escena dinámica de una novela de ficción. La imagen debe ser coherente con todos los elementos descritos.

**Estilo Visual Maestro:** ${project.styleSeed}

**Acción Principal:** ${actionDescription}
`;

  if (location) {
    prompt += `\n**Escenario/Ubicación:**
- **Nombre:** ${location.name}
- **Descripción:** ${location.description}\n`;
  }

  if (characters.length > 0) {
    prompt += `\n**Personajes en la Escena (USA ESTAS DESCRIPCIONES EXACTAS PARA SU APARIENCIA):**\n`;
    characters.forEach(char => {
      prompt += `- **${char.name}**: ${char.appearance || 'Apariencia no especificada.'}\n`;
    });
  }

  try {
     const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: prompt }] },
        config: {
            responseModalities: [Modality.IMAGE],
        },
     });

     for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
            return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
     }
     throw new Error("No se encontraron datos de imagen en la respuesta");
  } catch (error) {
    console.error("Error al generar la imagen de la escena:", error);
    throw error;
  }
};


export const suggestScenesFromManuscript = async (project: Project): Promise<{title: string, prompt: string}[]> => {
    const context = buildAnalysisContext(project);
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `${context}\n\nAnaliza el manuscrito en el contexto proporcionado. Identifica de 3 a 5 de los momentos más visualmente interesantes o dramáticos que serían buenas ilustraciones. Las sugerencias deben ser COHERENTES con la Semilla de Estilo del proyecto: "${project.styleSeed}". Para cada uno, crea un título corto y un prompt descriptivo para un generador de imágenes, ambos en español.
            
            Responde únicamente con un array de objetos JSON con las claves "title" y "prompt".`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING, description: "Un título corto para la escena." },
                            prompt: { type: Type.STRING, description: "Una descripción detallada para el generador de imágenes." },
                        },
                         required: ["title", "prompt"],
                    },
                },
            },
        });
        
        let jsonStr = response.text.trim();
        return JSON.parse(jsonStr);

    } catch (error) {
        console.error("Error sugiriendo escenas del manuscrito:", error);
        throw error;
    }
}

export const generateProjectIdea = async (prompt: string): Promise<{ title: string; synopsis: string; styleSeed: string; writingStyle: string; characters: Partial<Character>[]; plotPoints: Partial<PlotPoint>[]; }> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: `Eres un asistente creativo para escritores de novelas. Basado en la siguiente idea inicial, genera un concepto de proyecto completo y atractivo en español.
Idea inicial: "${prompt}"

Genera:
1. Un 'title' evocador.
2. Una 'synopsis' de 2 a 3 párrafos.
3. Una 'styleSeed' descriptiva para la generación de imágenes (ej: Cyberpunk Noir, Acuarela Ghibli).
4. Un 'writingStyle' descriptivo que defina el tono narrativo (ej: Primera persona sarcástica, Tercera persona omnisciente y oscura).
5. Un array 'characters' con 2-3 perfiles de personajes clave COMPLETOS. Debes inventar su apariencia, psicología, trasfondo y relaciones, no dejes campos vacíos.
6. Un array 'plotPoints' con 3-5 puntos clave iniciales de la trama. Cada punto debe tener 'title' y 'description'.

Todos los valores deben estar en español. Responde únicamente con un objeto JSON.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        synopsis: { type: Type.STRING },
                        styleSeed: { type: Type.STRING },
                        writingStyle: { type: Type.STRING },
                        characters: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING },
                                    age: { type: Type.STRING },
                                    role: { type: Type.STRING },
                                    psychology: { type: Type.STRING },
                                    backstory: { type: Type.STRING },
                                    relationships: { type: Type.STRING },
                                    appearance: { type: Type.STRING },
                                    skills: { type: Type.STRING },
                                },
                                required: ["name", "age", "role", "psychology", "backstory", "relationships", "appearance", "skills"],
                            }
                        },
                        plotPoints: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    title: { type: Type.STRING },
                                    description: { type: Type.STRING },
                                },
                                required: ["title", "description"],
                            }
                        }
                    },
                    required: ["title", "synopsis", "styleSeed", "writingStyle", "characters", "plotPoints"],
                },
            },
        });
        
        let jsonStr = response.text.trim();
        return JSON.parse(jsonStr);

    } catch (error) {
        console.error("Error generando idea de proyecto:", error);
        throw error;
    }
};
