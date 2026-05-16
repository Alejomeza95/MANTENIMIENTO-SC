import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { MessageSquare, Send, X, Bot, Sparkles, Loader2, BrainCircuit, Trash2, Maximize2, Minimize2, Lightbulb } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { cn } from '../lib/utils';
import { Asset, WorkOrder } from '../types';

interface Message {
  role: 'user' | 'model';
  text: string;
}

interface SmartAssistantProps {
  assets: Asset[];
  orders: WorkOrder[];
}

const SUGGESTIONS = [
  "¿Resumen de tareas hoy?",
  "¿Qué equipos tienen más fallos?",
  "Calcula costo de 5 horas técnicas",
  "Lista activos con órdenes vencidas"
];

export default function SmartAssistant({ assets, orders }: SmartAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem('cmms-chat-history');
      const parsed = saved ? JSON.parse(saved) : null;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch (e) {
      console.error('Error loading chat history:', e);
    }
    return [
      { role: 'model', text: '¡Hola! Soy tu asistente inteligente de CMMS. Puedo informarte sobre tareas pendientes, costos por equipo o cualquier detalle del sistema. ¿En qué puedo ayudarte hoy?' }
    ];
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('cmms-chat-history', JSON.stringify(messages));
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleSend = async (textOverride?: string) => {
    const messageText = textOverride || input.trim();
    if (!messageText || isLoading) return;

    const userMessage = messageText;
    if (!textOverride) setInput('');
    
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      const apiKey = (process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY || '');
      if (!apiKey) {
        throw new Error("Gemini API Key missing");
      }
      
      const genAI = new GoogleGenerativeAI(apiKey);
      
      const systemContext = `
        Eres un asistente experto en el Sistema de Gestión de Mantenimiento (CMMS) de esta empresa.
        DATOS ACTUALES DEL SISTEMA:
        - Total de Activos: ${assets.length}
        - Órdenes de Trabajo Totales: ${orders.length}
        - Órdenes Pendientes/En Progreso: ${orders.filter(o => o.status !== 'COMPLETADA').length}
        - Órdenes Completadas: ${orders.filter(o => o.status === 'COMPLETADA').length}
        
        DETALLE DE ACTIVOS Y PENDIENTES:
        ${assets.map(a => {
          const pending = orders.filter(o => o.assetId === a.id && o.status !== 'COMPLETADA');
          return `- ${a.name} (S/N: ${a.serialNumber}): ${pending.length} tareas pendientes.`;
        }).join('\n')}

        REGLAS DE NEGOCIO:
        1. Valor hora técnica: 13,000 COP.
        2. Siempre responde en Español.
        3. Usa Markdown para organizar la información (negritas, listas, tablas si es necesario).
        4. Sé conciso pero amable.
        5. Si no tienes datos sobre algo específico, admítelo en lugar de inventar.
        6. Si te piden un resumen, agrupa por prioridad o ubicación.
      `;

      const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        systemInstruction: systemContext
      });

      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      const chat = model.startChat({
        history: history,
      });

      const result = await chat.sendMessage(userMessage);
      const aiText = result.response.text() || "Lo siento, tuve un problema procesando tu consulta.";
      setMessages(prev => [...prev, { role: 'model', text: aiText }]);
    } catch (error) {
      console.error('Chat Error:', error);
      setMessages(prev => [...prev, { role: 'model', text: "Error de conexión con el asistente AI. Por favor verifica tu configuración de API key o intenta más tarde." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    const initial = [{ role: 'model', text: 'Chat reiniciado. ¿En qué puedo ayudarte ahora?' }];
    setMessages(initial as any);
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 md:bottom-8 md:right-8 w-14 h-14 md:w-16 md:h-16 bg-blue-600 text-white rounded-2xl shadow-2xl flex items-center justify-center hover:bg-blue-700 transition-all z-50 group hover:scale-110 active:scale-95"
      >
        <div className="absolute inset-0 bg-blue-400 rounded-2xl animate-ping opacity-20 group-hover:block hidden" />
        <BrainCircuit size={28} className="relative z-10" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ 
              opacity: 1, 
              y: 0, 
              scale: 1,
              width: isMaximized ? '100vw' : '450px',
              height: isMaximized ? '100vh' : '700px',
              maxWidth: isMaximized ? 'none' : '92vw',
              maxHeight: isMaximized ? 'none' : '85vh',
              right: isMaximized ? 0 : '2rem',
              bottom: isMaximized ? 0 : '2rem',
              borderRadius: isMaximized ? 0 : '1.5rem'
            }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className="fixed bg-white shadow-[0_20px_50px_rgba(0,0,0,0.2)] z-[60] border border-slate-200 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 md:p-6 bg-slate-950 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <Bot size={22} className="text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm tracking-tight">CMMS Assistant Pro</h3>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">IA Optimizada</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setIsMaximized(!isMaximized)}
                  className="p-2 hover:bg-white/10 rounded-lg text-slate-400 transition-colors hidden md:block"
                  title="Expandir"
                >
                  {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </button>
                <button 
                  onClick={clearChat}
                  className="p-2 hover:bg-rose-500/20 rounded-lg text-slate-400 hover:text-rose-400 transition-colors"
                  title="Limpiar chat"
                >
                  <Trash2 size={18} />
                </button>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-lg text-slate-400 transition-colors"
                >
                  <X size={22} />
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-slate-50/80 custom-scrollbar"
            >
              {messages.map((m, i) => (
                <div 
                  key={i}
                  className={cn(
                    "flex flex-col gap-2",
                    m.role === 'user' ? "items-end" : "items-start"
                  )}
                >
                  <div className={cn(
                    "p-4 rounded-2xl max-w-[90%] md:max-w-[85%] text-sm leading-relaxed shadow-sm",
                    m.role === 'user' 
                      ? "bg-blue-600 text-white rounded-tr-none font-medium" 
                      : "bg-white text-slate-700 border border-slate-200 rounded-tl-none markdown-body"
                  )}>
                    {m.role === 'model' ? (
                      <div className="prose prose-sm prose-slate max-w-none">
                        <ReactMarkdown>
                          {m.text}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      m.text
                    )}
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex flex-col gap-3 items-start animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex items-center gap-3 bg-white px-4 py-3 rounded-2xl rounded-tl-none border border-slate-100 shadow-sm">
                    <Loader2 className="animate-spin text-blue-600" size={16} />
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                      Analizando datos del CMMS...
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Suggestions & Input */}
            <div className="p-4 bg-white border-t border-slate-100 space-y-4 shrink-0">
              {messages.length < 5 && !isLoading && (
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none no-scrollbar">
                  {SUGGESTIONS.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(s)}
                      className="px-4 py-2 bg-slate-50 text-slate-600 border border-slate-200 rounded-full text-[10px] font-bold whitespace-nowrap hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-all flex items-center gap-2"
                    >
                      <Lightbulb size={12} className="text-amber-500" />
                      {s}
                    </button>
                  ))}
                </div>
              )}

              <div className="relative group">
                <input 
                  ref={inputRef}
                  type="text"
                  placeholder="Explícame las tareas de hoy..."
                  className="w-full pl-4 pr-14 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm outline-none focus:border-blue-600 focus:bg-white transition-all font-medium placeholder:text-slate-400 shadow-inner"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                />
                <button 
                  onClick={() => handleSend()}
                  disabled={isLoading || !input.trim()}
                  className={cn(
                    "absolute right-2 top-2 h-10 w-10 md:h-12 md:w-12 rounded-xl flex items-center justify-center transition-all",
                    input.trim() 
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30 hover:scale-105 active:scale-95" 
                      : "bg-slate-200 text-slate-400"
                  )}
                >
                  <Send size={18} />
                </button>
              </div>
              <p className="text-[9px] text-slate-400 text-center font-medium uppercase tracking-tighter">
                IA de apoyo técnico alimentada por datos reales del sistema
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

