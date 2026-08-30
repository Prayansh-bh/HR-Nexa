import React, { useState } from "react";
import { Edit, Loader2, Info } from "lucide-react";
import { ModalShell, Field, Btn, inputCls, dateInputProps } from "../../../components/ui";
import { useUpdateAssetMutation } from "../../../hooks/useAssetsQuery";
import { AssetRecord } from "../../../services/asset.service";

interface EditAssetModalProps {
  asset: AssetRecord;
  onClose: () => void;
  onSuccess?: () => void;
  toast?: (msg: string, tone?: "success" | "error" | "info") => void;
}

const CATEGORIES = [
  "Laptop",
  "Desktop",
  "Monitor",
  "Keyboard/Mouse",
  "Mobile Phone",
  "Tablet",
  "Headset",
  "Networking",
  "Printer",
  "Server",
  "Furniture",
  "Vehicle",
  "Other",
];

const CONDITIONS = ["New", "Good", "Fair", "Damaged"];

export function EditAssetModal({ asset, onClose, onSuccess, toast }: EditAssetModalProps) {
  const [formData, setFormData] = useState({
    name: asset.name || "",
    type: asset.category || asset.type || "Laptop",
    assetTag: asset.assetTag || "",
    brand: asset.brand || "",
    modelNumber: asset.modelNumber || "",
    serialNumber: asset.serialNumber || "",
    purchaseDate: asset.purchaseDate ? asset.purchaseDate.split("T")[0] : "",
    purchaseCost: asset.purchaseCost !== undefined ? String(asset.purchaseCost) : "",
    currency: asset.currency || "USD",
    warrantyExpiry: asset.warrantyExpiry ? asset.warrantyExpiry.split("T")[0] : "",
    vendor: asset.vendor || "",
    condition: asset.condition || "Good",
    invoiceUrl: asset.invoiceUrl || "",
    notes: asset.notes || "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const updateMutation = useUpdateAssetMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};

    if (!formData.name.trim()) errs.name = "Asset name is required";
    if (!formData.type.trim()) errs.type = "Category/type is required";
    if (formData.purchaseCost && isNaN(Number(formData.purchaseCost))) {
      errs.purchaseCost = "Must be a valid numeric amount";
    }

    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    try {
      await updateMutation.mutateAsync({
        id: asset.id,
        payload: {
          name: formData.name.trim(),
          type: formData.type.trim(),
          assetTag: formData.assetTag.trim() || undefined,
          brand: formData.brand.trim() || undefined,
          modelNumber: formData.modelNumber.trim() || undefined,
          serialNumber: formData.serialNumber.trim() || undefined,
          purchaseDate: formData.purchaseDate ? new Date(formData.purchaseDate).toISOString() : undefined,
          purchaseCost: formData.purchaseCost ? Number(formData.purchaseCost) : undefined,
          currency: formData.currency.trim() || "USD",
          warrantyExpiry: formData.warrantyExpiry ? new Date(formData.warrantyExpiry).toISOString() : undefined,
          vendor: formData.vendor.trim() || undefined,
          condition: formData.condition,
          invoiceUrl: formData.invoiceUrl.trim() || undefined,
          notes: formData.notes.trim() || undefined,
        },
      });

      toast?.("Asset updated successfully", "success");
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast?.(err.message || "Failed to update asset", "error");
    }
  };

  return (
    <ModalShell title={`Edit Asset: ${asset.name}`} onClose={onClose} wide={true}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Asset Identification */}
        <div className="space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">
            1. Asset Identification & Hardware
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Asset Name *" error={errors.name}>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={inputCls}
              />
            </Field>

            <Field label="Category / Type *" error={errors.type}>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className={inputCls}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Asset Tag (Unique ID)">
              <input
                type="text"
                value={formData.assetTag}
                onChange={(e) => setFormData({ ...formData, assetTag: e.target.value })}
                className={inputCls}
              />
            </Field>

            <Field label="Serial Number">
              <input
                type="text"
                value={formData.serialNumber}
                onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                className={inputCls}
              />
            </Field>

            <Field label="Brand / Manufacturer">
              <input
                type="text"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                className={inputCls}
              />
            </Field>

            <Field label="Model Number">
              <input
                type="text"
                value={formData.modelNumber}
                onChange={(e) => setFormData({ ...formData, modelNumber: e.target.value })}
                className={inputCls}
              />
            </Field>
          </div>
        </div>

        {/* Section 2: Procurement & Financials */}
        <div className="space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">
            2. Procurement & Financial Information
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Vendor / Supplier">
              <input
                type="text"
                value={formData.vendor}
                onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                className={inputCls}
              />
            </Field>

            <Field label="Invoice / Receipt URL">
              <input
                type="url"
                placeholder="https://storage.company.com/invoices/inv-001.pdf"
                value={formData.invoiceUrl}
                onChange={(e) => setFormData({ ...formData, invoiceUrl: e.target.value })}
                className={inputCls}
              />
            </Field>

            <Field label="Purchase Date">
              <input
                {...dateInputProps(formData.purchaseDate, (v) =>
                  setFormData({ ...formData, purchaseDate: v })
                )}
                className={inputCls}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Date asset was purchased / invoiced
              </p>
            </Field>

            <Field label="Warranty Expiry Date">
              <input
                {...dateInputProps(formData.warrantyExpiry, (v) =>
                  setFormData({ ...formData, warrantyExpiry: v })
                )}
                className={inputCls}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Date vendor hardware warranty expires
              </p>
            </Field>

            <Field label="Purchase Cost" error={errors.purchaseCost}>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 1999.00"
                value={formData.purchaseCost}
                onChange={(e) => setFormData({ ...formData, purchaseCost: e.target.value })}
                className={inputCls}
              />
            </Field>

            <Field label="Currency">
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className={inputCls}
              >
                <option value="USD">USD ($) — US Dollar</option>
                <option value="INR">INR (₹) — Indian Rupee</option>
                <option value="EUR">EUR (€) — Euro</option>
                <option value="GBP">GBP (£) — British Pound</option>
                <option value="CAD">CAD ($) — Canadian Dollar</option>
                <option value="AUD">AUD ($) — Australian Dollar</option>
                <option value="AED">AED (د.إ) — UAE Dirham</option>
              </select>
            </Field>
          </div>
        </div>

        {/* Section 3: Condition & Specifications */}
        <div className="space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">
            3. Condition & Technical Notes
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Condition">
              <select
                value={formData.condition}
                onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                className={inputCls}
              >
                {CONDITIONS.map((cond) => (
                  <option key={cond} value={cond}>
                    {cond}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Notes / Technical Specs" className="md:col-span-2">
              <textarea
                rows={2}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className={inputCls + " min-h-[60px] py-2"}
              />
            </Field>
          </div>
        </div>

        {/* Action Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5" />
            <span>Current Status: <strong>{asset.status || "Available"}</strong></span>
          </div>
          <div className="flex gap-2">
            <Btn variant="outline" onClick={onClose} disabled={updateMutation.isPending}>
              Cancel
            </Btn>
            <Btn type="submit" variant="primary" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Edit className="h-4 w-4" />
              )}
              <span>{updateMutation.isPending ? "Saving..." : "Save Changes"}</span>
            </Btn>
          </div>
        </div>
      </form>
    </ModalShell>
  );
}
