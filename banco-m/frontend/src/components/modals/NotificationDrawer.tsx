import React from 'react';
import { useBanking } from '../../context/BankingContext';

export const NotificationDrawer: React.FC = () => {
  const { isNotificationsOpen, setIsNotificationsOpen } = useBanking();

  if (!isNotificationsOpen) return null;

  const notifications = [
    {
      id: 1,
      title: 'Acreditación de sueldo exitosa',
      message: 'Se acreditaron $950.000,00 correspondientes a Tech Corp SA.',
      time: 'Hace 2 horas',
      icon: 'savings',
      read: false,
    },
    {
      id: 2,
      title: 'Alerta de Seguridad Sandbox',
      message: 'Nuevo inicio de sesión detectado en dispositivo simulado Web.',
      time: 'Ayer, 18:30 hs',
      icon: 'security',
      read: true,
    },
    {
      id: 3,
      title: 'Comprobante de servicios disponible',
      message: 'El pago de Telecom Personal fue procesado correctamente.',
      time: '14 de Octubre',
      icon: 'receipt',
      read: true,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-end p-4 bg-background/80 backdrop-blur-md animate-in fade-in"
      onClick={() => setIsNotificationsOpen(false)}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-surface-container-high p-5 shadow-2xl flex flex-col gap-4 border border-surface-bright/40 mt-14 mr-1 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[22px]">
              notifications
            </span>
            <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Notificaciones
            </span>
          </div>
          <button
            aria-label="Cerrar notificaciones"
            className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
            onClick={() => setIsNotificationsOpen(false)}
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="flex flex-col gap-2.5">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`p-3 rounded-xl flex items-start gap-3 transition-colors ${
                n.read ? 'bg-surface-container' : 'bg-surface-container-highest ring-1 ring-primary/40'
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center text-primary shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-[18px]">{n.icon}</span>
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-label-md text-label-md font-semibold text-on-surface truncate">
                    {n.title}
                  </span>
                  {!n.read && (
                    <span className="w-2 h-2 rounded-full bg-primary shrink-0 ml-1"></span>
                  )}
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5 leading-snug">
                  {n.message}
                </p>
                <span className="font-label-sm text-label-sm text-outline mt-1">{n.time}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
