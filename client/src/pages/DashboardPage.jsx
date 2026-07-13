import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Badge from '../atoms/Badge';
import Button from '../atoms/Button';
import { useGetDashboardOverviewQuery } from '../store/dashboardApi';
import { formatMoney } from '../lib/format';
import { getErrorMessage } from '../lib/errors';
import { cn } from '../lib/utils';

function formatActivityTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-PK', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function DashboardTable({ headers, rows, emptyLabel }) {
  if (!rows.length) {
    return <p className="text-[13px] text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-[13px]">
          <thead className="border-b border-border bg-background text-muted-foreground">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-4 py-3 font-medium">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="border-b border-border/70 last:border-b-0">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-4 py-3">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function compactNumber(value) {
  return new Intl.NumberFormat('en-PK', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number(value) || 0);
}

function ChartTooltip({ active, payload, label, valueFormatter }) {
  if (!active || !payload?.length) {
    return null;
  }
  return (
    <div className="rounded-lg border border-border bg-white px-3 py-2 shadow-lg">
      <p className="text-[12px] font-medium text-foreground">{label}</p>
      <p className="mt-1 text-[12px] text-muted">
        {payload[0].name}: {valueFormatter(payload[0].value)}
      </p>
    </div>
  );
}

function DashboardChartCard({ title, subtitle, data, dataKey, color, type, valueFormatter }) {
  const { t } = useTranslation();
  const hasData = data.some((item) => Number(item[dataKey]) > 0);
  return (
    <section className="rounded-xl border border-border bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <p className="mt-0.5 text-[12px] text-muted">{subtitle}</p>
        </div>
        <Badge variant={hasData ? 'success' : 'default'}>
          {hasData ? t('dashboard.live') : t('dashboard.charts.noData')}
        </Badge>
      </div>
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          {type === 'bar' ? (
            <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid stroke="#E8E8EE" strokeDasharray="4 4" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: '#6B6B80', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fill: '#6B6B80', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={compactNumber}
              />
              <Tooltip content={<ChartTooltip valueFormatter={valueFormatter} />} />
              <Bar dataKey={dataKey} name={title} fill={color} radius={[8, 8, 0, 0]} />
            </BarChart>
          ) : (
            <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid stroke="#E8E8EE" strokeDasharray="4 4" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: '#6B6B80', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fill: '#6B6B80', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={compactNumber}
              />
              <Tooltip content={<ChartTooltip valueFormatter={valueFormatter} />} />
              <Area
                type="monotone"
                dataKey={dataKey}
                name={title}
                stroke={color}
                fill={color}
                fillOpacity={0.12}
                strokeWidth={2.5}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function activityBadgeVariant(type) {
  switch (type) {
    case 'sale':
      return 'success';
    case 'return':
      return 'warning';
    case 'exchange':
      return 'default';
    case 'expense':
      return 'danger';
    default:
      return 'default';
  }
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const { data, isLoading, isFetching, error } = useGetDashboardOverviewQuery();
  const salesTrend = data?.charts?.salesTrend?.periods ?? [];

  const stats = data
    ? [
        {
          label: t('dashboard.stats.todaySales'),
          value: String(data.stats.saleCount),
          tone: 'default',
        },
        {
          label: t('dashboard.stats.todayRevenue'),
          value: formatMoney(data.stats.revenue),
          tone: 'success',
        },
        {
          label: t('dashboard.stats.todayProfit'),
          value: formatMoney(data.stats.profit),
          tone: data.stats.profit >= 0 ? 'success' : 'danger',
        },
        {
          label: t('dashboard.stats.lowStock'),
          value: String(data.stats.lowStockCount),
          tone: data.stats.lowStockCount > 0 ? 'warning' : 'success',
        },
      ]
    : [];

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-semibold">{t('dashboard.title')}</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{t('dashboard.subtitle')}</p>
        </div>
        <Link to="/pos">
          <Button>{t('dashboard.newSale')}</Button>
        </Link>
      </div>

      {isLoading ? (
        <p className="text-[13px] text-muted-foreground">{t('dashboard.loading')}</p>
      ) : error ? (
        <p className="text-[13px] text-danger">{getErrorMessage(error, t('dashboard.error'))}</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-border bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.05)]"
              >
                <div className="text-[22px] font-semibold tabular-nums">{stat.value}</div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[12px] text-muted-foreground">{stat.label}</span>
                  <Badge variant={stat.tone}>
                    {isFetching ? t('dashboard.refreshing') : t('dashboard.live')}
                  </Badge>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
            <DashboardChartCard
              title={t('dashboard.charts.revenue')}
              subtitle={t('dashboard.charts.lastDays', {
                count: data?.charts?.salesTrend?.days ?? 7,
              })}
              data={salesTrend}
              dataKey="revenue"
              color="#4F46E5"
              type="area"
              valueFormatter={formatMoney}
            />
            <DashboardChartCard
              title={t('dashboard.charts.salesCount')}
              subtitle={t('dashboard.charts.lastDays', {
                count: data?.charts?.salesTrend?.days ?? 7,
              })}
              data={salesTrend}
              dataKey="saleCount"
              color="#16A34A"
              type="bar"
              valueFormatter={(value) => String(Number(value) || 0)}
            />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
            <section>
              <h2 className="mb-3 text-[15px] font-semibold">{t('dashboard.topProducts')}</h2>
              <DashboardTable
                headers={[
                  t('dashboard.columns.product'),
                  t('dashboard.columns.sku'),
                  t('dashboard.columns.qtySold'),
                  t('dashboard.columns.revenue'),
                ]}
                rows={(data?.topProducts ?? []).map((item) => [
                  item.productName,
                  item.sku,
                  item.quantitySold,
                  formatMoney(item.revenue),
                ])}
                emptyLabel={t('dashboard.emptyTopProducts')}
              />
            </section>

            <section>
              <h2 className="mb-3 text-[15px] font-semibold">{t('dashboard.lowStock')}</h2>
              <DashboardTable
                headers={[
                  t('dashboard.columns.product'),
                  t('dashboard.columns.sku'),
                  t('dashboard.columns.onHand'),
                  t('dashboard.columns.threshold'),
                ]}
                rows={(data?.lowStockItems ?? []).map((item) => [
                  item.productName,
                  item.sku,
                  item.quantityOnHand,
                  item.reorderThreshold,
                ])}
                emptyLabel={t('dashboard.emptyLowStock')}
              />
            </section>
          </div>

          <section className="mt-6">
            <h2 className="mb-3 text-[15px] font-semibold">{t('dashboard.recentActivity')}</h2>
            {!data?.recentActivity?.length ? (
              <p className="text-[13px] text-muted-foreground">{t('dashboard.emptyActivity')}</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border bg-white">
                <ul className="divide-y divide-border/70">
                  {data.recentActivity.map((item) => (
                    <li
                      key={`${item.type}-${item.id}`}
                      className="flex items-start justify-between gap-4 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={activityBadgeVariant(item.type)}>
                            {t(`dashboard.activity.${item.type}`, { defaultValue: item.type })}
                          </Badge>
                          <span className="text-[13px] font-medium">{item.title}</span>
                        </div>
                        <p className="mt-1 text-[12px] text-muted-foreground">{item.subtitle}</p>
                        {item.userName ? (
                          <p className="mt-0.5 text-[12px] text-muted-foreground">
                            {item.userName}
                          </p>
                        ) : null}
                      </div>
                      <div className="shrink-0 text-right">
                        {item.amount !== null ? (
                          <p
                            className={cn(
                              'text-[13px] font-medium tabular-nums',
                              item.type === 'expense' ? 'text-danger' : 'text-foreground'
                            )}
                          >
                            {formatMoney(item.amount)}
                          </p>
                        ) : null}
                        <p className="mt-1 text-[12px] text-muted-foreground">
                          {formatActivityTime(item.createdAt)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
