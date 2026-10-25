"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { RaceResult } from "@apuracao/domain";
import { API_BASE } from "./api";

export type LiveStatus = "conectando" | "conectado" | "desconectado";

interface LiveState {
  status: LiveStatus;
  lastEventAt: string | null;
}

const LiveContext = createContext<LiveState>({
  status: "conectando",
  lastEventAt: null,
});

export function LiveProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<LiveStatus>("conectando");
  const [lastEventAt, setLastEventAt] = useState<string | null>(null);

  useEffect(() => {
    const source = new EventSource(`${API_BASE}/api/live`);
    // Numa rodada do poller lento chegam ~160 eventos quase juntos. Agrupar as
    // invalidações evita uma rajada de refetches de /api/resumo e /historico.
    let resumoHistorico: ReturnType<typeof setTimeout> | null = null;
    let municipios: ReturnType<typeof setTimeout> | null = null;

    const agendarResumoEHistorico = () => {
      if (resumoHistorico) return;
      resumoHistorico = setTimeout(() => {
        resumoHistorico = null;
        void queryClient.invalidateQueries({ queryKey: ["resumo"] });
        void queryClient.invalidateQueries({ queryKey: ["historico"] });
        void queryClient.invalidateQueries({ queryKey: ["grafico"] });
      }, 1_500);
    };

    const agendarMunicipios = () => {
      if (municipios) return;
      municipios = setTimeout(() => {
        municipios = null;
        void queryClient.invalidateQueries({
          queryKey: ["presidente-municipios"],
        });
      }, 500);
    };

    source.addEventListener("open", () => setStatus("conectado"));
    source.addEventListener("hello", () => setStatus("conectado"));
    source.addEventListener("update", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as {
          at: string;
          race: RaceResult;
        };
        const race = payload.race;
        queryClient.setQueryData(
          ["resultado", race.eleicao, race.cargo, race.uf, "", ""],
          race,
        );
        agendarResumoEHistorico();
        setLastEventAt(payload.at);
        setStatus("conectado");
      } catch {
        // ignora payload malformado
      }
    });
    source.addEventListener("municipios", () => {
      agendarMunicipios();
      setStatus("conectado");
    });
    source.onerror = () => setStatus("desconectado");

    return () => {
      source.close();
      if (resumoHistorico) clearTimeout(resumoHistorico);
      if (municipios) clearTimeout(municipios);
    };
  }, [queryClient]);

  const value = useMemo(() => ({ status, lastEventAt }), [status, lastEventAt]);
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export function useLive(): LiveState {
  return useContext(LiveContext);
}
