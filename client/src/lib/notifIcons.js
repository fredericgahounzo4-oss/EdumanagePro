import { AlertTriangle, CheckCircle2, Info, UserX } from "lucide-react";

// Icône et teinte d'une notification selon son type ('info' | 'success' | 'warning' | 'danger')
export function iconeNotif(type) {
  switch (type) {
    case "danger": return { Icon: UserX, tone: "red" };
    case "warning": return { Icon: AlertTriangle, tone: "brass" };
    case "success": return { Icon: CheckCircle2, tone: "green" };
    default: return { Icon: Info, tone: "blue" };
  }
}
