import {
  useState,
  ReactNode,
  ReactElement,
  isValidElement,
  cloneElement,
} from "react";

type TabsProps = {
  defaultValue: string;
  value?: string;
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
  const isControlled = value !== undefined;
  const [internalTab, setInternalTab] = useState(defaultValue);
  const activeTab = isControlled ? value : internalTab;

  const triggers: ReactNode[] = [];
  const contents: ReactNode[] = [];

  const childrenArray = Array.isArray(children) ? children : [children];

  childrenArray.forEach((child) => {
    if (!isValidElement(child)) return;

    const element = child as ReactElement;

    if (element.type === TabsList) {
      const triggerChildren = Array.isArray(element.props.children)
        ? element.props.children
        : [element.props.children];

      const modifiedChildren = triggerChildren.map((trigger) => {
        if (!isValidElement(trigger)) return trigger;

        // ✅ Cast trigger to known props type
        const triggerElement = trigger as ReactElement<TabsTriggerProps>;
        const triggerValue = triggerElement.props.value;
        const isActive = triggerValue === activeTab;

        const handleClick = () => {
          if (!isControlled) {
            setInternalTab(triggerValue);
          }
          triggerElement.props.onClick?.();
        };

        return cloneElement(triggerElement, {
          isActive,
          onClick: handleClick,
        });
      });

      triggers.push(modifiedChildren);
    } else if (
      (element.type === TabsContent || element.type?.name === "TabsContent") &&
      element.props.value === activeTab
    ) {
      contents.push(element);
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
}: TabsTriggerProps) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded transition-colors ${
        isActive ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-300"
      }`}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children }: TabsContentProps) {
  return <div>{children}</div>;
}
