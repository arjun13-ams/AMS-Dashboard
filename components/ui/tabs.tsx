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

  console.log("Tabs: activeTab =", activeTab);

  const triggers: ReactNode[] = [];
  const contents: ReactNode[] = [];

  const childrenArray = Array.isArray(children) ? children : [children];

  childrenArray.forEach((child, index) => {
    if (!isValidElement(child)) return;

    const element = child as ReactElement;

    console.log(`Tabs: processing child[${index}] type:`, element.type);

    if (element.type === TabsList) {
      console.log("Tabs: Found TabsList with children:", element.props.children);
      const triggerChildren = Array.isArray(element.props.children)
        ? element.props.children
        : [element.props.children];

      const modifiedChildren = triggerChildren.map((trigger, i) => {
        if (!isValidElement(trigger)) return trigger;

        const triggerElement = trigger as ReactElement<TabsTriggerProps>;
        const triggerValue = triggerElement.props.value;
        const isActive = triggerValue === activeTab;

        console.log(`Tabs: processing trigger[${i}] with value: ${triggerValue}, isActive: ${isActive}`);

        const handleClick = () => {
          console.log("TabsTrigger clicked:", triggerValue);
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
      element.type === TabsContent ||
      (typeof element.type === "function" && element.type.name === "TabsContent")
    ) {
      console.log("Tabs: Checking TabsContent with value:", element.props.value);
      if (element.props.value === activeTab) {
        console.log("Tabs: Adding TabsContent for activeTab:", activeTab);
        contents.push(element);
      }
    } else {
      console.log("Tabs: Skipping child at index", index);
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
  console.log(`TabsTrigger render: value=${value}, isActive=${isActive}`);
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
  console.log("TabsContent render for value:", value);
  return <div>{children}</div>;
}
