import {
  ArrowLeft,
  ArrowsClockwise,
  Barcode,
  Check,
  Info,
  LinkSimple,
  MagnifyingGlass,
  Package,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import axios from "axios";
import { useDeferredValue, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { TaxonomySectionNav } from "../components/TaxonomySectionNav";
import { useFmCodeAssets, useIssueFmCode } from "../fmCodeQueries";
import { useTaxonomyCatalog } from "../taxonomyQueries";
import type { FmCodeAsset, TaxonomyRecord } from "../types";

const EMPTY_ASSETS: FmCodeAsset[] = [];
const EMPTY_TAXONOMIES: TaxonomyRecord[] = [];
const PENDING_PAGE_SIZE = 100;
const collator = new Intl.Collator("es-PE", { numeric: true, sensitivity: "base" });

function apiErrorMessage(error: unknown) {
  if (!axios.isAxiosError(error)) return "No se pudo asignar el código FM. Inténtalo nuevamente.";
  const data = error.response?.data;
  if (typeof data === "string") return data;
  if (data && typeof data === "object") {
    const record = data as Record<string, string | string[]>;
    const value = record.taxonomy_id ?? record.detail ?? Object.values(record)[0];
    if (Array.isArray(value)) return value[0] ?? "No se pudo asignar el código FM.";
    if (typeof value === "string") return value;
  }
  return "No se pudo asignar el código FM. Verifica la conexión e inténtalo nuevamente.";
}

export function FmCodeAssignPage() {
  const navigate = useNavigate();
  const [pendingSearch, setPendingSearch] = useState("");
  const deferredSearch = useDeferredValue(pendingSearch.trim());
  const assetsQuery = useFmCodeAssets({
    state: "pending",
    search: deferredSearch,
    page: 1,
    pageSize: PENDING_PAGE_SIZE,
    ordering: "code",
  });
  const taxonomiesQuery = useTaxonomyCatalog({
    active: "true",
    reviewStatus: "VALIDATED",
    issuanceEnabled: "true",
  });
  const issueMutation = useIssueFmCode();
  const [assetId, setAssetId] = useState("");
  const [taxonomyId, setTaxonomyId] = useState("");
  const [submitError, setSubmitError] = useState("");
  const pendingPage = assetsQuery.data;
  const searchBusy = deferredSearch !== pendingSearch.trim() || assetsQuery.isFetching;
  const assets = searchBusy ? EMPTY_ASSETS : (pendingPage?.items ?? EMPTY_ASSETS);
  const taxonomies = taxonomiesQuery.data ?? EMPTY_TAXONOMIES;
  const availableAssets = useMemo(
    () =>
      assets
        .filter((asset) => !asset.fmCode)
        .sort((left, right) => collator.compare(left.technicalCode, right.technicalCode)),
    [assets],
  );
  const availableTaxonomies = useMemo(
    () =>
      taxonomies
        .filter(
          (taxonomy) =>
            taxonomy.active && taxonomy.issuanceEnabled && taxonomy.reviewStatus === "VALIDATED",
        )
        .sort((left, right) => collator.compare(left.prefix, right.prefix)),
    [taxonomies],
  );
  const selectedAsset = availableAssets.find((asset) => asset.id === assetId);
  const selectedTaxonomy = availableTaxonomies.find((taxonomy) => taxonomy.id === taxonomyId);
  const loading = assetsQuery.isPending || taxonomiesQuery.isPending;
  const loadError = assetsQuery.isError || taxonomiesQuery.isError;
  const noPendingAssets = !pendingSearch.trim() && !searchBusy && pendingPage?.count === 0;
  const noSearchResults = Boolean(pendingSearch.trim()) && !searchBusy && pendingPage?.count === 0;

  function updatePendingSearch(value: string) {
    setPendingSearch(value);
    setAssetId("");
    setSubmitError("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!assetId || !taxonomyId) return;
    setSubmitError("");
    try {
      const result = await issueMutation.mutateAsync({ assetId, taxonomyId });
      navigate(
        {
          pathname: "/administracion/taxonomia/codigos",
          search: `?taxonomy=${encodeURIComponent(taxonomyId)}`,
        },
        {
          replace: true,
          state: {
            message: `Código ${result.fmCode ?? "FM"} asignado correctamente a ${result.name}.`,
          },
        },
      );
    } catch (error) {
      setSubmitError(apiErrorMessage(error));
    }
  }

  return (
    <section className="taxonomy-form-page fm-code-assign-page">
      <TaxonomySectionNav />
      <div className="wizard-heading fm-code-assign-heading">
        <Link className="back-link" to="/administracion/taxonomia/codigos">
          <ArrowLeft /> Volver a códigos FM
        </Link>
        <div>
          <div>
            <p className="breadcrumb">Administración / Taxonomía / Códigos FM</p>
            <h1>Asignar código FM</h1>
            <p>Vincula un bien existente con una clasificación emisora.</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="taxonomy-form-loading fm-code-form-loading" aria-busy="true">
          <span />
          <span />
          <span />
          <span className="sr-only">Cargando bienes y clasificaciones</span>
        </div>
      ) : loadError ? (
        <section className="taxonomy-state-panel" role="alert">
          <WarningCircle size={34} weight="duotone" />
          <strong>No se pudo preparar la asignación</strong>
          <p>Se necesitan los bienes y el catálogo vigente antes de emitir un código.</p>
          <button
            className="button button-secondary"
            type="button"
            onClick={() => {
              void assetsQuery.refetch();
              void taxonomiesQuery.refetch();
            }}
          >
            <ArrowsClockwise /> Reintentar
          </button>
        </section>
      ) : noPendingAssets ? (
        <section className="taxonomy-state-panel">
          <Check size={34} weight="bold" />
          <strong>Todos los bienes ya tienen código FM</strong>
          <p>
            No hay registros pendientes de clasificación. Puedes consultar los códigos existentes.
          </p>
          <Link className="button button-secondary" to="/administracion/taxonomia/codigos">
            Ver códigos FM
          </Link>
        </section>
      ) : !availableTaxonomies.length ? (
        <section className="taxonomy-state-panel">
          <WarningCircle size={34} weight="duotone" />
          <strong>No hay clasificaciones habilitadas</strong>
          <p>Activa y valida una taxonomía antes de asignar códigos FM.</p>
          <Link className="button button-secondary" to="/administracion/taxonomia">
            Revisar clasificaciones
          </Link>
        </section>
      ) : (
        <div className="taxonomy-form-layout fm-code-assign-layout">
          <form className="form-panel taxonomy-form fm-code-assign-form" onSubmit={submit}>
            <section>
              <header>
                <span>Bien de destino</span>
                <h2>Selecciona el registro pendiente</h2>
                <p>Solo aparecen bienes que todavía no tienen identificador operativo.</p>
              </header>

              <div className="fm-code-pending-search">
                <label htmlFor="fm-code-pending-search">Buscar bien pendiente</label>
                <div>
                  <MagnifyingGlass size={19} aria-hidden="true" />
                  <input
                    id="fm-code-pending-search"
                    type="search"
                    value={pendingSearch}
                    onChange={(event) => updatePendingSearch(event.target.value)}
                    placeholder="ID técnico, nombre, marca o modelo"
                    autoComplete="off"
                    aria-describedby="fm-code-pending-search-help"
                  />
                  {pendingSearch && (
                    <button
                      type="button"
                      onClick={() => updatePendingSearch("")}
                      aria-label="Limpiar búsqueda de bienes"
                    >
                      <X size={17} />
                    </button>
                  )}
                </div>
                <small id="fm-code-pending-search-help" aria-live="polite">
                  {searchBusy
                    ? "Buscando bienes pendientes…"
                    : `${pendingPage?.count ?? 0} ${pendingPage?.count === 1 ? "bien disponible" : "bienes disponibles"}`}
                  {(pendingPage?.count ?? 0) > PENDING_PAGE_SIZE &&
                    ` · Se muestran los primeros ${PENDING_PAGE_SIZE}; usa la búsqueda para precisar.`}
                </small>
              </div>

              <label className="field field-wide" htmlFor="fm-code-asset">
                <span>
                  Bien sin código FM <b aria-hidden="true">*</b>
                </span>
                <select
                  id="fm-code-asset"
                  value={assetId}
                  onChange={(event) => setAssetId(event.target.value)}
                  required
                  disabled={searchBusy || noSearchResults}
                >
                  <option value="">
                    {searchBusy
                      ? "Actualizando resultados…"
                      : noSearchResults
                        ? "No hay coincidencias"
                        : "Selecciona un bien"}
                  </option>
                  {availableAssets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.technicalCode} — {asset.name}
                    </option>
                  ))}
                </select>
              </label>

              {noSearchResults && (
                <div className="fm-code-pending-empty" role="status">
                  <Package size={22} weight="duotone" />
                  <span>
                    <strong>No hay bienes pendientes que coincidan</strong>
                    <small>Prueba con otro ID técnico, nombre, marca o modelo.</small>
                  </span>
                  <button type="button" onClick={() => updatePendingSearch("")}>
                    Restablecer búsqueda
                  </button>
                </div>
              )}

              {selectedAsset && (
                <dl className="fm-code-selection-summary" aria-live="polite">
                  <div>
                    <dt>ID técnico</dt>
                    <dd>{selectedAsset.technicalCode}</dd>
                  </div>
                  <div>
                    <dt>Bien</dt>
                    <dd>{selectedAsset.name}</dd>
                  </div>
                  <div>
                    <dt>Marca / modelo</dt>
                    <dd>
                      {[selectedAsset.brand, selectedAsset.model].filter(Boolean).join(" · ") ||
                        "No registrado"}
                    </dd>
                  </div>
                </dl>
              )}
            </section>

            <section>
              <header>
                <span>Clasificación emisora</span>
                <h2>Elige el prefijo correcto</h2>
                <p>La clasificación define el prefijo y conserva su propia secuencia histórica.</p>
              </header>
              <label className="field field-wide" htmlFor="fm-code-taxonomy">
                <span>
                  Taxonomía habilitada <b aria-hidden="true">*</b>
                </span>
                <select
                  id="fm-code-taxonomy"
                  value={taxonomyId}
                  onChange={(event) => setTaxonomyId(event.target.value)}
                  required
                >
                  <option value="">Selecciona una clasificación</option>
                  {availableTaxonomies.map((taxonomy) => (
                    <option key={taxonomy.id} value={taxonomy.id}>
                      {taxonomy.prefix} — {taxonomy.name}
                    </option>
                  ))}
                </select>
              </label>
              {selectedTaxonomy && (
                <dl className="fm-code-selection-summary" aria-live="polite">
                  <div>
                    <dt>Prefijo</dt>
                    <dd>{selectedTaxonomy.prefix}</dd>
                  </div>
                  <div>
                    <dt>Clasificación</dt>
                    <dd>{selectedTaxonomy.name}</dd>
                  </div>
                  <div>
                    <dt>Jerarquía</dt>
                    <dd>
                      {selectedTaxonomy.category} / {selectedTaxonomy.subcategory}
                    </dd>
                  </div>
                </dl>
              )}
            </section>

            <section className="fm-code-confirm-section">
              <header>
                <span>Confirmación</span>
                <h2>Revisa el código previsto</h2>
              </header>
              <div className="fm-code-issued-preview" aria-live="polite">
                <Barcode size={27} weight="duotone" />
                <span>
                  <small>Siguiente código disponible</small>
                  <output>
                    {selectedTaxonomy?.nextCodePreview ?? "Selecciona una clasificación"}
                  </output>
                </span>
              </div>
              <p className="fm-code-integrity-note" id="fm-code-integrity-note">
                <Info size={19} weight="duotone" />
                <span>
                  El correlativo no se escribe manualmente. El servidor reserva el siguiente número
                  al confirmar, por lo que el código final puede avanzar si otra persona emite uno
                  al mismo tiempo.
                </span>
              </p>
            </section>

            {submitError && (
              <div className="taxonomy-form-error" role="alert">
                <WarningCircle /> {submitError}
              </div>
            )}

            <footer className="form-actions">
              <Link className="button button-secondary" to="/administracion/taxonomia/codigos">
                Cancelar
              </Link>
              <button
                className="button button-primary"
                type="submit"
                disabled={!assetId || !taxonomyId || issueMutation.isPending}
                aria-describedby="fm-code-integrity-note"
              >
                <LinkSimple />
                {issueMutation.isPending ? "Asignando código…" : "Asignar código FM"}
              </button>
            </footer>
          </form>

          <aside className="help-panel taxonomy-form-help fm-code-assign-help">
            <Info size={24} weight="duotone" />
            <h2>Integridad del código</h2>
            <ul>
              <li>
                <Check /> Siempre queda vinculado a un bien.
              </li>
              <li>
                <Check /> Usa una taxonomía activa y validada.
              </li>
              <li>
                <Check /> Nunca reutiliza correlativos anteriores.
              </li>
              <li>
                <Check /> No reemplaza el ID técnico ni el QR.
              </li>
            </ul>
            <p>
              Si la clasificación aún no es segura, vuelve al bien y conserva su estado pendiente en
              lugar de emitir un código incorrecto.
            </p>
            {selectedAsset && (
              <Link className="fm-code-context-link" to={`/bienes/${selectedAsset.id}`}>
                <Package /> Abrir detalle del bien
              </Link>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}
