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
        void queryClient.invalidateQueries({ queryKey: ["resumo"] });
        void queryClient.invalidateQueries({
          queryKey: ["historico", race.eleicao, race.cargo, race.uf],
        });
        setLastEventAt(payload.at);
        setStatus("conectado");
      } catch {
        // ignora payload malformado
      }
    });
    source.onerror = () => setStatus("desconectado");

    return () => source.close();
  }, [queryClient]);

  const value = useMemo(() => ({ status, lastEventAt }), [status, lastEventAt]);
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export function useLive(): LiveState {
  return useContext(LiveContext);
}
