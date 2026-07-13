import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  Users,
  Receipt,
  ArrowLeftRight,
  Wallet,
  BarChart3,
  Tag,
  Settings,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../hooks/useAuth';

const navItems = [
  { to: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard, end: true, permission: 'dashboard.view' },
  { to: '/pos', labelKey: 'nav.pos', icon: ShoppingCart, permission: 'sales.create' },
  { to: '/products', labelKey: 'nav.products', icon: Package, permission: 'products.view' },
  { to: '/inventory', labelKey: 'nav.inventory', icon: Boxes, permission: 'inventory.view' },
  { to: '/customers', labelKey: 'nav.customers', icon: Users, permission: 'customers.view' },
  { to: '/sales-history', labelKey: 'nav.salesHistory', icon: Receipt, permission: 'sales.view' },
  { to: '/exchanges', labelKey: 'nav.exchanges', icon: ArrowLeftRight, permission: 'exchanges.manage' },
  { to: '/expenses', labelKey: 'nav.expenses', icon: Wallet, permission: 'expenses.view' },
  { to: '/reports', labelKey: 'nav.reports', icon: BarChart3, permission: 'reports.view' },
  { to: '/seasonal', labelKey: 'nav.seasonal', icon: Tag, permission: 'promotions.manage' },
  { to: '/settings', labelKey: 'nav.settings', icon: Settings, permission: 'settings.view' },
];

export default function Sidebar() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const visibleItems = navItems.filter(
    (item) => !item.permission || hasPermission(item.permission)
  );

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-white">
      <div className="flex h-14 items-center gap-2.5 border-b border-border px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-xs font-bold text-white">
          Z
        </div>
        <span className="text-[15px] font-semibold tracking-tight">{t('app.name')}</span>
      </div>
      <nav className="flex-1 overflow-y-auto py-3">
        {visibleItems.map(({ to, labelKey, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'mx-2 mb-0.5 flex h-9 items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition-colors',
                isActive
                  ? 'bg-[#eef2ff] text-primary'
                  : 'text-muted hover:bg-[#f4f4f8] hover:text-foreground'
              )
            }
          >
            <Icon size={18} strokeWidth={1.75} />
            <span className="truncate">{t(labelKey)}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
