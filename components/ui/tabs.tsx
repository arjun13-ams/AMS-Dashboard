import { useState, useEffect, ReactNode, cloneElement, isValidElement } from "react";

type TabsProps = {
  defaultValue?: string;
  value?: string; // controlled
  children: ReactNode;
  className?: string;
};

type TabsTriggerProps = {
  value: string;
  children: ReactNode;
  isActive?: boolean;
  onClick?: () => void;
};

type TabsContentProps = {
  value: string;
  children: ReactNode;
};

export function Tabs({ defaultValue, value, children, className }: TabsProps) {
  const [internalTab, setInternalTab] = useState(defaultValue ?? "");
  const isControlled = value !== undefined;
  const activeTab = isControlled ? value : internalTab;

  useEffect(() => {
    if (isControlled && value !== internalTab) {
      setInternalTab(value);
    }
  }, [value]);

  const triggers: ReactNode[] = [];
  const contents: ReactNode[] = [];

  const childrenArray = Array.isArray(children) ? children : [children];

  childrenArray.forEach((child: any) => {
    if (!isValidElement(child)) return;

    if (child.type === TabsList) {
      const triggerChildren = Array.isArray(child.props.children)
        ? child.props.children
        : [child.props.children];

      const modifiedChildren = triggerChildren.map((trigger) => {
        if (!isValidElement(trigger)) return trigger;

        const triggerValue = trigger.props.value;
        const isActive = triggerValue === activeTab;

        const onClick = () => {
          if (!isControlled) {
            setInternalTab(triggerValue);
          }
          trigger.props.onClick?.();
        };

        return cloneElement(trigger, {
          isActive,
          onClick,
        });
      });

      triggers.push(cloneElement(child, {}, modifiedChildren));
    }

    if (
      (child.type === TabsContent || child.type?.name === "TabsContent") &&
      child.props.value === activeTab
    ) {
      contents.push(child);
    }
  });

  return (
    <div className={className}>
      <div className="flex gap-2 mb-4">{triggers}</div>
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
}: TabsTriggerProps) {
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
