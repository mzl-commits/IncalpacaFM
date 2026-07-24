import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  QrCode,
  Printer,
  FilePdf,
  Plus,
  MagnifyingGlass,
  Funnel,
  ArrowClockwise,
  MapPin,
  User,
  CalendarCheck,
  CheckCircle,
  Clock,
  Warning,
  ShareNetwork,
} from "@phosphor-icons/react";
import QRCode from "qrcode";
import { useEffect } from "react";

interface QrItem {
  id: string;
  code: string;
  description: string;
  category: string;
  location: string;
  assignedTo: string;
  qrStatus: "Impreso" | "Pendiente" | "Dañado";
  lifecycleStatus: "Activo" | "En Mantenimiento" | "Asignado";
  date: string;
}

const mockQrItems: QrItem[] = [
  {
    id: "1",
    code: "INC-BIEN-2026-001245",
    description: "Laptop Lenovo ThinkPad T14 Gen 4",
    category: "Cómputo",
    location: "Sede Principal - Piso 4 (TI)",
    assignedTo: "Juan Pérez (Facility Management)",
    qrStatus: "Impreso",
    lifecycleStatus: "Activo",
    date: "24 jul 2026",
  },
  {
    id: "2",
    code: "INC-BIEN-2026-001246",
    description: 'Monitor Dell UltraSharp 27" 4K',
    category: "Cómputo",
    location: "Almacén Central - Rack B2",
    assignedTo: "Sin asignar (En Almacén)",
    qrStatus: "Pendiente",
    lifecycleStatus: "Activo",
    date: "23 jul 2026",
  },
  {
    id: "3",
    code: "INC-BIEN-2026-001247",
    description: "Silla Ergonómica Herman Miller Aeron",
    category: "Mobiliario",
    location: "Sede Principal - Sala Reuniones A",
    assignedTo: "Rosa Medina (Gerencia)",
    qrStatus: "Impreso",
    lifecycleStatus: "Asignado",
    date: "22 jul 2026",
  },
  {
    id: "4",
    code: "INC-BIEN-2026-001248",
    description: "Taladro Percutor Industrial Bosch GSB 550",
    category: "Maquinaria",
    location: "Planta Industrial - Taller Mantenimiento",
    assignedTo: "Marco Quispe (Técnico)",
    qrStatus: "Dañado",
    lifecycleStatus: "En Mantenimiento",
    date: "21 jul 2026",
  },
  {
    id: "5",
    code: "INC-BIEN-2026-001249",
    description: "Servidor Rack HP ProLiant DL380",
    category: "Cómputo",
    location: "Data Center - Rack 03",
    assignedTo: "Luis Salas (Sistemas)",
    qrStatus: "Impreso",
    lifecycleStatus: "Activo",
    date: "20 jul 2026",
  },
  {
    id: "6",
    code: "INC-BIEN-2026-001250",
    description: "Montacargas Eléctrico Toyota 2.5T",
    category: "Maquinaria",
    location: "Almacén Textil - Zona Carga",
    assignedTo: "Carlos Vargas (Operaciones)",
    qrStatus: "Pendiente",
    lifecycleStatus: "Activo",
    date: "19 jul 2026",
  },
];

function QrCodeDataUrl({ code }: { code: string }) {
  const [dataUrl, setDataUrl] = useState<string>("");

  useEffect(() => {
    QRCode.toDataURL(code, { width: 180, margin: 1 })
      .then(setDataUrl)
      .catch((err) => console.error("Error generating QR:", err));
  }, [code]);

  return dataUrl ? (
    <img src={dataUrl} alt={`QR Code ${code}`} className="w-full h-full object-contain" />
  ) : (
    <div className="flex items-center justify-center h-full text-gray-400 text-xs">Generando...</div>
  );
}

export function AssetQrInventoryPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Todos");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"todos" | "pendientes" | "impresos">("todos");

  const filteredItems = useMemo(() => {
    return mockQrItems.filter((item) => {
      const matchesSearch =
        item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.location.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory = categoryFilter === "Todos" || item.category === categoryFilter;
      const matchesStatus = statusFilter === "Todos" || item.qrStatus === statusFilter;

      const matchesTab =
        activeTab === "todos" ||
        (activeTab === "pendientes" && item.qrStatus === "Pendiente") ||
        (activeTab === "impresos" && item.qrStatus === "Impreso");

      return matchesSearch && matchesCategory && matchesStatus && matchesTab;
    });
  }, [searchTerm, categoryFilter, statusFilter, activeTab]);

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredItems.map((i) => i.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handlePrintBatch = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link to="/bienes/entradas" className="hover:underline text-slate-600">Bienes</Link>
            <span>/</span>
            <span className="font-semibold text-slate-800">Gestión de Etiquetas QR</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <QrCode className="text-blue-600" size={28} weight="duotone" />
            Inventario de Códigos QR
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Gestione, verifique y exporte las etiquetas físicas de trazabilidad QR de los activos de Incalpaca.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handlePrintBatch}
            disabled={selectedIds.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
          >
            <Printer size={18} />
            Imprimir Selección ({selectedIds.length})
          </button>

          <button
            type="button"
            onClick={handlePrintBatch}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm transition-all"
          >
            <FilePdf size={18} className="text-red-600" />
            Exportar Lote PDF
          </button>

          <Link
            to="/bienes/entradas/nueva"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-900 rounded-lg hover:bg-blue-800 shadow-md transition-all"
          >
            <Plus size={18} />
            Nuevo Registro y QR
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6 text-sm font-medium">
        <button
          type="button"
          onClick={() => setActiveTab("todos")}
          className={`pb-3 border-b-2 transition-colors ${
            activeTab === "todos"
              ? "border-blue-700 text-blue-900 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Todos los QR ({mockQrItems.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("pendientes")}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === "pendientes"
              ? "border-blue-700 text-blue-900 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Clock size={16} className="text-amber-600" />
          Pendientes de Impresión ({mockQrItems.filter((i) => i.qrStatus === "Pendiente").length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("impresos")}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === "impresos"
              ? "border-blue-700 text-blue-900 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <CheckCircle size={16} className="text-emerald-600" />
          Impresos y Verificados ({mockQrItems.filter((i) => i.qrStatus === "Impreso").length})
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col lg:flex-row gap-4 items-end">
        <div className="flex-1 w-full">
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Búsqueda Rápida
          </label>
          <div className="relative">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por código (INC-BIEN-...), descripción o ubicación..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>

        <div className="w-full lg:w-48">
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Categoría
          </label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full py-2 px-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="Todos">Todas las categorías</option>
            <option value="Cómputo">Cómputo</option>
            <option value="Maquinaria">Maquinaria</option>
            <option value="Mobiliario">Mobiliario</option>
          </select>
        </div>

        <div className="w-full lg:w-48">
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Estado Etiqueta QR
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full py-2 px-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="Todos">Todos los estados</option>
            <option value="Impreso">Impreso</option>
            <option value="Pendiente">Pendiente</option>
            <option value="Dañado">Dañado / Reemplazar</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleSelectAll}
            className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors h-[38px]"
          >
            {selectedIds.length === filteredItems.length && filteredItems.length > 0
              ? "Deseleccionar todo"
              : "Seleccionar todo"}
          </button>
        </div>
      </div>

      {/* Grid of QR Asset Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.map((item) => {
          const isSelected = selectedIds.includes(item.id);

          return (
            <div
              key={item.id}
              className={`bg-white border rounded-xl p-4 shadow-sm transition-all hover:shadow-md flex gap-4 relative ${
                isSelected ? "border-blue-600 ring-2 ring-blue-100 bg-blue-50/20" : "border-slate-200"
              }`}
            >
              {/* QR Image Box */}
              <div className="flex-shrink-0 flex flex-col items-center justify-between">
                <div className="w-28 h-28 bg-white p-2 border border-slate-200 rounded-lg shadow-inner flex items-center justify-center">
                  <QrCodeDataUrl code={item.code} />
                </div>
                <div className="mt-2 flex gap-1">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    title="Imprimir Etiqueta"
                    className="p-1.5 rounded bg-slate-100 text-slate-700 hover:bg-blue-600 hover:text-white transition-colors"
                  >
                    <Printer size={16} />
                  </button>
                  <button
                    type="button"
                    title="Regenerar QR"
                    className="p-1.5 rounded bg-slate-100 text-slate-700 hover:bg-blue-600 hover:text-white transition-colors"
                  >
                    <ArrowClockwise size={16} />
                  </button>
                  <Link
                    to={`/q/${item.code}`}
                    target="_blank"
                    title="Vista pública del QR"
                    className="p-1.5 rounded bg-slate-100 text-slate-700 hover:bg-blue-600 hover:text-white transition-colors"
                  >
                    <ShareNetwork size={16} />
                  </Link>
                </div>
              </div>

              {/* Asset Info */}
              <div className="flex-1 flex flex-col min-w-0">
                <div className="flex justify-between items-start mb-1">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                      item.qrStatus === "Impreso"
                        ? "bg-emerald-100 text-emerald-800"
                        : item.qrStatus === "Pendiente"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {item.qrStatus === "Impreso" && <CheckCircle size={12} className="mr-1" />}
                    {item.qrStatus === "Pendiente" && <Clock size={12} className="mr-1" />}
                    {item.qrStatus === "Dañado" && <Warning size={12} className="mr-1" />}
                    {item.qrStatus}
                  </span>

                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(item.id)}
                    className="rounded border-slate-300 text-blue-700 focus:ring-blue-600 w-4 h-4 cursor-pointer"
                  />
                </div>

                <Link
                  to={`/bienes/${item.id}`}
                  className="font-bold text-slate-900 hover:text-blue-700 truncate text-base transition-colors"
                >
                  {item.code}
                </Link>
                <p className="text-xs text-slate-600 line-clamp-2 mt-0.5 font-medium">
                  {item.description}
                </p>

                <div className="mt-auto pt-3 border-t border-slate-100 space-y-1 text-xs text-slate-500">
                  <div className="flex items-center gap-1.5 truncate">
                    <MapPin size={14} className="text-slate-400 flex-shrink-0" />
                    <span className="truncate">{item.location}</span>
                  </div>
                  <div className="flex items-center gap-1.5 truncate">
                    <User size={14} className="text-slate-400 flex-shrink-0" />
                    <span className="truncate">{item.assignedTo}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                    <span>Categoría: {item.category}</span>
                    <span>{item.date}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredItems.length === 0 && (
        <div className="text-center py-12 bg-white border border-slate-200 rounded-xl">
          <QrCode size={48} className="mx-auto text-slate-300 mb-3" />
          <h3 className="text-base font-semibold text-slate-800">No se encontraron etiquetas QR</h3>
          <p className="text-sm text-slate-500 mt-1">Pruebe ajustando los filtros de búsqueda o categoría.</p>
        </div>
      )}
    </div>
  );
}
