"use client";

import { LOCALE } from "@/config/locale";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/lib/format/money";

const shortDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString(LOCALE, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

/**
 * Daily revenue bars. The chart is decorative for assistive technology;
 * the same numbers are in a visually hidden table right after it.
 */
export function RevenueChart({
  data,
}: {
  data: ReadonlyArray<{ date: string; revenue: number; orders: number }>;
}) {
  return (
    <figure>
      <div aria-hidden className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={[...data]}
            margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
            accessibilityLayer={false}
          >
            <CartesianGrid vertical={false} stroke="var(--color-line)" />
            <XAxis
              dataKey="date"
              tickFormatter={shortDate}
              tick={{ fontSize: 11, fill: "var(--color-ink-subtle)" }}
              interval="preserveStartEnd"
              tickLine={false}
              axisLine={{ stroke: "var(--color-line)" }}
            />
            <YAxis
              tickFormatter={(v: number) => `EGP ${Math.round(v / 100).toLocaleString(LOCALE)}`}
              tick={{ fontSize: 11, fill: "var(--color-ink-subtle)" }}
              tickLine={false}
              axisLine={false}
              width={64}
            />
            <Tooltip
              cursor={{ fill: "var(--color-surface-muted)" }}
              formatter={(value) => [formatMoney(Number(value)), "Revenue"]}
              labelFormatter={(label) => shortDate(String(label))}
            />
            <Bar dataKey="revenue" fill="var(--color-ink)" maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">Revenue per day</figcaption>
      <table className="sr-only">
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Revenue</th>
            <th scope="col">Orders</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <th scope="row">{shortDate(d.date)}</th>
              <td>{formatMoney(d.revenue)}</td>
              <td>{d.orders}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
