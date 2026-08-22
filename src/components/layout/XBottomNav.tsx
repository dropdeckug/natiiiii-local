import { PlusCircle, Hammer, Bell, User, BarChart3 } from "lucide-react";

interface XBottomNavProps {
  activeItem: string;
  onItemClick: (item: string) => void;
}

const bottomItems = [
  { id: "create", icon: PlusCircle },
  { id: "builds", icon: Hammer },
  { id: "analytics", icon: BarChart3 },
  { id: "notifications", icon: Bell },
  { id: "profile", icon: User },
];

const XBottomNav = ({ activeItem, onItemClick }: XBottomNavProps) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background md:hidden">
      <div className="flex items-center justify-around h-[53px]">
        {bottomItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeItem === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onItemClick(item.id)}
              className="flex items-center justify-center w-full h-full"
            >
              <Icon
                size={26}
                strokeWidth={isActive ? 2.5 : 1.5}
                className={isActive ? "text-foreground" : "text-muted-foreground"}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default XBottomNav;
