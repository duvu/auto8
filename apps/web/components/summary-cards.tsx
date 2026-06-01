'use client';
import Link from 'next/link';

export interface SummaryCard {
  label: string;
  value: string | number | undefined | null;
  delta?: string;
  deltaPositive?: boolean;
  href?: string;
}

export function SummaryCards({ cards }: { cards: SummaryCard[] }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card) => {
        const inner = (
          <div className={`bg-white border border-[#e5e7eb] rounded-xl p-4 ${card.href ? 'hover:border-[#c9612c] cursor-pointer transition-colors' : ''}`}>
            <p className="text-xs font-medium text-[#6b7280] uppercase tracking-wide">{card.label}</p>
            {card.value == null ? (
              <div className="h-7 w-20 bg-gray-200 animate-pulse rounded mt-1" />
            ) : (
              <p className="text-2xl font-bold text-[#111827] mt-1">{card.value}</p>
            )}
            {card.delta != null && (
              <p className={`text-xs mt-1 ${card.deltaPositive ? 'text-green-600' : 'text-red-600'}`}>
                {card.delta}
              </p>
            )}
          </div>
        );
        return card.href ? <Link href={card.href} key={card.label}>{inner}</Link> : <div key={card.label}>{inner}</div>;
      })}
    </div>
  );
}
