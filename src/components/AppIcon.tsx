import type { LucideIcon } from "lucide-react-native";
import { useTheme } from "./theme";
import ActivityIcon from "lucide-react-native/icons/activity";
import IncomeIcon from "lucide-react-native/icons/arrow-down-left";
import ExpenseIcon from "lucide-react-native/icons/arrow-up-right";
import TransferIcon from "lucide-react-native/icons/arrow-left-right";
import BellIcon from "lucide-react-native/icons/bell";
import TransportIcon from "lucide-react-native/icons/bus";
import CalendarIcon from "lucide-react-native/icons/calendar-days";
import CheckIcon from "lucide-react-native/icons/check";
import DownIcon from "lucide-react-native/icons/chevron-down";
import LeftIcon from "lucide-react-native/icons/chevron-left";
import RightIcon from "lucide-react-native/icons/chevron-right";
import CloudIcon from "lucide-react-native/icons/cloud";
import CreditIcon from "lucide-react-native/icons/credit-card";
import DownloadIcon from "lucide-react-native/icons/download";
import HealthIcon from "lucide-react-native/icons/heart-pulse";
import HomeIcon from "lucide-react-native/icons/house";
import BankIcon from "lucide-react-native/icons/landmark";
import LocationIcon from "lucide-react-native/icons/map-pin";
import EditIcon from "lucide-react-native/icons/pencil";
import PlusIcon from "lucide-react-native/icons/plus";
import SearchIcon from "lucide-react-native/icons/search";
import SettingsIcon from "lucide-react-native/icons/settings";
import ShieldIcon from "lucide-react-native/icons/shield-check";
import LeisureIcon from "lucide-react-native/icons/sparkles";
import TagIcon from "lucide-react-native/icons/tag";
import TargetIcon from "lucide-react-native/icons/target";
import UserIcon from "lucide-react-native/icons/user-round";
import FoodIcon from "lucide-react-native/icons/utensils";
import WalletIcon from "lucide-react-native/icons/wallet";
import CloseIcon from "lucide-react-native/icons/x";
import ClockIcon from "lucide-react-native/icons/clock";
import CalendarPlusIcon from "lucide-react-native/icons/calendar-plus";
const icons = {
  calendarPlus: CalendarPlusIcon,
  clock: ClockIcon,
  activity: ActivityIcon,
  income: IncomeIcon,
  expense: ExpenseIcon,
  transfer: TransferIcon,
  bell: BellIcon,
  transport: TransportIcon,
  calendar: CalendarIcon,
  check: CheckIcon,
  down: DownIcon,
  left: LeftIcon,
  right: RightIcon,
  cloud: CloudIcon,
  credit: CreditIcon,
  download: DownloadIcon,
  health: HealthIcon,
  home: HomeIcon,
  bank: BankIcon,
  location: LocationIcon,
  edit: EditIcon,
  plus: PlusIcon,
  search: SearchIcon,
  settings: SettingsIcon,
  shield: ShieldIcon,
  leisure: LeisureIcon,
  tag: TagIcon,
  target: TargetIcon,
  user: UserIcon,
  food: FoodIcon,
  wallet: WalletIcon,
  close: CloseIcon,
} satisfies Record<string, LucideIcon>;
export type IconName = keyof typeof icons;
export function AppIcon({
  name,
  size = 20,
  color,
  strokeWidth = 1.8,
}: {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const { colors } = useTheme(),
    Icon = icons[name];
  return (
    <Icon
      size={size}
      color={color ?? colors.text}
      strokeWidth={strokeWidth}
      accessible={false}
      aria-hidden
    />
  );
}
