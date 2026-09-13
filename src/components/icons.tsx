import type { SVGProps } from "react";

function Svg(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    />
  );
}

export function IconDashboard(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13" y="3.5" width="7.5" height="4.5" rx="1.5" />
      <rect x="13" y="10.5" width="7.5" height="10" rx="1.5" />
      <rect x="3.5" y="13.5" width="7.5" height="7" rx="1.5" />
    </Svg>
  );
}

export function IconVender(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M3 3h6l1.5 4.5H21l-2 8H8.5L6 5H3" />
      <circle cx="10" cy="20" r="1.4" />
      <circle cx="17.5" cy="20" r="1.4" />
    </Svg>
  );
}

export function IconProdutos(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M9 3h6l1 3H8l1-3Z" />
      <path d="M7 6h10l1 15H6L7 6Z" />
      <path d="M9.5 11c0 1.4 1.1 2.5 2.5 2.5s2.5-1.1 2.5-2.5" />
    </Svg>
  );
}

export function IconClientes(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M16 4.3c1.4.5 2.4 1.8 2.4 3.4 0 1.6-1 2.9-2.4 3.4" />
      <path d="M15.5 14c2.8.3 5 2.7 5 6" />
    </Svg>
  );
}

export function IconFornecedores(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M3 7h11v9H3z" />
      <path d="M14 10h4l3 3v3h-7z" />
      <circle cx="7" cy="18.5" r="1.6" />
      <circle cx="17.5" cy="18.5" r="1.6" />
    </Svg>
  );
}

export function IconEstoque(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M3 7.5 12 3l9 4.5-9 4.5-9-4.5Z" />
      <path d="M3 7.5V16l9 4.5V12" />
      <path d="M21 7.5V16l-9 4.5" />
    </Svg>
  );
}

export function IconEntradaEstoque(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M4 10.5V19a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-8.5" />
      <path d="M3 7.5 12 3l9 4.5-9 4.5-9-4.5Z" />
      <path d="M12 9v9" />
      <path d="M8.5 14.5 12 18l3.5-3.5" />
    </Svg>
  );
}

export function IconCompras(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M4 8h16l-1.5 11.5a1.5 1.5 0 0 1-1.5 1.5H7a1.5 1.5 0 0 1-1.5-1.5L4 8Z" />
      <path d="M8 8V6a4 4 0 0 1 8 0v2" />
      <path d="M9 12l2 2 4-4" />
    </Svg>
  );
}

export function IconRelatorios(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M4 20V10" />
      <path d="M11 20V4" />
      <path d="M18 20v-7" />
      <path d="M3 20h18" />
    </Svg>
  );
}

export function IconDespesas(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="4" width="17" height="16" rx="1.5" />
      <path d="M8 9h8" />
      <path d="M8 13h8" />
      <path d="M8 17h5" />
    </Svg>
  );
}

export function IconAuditoria(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
      <path d="M8 11h6" />
    </Svg>
  );
}

export function IconUsuarios(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 20c0-3.6 2.9-6.5 6.5-6.5" />
      <path d="M16 15.5l1.1 1.1L19.5 14" />
      <circle cx="18" cy="17.5" r="3.2" />
    </Svg>
  );
}

export function IconLogout(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4" />
      <path d="M14 8l4 4-4 4" />
      <path d="M18 12H9" />
    </Svg>
  );
}

export function IconMenu(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </Svg>
  );
}

export function IconClose(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </Svg>
  );
}

export function IconSearch(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M20 20l-4.3-4.3" />
    </Svg>
  );
}

export function IconPlus(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function IconMinus(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M5 12h14" />
    </Svg>
  );
}

export function IconCheck(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M4 12l5.5 5.5L20 6" />
    </Svg>
  );
}

export function IconAlerta(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M12 3 2 21h20L12 3Z" />
      <path d="M12 10v5" />
      <circle cx="12" cy="17.8" r="0.15" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconDinheiro(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  );
}

export function IconPix(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M8 4.5 4.5 8 8 11.5" />
      <path d="M16 4.5 19.5 8 16 11.5" />
      <path d="M8 19.5 4.5 16 8 12.5" />
      <path d="M16 19.5 19.5 16 16 12.5" />
    </Svg>
  );
}

export function IconCartao(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="M2.5 10h19" />
    </Svg>
  );
}

export function IconTrocar(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M4 7h13l-3-3" />
      <path d="M20 17H7l3 3" />
    </Svg>
  );
}

export function IconChat(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M3.5 5.5h17v11h-9L7 20v-3.5H3.5z" />
      <circle cx="8.3" cy="11" r="0.15" fill="currentColor" stroke="none" />
      <circle cx="12" cy="11" r="0.15" fill="currentColor" stroke="none" />
      <circle cx="15.7" cy="11" r="0.15" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconSend(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M4 20l17-8L4 4l2 7 10.5 1L6 13z" />
    </Svg>
  );
}

export function IconFrete(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <rect x="2.5" y="7" width="12" height="9" rx="1.2" />
      <path d="M14.5 10h4l3 3.5V16h-7" />
      <circle cx="7" cy="18.3" r="1.6" />
      <circle cx="17" cy="18.3" r="1.6" />
    </Svg>
  );
}

export function IconMic(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
      <path d="M12 18v3" />
      <path d="M9 21h6" />
    </Svg>
  );
}

// ---------- Oficina (VM Moto Peças) ----------

export function IconMoto(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <circle cx="5" cy="17" r="3.2" />
      <circle cx="19" cy="17" r="3.2" />
      <path d="M5 17h4l3.5-5H8.5" />
      <path d="M12.5 12l3 5" />
      <path d="M13.5 8h3l2.5 4" />
      <path d="M15.5 8l-1.2-2H12" />
    </Svg>
  );
}

export function IconServico(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M14.5 6.2a3.8 3.8 0 0 0 5 5l-8.8 8.8a2.4 2.4 0 0 1-3.4-3.4z" />
      <path d="M14.5 6.2 17 3.7a4.8 4.8 0 0 1 3.6 3.6L18 9.8" />
    </Svg>
  );
}

export function IconRepasse(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M16.5 11.5h5" />
      <path d="M19.5 9l2.2 2.5-2.2 2.5" />
    </Svg>
  );
}

export function IconHome(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M3.5 10.5 12 3.5l8.5 7" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M9.5 20v-6h5v6" />
    </Svg>
  );
}

export function IconSino(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M18 9.5a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16s-2-1.5-2-6.5" />
      <path d="M13.7 19.5a2 2 0 0 1-3.4 0" />
    </Svg>
  );
}
