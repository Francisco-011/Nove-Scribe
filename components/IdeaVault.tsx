
import React, { useState, useEffect, useRef } from 'react';
import { 
  VaultIcon, 
  MicrophoneIcon, 
  StopIcon, 
  PlusIcon, 
  XIcon, 
  TrashIcon, 
  CloudIcon, 
  CloudOffIcon, 
  CheckIcon,
  ListIcon
} from './Icons';
import { saveIdea, subscribeToIdeas, deleteIdea, Idea } from '../services/firebase';

interface IdeaVaultProps {
  user: any;
}

// Helper para el reconocimiento de voz
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export const IdeaVault: React.FC<IdeaVaultProps> = ({ user }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Monitor de conexión
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Suscripción a Ideas (Realtime + Offline Persistence)
  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToIdeas((newIdeas) => {
        setIdeas(newIdeas);
    });
    return () => unsubscribe();
  }, [user]);

  // Configuración de Voz
  useEffect(() => {
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'es-ES';

      rec.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
            setInputText(prev => prev ? `${prev} ${finalTranscript}` : finalTranscript);
        }
      };
      
      rec.onerror = (event: any) => {
          console.error("Error de reconocimiento de voz:", event.error);
          setIsRecording(false);
      };
      
      rec.onend = () => {
          // Si se detiene "solo", actualizar estado visual
          // Pero si isRecording es true, podría haber sido un silencio, intentar reiniciar si se desea
      };

      setRecognition(rec);
    }
  }, []);

  const toggleRecording = () => {
      if (!recognition) {
          alert("Tu navegador no soporta reconocimiento de voz nativo. Intenta usar Chrome.");
          return;
      }
      
      if (isRecording) {
          recognition.stop();
          setIsRecording(false);
      } else {
          recognition.start();
          setIsRecording(true);
      }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    // Si estaba grabando, parar
    if (isRecording && recognition) {
        recognition.stop();
        setIsRecording(false);
    }

    try {
        await saveIdea(inputText.trim());
        setInputText('');
        // Scroll al tope de la lista
        if (messagesEndRef.current) {
             messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    } catch (error) {
        console.error("Error al guardar idea:", error);
        alert("No se pudo guardar la idea.");
    }
  };

  const handleDelete = async (id: string) => {
      if (confirm("¿Eliminar esta idea?")) {
          await deleteIdea(id);
      }
  };
  
  const formatDate = (timestamp: any) => {
      if (!timestamp) return 'Pendiente de sincronización...';
      return new Date(timestamp.seconds * 1000).toLocaleString();
  };

  // --- RENDER ---

  if (!user) return null;

  return (
    <>
        {/* Floating Action Button (FAB) */}
        <button 
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 p-4 bg-amber-500 hover:bg-amber-400 text-white rounded-full shadow-2xl shadow-amber-500/20 transition-transform transform hover:scale-110 flex items-center justify-center border-2 border-amber-600/50"
            title="Bóveda de Ideas"
        >
            <VaultIcon className="h-7 w-7" />
        </button>

        {/* Panel Lateral / Modal */}
        {isOpen && (
            <div className="fixed inset-0 z-[60] flex justify-end">
                {/* Backdrop */}
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsOpen(false)}></div>

                {/* Drawer Content */}
                <div className="relative w-full max-w-md bg-slate-900 border-l border-brand-secondary shadow-2xl flex flex-col h-full animate-slide-in-right">
                    
                    {/* Header */}
                    <div className="p-4 border-b border-brand-secondary flex justify-between items-center bg-slate-800/50">
                        <div className="flex items-center space-x-2">
                            <VaultIcon className="h-5 w-5 text-amber-500" />
                            <h2 className="font-bold text-lg text-brand-text-primary">Bóveda de Ideas</h2>
                        </div>
                        <div className="flex items-center space-x-3">
                            <div className="flex items-center space-x-1 text-xs text-brand-text-secondary bg-slate-800 px-2 py-1 rounded-full">
                                {isOnline ? <CloudIcon className="h-3 w-3 text-green-500"/> : <CloudOffIcon className="h-3 w-3 text-red-500"/>}
                                <span>{isOnline ? 'Online' : 'Offline'}</span>
                            </div>
                            <button onClick={() => setIsOpen(false)} className="text-brand-text-secondary hover:text-white">
                                <XIcon className="h-6 w-6" />
                            </button>
                        </div>
                    </div>

                    {/* Input Area */}
                    <div className="p-4 bg-slate-800/30 border-b border-brand-secondary">
                        <form onSubmit={handleSubmit} className="relative">
                            <textarea 
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                placeholder="¿Qué se te ocurrió? Escribe o graba..."
                                className="w-full bg-brand-secondary rounded-lg p-3 pr-12 min-h-[100px] text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:outline-none resize-none"
                            />
                            {/* Botones de Acción dentro del área de texto */}
                            <div className="absolute bottom-2 right-2 flex space-x-2">
                                <button 
                                    type="button"
                                    onClick={toggleRecording}
                                    className={`p-2 rounded-full transition-colors ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                                    title={isRecording ? "Detener grabación" : "Grabar voz"}
                                >
                                    {isRecording ? <StopIcon className="h-5 w-5"/> : <MicrophoneIcon className="h-5 w-5"/>}
                                </button>
                                <button 
                                    type="submit"
                                    disabled={!inputText.trim()}
                                    className="p-2 bg-amber-600 text-white rounded-full hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    title="Guardar idea"
                                >
                                    <CheckIcon className="h-5 w-5"/>
                                </button>
                            </div>
                        </form>
                        <p className="text-[10px] text-brand-text-secondary mt-2 text-center">
                            {isOnline ? 'Las ideas se guardan en la nube.' : 'Modo Offline activo. Las ideas se guardarán localmente y subirán al conectar.'}
                        </p>
                    </div>

                    {/* List Area */}
                    <div className="flex-grow overflow-y-auto p-4 space-y-4">
                        <div ref={messagesEndRef} />
                        {ideas.length === 0 ? (
                            <div className="text-center py-10 text-brand-text-secondary opacity-50 flex flex-col items-center">
                                <ListIcon className="h-12 w-12 mb-3"/>
                                <p>Tu bóveda está vacía.</p>
                                <p className="text-xs">Captura pensamientos antes de que vuelen.</p>
                            </div>
                        ) : (
                            ideas.map((idea) => (
                                <div key={idea.id} className="bg-brand-secondary p-4 rounded-lg border border-slate-700 hover:border-brand-accent transition-colors group relative">
                                    <p className="text-sm text-brand-text-primary whitespace-pre-wrap mb-4">{idea.content}</p>
                                    <div className="flex justify-between items-center pt-2 border-t border-slate-700/50">
                                        <span className="text-[10px] text-brand-text-secondary">{formatDate(idea.createdAt)}</span>
                                        <button 
                                            onClick={() => handleDelete(idea.id)}
                                            className="text-slate-500 hover:text-red-400 p-1 rounded hover:bg-slate-800 opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="Eliminar"
                                        >
                                            <TrashIcon className="h-4 w-4"/>
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                </div>
            </div>
        )}
    </>
  );
};
