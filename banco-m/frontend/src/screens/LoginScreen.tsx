import React, { useState } from 'react';
import { useBanking } from '../context/BankingContext';
import { BOREAL_LOGO_URL, INITIAL_USER } from '../data/mockData';

export const LoginScreen: React.FC = () => {
  const { login, registerAccount, isInitializing } = useBanking();
  const [cuit, setCuit] = useState(INITIAL_USER.cuil.replace(/\D/g, ''));
  const [titular, setTitular] = useState(INITIAL_USER.name);
  const [isLoading, setIsLoading] = useState(false);
  const [demoEmail, setDemoEmail] = useState('');
  const [demoPassword, setDemoPassword] = useState('');
  const [demoError, setDemoError] = useState('');
  const [demoAccess, setDemoAccess] = useState(false);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (demoEmail.trim().toLowerCase() !== 'demo.banco.rodrigo.i26@gmail.com' || demoPassword !== 'BancoDemo2026') {
      setDemoError('El correo o la contraseña no coinciden con el usuario demo.'); return;
    }
    setDemoAccess(true);
    setIsLoading(true);
    await login(cuit);
    setIsLoading(false);
  };

  if (!demoAccess) {
    return (
      <main className="min-h-screen grid place-items-center bg-[#f5f6fa] px-4 py-8 text-[#14214f]">
        <section className="w-full max-w-lg rounded-2xl border border-[#e0e5ef] bg-white p-8 shadow-lg sm:p-11">
          <div className="mb-7 text-2xl" aria-hidden="true">♢</div>
          <p className="mb-3 text-sm tracking-wider text-[#89743a]">BIENVENIDO · BANCO M · RODRIGO</p>
          <h1 className="text-3xl font-bold tracking-tight">Ingresá a tu cuenta</h1>
          <p className="mb-8 mt-3 text-[#4b5470]">Accedé a tu billetera y cuentas del entorno académico.</p>
          <form onSubmit={handleLogin} className="grid gap-5">
            <label className="grid gap-2 text-sm font-semibold uppercase">Correo electrónico
              <input type="email" required autoComplete="username" value={demoEmail} onChange={event => setDemoEmail(event.target.value)} placeholder="nombre@correo.com" className="h-13 rounded-lg border border-[#c4cde0] px-4 font-normal normal-case outline-none focus:border-[#3f78b6] focus:ring-2 focus:ring-[#3f78b633]" />
            </label>
            <label className="grid gap-2 text-sm font-semibold uppercase">Contraseña
              <input type="password" required autoComplete="current-password" value={demoPassword} onChange={event => setDemoPassword(event.target.value)} placeholder="Ingresá tu contraseña" className="h-13 rounded-lg border border-[#c4cde0] px-4 font-normal normal-case outline-none focus:border-[#3f78b6] focus:ring-2 focus:ring-[#3f78b633]" />
            </label>
            {demoError && <p role="alert" className="text-sm text-red-700">{demoError}</p>}
            <button type="submit" disabled={isLoading} className="h-13 rounded-lg bg-[#14214f] font-semibold text-white hover:bg-[#1d306b]">{isLoading ? 'Conectando…' : 'Iniciar sesión'}</button>
          </form>
          <aside className="mt-6 grid gap-2 rounded-lg border border-dashed border-[#af9b63] bg-[#faf8f1] p-4 text-sm"><strong>Usuario de prueba (ayuda memoria)</strong><span>Correo: <b>demo.banco.rodrigo.i26@gmail.com</b></span><span>Contraseña: <b>BancoDemo2026</b></span></aside>
          <footer className="mt-6 text-center text-sm text-[#596887]">Entorno académico · Información de ejemplo</footer>
        </section>
      </main>
    );
  }

  const handleRegister = async () => {
    setIsLoading(true);
    await registerAccount(cuit, titular);
    setIsLoading(false);
  };

  return (
    <main className="flex flex-col relative w-full bg-background min-h-screen pt-safe pb-safe items-center justify-center">
      <div className="flex flex-col w-full max-w-md px-margin py-space-xl">
        <div className="w-full pt-space-xs pb-space-sm flex items-center justify-center">
          <div className="w-full flex items-center justify-between gap-space-xs px-3 py-2 bg-surface-container-high rounded-full shadow-sm">
            <div className="flex items-center gap-space-xs min-w-0">
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
              <p className="font-label-sm text-amber-300 truncate">Entorno educativo ficticio · Sin dinero real</p>
            </div>
            <span className="material-symbols-outlined text-amber-400 text-sm">warning</span>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center text-center mt-space-sm mb-space-lg">
          <div className="relative flex items-center justify-center mb-space-sm">
            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full scale-125" />
            <div className="relative w-16 h-16 rounded-xl bg-surface-container-highest shadow-xl flex items-center justify-center p-2">
              <img alt="Boreal Banco" className="w-12 h-12 object-contain" src={BOREAL_LOGO_URL} />
            </div>
          </div>
          <h1 className="font-headline-lg text-headline-lg-mobile text-on-surface tracking-tight font-bold">Boreal Banco</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">Conectate con tu cuenta de banco-m</p>
        </div>

        {isInitializing ? (
          <div className="bg-surface-container rounded-xl p-space-md shadow-xl text-center text-on-surface-variant">
            Recuperando la cuenta guardada…
          </div>
        ) : (
          <div className="bg-surface-container rounded-xl p-space-md shadow-xl flex flex-col gap-space-md relative overflow-hidden border border-surface-container-high/40">
            <form onSubmit={handleLogin} className="flex flex-col gap-space-md relative z-10">
              <div className="flex flex-col gap-1">
                <label className="font-label-md text-label-md text-on-surface" htmlFor="cuitInput">CUIT del titular</label>
                <div className="relative flex items-center bg-surface-container-low rounded-lg shadow-sm border border-outline-variant/30 focus-within:border-primary/50 transition-colors">
                  <span className="material-symbols-outlined text-outline ml-3 absolute pointer-events-none text-xl">badge</span>
                  <input
                    id="cuitInput"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    required
                    maxLength={13}
                    value={cuit}
                    onChange={(event) => setCuit(event.target.value)}
                    placeholder="20384918239"
                    className="w-full bg-transparent py-3 pl-10 pr-3 font-body-md text-body-md text-on-surface placeholder:text-outline-variant focus:outline-none"
                  />
                </div>
                <span className="font-label-sm text-label-sm text-outline">Ingresá los 11 dígitos de la cuenta creada en banco-m.</span>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-label-md text-label-md text-on-surface" htmlFor="holderInput">Nombre para crear una cuenta nueva</label>
                <input
                  id="holderInput"
                  type="text"
                  value={titular}
                  onChange={(event) => setTitular(event.target.value)}
                  placeholder="Nombre y apellido"
                  className="w-full bg-surface-container-low py-3 px-3 rounded-lg font-body-md text-body-md text-on-surface placeholder:text-outline-variant focus:outline-none border border-outline-variant/30 focus:border-primary/50"
                />
              </div>

              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-container-high/60 text-on-surface-variant">
                <span className="material-symbols-outlined text-tertiary text-base">verified_user</span>
                <span className="font-label-sm text-label-sm leading-tight">El backend no autentica usuarios; el CUIT solo identifica la cuenta de prueba.</span>
              </div>

              <button type="submit" disabled={isLoading} className="w-full bg-primary-container hover:bg-primary text-on-primary-container font-label-lg text-label-lg py-3 px-4 rounded-lg shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-60">
                {isLoading ? 'Conectando…' : 'Ingresar a mi cuenta'}
                {!isLoading && <span className="material-symbols-outlined text-xl">arrow_forward</span>}
              </button>
              <button type="button" disabled={isLoading} onClick={handleRegister} className="w-full bg-surface-container-high hover:bg-surface-container-highest text-secondary font-label-lg text-label-lg py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-60">
                {isLoading ? 'Procesando…' : 'Crear cuenta de prueba en banco-m'}
                {!isLoading && <span className="material-symbols-outlined text-xl">person_add</span>}
              </button>
            </form>
          </div>
        )}

        <div className="mt-space-lg flex items-center justify-center gap-space-xs text-center px-space-md">
          <span className="material-symbols-outlined text-outline text-base">database</span>
          <p className="font-body-sm text-body-sm text-outline">Saldos y movimientos se leen y guardan en la API banco-m.</p>
        </div>
      </div>
    </main>
  );
};
