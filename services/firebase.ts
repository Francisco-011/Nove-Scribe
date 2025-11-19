
import * as _app from "firebase/app";
import * as _auth from "firebase/auth";
import * as _firestore from "firebase/firestore";
import type { Project, Character, Location, PlotPoint, Manuscript, GeneratedImage } from '../types';

// Workaround for module resolution errors: cast imports to any to access destructured members
const { initializeApp } = _app as any;
const { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged
} = _auth as any;

const { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc, 
  writeBatch,
  onSnapshot,
  query,
  where,
  serverTimestamp
} = _firestore as any;


// Configuración EXACTA proporcionada para 'proceza'
const firebaseConfig = {
  apiKey: "AIzaSyBIXQqfSM9wbQi1ZayzbXaJc45eV3_tqhU",
  authDomain: "proceza.firebaseapp.com",
  projectId: "proceza",
  storageBucket: "proceza.firebasestorage.app",
  messagingSenderId: "473257327021",
  appId: "1:473257327021:web:656ce70fd670cd7bf9c924"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// IMPORTANTE: Inicializar Firestore apuntando a la base de datos personalizada 'nova-scribe-db'
export const db = getFirestore(app, 'nova-scribe-db');

// --- AUTH SERVICES ---

export const loginUser = async (email: string, pass: string) => {
  return await signInWithEmailAndPassword(auth, email, pass);
};

export const registerUser = async (email: string, pass: string) => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
  // Crear perfil de usuario básico en Firestore
  await setDoc(doc(db, "users", userCredential.user.uid), {
    email: email,
    createdAt: serverTimestamp(),
    uid: userCredential.user.uid
  });
  return userCredential;
};

export const logoutUser = async () => {
  return await signOut(auth);
};

export const subscribeToAuth = (callback: (user: any | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// --- FIRESTORE SERVICES (Nova Scribe Logic) ---

/**
 * Helper para sincronizar una subcolección de manera segura y paralela.
 * Evita usar 'batch' único para prevenir que una imagen pesada bloquee el guardado del texto.
 */
const syncSubcollectionSafe = async (
  db: any, 
  parentPath: string, 
  subcollectionName: string, 
  items: {id: string}[]
) => {
    const colPath = `${parentPath}/${subcollectionName}`;
    const colRef = collection(db, colPath);
    
    // 1. Obtener lo que hay en la nube para saber qué borrar
    const snapshot = await getDocs(colRef);
    const newIdsLocal = new Set(items.map(i => i.id));
    
    const promises: Promise<any>[] = [];

    // 2. Borrar lo que ya no existe localmente
    snapshot.docs.forEach((docSnapshot: any) => {
        if (!newIdsLocal.has(docSnapshot.id)) {
            // console.log(`Borrando ${subcollectionName}/${docSnapshot.id}`);
            promises.push(deleteDoc(docSnapshot.ref));
        }
    });

    // 3. Guardar/Actualizar cada item individualmente
    // Esto aísla los errores. Si una imagen falla por tamaño, el resto se guarda.
    items.forEach(item => {
        const docRef = doc(db, colPath, item.id);
        // Usamos merge: true para asegurar que las actualizaciones de campos (texto) se apliquen correctamente
        const savePromise = setDoc(docRef, item, { merge: true })
            .catch((err: any) => {
                console.error(`❌ Error guardando documento individual en ${subcollectionName} (Posiblemente imagen muy pesada):`, item.id, err);
                // No relanzamos el error para permitir que los otros items se guarden
            });
        promises.push(savePromise);
    });

    await Promise.all(promises);
    // console.log(`✅ Sincronización completada para: ${subcollectionName}`);
};

export const saveProjectFull = async (project: Project) => {
  if (!auth.currentUser) {
      console.error("Error: Intentando guardar sin usuario logueado");
      throw new Error("Usuario no autenticado");
  }

  console.log("💾 Iniciando guardado granular...", project.id);

  try {
      const projectRef = doc(db, "projects", project.id);
      
      // 1. Guardar Metadatos (Ligero)
      const projectMeta = {
        id: project.id,
        title: project.title,
        synopsis: project.synopsis,
        styleSeed: project.styleSeed,
        writingStyle: project.writingStyle || '', // Guardamos el estilo de escritura
        activeManuscriptId: project.activeManuscriptId,
        ownerId: auth.currentUser.uid,
        lastModified: new Date().toISOString()
      };
      
      await setDoc(projectRef, projectMeta, { merge: true });

      const projectPath = `projects/${project.id}`;

      // 2. Guardar subcolecciones en paralelo
      // Usamos la versión Safe para que las imágenes no bloqueen el texto
      await Promise.all([
          syncSubcollectionSafe(db, projectPath, 'characters', project.memoryCore.characters),
          syncSubcollectionSafe(db, projectPath, 'locations', project.memoryCore.locations),
          syncSubcollectionSafe(db, projectPath, 'plotPoints', project.memoryCore.plotPoints),
          syncSubcollectionSafe(db, projectPath, 'manuscripts', project.manuscripts),
          syncSubcollectionSafe(db, projectPath, 'gallery', project.gallery || [])
      ]);

      console.log("✅ Guardado completo finalizado.");
  } catch (error) {
      console.error("❌ ERROR CRÍTICO GLOBAL al guardar:", error);
      throw error;
  }
};

export const loadProjectFull = async (projectId: string): Promise<Project | null> => {
  try {
    console.log("Cargando proyecto completo...", projectId);
    const projectDoc = await getDoc(doc(db, "projects", projectId));
    
    if (!projectDoc.exists()) {
        console.warn("El documento del proyecto no existe");
        return null;
    }
    
    const data = projectDoc.data();
    const projectPath = `projects/${projectId}`;
    
    // Cargar todas las subcolecciones
    const [charsSnap, locsSnap, plotsSnap, manusSnap, gallerySnap] = await Promise.all([
      getDocs(collection(db, `${projectPath}/characters`)),
      getDocs(collection(db, `${projectPath}/locations`)),
      getDocs(collection(db, `${projectPath}/plotPoints`)),
      getDocs(collection(db, `${projectPath}/manuscripts`)),
      getDocs(collection(db, `${projectPath}/gallery`))
    ]);

    const loadedProject = {
      id: data.id,
      title: data.title,
      synopsis: data.synopsis,
      styleSeed: data.styleSeed,
      writingStyle: data.writingStyle || '', // Cargamos el estilo de escritura
      activeManuscriptId: data.activeManuscriptId,
      gallery: gallerySnap.docs.map((d: any) => d.data() as GeneratedImage),
      memoryCore: {
        characters: charsSnap.docs.map((d: any) => d.data() as Character),
        locations: locsSnap.docs.map((d: any) => d.data() as Location),
        plotPoints: plotsSnap.docs.map((d: any) => d.data() as PlotPoint)
      },
      manuscripts: manusSnap.docs.map((d: any) => d.data() as Manuscript)
    } as Project;

    console.log("✅ Proyecto cargado con éxito.");
    return loadedProject;

  } catch (error) {
    console.error("❌ Error cargando proyecto:", error);
    throw error;
  }
};

export const deleteProjectFull = async (projectId: string) => {
  console.log("Eliminando proyecto...", projectId);
  const projectPath = `projects/${projectId}`;
  const subcollections = ['characters', 'locations', 'plotPoints', 'manuscripts', 'gallery'];
  
  for (const sub of subcollections) {
    const snapshot = await getDocs(collection(db, `${projectPath}/${sub}`));
    const batch = writeBatch(db);
    let count = 0;
    snapshot.docs.forEach((doc: any) => {
      batch.delete(doc.ref);
      count++;
    });
    if (count > 0) await batch.commit();
  }
  await deleteDoc(doc(db, "projects", projectId));
  console.log("✅ Proyecto eliminado");
};

export const subscribeToProjectList = (onUpdate: (projects: Project[]) => void) => {
  if (!auth.currentUser) return () => {};

  const q = query(
      collection(db, "projects"), 
      where("ownerId", "==", auth.currentUser.uid)
  );
  
  return onSnapshot(q, (snapshot: any) => {
    const projectsMeta = snapshot.docs.map((doc: any) => {
        const data = doc.data();
        return {
            id: doc.id,
            title: data.title,
            synopsis: data.synopsis,
            styleSeed: data.styleSeed,
            writingStyle: data.writingStyle || '', // Incluir en la lista rápida
            activeManuscriptId: data.activeManuscriptId,
            gallery: [], 
            memoryCore: { characters: [], locations: [], plotPoints: [] },
            manuscripts: [],
            lastModified: data.lastModified
        } as Project;
    });
    projectsMeta.sort((a: any, b: any) => {
        const dateA = a.lastModified ? new Date(a.lastModified).getTime() : 0;
        const dateB = b.lastModified ? new Date(b.lastModified).getTime() : 0;
        return dateB - dateA;
    });

    onUpdate(projectsMeta);
  }, (error: any) => {
      console.error("Error en suscripción de proyectos:", error);
  });
};
