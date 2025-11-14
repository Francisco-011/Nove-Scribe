import { GoogleGenAI, Modality, Type } from "@google/genai";
import type { Project, Character, Location, PlotPoint } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

function buildContextPrompt(userPrompt: string, project: Project): string {
  let context = `Eres un asistente de escritura de novelas. Tu tarea es generar contenido narrativo atractivo basado en el contexto del proyecto y la solicitud del usuario. Asegúrate de que el resultado sea coherente con el mundo y las personalidades de los personajes establecidos.

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

const buildAnalysisContext = (project: Project): string => {
    let context = `CONTEXTO DEL PROYECTO:
---
**TÍTULO:** ${project.title}
**SINOPSIS GENERAL:** ${project.synopsis}
---
`;

  if (project.memoryCore.characters.length > 0) {
    context += `**PERSONAJES EXISTENTES (para referencia de coherencia):**\n`;
    project.memoryCore.characters.forEach(char => {
      context += `- **${char.name}**: Rol: ${char.role}. Psicología: ${char.psychology}.\n`;
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
  context += `**CONTENIDO DEL MANUSCRITO A ANALIZAR:**\n"${activeManuscript?.content || ''}"\n---`;
  
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
): Promise<{ characters: Partial<Character>[], locations: Partial<Location>[] }> => {
    const context = buildAnalysisContext(project);
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `${context}\n\nAnaliza el manuscrito en el contexto proporcionado. Identifica nombres de posibles NUEVOS personajes y NUEVAS ubicaciones que NO estén en las listas de existentes. Prioriza aquellos que parecen tener un rol o importancia en la narrativa (ej: tienen diálogo, realizan acciones clave). Para cada uno, extrae solo el nombre.\n\nResponde únicamente con un objeto JSON que tenga dos arrays: "characters" y "locations". Cada objeto en los arrays debe tener solo una propiedad "name".`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        characters: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: { name: { type: Type.STRING } },
                            },
                        },
                        locations: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: { name: { type: Type.STRING } },
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

export const generateProjectIdea = async (prompt: string): Promise<{ title: string; synopsis: string; styleSeed: string; }> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: `Eres un asistente creativo para escritores de novelas. Basado en la siguiente idea inicial, genera un concepto de proyecto completo y atractivo en español.
Idea inicial: "${prompt}"

Genera un título evocador, una sinopsis de 2 a 3 párrafos que establezca el conflicto principal y los personajes clave, y una "Semilla de Estilo Visual" descriptiva para la generación de imágenes. Todos los valores deben estar en español.
Responde únicamente con un objeto JSON con las claves "title", "synopsis" y "styleSeed".`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        synopsis: { type: Type.STRING },
                        styleSeed: { type: Type.STRING },
                    },
                    required: ["title", "synopsis", "styleSeed"],
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