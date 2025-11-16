import JSZip from 'jszip';
import type { Project, GeneratedImage } from '../types';

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
        const projectData = JSON.parse(JSON.stringify(project)); 
        const imgFolder = zip.folder('images');

        if (!imgFolder) {
            throw new Error("Could not create images folder in zip");
        }

        const processItem = (item: { id: string, imageUrl?: string }, type: string) => {
            if (item.imageUrl && item.imageUrl.startsWith('data:image/')) {
                const blob = dataURLtoBlob(item.imageUrl);
                if (blob) {
                    const extension = blob.type.split('/')[1] || 'png';
                    const filename = `${type}-${item.id}.${extension}`;
                    imgFolder.file(filename, blob);
                    item.imageUrl = filename; 
                }
            }
        };

        const processGalleryImage = (item: { id: string, src?: string }) => {
            if (item.src && item.src.startsWith('data:image/')) {
                const blob = dataURLtoBlob(item.src);
                if (blob) {
                    const extension = blob.type.split('/')[1] || 'png';
                    const filename = `gallery-${item.id}.${extension}`;
                    imgFolder.file(filename, blob);
                    item.src = filename;
                }
            }
        };
        
        projectData.memoryCore.characters.forEach((char: any) => processItem(char, 'character'));
        projectData.memoryCore.locations.forEach((loc: any) => processItem(loc, 'location'));
        projectData.memoryCore.plotPoints.forEach((plot: any) => processItem(plot, 'plot'));
        if(projectData.gallery) {
            projectData.gallery.forEach((img: any) => processGalleryImage(img));
        }

        zip.file('project.json', JSON.stringify(projectData, null, 2));

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

    const projectData: Project = JSON.parse(await projectFile.async('string'));

    // Backwards compatibility for projects without a gallery
    if (!projectData.gallery) {
        projectData.gallery = [];
    }

    const imageMap = new Map<string, string>();
    const imageFolder = loadedZip.folder('images');

    if (imageFolder) {
        const imagePromises: Promise<void>[] = [];
        imageFolder.forEach((relativePath, file) => {
            const promise = async () => {
                const base64 = await file.async('base64');
                const mimeType = getMimeType(file.name);
                const dataUrl = `data:${mimeType};base64,${base64}`;
                imageMap.set(file.name, dataUrl);
            };
            imagePromises.push(promise());
        });
        await Promise.all(imagePromises);
    }
    
    const reconstructItem = (item: { id: string, imageUrl?: string }) => {
        if (item.imageUrl && imageMap.has(item.imageUrl)) {
            item.imageUrl = imageMap.get(item.imageUrl);
        }
    };
    
    const reconstructGalleryImage = (item: GeneratedImage) => {
        if (item.src && imageMap.has(item.src)) {
            item.src = imageMap.get(item.src)!;
        }
    };

    projectData.memoryCore.characters.forEach(reconstructItem);
    projectData.memoryCore.locations.forEach(reconstructItem);
    projectData.memoryCore.plotPoints.forEach(reconstructItem);
    if(projectData.gallery) {
        projectData.gallery.forEach(reconstructGalleryImage);
    }
    
    const { id, ...projectWithoutId } = projectData;
    return projectWithoutId;
};