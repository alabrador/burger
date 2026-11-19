"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { useReportError } from "@/components/ErrorScreen";
import { Btn, Card } from "../_lib/ui";

export default function AdminError({ error, retry }: { error: unknown; retry: () => void }) {
  useReportError(error);
  return (
    <div className="pt-10">
      <Card>
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <TriangleAlert className="size-10 text-red" />
          <h1 className="text-lg font-semibold">Esta sección ha fallado al cargar</h1>
          <p className="max-w-md text-sm text-muted">El error ha quedado registrado en «Errores». El resto del panel sigue funcionando.</p>
          <Btn variant="gold" onClick={() => retry()}>
            <RotateCcw className="size-4" /> Reintentar
          </Btn>
        </div>
      </Card>
    </div>
  );
}
