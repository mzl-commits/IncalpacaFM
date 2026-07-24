import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  QrCode,
  Printer,
  PencilSimple,
  Warning,
  DownloadSimple,
  MapPin,
  User,
  CheckCircle,
  FileText,
  ShareNetwork,
  ClockCounterClockwise,
  ArrowLeft,
  Package,
  X,
  Check,
  FloppyDisk,
} from "@phosphor-icons/react";
import QRCode from "qrcode";

interface AssetDetail {
  id: string;
  code: string;
  description: string;
  category: string;
  brand: string;
  model: string;
  serialNumber: string;
  entryDate: string;
  entryType: string;
  invoiceNumber: string;
  supplier: string;
  cost: string;
  conservationStatus: "Excelente" | "Bueno" | "Regular" | "Malo";
  lifecycleStatus: "Activo en Uso" | "En Almacén" | "En Mantenimiento" | "Dado de Baja";
  location: {
    site: string;
    building: string;
    room: string;
  };
  custodian: {
    name: string;
    role: string;
    department: string;
    assignedDate: string;
  };
  history: Array<{
    date: string;
    type: string;
    title: string;
    actor: string;
    description: string;
  }>;
  documents: Array<{
    title: string;
    type: string;
    size: string;
  }>;
}

const mockAssetDetail: AssetDetail = {
  id: "1",
  code: "INC-BIEN-2026-001245",
  description: "Laptop Lenovo ThinkPad T14 Gen 4 Intel Core i7 16GB RAM 512GB SSD",
  category: "Equipos de Cómputo",
  brand: "Lenovo",
  model: "ThinkPad T14 Gen 4",
  serialNumber: "PF-49X82Z-2026",
  entryDate: "24 de Julio de 2026",
  entryType: "Compra Directa",
  invoiceNumber: "F001-00049281",
  supplier: "Lenovo Perú S.A.",
  cost: "S/. 4,850.00",
  conservationStatus: "Excelente",
  lifecycleStatus: "Activo en Uso",
  location: {
    site: "Sede Principal Arequipa",
    building: "Edificio Corporativo - Piso 4",
    room: "Área de Facility Management & Operaciones",
  },
  custodian: {
    name: "Juan Pérez Solís",
    role: "Analista de Infraestructura",
    department: "Facility Management",
    assignedDate: "24 de Julio de 2026",
  },
  history: [
    {
      date: "24 Jul 2026 - 10:15 AM",
      type: "Ingreso",
      title: "Registro de Entrada y Código QR Generado",
      actor: "Ana Torres (Recepcionista Almacén)",
      description: "Se registró el bien mediante Factura F001-00049281 y se emitió la etiqueta QR oficial INC-BIEN-2026-001245.",
    },
    {
      date: "24 Jul 2026 - 11:30 AM",
      type: "Asignación",
      title: "Asignación Oficial de Activo",
      actor: "Marco Quispe (Planner FM)",
      description: "Entrega del bien con acta firmada a Juan Pérez Solís para trabajo remoto e instalaciones.",
    },
    {
      date: "24 Jul 2026 - 12:00 PM",
      type: "Verificación",
      title: "Verificación Física de QR",
      actor: "Juan Pérez Solís",
      description: "Confirmación de lectura del código QR escaneado en aplicación móvil.",
    },
  ],
  documents: [
    { title: "Factura_Compra_F001-00049281.pdf", type: "PDF", size: "1.2 MB" },
    { title: "Guia_Remision_004-192.pdf", type: "PDF", size: "480 KB" },
    { title: "Acta_Entrega_Firmada.pdf", type: "PDF", size: "850 KB" },
    { title: "Poliza_Garantia_Lenovo.pdf", type: "PDF", size: "2.1 MB" },
  ],
};

export function AssetDetailPage() {
  const { id } = useParams();
  const [asset, setAsset] = useState<AssetDetail>(mockAssetDetail);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [showToast, setShowToast] = useState<boolean>(false);

  // Form State for Editing
  const [formData, setFormData] = useState({
    description: asset.description,
    category: asset.category,
    brand: asset.brand,
    model: asset.model,
    serialNumber: asset.serialNumber,
    conservationStatus: asset.conservationStatus,
    lifecycleStatus: asset.lifecycleStatus,
    site: asset.location.site,
    building: asset.location.building,
    room: asset.location.room,
    custodianName: asset.custodian.name,
    custodianRole: asset.custodian.role,
  });

  useEffect(() => {
    QRCode.toDataURL(`https://incalpaca.fm/q/${asset.code}`, { width: 220, margin: 1 })
      .then(setQrDataUrl)
      .catch((err) => console.error("Error generating QR:", err));
  }, [asset.code]);

  const handleOpenEdit = () => {
    setFormData({
      description: asset.description,
      category: asset.category,
      brand: asset.brand,
      model: asset.model,
      serialNumber: asset.serialNumber,
      conservationStatus: asset.conservationStatus,
      lifecycleStatus: asset.lifecycleStatus,
      site: asset.location.site,
      building: asset.location.building,
      room: asset.location.room,
      custodianName: asset.custodian.name,
      custodianRole: asset.custodian.role,
    });
    setIsEditing(true);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();

    const nowStr = new Date().toLocaleString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const updatedAsset: AssetDetail = {
      ...asset,
      description: formData.description,
      category: formData.category,
      brand: formData.brand,
      model: formData.model,
      serialNumber: formData.serialNumber,
      conservationStatus: formData.conservationStatus as any,
      lifecycleStatus: formData.lifecycleStatus as any,
      location: {
        site: formData.site,
        building: formData.building,
        room: formData.room,
      },
      custodian: {
        ...asset.custodian,
        name: formData.custodianName,
        role: formData.custodianRole,
      },
      history: [
        {
          date: nowStr,
          type: "Edición",
          title: "Actualización de Ficha de Activo",
          actor: "Facility Management (Administrador)",
          description: "Se modificaron los datos generales, estado o asignación del activo en el sistema.",
        },
        ...asset.history,
      ],
    };

    setAsset(updatedAsset);
    setIsEditing(false);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 4000);
  };

  return (
    <div className="space-y-6 relative">
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-900 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-emerald-700 animate-bounce">
          <CheckCircle size={22} className="text-emerald-400" />
          <div>
            <p className="font-bold text-sm">¡Activo actualizado!</p>
            <p className="text-xs text-emerald-200">Los cambios han sido guardados correctamente.</p>
          </div>
        </div>
      )}

      {/* Navigation Breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link to="/bienes/entradas" className="hover:underline flex items-center gap-1 text-slate-600">
              <ArrowLeft size={14} /> Bienes
            </Link>
            <span>/</span>
            <Link to="/bienes/qr" className="hover:underline text-slate-600">Inventario QR</Link>
            <span>/</span>
            <span className="font-semibold text-slate-800">{asset.code}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 font-mono tracking-tight">{asset.code}</h1>
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${
                asset.lifecycleStatus === "Activo en Uso"
                  ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                  : asset.lifecycleStatus === "En Mantenimiento"
                  ? "bg-amber-100 text-amber-800 border-amber-200"
                  : "bg-slate-100 text-slate-800 border-slate-200"
              }`}
            >
              <CheckCircle size={14} className="mr-1" />
              {asset.lifecycleStatus}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm transition-all"
          >
            <Printer size={18} />
            Imprimir Ficha
          </button>
          <button
            type="button"
            onClick={handleOpenEdit}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-blue-900 bg-blue-50 border border-blue-300 rounded-lg hover:bg-blue-100 shadow-sm transition-all"
          >
            <PencilSimple size={18} className="text-blue-700" />
            Editar Activo
          </button>
          <Link
            to="/incidencias"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-800 bg-amber-50 border border-amber-300 rounded-lg hover:bg-amber-100 shadow-sm transition-all"
          >
            <Warning size={18} />
            Reportar Incidencia
          </Link>
        </div>
      </div>

      {/* Main Details Layout (Grid 3 Columns: 2 cols main, 1 col QR/Status sidebar) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content (2 Columns) */}
        <div className="lg:col-span-2 space-y-6">
          {/* General Information Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Package size={20} className="text-blue-700" />
                Información General del Activo
              </h2>
              <button
                type="button"
                onClick={handleOpenEdit}
                className="text-xs text-blue-700 hover:underline flex items-center gap-1 font-semibold"
              >
                <PencilSimple size={14} /> Modificar
              </button>
            </div>

            <p className="text-base font-semibold text-slate-800 leading-snug">
              {asset.description}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm pt-2">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="block text-xs text-slate-500 font-medium">Categoría</span>
                <span className="font-semibold text-slate-900">{asset.category}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="block text-xs text-slate-500 font-medium">Marca / Modelo</span>
                <span className="font-semibold text-slate-900">{asset.brand} - {asset.model}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="block text-xs text-slate-500 font-medium">Número de Serie</span>
                <span className="font-semibold font-mono text-slate-900">{asset.serialNumber}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="block text-xs text-slate-500 font-medium">Estado de Conservación</span>
                <span className="font-semibold text-emerald-700">{asset.conservationStatus}</span>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-slate-500 block">Fecha de Ingreso</span>
                <span className="font-medium text-slate-900">{asset.entryDate}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Modalidad de Entrada</span>
                <span className="font-medium text-slate-900">{asset.entryType}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Proveedor / Factura</span>
                <span className="font-medium text-slate-900">{asset.supplier} ({asset.invoiceNumber})</span>
              </div>
            </div>
          </div>

          {/* Location and Custodian Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <MapPin size={20} className="text-blue-700" />
                Ubicación y Asignación Actual
              </h2>
              <button
                type="button"
                onClick={handleOpenEdit}
                className="text-xs text-blue-700 hover:underline flex items-center gap-1 font-semibold"
              >
                <PencilSimple size={14} /> Cambiar Asignación
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ubicación Física</h3>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-50 text-blue-700 rounded-lg">
                    <MapPin size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{asset.location.site}</p>
                    <p className="text-xs text-slate-600">{asset.location.building}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{asset.location.room}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Responsable / Custodio</h3>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-50 text-blue-700 rounded-lg">
                    <User size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{asset.custodian.name}</p>
                    <p className="text-xs text-slate-600">{asset.custodian.role}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Asignado el: {asset.custodian.assignedDate}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Lifecycle & Event History Timeline */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <ClockCounterClockwise size={20} className="text-blue-700" />
              Historial y Trazabilidad del Ciclo de Vida
            </h2>

            <div className="relative border-l-2 border-slate-200 ml-3 space-y-6 pt-2">
              {asset.history.map((event, idx) => (
                <div key={idx} className="relative pl-6">
                  <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-blue-700 border-4 border-white ring-2 ring-blue-100" />
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <h4 className="text-sm font-bold text-slate-900">{event.title}</h4>
                    <span className="text-xs font-mono text-slate-400">{event.date}</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">{event.description}</p>
                  <span className="inline-block text-[11px] text-slate-400 mt-1 font-medium">
                    Por: {event.actor}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar Column (QR Code & Documents) */}
        <div className="space-y-6">
          {/* QR Code Identification Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm text-center space-y-4">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center justify-center gap-2">
              <QrCode size={20} className="text-blue-700" />
              Etiqueta de Identificación QR
            </h3>

            <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl inline-block shadow-inner">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt={`QR Code ${asset.code}`} className="w-48 h-48 mx-auto object-contain" />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center text-slate-400 text-xs">Cargando...</div>
              )}
            </div>

            <div>
              <p className="font-mono text-lg font-bold text-slate-900">{asset.code}</p>
              <p className="text-xs text-slate-500 mt-0.5">SGTB Incalpaca Unique Identifier</p>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="w-full py-2 px-4 text-xs font-bold text-white bg-blue-900 hover:bg-blue-800 rounded-lg shadow-sm flex items-center justify-center gap-2 transition-all"
              >
                <Printer size={16} />
                Imprimir Etiqueta Adhesiva
              </button>

              <a
                href={qrDataUrl}
                download={`${asset.code}-QR.png`}
                className="w-full py-2 px-4 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center gap-2 transition-all"
              >
                <DownloadSimple size={16} />
                Descargar PNG (Alta Resolución)
              </a>

              <Link
                to={`/q/${asset.code}`}
                target="_blank"
                className="w-full py-2 px-4 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center justify-center gap-2 transition-all"
              >
                <ShareNetwork size={16} />
                Ver Vista Pública (Escaneo QR)
              </Link>
            </div>
          </div>

          {/* Documents Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
              <FileText size={18} className="text-blue-700" />
              Documentos Adjuntos ({asset.documents.length})
            </h3>

            <div className="space-y-2">
              {asset.documents.map((doc, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileText size={16} className="text-red-600 flex-shrink-0" />
                    <span className="font-medium text-slate-800 truncate">{doc.title}</span>
                  </div>
                  <span className="text-[11px] text-slate-400 ml-2">{doc.size}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* EDIT ASSET MODAL */}
      {isEditing && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PencilSimple size={22} className="text-blue-400" />
                <h3 className="font-bold text-lg">Editar Activo {asset.code}</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Descripción / Nombre del Activo
                </label>
                <textarea
                  rows={2}
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Categoría</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full p-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  >
                    <option value="Equipos de Cómputo">Equipos de Cómputo</option>
                    <option value="Maquinaria Industrial">Maquinaria Industrial</option>
                    <option value="Mobiliario de Oficina">Mobiliario de Oficina</option>
                    <option value="Herramientas">Herramientas</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Marca</label>
                  <input
                    type="text"
                    required
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full p-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Modelo</label>
                  <input
                    type="text"
                    required
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className="w-full p-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Número de Serie</label>
                  <input
                    type="text"
                    required
                    value={formData.serialNumber}
                    onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                    className="w-full p-2.5 text-sm border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Estado de Conservación
                  </label>
                  <select
                    value={formData.conservationStatus}
                    onChange={(e) => setFormData({ ...formData, conservationStatus: e.target.value as any })}
                    className="w-full p-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  >
                    <option value="Excelente">Excelente</option>
                    <option value="Bueno">Bueno</option>
                    <option value="Regular">Regular</option>
                    <option value="Malo">Malo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Estado del Ciclo de Vida
                  </label>
                  <select
                    value={formData.lifecycleStatus}
                    onChange={(e) => setFormData({ ...formData, lifecycleStatus: e.target.value as any })}
                    className="w-full p-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  >
                    <option value="Activo en Uso">Activo en Uso</option>
                    <option value="En Almacén">En Almacén</option>
                    <option value="En Mantenimiento">En Mantenimiento</option>
                    <option value="Dado de Baja">Dado de Baja</option>
                  </select>
                </div>
              </div>

              {/* Location & Custodian Section */}
              <div className="border-t border-slate-200 pt-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ubicación y Responsable</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Sede</label>
                    <input
                      type="text"
                      value={formData.site}
                      onChange={(e) => setFormData({ ...formData, site: e.target.value })}
                      className="w-full p-2 text-xs border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Edificio / Piso</label>
                    <input
                      type="text"
                      value={formData.building}
                      onChange={(e) => setFormData({ ...formData, building: e.target.value })}
                      className="w-full p-2 text-xs border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Área / Oficina</label>
                    <input
                      type="text"
                      value={formData.room}
                      onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                      className="w-full p-2 text-xs border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Nombre Custodio</label>
                    <input
                      type="text"
                      value={formData.custodianName}
                      onChange={(e) => setFormData({ ...formData, custodianName: e.target.value })}
                      className="w-full p-2 text-xs border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Cargo Custodio</label>
                    <input
                      type="text"
                      value={formData.custodianRole}
                      onChange={(e) => setFormData({ ...formData, custodianRole: e.target.value })}
                      className="w-full p-2 text-xs border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="border-t border-slate-200 pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-900 hover:bg-blue-800 rounded-lg shadow-md flex items-center gap-1.5 transition-all"
                >
                  <FloppyDisk size={16} />
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
