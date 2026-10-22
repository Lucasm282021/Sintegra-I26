/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ActiveTabId, HeaderGlobal } from './components/HeaderGlobal';
import { TabPadronComercios } from './components/TabPadronComercios';
import { TabCuentasCorrientes } from './components/TabCuentasCorrientes';
import { TabComprobantesCertificados } from './components/TabComprobantesCertificados';
import { DockedTrafficInspector, TabInspectorApi } from './components/TabInspectorApi';
import {
  ComercioConResumen,
  getHealth,
  listarComercios,
  listarComprobantes,
  resetSeedData,
  subscribeTrafficLogs,
} from './services/municipioService';
import { ApiTrafficLog, ComprobantePago } from './types/municipio';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTabId>('padron');
  const [apiOnline, setApiOnline] = useState<boolean>(true);
  const [lastHealthLatency, setLastHealthLatency] = useState<number | null>(null);
  const [comercios, setComercios] = useState<ComercioConResumen[]>([]);
  const [comprobantes, setComprobantes] = useState<ComprobantePago[]>([]);
  const [selectedCuit, setSelectedCuit] = useState<string>('30789012345');
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);
  const [trafficLogs, setTrafficLogs] = useState<ApiTrafficLog[]>([]);
  const [dockOpen, setDockOpen] = useState<boolean>(false);
  const [showIntro, setShowIntro] = useState(true);
  
  useEffect(() => {
    const unsubscribe = subscribeTrafficLogs((logs) => {
      setTrafficLogs(logs);
    });
    return unsubscribe;
  }, []);

  const cargarEstadoInicial = useCallback(async () => {
    setLoadingInitial(true);
    try {
      const [healthRes, comerciosRes, comprobantesRes] = await Promise.all([
        getHealth(),
        listarComercios(),
        listarComprobantes(),
      ]);

      setApiOnline(healthRes.ok && healthRes.data?.status === 'ok');
      setLastHealthLatency(healthRes.latencyMs);

      if (comerciosRes.ok && comerciosRes.data) {
        setComercios(comerciosRes.data);
      }
      if (comprobantesRes.ok && comprobantesRes.data) {
        setComprobantes(comprobantesRes.data);
      }
    } finally {
      setLoadingInitial(false);
    }
  }, []);

  useEffect(() => {
    cargarEstadoInicial();
  }, [cargarEstadoInicial]);

  const handlePingHealth = async () => {
    const res = await getHealth();
    setApiOnline(res.ok && res.data?.status === 'ok');
    setLastHealthLatency(res.latencyMs);
  };

  const handleRefreshPadronYComprobantes = async () => {
    const [comerciosRes, comprobantesRes] = await Promise.all([
      listarComercios(),
      listarComprobantes(),
    ]);
    if (comerciosRes.ok && comerciosRes.data) {
      setComercios(comerciosRes.data);
    }
    if (comprobantesRes.ok && comprobantesRes.data) {
      setComprobantes(comprobantesRes.data);
    }
  };

  const handleComercioCreado = async (cuitCreado: string) => {
    setSelectedCuit(cuitCreado);
    await handleRefreshPadronYComprobantes();
  };

  const handleIrACuentaCorriente = (cuit: string) => {
    setSelectedCuit(cuit);
    setActiveTab('cuentas');
  };

  const handleIrACertificados = (cuit: string) => {
    setSelectedCuit(cuit);
    setActiveTab('comprobantes');
  };

  const handlePagoExitoso = async (comprobante: ComprobantePago) => {
    setSelectedCuit(comprobante.cuit);
    await handleRefreshPadronYComprobantes();
  };

  const handleResetSeed = async () => {
    resetSeedData();
    setSelectedCuit('30789012345');
    await cargarEstadoInicial();
  };

    if (showIntro) {
  return (
    <div className="fixed inset-0 bg-[#070b14] flex flex-col items-center justify-center z-50">
      <video 
        src="/intro-muni-i26.mp4" 
        autoPlay 
        muted 
        playsInline
        onEnded={() => setShowIntro(false)}
        className="w-full max-w-4xl shadow-[0_0_50px_rgba(255,100,0,0.2)]"
      />
      <button 
        onClick={() => setShowIntro(false)} 
        className="mt-6 text-slate-500 hover:text-white text-sm underline cursor-pointer"
      >
        Omitir intro
      </button>
    </div>
  );
}

  return (
    <div id="top" className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Header Global */}
      <HeaderGlobal
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        apiOnline={apiOnline}
        lastHealthLatency={lastHealthLatency}
        trafficCount={trafficLogs.length}
        onPingHealth={handlePingHealth}
      />

      {/* Context Subheader */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-900">
              Módulo MUNICIPIO (Puerto Local 3005)
            </span>
            <span aria-hidden="true">·</span>
            <span>Moneda: Pesos Argentinos (ARS)</span>
            <span aria-hidden="true">·</span>
            <span>Períodos Activos: 2026-07, 2026-08, 2026-09</span>
          </div>

          <div className="flex items-center gap-2 font-mono text-slate-500">
            <span>Seed Data:</span>
            <button
              type="button"
              onClick={() => handleIrACuentaCorriente('30712345678')}
              className="text-emerald-700 hover:underline font-medium cursor-pointer"
            >
              30712345678 (Sin Deuda)
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => handleIrACuentaCorriente('30789012345')}
              className="text-amber-700 hover:underline font-medium cursor-pointer"
            >
              30789012345 (Con Deuda)
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {activeTab === 'padron' && (
          <TabPadronComercios
            comercios={comercios}
            isLoading={loadingInitial}
            onComercioCreado={handleComercioCreado}
            onIrACuentaCorriente={handleIrACuentaCorriente}
            onIrACertificados={handleIrACertificados}
          />
        )}

        {activeTab === 'cuentas' && (
          <TabCuentasCorrientes
            selectedCuit={selectedCuit}
            comerciosPadron={comercios}
            onSelectCuit={setSelectedCuit}
            onPagoExitoso={handlePagoExitoso}
            onIrAComprobantes={handleIrACertificados}
          />
        )}

        {activeTab === 'comprobantes' && (
          <TabComprobantesCertificados
            selectedCuit={selectedCuit}
            comerciosPadron={comercios}
            comprobantes={comprobantes}
            onSelectCuit={setSelectedCuit}
            onIrACuentaCorriente={handleIrACuentaCorriente}
            onRefreshComprobantes={handleRefreshPadronYComprobantes}
          />
        )}

        {activeTab === 'inspector' && (
          <TabInspectorApi
            logs={trafficLogs}
            onResetSeed={handleResetSeed}
            isFullTab={true}
          />
        )}
      </main>

      {/* Docked API Traffic Inspector (visible on Tabs 1-3 so user can inspect JSON in real time) */}
      {activeTab !== 'inspector' && (
        <DockedTrafficInspector
          logs={trafficLogs}
          isOpen={dockOpen}
          onToggle={() => setDockOpen((prev) => !prev)}
          onOpenFullTab={() => setActiveTab('inspector')}
        />
      )}
    </div>
  );
}
