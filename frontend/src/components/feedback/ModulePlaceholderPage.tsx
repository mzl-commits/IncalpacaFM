import { Wrench } from "@phosphor-icons/react";

export function ModulePlaceholderPage({ title }: { title: string }) {
  return (
    <section className="empty-module">
      <Wrench size={40} weight="duotone" />
      <h1>{title}</h1>
      <p>La estructura del módulo está reservada y se implementará con su contrato API.</p>
    </section>
  );
}
