import {
  useState,
  ReactNode,
  ReactElement,
  isValidElement,
  cloneElement,
} from "react";

// === Types ===
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

// === Tabs Component ===
export function Tabs({ defaultValue, value, children, className }: TabsProps) {
  const isControlled = value !== undefined;
  const [internalTab, setInternalTab] = useState(defaultValue);
  const activeTab = isControlled ? value : internalTab;

  const triggers: ReactNode[] = [];
  const contents: ReactNode[] = [];
  const childrenArray = Array.isArray(children) ? children : [children];

  childrenArray.forEach((child, index) => {
    if (!isValidElement(child)) return;

    const element = child as ReactElement;

    if (element.type === TabsList) {
      const triggerChildren = Array.isArray(element.props.children)
        ? element.props.children
        : [element.props.children];

      const modifiedChildren = triggerChildren.map((trigger, i) => {
        if (!isValidElement(trigger)) return trigger;

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
    } else {
      const isTabsContent =
        typeof element.type === "function" &&
        (element.type.name === "TabsContent" ||
          (typeof (element.type as any).displayName === "string" &&
           (element.type as any).displayName === "TabsContent"));

      if (isTabsContent) {
        if (element.props.value === activeTab) {
          contents.push(element);
        }
      }
    }
  });

  return (
    <div className={className}>
      <div className="flex gap-2 mb-4">{triggers.flat()}</div>
      <div>{contents}</div>
    </div>
  );
}

// === Supporting Components ===
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

// Set displayName for build-safe identification
TabsContent.displayName = "TabsContent";
