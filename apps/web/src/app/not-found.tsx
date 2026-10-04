import Link from "next/link";
import { buttonClass, Card } from "@/components/ui";

export default function NotFound() {
  return (
    <Card className="mx-auto max-w-lg p-6 text-center">
      <h1 className="text-lg font-semibold">Página não encontrada</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        O endereço acessado não existe ou a localidade não está disponível.
      </p>
      <Link href="/" className={buttonClass("primary", "mt-4")}>
        Voltar ao painel
      </Link>
    </Card>
  );
}
