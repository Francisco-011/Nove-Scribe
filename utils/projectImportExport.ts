import JSZip from 'jszip';
import type { Project } from '../types';

// Helper to convert data URL to blob
const dataURLtoBlob = (dataurl: string) => {
    const arr = dataurl.split(',');
    if (arr.length < 2) return null;
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) return null;
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], {type:mime});
}

const getMimeType = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'png': return 'image/png';
        case 'jpg':
        case 'jpeg': return 'image/jpeg';
        case 'gif': return 'image/gif';
        case 'webp': return 'image/webp';
        default: return 'application/octet-stream';
    }
}


export const exportProject = async (project: Project) => {
    try {
        const zip = new JSZip();
        // Paso 1: Crear una copia profunda de los datos del proyecto.
        // Esto evita modificar el estado actual de la aplicación.
        const projectData = JSON.parse(JSON.stringify(project)); 
        const imgFolder = zip.folder('images');

        if (!imgFolder) {
            throw new Error("Could not create images folder in zip");
        }

        // Paso 2: Procesar y etiquetar cada imagen.
        // Esta función se encarga de convertir las imágenes de Base64 a archivos binarios
        // y de crear un nombre de archivo único y descriptivo para cada una.
        const processItem = (item: { id: string, imageUrl?: string }, type: string) => {
            if (item.imageUrl && item.imageUrl.startsWith('data:image/')) {
                const blob = dataURLtoBlob(item.imageUrl);
                if (blob) {
                    const extension = blob.type.split('/')[1] || 'png';
                    // Etiquetado: El nombre del archivo se construye usando el tipo de entidad (ej: 'character')
                    // y su ID único. Esto garantiza que cada imagen tenga una referencia inequívoca.
                    // Ejemplo: 'character-1a2b3c4d.png'
                    const filename = `${type}-${item.id}.${extension}`;
                    imgFolder.file(filename, blob);
                    
                    // Se reemplaza el dato Base64 en el JSON por el nombre del archivo etiquetado.
                    // En la importación, este nombre de archivo se usará para volver a vincular la imagen.
                    item.imageUrl = filename; 
                }
            }
        };
        
        // Se aplica el proceso de etiquetado a todas las entidades que pueden tener imágenes.
        projectData.memoryCore.characters.forEach((char: any) => processItem(char, 'character'));
        projectData.memoryCore.locations.forEach((loc: any) => processItem(loc, 'location'));
        projectData.memoryCore.plotPoints.forEach((plot: any) => processItem(plot, 'plot'));

        // Paso 3: Guardar el archivo JSON actualizado en el ZIP.
        // Este JSON ahora contiene las referencias a los archivos de imagen en lugar de los datos Base64.
        zip.file('project.json', JSON.stringify(projectData, null, 2));

        // Paso 4: Generar el archivo ZIP y ofrecerlo para descarga.
        const zipBlob = await zip.generateAsync({ type: 'blob' });

        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipBlob);
        const safeTitle = project.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        link.download = `novascribe_project_${safeTitle}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

    } catch (error) {
        console.error("Error exporting project:", error);
        alert("Hubo un error al exportar el proyecto. Revisa la consola para más detalles.");
    }
};

export const importProject = async (zipFile: File): Promise<Omit<Project, 'id'>> => {
    const zip = new JSZip();
    const loadedZip = await zip.loadAsync(zipFile);

    const projectFile = loadedZip.file('project.json');
    if (!projectFile) {
        throw new Error('El archivo ZIP no contiene un project.json válido.');
    }

    // Paso 1: Cargar la estructura completa de datos.
    // La variable 'projectData' ahora contiene toda la información del proyecto
    // (personajes, ubicaciones, trama, manuscritos) con todos sus campos de texto intactos.
    const projectData: Project = JSON.parse(await projectFile.async('string'));

    // Paso 2: Preparar la reconstrucción de imágenes.
    // Se crea un mapa para almacenar las imágenes decodificadas del ZIP.
    const imageMap = new Map<string, string>();
    const imageFolder = loadedZip.folder('images');

    if (imageFolder) {
        const imagePromises: Promise<void>[] = [];
        imageFolder.forEach((relativePath, file) => {
            const promise = async () => {
                const base64 = await file.async('base64');
                const mimeType = getMimeType(file.name);
                const dataUrl = `data:${mimeType};base64,${base64}`;
                imageMap.set(file.name, dataUrl); // Se asocia el nombre de archivo con su data URL.
            };
            imagePromises.push(promise());
        });
        await Promise.all(imagePromises);
    }
    
    // Paso 3: Vincular imágenes a sus entidades correspondientes.
    // Esta función se asegura de que cada imagen se vincule correctamente con su
    // entidad original (personaje, ubicación, etc.) sin alterar ningún otro dato.
    const reconstructItem = (item: { id: string, imageUrl?: string }) => {
        if (item.imageUrl && imageMap.has(item.imageUrl)) {
            // Se restaura la imagen en formato Base64 en el campo 'imageUrl' correcto.
            item.imageUrl = imageMap.get(item.imageUrl);
        }
    };
    
    projectData.memoryCore.characters.forEach(reconstructItem);
    projectData.memoryCore.locations.forEach(reconstructItem);
    projectData.memoryCore.plotPoints.forEach(reconstructItem);
    
    // Se devuelve el objeto de proyecto completo y reconstruido.
    // La función que lo llama (onCreateProject) le asignará un nuevo ID local.
    const { id, ...projectWithoutId } = projectData;
    return projectWithoutId;
};