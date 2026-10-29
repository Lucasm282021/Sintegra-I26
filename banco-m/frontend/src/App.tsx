import React from 'react';
import { BankingProvider, useBanking } from './context/BankingContext';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { DesktopNav } from './components/DesktopNav';
import { Toast } from './components/Toast';
import { ReceiptModal } from './components/modals/ReceiptModal';
import { TransferModal } from './components/modals/TransferModal';
import { PayServiceModal } from './components/modals/PayServiceModal';
import { DepositModal } from './components/modals/DepositModal';
import { QrPaymentsModal } from './components/modals/QrPaymentsModal';
import { NotificationDrawer } from './components/modals/NotificationDrawer';
import { LoginScreen } from './screens/LoginScreen';
import { HomeScreen } from './screens/HomeScreen';
import { AccountsScreen } from './screens/AccountsScreen';
import { MovementsScreen } from './screens/MovementsScreen';
import { ProfileScreen } from './screens/ProfileScreen';

const MainAppContent: React.FC = () => {
  const { isAuthenticated, isInitializing, activeTab } = useBanking();

  if (isInitializing) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-on-surface-variant">Conectando con banco-m…</div>;
  }

  if (!isAuthenticated) {
    return (
      <>
        <LoginScreen />
        <Toast />
      </>
    );
  }

  return (
    <div className="bg-background font-body-md text-on-surface min-h-screen flex flex-col selection:bg-primary-container selection:text-on-primary-container relative">
      {/* Fixed Header */}
      <Header />

      <div className="mx-auto flex w-full max-w-[1440px] flex-1 items-start lg:px-6 lg:pt-24">
        <DesktopNav />
        <main className="flex min-h-screen w-full flex-col relative bg-background px-margin pt-24 pb-28 lg:min-h-[calc(100vh-6rem)] lg:px-8 lg:pt-8 lg:pb-12">
          {activeTab === 'inicio' && <HomeScreen />}
          {activeTab === 'cuentas' && <AccountsScreen />}
          {activeTab === 'movimientos' && <MovementsScreen />}
          {activeTab === 'perfil' && <ProfileScreen />}
        </main>
      </div>

      {/* Fixed Bottom Navigation */}
      <BottomNav />

      {/* Overlays & Interactive Modals */}
      <ReceiptModal />
      <TransferModal />
      <PayServiceModal />
      <DepositModal />
      <QrPaymentsModal />
      <NotificationDrawer />
      <Toast />
    </div>
  );
};

export default function App() {
  return (
    <BankingProvider>
      <MainAppContent />
    </BankingProvider>
  );
}
