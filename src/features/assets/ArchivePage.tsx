import React, { useState, useMemo } from 'react';
import { 
  Package, 
  RotateCcw,
  Eye,
  FileDown,
  Archive as ArchiveIcon,
  Search,
  X,
  Wrench,
  Loader2
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Asset } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { useFirestoreCollection, updateFirestoreDoc } from '../../lib/firestoreHooks';

export default function ArchivePage() {
  const { data: allAssets, loading } = useFirestoreCollection<Asset>('assets');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  const assets = useMemo(() => 
    allAssets.filter(a => (a.status || 'ACTIVE') === 'ARCHIVED'), 
  [allAssets]);

  const reactivateAsset = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('¿Desea reactivar este equipo y devolverlo a la lista de activos en operación?')) {
      try {
        await updateFirestoreDoc('assets', id, { status: 'ACTIVE' });
        if (selectedAsset?.id === id) setSelectedAsset(null);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const filteredAssets = assets.filter(asset => 
    asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.serialNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
        <p className="text-slate-500 font-medium mt-4">Sincronizando archivo...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 text-left">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Archivo de Equipos</h1>
          <p className="text-slate-500 mt-1">Consulta de activos que han sido dados de baja del sistema.</p>
        </div>
        
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por nombre o S/N..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 outline-none transition-all text-sm font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-rose-50 border border-rose-100 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-rose-500/10 rounded-xl">
            <ArchiveIcon className="text-rose-600" size={24} />
          </div>
          <div>
            <h3 className="font-bold text-rose-900">Activos Históricos</h3>
            <p className="text-rose-700 text-sm mt-1">
              Los equipos en esta lista no aparecen en la programación de mantenimiento activa. 
              Puede reactivarlos en cualquier momento si vuelven a estar operativos.
            </p>
          </div>
        </div>
        <div className="bg-white/50 px-4 py-2 rounded-xl border border-rose-200">
          <span className="text-xs font-bold text-rose-600 uppercase tracking-widest">{assets.length} Equipos Archivados</span>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold text-[10px] uppercase tracking-widest text-center">
              <tr>
                <th className="px-6 py-4">Equipo Detalle</th>
                <th className="px-6 py-4">S/N</th>
                <th className="px-6 py-4">Estado Anterior</th>
                <th className="px-6 py-4">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">
                    {assets.length === 0 ? 'No hay equipos en el archivo.' : 'No se encontraron resultados para la búsqueda.'}
                  </td>
                </tr>
              ) : (
                filteredAssets.map((asset) => (
                  <tr 
                    key={asset.id} 
                    onClick={() => setSelectedAsset(asset)}
                    className="hover:bg-slate-50/50 transition-colors cursor-pointer group"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden opacity-60 group-hover:opacity-100 transition-opacity">
                          {asset.imageUrl ? (
                            <img src={asset.imageUrl} className="w-full h-full object-cover grayscale" />
                          ) : <Package size={18} className="text-slate-300" />}
                        </div>
                        <div>
                          <p className="text-slate-500 font-bold group-hover:text-slate-900 transition-colors">{asset.name}</p>
                          <p className="text-[10px] text-slate-400">{asset.type} • {asset.year}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-400 text-center">{asset.serialNumber}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter bg-rose-50 text-rose-600">
                        DADO DE BAJA
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button 
                          className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                          title="Ver Detalle"
                        >
                          <Eye size={18} />
                        </button>
                        <button 
                          onClick={(e) => reactivateAsset(asset.id, e)}
                          className="p-2 text-slate-400 hover:text-emerald-600 transition-colors"
                          title="Reactivar Equipo"
                        >
                          <RotateCcw size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal (Reusing logic from AssetsPage essentially) */}
      <AnimatePresence>
        {selectedAsset && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedAsset(null)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-3">
                  <ArchiveIcon className="text-rose-600" size={20} />
                  <h3 className="font-bold text-slate-900 uppercase tracking-tight">Consulta de Equipo Archivado</h3>
                </div>
                <button onClick={() => setSelectedAsset(null)} className="p-1 hover:bg-slate-200 rounded-lg transition-colors text-slate-400">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="aspect-square bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden flex items-center justify-center relative grayscale">
                    {selectedAsset.imageUrl ? (
                      <img src={selectedAsset.imageUrl} className="w-full h-full object-cover" />
                    ) : <Package size={48} className="text-slate-300" />}
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h4 className="text-2xl font-black text-slate-900 tracking-tight">{selectedAsset.name}</h4>
                      <p className="text-sm font-medium text-slate-500 mt-1">{selectedAsset.description}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">S/N</p>
                        <p className="text-sm font-mono font-bold text-slate-700">{selectedAsset.serialNumber}</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Año</p>
                        <p className="text-sm font-bold text-slate-700">{selectedAsset.year}</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h5 className="text-xs font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <Wrench size={14} className="text-rose-600" />
                        Historial de Mantenimiento
                      </h5>
                      <div className="space-y-2">
                        {selectedAsset.activities.map((act) => (
                          <div key={act.id} className="p-2.5 bg-rose-50/30 rounded-lg border border-rose-100/50">
                            <p className="text-xs font-bold text-slate-700">{act.description}</p>
                            <p className="text-[10px] text-rose-600 font-bold mt-1 uppercase">Cada {act.frequencyWeeks} semanas</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3">
                <button 
                  onClick={(e) => reactivateAsset(selectedAsset.id, e as any)}
                  className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-500/20"
                >
                  <RotateCcw size={18} />
                  REACTIVAR EQUIPO
                </button>
                <button 
                  onClick={() => {
                    if (selectedAsset.manualUrl) {
                      const link = document.createElement('a');
                      link.href = selectedAsset.manualUrl;
                      link.download = `Manual_${selectedAsset.name.replace(/\s+/g, '_')}.pdf`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    } else {
                      alert('Este equipo no tiene un manual técnico adjunto.');
                    }
                  }}
                  className={cn(
                    "px-6 py-3 border font-bold rounded-xl flex items-center justify-center gap-2 transition-colors",
                    selectedAsset.manualUrl 
                      ? "bg-rose-600 text-white border-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-500/20" 
                      : "bg-white border-slate-200 text-slate-400 cursor-not-allowed"
                  )}
                >
                  <FileDown size={18} />
                  DESCARGAR MANUAL
                </button>
                <button 
                  onClick={() => alert('Descargando historial técnico...')}
                  className="px-6 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors"
                >
                  <FileDown size={18} />
                  HISTORIAL
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
