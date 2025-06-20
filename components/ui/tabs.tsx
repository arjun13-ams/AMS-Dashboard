import { ReactNode, useState } from "react";

type TabsProps = {
  defaultValue: string;
  children: ReactNode;
  className?: string; // ✅ Add this
};

type TabsTriggerProps = {
  value: string;
  children: ReactNode;
  onClick: () => void;
  isActive: boolean;
};

type TabsContentProps = {
  value: string;
  activeTab: string;
  children: ReactNode;
};

export function Tabs({ defaultValue, children, className = "" }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultValue);

  const childrenArray = Array.isArray(children) ? children : [children];

  return (
    <div className={className}>
      {childrenArray.map((child: any, i: number) => {
        if (child.type === TabsList) {
          return (
            <TabsList key={i}>
              {child.props.children.map((trigger: any, j: number) => (
                <TabsTrigger
                  key={j}
                  value={trigger.props.value}
                  onClick={() => setActiveTab(trigger.props.value)}
                  isActive={activeTab === trigger.props.value}
                >
                  {trigger.props.children}
                </TabsTrigger>
              ))}
            </TabsList>
          );
        }

        if (child.type === TabsContent) {
          return (
            <TabsContent
              key={i}
              value={child.props.value}
              activeTab={activeTab}
            >
              {child.props.children}
            </TabsContent>
          );
        }

        return null;
      })}
    </div>
  );
}

export function TabsList({ children }: { children: ReactNode }) {
  return <div className="flex gap-2 mb-4">{children}</div>;
}

export function TabsTrigger({
  value,
  onClick,
  isActive,
  children,
}: TabsTriggerProps) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded font-medium transition-colors ${
        isActive ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-300"
      }`}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  activeTab,
  children,
}: TabsContentProps) {
  if (value !== activeTab) return null;
  return <div className="mt-4">{children}</div>;
}
