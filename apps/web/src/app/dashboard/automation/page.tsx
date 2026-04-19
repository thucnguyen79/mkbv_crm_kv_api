'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getApiClient } from '@/lib/api';

interface Rule {
  code: string;
  description: string;
  conditionsSchema: Record<string, unknown>;
}

export default function AutomationRulesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['automation-rules'],
    queryFn: () =>
      getApiClient()
        .get<Rule[]>('/automation/rules')
        .then((r) => r.data),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Automation rules</h1>
      <p className="text-sm text-muted-foreground">
        Các rule có sẵn để gắn vào <code>Campaign.ruleCode</code>. Schema cho biết các field hợp lệ
        trong <code>Campaign.conditions</code>.
      </p>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {data?.map((r) => (
            <Card key={r.code}>
              <CardHeader>
                <CardTitle className="font-mono text-sm">{r.code}</CardTitle>
                <CardDescription>{r.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">
                  {JSON.stringify(r.conditionsSchema, null, 2)}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
