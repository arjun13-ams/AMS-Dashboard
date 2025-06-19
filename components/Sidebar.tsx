type Props = {
  activeTab: string;
  setActiveTab: (tab: string) => void;
};

export default function Sidebar({ activeTab, setActiveTab }: Props) {
  const tabs = [
    { id: 'chart', label: '📈 Chart View' },
    { id: 'momentum', label: '🚀 Momentum Stocks' },
    { id: 'rebalance', label: '🔁 Rebalance Log' },
    { id: 'portfolio', label: '📊 Portfolio & Journal' },
  ];

  return (
    <div className="w-64 bg-gray-800 p-4">
      <h2 className="text-lg font-bold mb-6">AMS Dashboard</h2>
      <ul className="space-y-2">
        {tabs.map((tab) => (
          <li key={tab.id}>
            <button
              className={\`w-full text-left px-3 py-2 rounded hover:bg-gray-700 \${activeTab === tab.id ? 'bg-gray-700 font-semibold' : ''}\`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}