import { useState, useEffect, ReactNode } from "react";

type TabsProps = {
  defaultValue: string;
  value?: string;               // Added for controlled active tab
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

export function Tabs({ defaultValue, value, children, className }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultValue);

  // Sync activeTab state with controlled value prop if provided
  useEffect(() => {
    if (value !== undefined && value !== activeTab) {
      console.log(`Tabs: syncing activeTab state to controlled value: ${value}`);
      setActiveTab(value);
    }
  }, [value, activeTab]);

  console.log("Tabs: current activeTab =", activeTab);

  const triggers: ReactNode[] = [];
  const contents: ReactNode[] = [];

  const childrenArray = Array.isArray(children) ? children : [children];

  childrenArray.forEach((child: any, index: number) => {
    console.log(`Tabs: processing child[${index}] type:`, child.type?.name || child.type);

    if (child.type === TabsList) {
      console.log("Tabs: Found TabsList with children:", child.props.children);
      triggers.push(
        child.props.children.map((trigger: any, i: number) => {
          console.log(`Tabs: processing trigger[${i}] with value:`, trigger.props.value);
          if (trigger.type === TabsTrigger) {
            return {
              ...trigger,
              props: {
                ...trigger.props,
                isActive: trigger.props.value === activeTab,
                onClick: () => {
                  console.log("TabsTrigger clicked:", trigger.props.value);
                  setActiveTab(trigger.props.value);
                },
              },
            };
          }
          return trigger;
        })
      );
    } else if (
      (child.type === TabsContent || child.type?.name === "TabsContent") &&
      child.props.value === activeTab
    ) {
      console.log("Tabs: Adding TabsContent with value:", child.props.value);
      contents.push(child);
    } else {
      console.log("Tabs: Skipping child", child);
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
  console.log(`TabsTrigger render: value=${value}, isActive=${isActive}`);
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
  console.log("TabsContent render");
  return <div>{children}</div>;
}
