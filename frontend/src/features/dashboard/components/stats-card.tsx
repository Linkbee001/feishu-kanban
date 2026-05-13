import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  icon: LucideIcon;
  title: string;
  value: number | string;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  onClick?: () => void;
  className?: string;
  loading?: boolean;
}

export function StatsCard({
  icon: Icon,
  title,
  value,
  subtitle,
  trend = 'neutral',
  trendValue,
  onClick,
  className,
  loading = false,
}: StatsCardProps) {
  return (
    <Card
      className={cn(
        'transition-all duration-200',
        onClick && 'cursor-pointer hover:shadow-md hover:border-primary/20',
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <div className="h-7 w-16 bg-muted rounded animate-pulse" />
            <div className="h-4 w-24 bg-muted rounded animate-pulse" />
          </div>
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            {(subtitle || trendValue) && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                {trend !== 'neutral' && trendValue && (
                  <>
                    {trend === 'up' ? (
                      <TrendingUp className="h-3 w-3 text-green-500" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-500" />
                    )}
                    <span
                      className={
                        trend === 'up' ? 'text-green-600' : 'text-red-600'
                      }
                    >
                      {trendValue}
                    </span>
                  </>
                )}
                {subtitle && <span>{subtitle}</span>}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
