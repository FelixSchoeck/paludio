import React from 'react';
import {
  Home,
  Map,
  DraftingCompass,
  Euro,
  Activity,
  Tractor,
  ShoppingBag,
  Leaf,
  Wheat,
  Sprout,
  Trees,
  Sun,
  ShieldAlert,
  AlertTriangle,
  Info,
  CheckCircle2,
  Calendar,
  FileText,
  Search,
  Download,
  Trash2,
  MapPin,
  Crosshair,
  Package,
  Truck,
  Shovel,
  Satellite,
  Building2,
  Globe2,
  Zap,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  Database,
  ShieldCheck,
  Layers,
  Landmark,
  X,
  Check,
  CircleDot,
  Flame,
  Droplets,
  HelpCircle,
  Star,
  Sparkles,
  Pencil,
  Play,
  Save,
  Upload,
  Square,
  RotateCcw,
  ChevronsUpDown,
  Droplet,
  ChartLine,
  Plus,
  type LucideProps,
} from 'lucide-react';

export {
  Home,
  Map,
  DraftingCompass,
  Euro,
  Activity,
  Tractor,
  ShoppingBag,
  Leaf,
  Wheat,
  Sprout,
  Trees,
  Sun,
  ShieldAlert,
  AlertTriangle,
  Info,
  CheckCircle2,
  Calendar,
  FileText,
  Search,
  Download,
  Trash2,
  MapPin,
  Crosshair,
  Package,
  Truck,
  Shovel,
  Satellite,
  Building2,
  Globe2,
  Zap,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  Database,
  ShieldCheck,
  Layers,
  Landmark,
  X,
  Check,
  CircleDot,
  Flame,
  Droplets,
  HelpCircle,
  Star,
  Sparkles,
  Pencil,
  Play,
  Save,
  Upload,
  Square,
  RotateCcw,
  ChevronsUpDown,
  Droplet,
  ChartLine,
  Plus,
};

/**
 * Gibt das passende Lucide-Icon für einen Kultur-Schlüssel zurück
 */
export function CropIcon({ name, size = 20, className }: { name?: string; size?: number; className?: string }) {
  const props: LucideProps = { size, className };
  switch (name) {
    case 'rohrkolben':
      return <Wheat {...props} />;
    case 'schilf':
      return <Leaf {...props} />;
    case 'nassgruenland':
      return <Sprout {...props} />;
    case 'buffel':
      return <Activity {...props} />;
    case 'erle':
      return <Trees {...props} />;
    case 'torfmoos':
      return <CircleDot {...props} />;
    case 'moor_pv':
      return <Sun {...props} />;
    default:
      return <Sprout {...props} />;
  }
}

/**
 * Gibt das passende Lucide-Icon für Maschinenkategorien zurück
 */
export function MachineIcon({ category, size = 20, className }: { category?: string; size?: number; className?: string }) {
  const props: LucideProps = { size, className };
  switch (category) {
    case 'raupe-maehen':
    case 'breitreifen':
      return <Tractor {...props} />;
    case 'ballenpresse':
      return <Package {...props} />;
    case 'wasserbau':
      return <Shovel {...props} />;
    case 'pflanzung':
      return <Sprout {...props} />;
    case 'transport':
      return <Truck {...props} />;
    case 'monitoring':
      return <Satellite {...props} />;
    default:
      return <Tractor {...props} />;
  }
}

/**
 * Gibt das passende Lucide-Icon für Produktkategorien zurück
 */
export function ProductIcon({ category, size = 20, className }: { category?: string; size?: number; className?: string }) {
  const props: LucideProps = { size, className };
  switch (category) {
    case 'baustoff':
      return <Building2 {...props} />;
    case 'reet':
      return <Leaf {...props} />;
    case 'biomasse':
      return <Wheat {...props} />;
    case 'substrat':
      return <CircleDot {...props} />;
    case 'holz':
      return <Trees {...props} />;
    case 'fleisch':
      return <Activity {...props} />;
    case 'zertifikat':
      return <Globe2 {...props} />;
    case 'energie':
      return <Zap {...props} />;
    default:
      return <Package {...props} />;
  }
}
