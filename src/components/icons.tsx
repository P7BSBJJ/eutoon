// Ícones desenhados (sem emoji). Os de interface vêm do Lucide (traço consistente);
// os de futebol são desenhados aqui no mesmo estilo: 24x24, traço 2, cor = currentColor.
import type { SVGProps } from "react";

export {
  ArrowLeft,
  Bell,
  Ban,
  Pin,
  PinOff,
  Trash2,
  LogOut as LeaveIcon,
  Send,
  Banknote,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  Clock,
  Copy,
  Crown,
  History,
  Hourglass,
  LogOut,
  MapPin,
  Megaphone,
  MessageCircle,
  MoreHorizontal,
  PenLine,
  Pencil,
  PiggyBank,
  Plus,
  Settings,
  ShieldBan,
  Shuffle,
  Sparkles,
  Target,
  Trophy,
  TriangleAlert,
  UserPlus,
  Users,
  Vote,
  Wallet,
  X,
} from "lucide-react";

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size = 24) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

/** bola de futebol (gols) */
export function BallIcon({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8.4 15.4 10.9 14.1 14.9H9.9L8.6 10.9Z" fill="currentColor" strokeWidth="1.5" />
      <path d="M12 8.4V2.6M15.4 10.9l5.6-1.9M14.1 14.9l3.5 4.8M9.9 14.9l-3.5 4.8M8.6 10.9 3 9" strokeWidth="1.6" />
    </svg>
  );
}

/** chuteira (assistências) */
export function BootIcon({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M4 5h5l1 4.6c3.3.3 6.3 1.1 9.2 2.4 1.2.5 1.8 1.5 1.8 2.7V17H4Z" />
      <path d="M6 17v2.5M10 17v2.5M14 17v2.5M18 17v2.5" />
      <path d="M9.6 8.6 12 9.2M10.2 11 12.6 11.4" strokeWidth="1.6" />
    </svg>
  );
}

/** luva de goleiro */
export function GloveIcon({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M7.5 21v-5.2L4.8 12.6a1.7 1.7 0 0 1 2.6-2.2l1.6 1.7V5a1.6 1.6 0 0 1 3.2 0v5.5V4a1.6 1.6 0 0 1 3.2 0v6.5V5.5a1.6 1.6 0 0 1 3.2 0V14c0 3-1.7 5-4.1 5.6V21Z" />
      <path d="M7.5 18h7.5" />
    </svg>
  );
}

/** apito */
export function WhistleIcon({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M2.5 9.5h10.5l8 3v3l-8-1.2a5.5 5.5 0 1 1-10.5-4.8Z" />
      <circle cx="8" cy="13.5" r="1.6" />
      <path d="M13 9.5V7" />
    </svg>
  );
}

/** a bola da marca (3D) – para o interruptor e destaques */
export function BrandBall({ size = 32, className = "" }: { size?: number; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/ball.svg" alt="" width={size} height={size} className={className} />;
}
