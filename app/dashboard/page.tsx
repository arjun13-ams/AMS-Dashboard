'use client';
import { useState } from 'react';
import Sidebar from '../../components/Sidebar';
import ChartView from '../../components/ChartView';
import MomentumTabs from '../../components/MomentumTabs';
import RebalanceView from '../../components/RebalanceView';
import PortfolioView from '../../components/PortfolioView';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState('chart');

  const renderTab = () => {
    switch (activeTab) {
      case 'chart':
        return <ChartView />;
      case 'momentum':
        return <MomentumTabs />;
      case 'rebalance':
        return <RebalanceView />;
      case 'portfolio':
        return <PortfolioView />;
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-900 text-white">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="flex-1 p-4">{renderTab()}</main>
    </div>
  );
}
