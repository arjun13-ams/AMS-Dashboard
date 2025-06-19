// components/ui/tabs.tsx
import { useState, ReactNode } from "react";

type TabsProps = {
  defaultValue: string;
  children: ReactNode;
  className?: string;
};

type TabsTriggerProps = {
  value: string;
  children: ReactNode;
};

type TabsContentProps = {
  value: string;
  children: ReactNode;
};

export function Tabs({ defaultValue, children, className }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultValue);

  const triggers: ReactNode[] = [];
  const contents: ReactNode[] = [];

  const childrenArray = Array.isArray(children) ? children : [children];

  childrenArray.forEach((child: any) => {
    if (child.type === TabsList) {
      triggers.push(
        child.props.children.map((trigger: any) =>
          trigger.type === TabsTrigger
            ? {
                ...trigger,
                props: {
                  ...trigger.props,
                  isActive: trigger.props.value === activeTab,
                  onClick: () => setActiveTab(trigger.props.value),
                },
              }
            : trigger
        )
      );
    } else if (child.type === TabsContent && child.props.value === activeTab) {
      contents.push(child);
    }
  });

  return (
    <div className={className}>
      <div className="flex gap-2 mb-4">{triggers.flat()}</div>
      <div>{contents}</div>
    </div>
  );
}

export function TabsList({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function TabsTrigger({
  value,
  children,
  isActive,
  onClick,
}: TabsTriggerProps & { isActive?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded ${
        isActive ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-300"
      }`}
    >
      {children}
    </button>
  );
}

export function TabsContent({ children }: TabsContentProps) {
  return <div>{children}</div>;
}
