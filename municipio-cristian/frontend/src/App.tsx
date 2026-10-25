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

  const moduleBackground: Record<ActiveTabId, string> = {
    padron: 'bg-blue-50/70',
    cuentas: 'bg-emerald-50/70',
    comprobantes: 'bg-violet-50/70',
    inspector: 'bg-slate-100',
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
      <div className="bg-slate-50 border-b border-slate-200">
        <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-3 px-4 py-3 text-xs text-slate-600 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex min-h-8 items-center rounded-full border border-blue-200 bg-blue-50 px-3 font-semibold text-blue-900">
              Entorno de demostración
            </span>
            <span className="text-slate-500">Moneda <strong className="font-semibold text-slate-800">Pesos argentinos (ARS)</strong></span>
            <span className="hidden text-slate-300 sm:inline" aria-hidden="true">/</span>
            <span className="text-slate-500">Períodos <strong className="font-semibold text-slate-800">jul–sep 2026</strong></span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-500">Casos de ejemplo</span>
            <button
              type="button"
              onClick={() => handleIrACuentaCorriente('30712345678')}
              className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 font-medium text-emerald-900 transition-colors hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 cursor-pointer"
            >
              <span className="font-mono tabular-nums">30712345678</span><span>Al día</span>
            </button>
            <button
              type="button"
              onClick={() => handleIrACuentaCorriente('30789012345')}
              className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 font-medium text-amber-900 transition-colors hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 cursor-pointer"
            >
              <span className="font-mono tabular-nums">30789012345</span><span>Con deuda</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Viewport */}
      <main className={`mx-auto w-full max-w-[1680px] flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-8 ${moduleBackground[activeTab]}`}>
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
